/**
 * Proxy helper — routes all external HTTP calls through /api/proxy
 * when running on HTTPS (Vercel). Direct on localhost (HTTP).
 *
 * Includes:
 * - 8s timeout on all requests
 * - Client-side response cache (5s TTL) to reduce redundant fetches
 * - Synthetic 503 response on failure (never throws)
 */

const DIRECT_URLS: Record<string, string> = {
  rpc: process.env.NEXT_PUBLIC_HEART_RPC || "http://5.161.47.118:26657",
  rest: process.env.NEXT_PUBLIC_HEART_REST || "http://5.161.47.118:1317",
  daemon: process.env.NEXT_PUBLIC_DAEMON_URL || "http://5.161.47.118:4600",
  faucet: process.env.NEXT_PUBLIC_FAUCET_URL || "http://5.161.47.118:4500",
}

function isHTTPS(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:"
}

/** Client-side cache — serves stale data while refetching */
const cache = new Map<string, { data: string; timestamp: number; status: number }>()
const CACHE_TTL = 5000 // 5 seconds

function getCached(key: string): Response | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) return null
  return new Response(entry.data, {
    status: entry.status,
    headers: { "Content-Type": "application/json" },
  })
}

async function setCache(key: string, res: Response): Promise<Response> {
  const text = await res.text()
  cache.set(key, { data: text, timestamp: Date.now(), status: res.status })
  // Return a new Response since we consumed the body
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function proxyFetch(
  path: string,
  target: "rpc" | "rest" | "daemon" | "faucet",
  options?: RequestInit
): Promise<Response> {
  const method = options?.method || "GET"
  const isRead = method === "GET"

  // Check cache for read requests
  if (isRead) {
    const cacheKey = `${target}:${path}`
    const cached = getCached(cacheKey)
    if (cached) return cached
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const fetchOpts: RequestInit = { ...options, signal: controller.signal }

  try {
    let res: Response
    if (isHTTPS()) {
      if (target === "daemon") {
        res = await fetch(`/api/daemon?path=${encodeURIComponent(path)}`, fetchOpts)
      } else {
        res = await fetch(`/api/proxy?url=${encodeURIComponent(path)}&target=${target}`, fetchOpts)
      }
    } else {
      res = await fetch(`${DIRECT_URLS[target]}${path}`, fetchOpts)
    }
    clearTimeout(timeout)

    // Cache successful read responses
    if (isRead && res.ok) {
      const cacheKey = `${target}:${path}`
      return await setCache(cacheKey, res)
    }

    return res
  } catch {
    clearTimeout(timeout)

    // On failure, try to serve stale cache (any age)
    if (isRead) {
      const cacheKey = `${target}:${path}`
      const stale = cache.get(cacheKey)
      if (stale) {
        return new Response(stale.data, {
          status: stale.status,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    return new Response(JSON.stringify({ error: "Unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }
}

/** Convenience: fetch JSON with automatic proxy */
export async function proxyJSON<T = unknown>(
  path: string,
  target: "rpc" | "rest" | "daemon" | "faucet"
): Promise<T | null> {
  try {
    const res = await proxyFetch(path, target)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
