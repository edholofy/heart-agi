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
  if (isHTTPS()) {
    // Route through server-side proxy to avoid mixed content
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(path)}&target=${target}`
    return fetch(proxyUrl, options)
  }

  // Direct call on localhost
  return fetch(`${DIRECT_URLS[target]}${path}`, options)
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
