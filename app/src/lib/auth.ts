import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'humans-ai-dev-secret-change-in-production'
)

/** Extract and verify wallet address from Authorization header */
export async function getAuthAddress(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return (payload.sub as string) || null
  } catch {
    return null
  }
}
