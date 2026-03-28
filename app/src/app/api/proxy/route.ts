import { NextRequest, NextResponse } from 'next/server'

/**
 * Universal proxy for all chain/daemon HTTP calls.
 * Solves HTTPS → HTTP mixed content on production (Vercel).
 *
 * Usage:
 *   GET /api/proxy?url=/status&target=rpc
 *   GET /api/proxy?url=/heart/existence/list_tasks&target=rest
 *   GET /api/proxy?url=/api/entities&target=daemon
 *   POST /api/proxy?url=/api/faucet&target=faucet  body={...}
 */

const TARGETS: Record<string, string> = {
  rpc: process.env.HEART_RPC_INTERNAL || 'http://5.161.47.118:26657',
  rest: process.env.HEART_REST_INTERNAL || 'http://5.161.47.118:1317',
  daemon: process.env.DAEMON_INTERNAL_URL || 'http://5.161.47.118:4600',
  faucet: process.env.FAUCET_INTERNAL_URL || 'http://5.161.47.118:4500',
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || '/status'
  const target = req.nextUrl.searchParams.get('target') || 'rpc'

  const base = TARGETS[target]
  if (!base) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  try {
    const res = await fetch(`${base}${url}`, {
      headers: { 'Accept': 'application/json' },
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    })
  } catch {
    return NextResponse.json({ error: 'Target unreachable' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || '/'
  const target = req.nextUrl.searchParams.get('target') || 'rpc'

  const base = TARGETS[target]
  if (!base) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  try {
    const body = await req.text()
    const res = await fetch(`${base}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Target unreachable' }, { status: 502 })
  }
}
