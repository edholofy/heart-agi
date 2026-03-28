import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'ethers'
import { SignJWT, jwtVerify } from 'jose'

/**
 * Wallet-based authentication.
 *
 * Flow:
 *   1. GET  /api/auth?address=0x... → returns a nonce to sign
 *   2. POST /api/auth { address, signature, nonce } → verifies signature, returns JWT
 *
 * The JWT is then sent as Authorization: Bearer <token> on protected routes.
 */

const JWT_SECRET_RAW = process.env.JWT_SECRET
// Warn but don't crash at build time — Vercel sets NODE_ENV=production during build
if (!JWT_SECRET_RAW && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET not set. Using dev fallback. Set JWT_SECRET in production.')
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || 'humans-ai-dev-secret-DO-NOT-USE-IN-PRODUCTION'
)

// In-memory nonce store (use Redis/DB in production)
const nonceStore = new Map<string, { nonce: string; expires: number }>()

function generateNonce(): string {
  return `Sign this message to authenticate with $HEART\n\nNonce: ${Math.random().toString(36).slice(2)}${Date.now()}`
}

/** GET /api/auth?address=0x... → returns nonce to sign */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 })
  }

  const nonce = generateNonce()
  const normalized = address.toLowerCase()

  // Store nonce with 5-minute expiry
  nonceStore.set(normalized, {
    nonce,
    expires: Date.now() + 5 * 60 * 1000,
  })

  return NextResponse.json({ nonce })
}

/** POST /api/auth { address, signature, nonce } → verify and return JWT */
export async function POST(req: NextRequest) {
  try {
    const { address, signature, nonce } = await req.json()

    if (!address || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Missing address, signature, or nonce' },
        { status: 400 }
      )
    }

    const normalized = address.toLowerCase()

    // Check nonce exists and hasn't expired
    const stored = nonceStore.get(normalized)
    if (!stored || stored.nonce !== nonce) {
      return NextResponse.json(
        { error: 'Invalid or expired nonce. Request a new one.' },
        { status: 401 }
      )
    }

    if (Date.now() > stored.expires) {
      nonceStore.delete(normalized)
      return NextResponse.json(
        { error: 'Nonce expired. Request a new one.' },
        { status: 401 }
      )
    }

    // Verify signature
    const recoveredAddress = verifyMessage(nonce, signature)
    if (recoveredAddress.toLowerCase() !== normalized) {
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      )
    }

    // Clean up nonce (single use)
    nonceStore.delete(normalized)

    // Issue JWT (24-hour expiry)
    const token = await new SignJWT({
      address: normalized,
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setSubject(normalized)
      .sign(JWT_SECRET)

    return NextResponse.json({
      token,
      address: normalized,
      expiresIn: 86400,
    })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json(
      { error: error.message || 'Auth failed' },
      { status: 500 }
    )
  }
}

/** Verify a JWT token — used by other API routes */
export async function verifyToken(
  token: string
): Promise<{ address: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { address: payload.sub as string }
  } catch {
    return null
  }
}
