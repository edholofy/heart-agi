import { NextRequest, NextResponse } from "next/server"

const CHAIN_RPC_URL =
  process.env.HEART_RPC_INTERNAL || "http://5.161.47.118:26657"

/** Safe RPC methods — blocks dangerous ones like unsafe_flush_mempool, dial_peers */
const ALLOWED_RPC_METHODS = new Set([
  "broadcast_tx_sync",
  "broadcast_tx_async",
  "broadcast_tx_commit",
  "abci_query",
  "status",
  "block",
  "blockchain",
  "block_results",
  "validators",
  "tx",
  "tx_search",
  "net_info",
  "health",
  "unconfirmed_txs",
  "num_unconfirmed_txs",
  "commit",
  "consensus_state",
])

/**
 * POST /api/chain/rpc
 *
 * Proxies CometBFT JSON-RPC requests with method allowlist.
 * Blocks dangerous RPC methods that could disrupt the chain.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Validate JSON-RPC method
    let parsed: { method?: string }
    try {
      parsed = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!parsed.method || !ALLOWED_RPC_METHODS.has(parsed.method)) {
      return NextResponse.json(
        { error: `RPC method not allowed: ${parsed.method}` },
        { status: 403 }
      )
    }

    const res = await fetch(CHAIN_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })

    const data = await res.text()

    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    })
  } catch (err) {
    console.error("[api/chain/rpc] Proxy error:", err)
    return NextResponse.json(
      { error: "Chain RPC unreachable" },
      { status: 502 }
    )
  }
}
