import { BrowserProvider } from 'ethers'

const TOKEN_KEY = 'humans-ai-auth-token'

/** Get stored auth token */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

/** Store auth token */
function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Clear auth token */
export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/** Check if we have a valid (non-expired) auth token */
export function hasValidToken(): boolean {
  const token = getAuthToken()
  if (!token) return false

  try {
    // Decode JWT payload (no verification — just check expiry)
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/**
 * Authenticate with wallet signature.
 * 1. Request nonce from server
 * 2. Sign nonce with MetaMask
 * 3. Send signature to server
 * 4. Receive and store JWT
 */
export async function authenticateWithWallet(address: string): Promise<string> {
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum
  if (!ethereum) throw new Error('No wallet provider')

  // 1. Get nonce
  const nonceRes = await fetch(`/api/auth?address=${encodeURIComponent(address)}`)
  if (!nonceRes.ok) throw new Error('Failed to get nonce')
  const { nonce } = await nonceRes.json()

  // 2. Sign with MetaMask
  const provider = new BrowserProvider(ethereum as never)
  const signer = await provider.getSigner()
  const signature = await signer.signMessage(nonce)

  // 3. Verify and get JWT
  const authRes = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature, nonce }),
  })

  if (!authRes.ok) {
    const err = await authRes.json()
    throw new Error(err.error || 'Authentication failed')
  }

  const { token } = await authRes.json()

  // 4. Store token
  setAuthToken(token)

  return token
}

/** Get auth headers for API calls */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}
