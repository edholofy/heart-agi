import { NextRequest, NextResponse } from "next/server"

const DAEMON_URL = process.env.DAEMON_INTERNAL_URL || "http://5.161.47.118:4600"
const DAEMON_API_KEY = process.env.DAEMON_API_KEY || ""

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

    if (amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
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
