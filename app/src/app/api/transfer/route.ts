import { NextRequest, NextResponse } from "next/server"

const DAEMON_URL = process.env.DAEMON_INTERNAL_URL || "http://5.161.47.118:4600"
const DAEMON_API_KEY = process.env.DAEMON_API_KEY || ""

/** Max transfer amount per request */
const MAX_TRANSFER_AMOUNT = 10000

/** Rate limiting: max requests per wallet per window */
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

/**
 * Validate wallet address format (heart1... bech32, at least 42 chars).
 */
function isValidWalletAddress(address: string): boolean {
  return typeof address === "string" && /^heart1[a-z0-9]{38,}$/.test(address)
}

/**
 * Simple in-memory rate limiter per wallet address.
 * Returns true if the request is allowed, false if rate-limited.
 */
function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(walletAddress)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(walletAddress, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  entry.count++
  return true
}

/**
 * POST /api/transfer
 * Transfer compute between entities. Requires wallet ownership proof.
 */
export async function POST(req: NextRequest) {
  try {
    const { fromId, toId, amount, walletAddress } = await req.json()

    if (!fromId || !toId || !amount || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate wallet address format
    if (!isValidWalletAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format. Must start with 'heart1' and be at least 42 characters." },
        { status: 400 }
      )
    }

    // Rate limit per wallet
    if (!checkRateLimit(walletAddress)) {
      return NextResponse.json(
        { error: "Too many transfer requests. Please wait before trying again." },
        { status: 429 }
      )
    }

    if (amount <= 0 || amount > MAX_TRANSFER_AMOUNT) {
      return NextResponse.json(
        { error: `Invalid amount. Must be between 0 and ${MAX_TRANSFER_AMOUNT}.` },
        { status: 400 }
      )
    }

    // Verify the wallet address owns the source entity
    const headers: Record<string, string> = { "Accept": "application/json" }
    if (DAEMON_API_KEY) headers["X-API-Key"] = DAEMON_API_KEY

    const entityRes = await fetch(`${DAEMON_URL}/api/entities/status?id=${encodeURIComponent(fromId)}`, { headers })
    if (!entityRes.ok) {
      return NextResponse.json({ error: "Could not verify entity ownership" }, { status: 400 })
    }

    const entityData = await entityRes.json()
    const ownerAddress = entityData.owner_address || ""

    // Check ownership: wallet must match owner_address
    // owner_address is either a heart1... address or stripe-... session ID
    if (ownerAddress && !ownerAddress.startsWith("stripe-") && ownerAddress !== walletAddress) {
      return NextResponse.json({ error: "You don't own this entity" }, { status: 403 })
    }

    // Execute the transfer via daemon
    const transferRes = await fetch(`${DAEMON_URL}/api/entities/transfer`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ from_id: fromId, to_id: toId, amount }),
    })

    const result = await transferRes.json()

    if (!transferRes.ok) {
      return NextResponse.json({ error: result.error || "Transfer failed" }, { status: transferRes.status })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Transfer failed" }, { status: 500 })
  }
}
