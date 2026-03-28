import { NextRequest, NextResponse } from 'next/server'

const DAEMON_URL = process.env.DAEMON_INTERNAL_URL || 'http://5.161.47.118:4600'
const DAEMON_API_KEY = process.env.DAEMON_API_KEY || ''

/** Allowed daemon path prefixes */
const ALLOWED_DAEMON_PATHS = ['/api/entities', '/api/activity']

function isDaemonPathAllowed(path: string): boolean {
  return ALLOWED_DAEMON_PATHS.some(prefix => path.startsWith(prefix))
}

/** Build headers with optional daemon API key */
function buildHeaders(base: Record<string, string> = {}): Record<string, string> {
  const headers = { ...base }
  if (DAEMON_API_KEY) {
    headers['X-API-Key'] = DAEMON_API_KEY
  }
  return headers
}

/**
 * Proxy for the daemon API — solves HTTPS -> HTTP mixed content.
 *
 * GET  /api/daemon?path=/api/entities
 * POST /api/daemon?path=/api/entities/spawn  body={...}
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || '/api/entities'

  if (!isDaemonPathAllowed(path)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  try {
    const res = await fetch(`${DAEMON_URL}${path}`, {
      headers: buildHeaders({ 'Accept': 'application/json' }),
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

  if (!isDaemonPathAllowed(path)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const res = await fetch(`${DAEMON_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Daemon unreachable' }, { status: 502 })
  }
}
