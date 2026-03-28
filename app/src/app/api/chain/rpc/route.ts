import { NextRequest, NextResponse } from "next/server"

const CHAIN_RPC_URL =
  process.env.HEART_RPC_INTERNAL || "http://5.161.47.118:26657"

/**
 * POST /api/chain/rpc
 *
 * Proxies CometBFT JSON-RPC requests so that CosmJS can broadcast
 * transactions from an HTTPS page without mixed-content errors.
 *
 * The browser's SigningStargateClient sends JSON-RPC bodies here;
 * we forward them to the chain node and relay the response back.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

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
