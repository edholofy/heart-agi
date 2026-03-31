/**
 * Proxy helper — routes all external HTTP calls through /api/proxy
 * when running on HTTPS (Vercel). Direct on localhost (HTTP).
 *
 * Usage:
 *   const data = await proxyFetch("/status", "rpc")
 *   const data = await proxyFetch("/heart/existence/list_tasks", "rest")
 *   const data = await proxyFetch("/api/entities", "daemon")
 *   const data = await proxyFetch("/api/faucet", "faucet", { method: "POST", body: JSON.stringify({...}) })
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

export async function proxyFetch(
  path: string,
  target: "rpc" | "rest" | "daemon" | "faucet",
  options?: RequestInit
): Promise<Response> {
  // Add 8s timeout to all daemon calls to prevent page hangs
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const fetchOpts: RequestInit = { ...options, signal: controller.signal }

  try {
    let res: Response
    if (isHTTPS()) {
      if (target === "daemon") {
        const daemonUrl = `/api/daemon?path=${encodeURIComponent(path)}`
        res = await fetch(daemonUrl, fetchOpts)
      } else {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(path)}&target=${target}`
        res = await fetch(proxyUrl, fetchOpts)
      }
    } else {
      res = await fetch(`${DIRECT_URLS[target]}${path}`, fetchOpts)
    }
    clearTimeout(timeout)
    return res
  } catch (err) {
    clearTimeout(timeout)
    // Return a synthetic failed response instead of throwing
    return new Response(JSON.stringify({ error: "Daemon unavailable" }), {
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
