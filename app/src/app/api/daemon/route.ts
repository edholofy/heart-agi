import { NextRequest, NextResponse } from 'next/server'

const DAEMON_URL = process.env.DAEMON_INTERNAL_URL || 'http://5.161.47.118:4600'

/**
 * Proxy for the daemon API — solves HTTPS → HTTP mixed content.
 *
 * GET  /api/daemon?path=/api/entities
 * POST /api/daemon?path=/api/entities/spawn  body={...}
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || '/api/entities'

  try {
    const res = await fetch(`${DAEMON_URL}${path}`, {
      headers: { 'Accept': 'application/json' },
    })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  } catch {
    return NextResponse.json({ error: 'Daemon unreachable', entities: [], activity: [], total: 0 }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || '/api/entities/spawn'

  try {
    const body = await req.json()
    const res = await fetch(`${DAEMON_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Daemon unreachable' }, { status: 502 })
  }
}
