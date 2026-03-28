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

/** Allowed path prefixes per target — prevents open proxy abuse */
const ALLOWED_PATHS: Record<string, string[]> = {
  rpc: ['/status', '/net_info', '/blockchain', '/block', '/validators', '/abci_query', '/tx'],
  rest: ['/heart/', '/cosmos/'],
  daemon: ['/api/'],
  faucet: ['/api/faucet'],
}

const DAEMON_API_KEY = process.env.DAEMON_API_KEY || ''

function isPathAllowed(target: string, url: string): boolean {
  const allowedPrefixes = ALLOWED_PATHS[target]
  if (!allowedPrefixes) return false

  // Normalize the path to prevent traversal attacks (e.g., /heart/../../etc/passwd)
  // Reject any URL containing path traversal sequences
  if (url.includes('..') || url.includes('//') || url.includes('\\')) {
    return false
  }

  return allowedPrefixes.some(prefix => url.startsWith(prefix))
}

/** Build headers for the upstream request, including daemon API key if needed */
function buildUpstreamHeaders(target: string, base: Record<string, string> = {}): Record<string, string> {
  const headers = { ...base }
  if (target === 'daemon' && DAEMON_API_KEY) {
    headers['X-API-Key'] = DAEMON_API_KEY
  }
  return headers
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || '/status'
  const target = req.nextUrl.searchParams.get('target') || 'rpc'

  const base = TARGETS[target]
  if (!base) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  if (!isPathAllowed(target, url)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${base}${url}`, {
      headers: buildUpstreamHeaders(target, { 'Accept': 'application/json' }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 })
    }
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

  if (!isPathAllowed(target, url)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const body = await req.text()
    const res = await fetch(`${base}${url}`, {
      method: 'POST',
      headers: buildUpstreamHeaders(target, { 'Content-Type': 'application/json' }),
      body,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Target unreachable' }, { status: 502 })
  }
}
