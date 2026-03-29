"use client"

import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing"
import { SigningStargateClient, StargateClient } from "@cosmjs/stargate"

const RAW_CHAIN_RPC =
  process.env.NEXT_PUBLIC_HEART_RPC || "http://5.161.47.118:26657"
const CHAIN_ID = "heart-testnet-1"
const PREFIX = "heart"
const DENOM = "uheart"
const WALLET_STORAGE_KEY = "heart-wallet-encrypted"
const SESSION_KEY_STORAGE = "heart-wallet-session-key"
/** @deprecated Used only for migration from plaintext storage */
const LEGACY_STORAGE_KEY = "heart-wallet-mnemonic"

/* ------------------------------------------------------------------ */
/*  Encryption helpers (AES-256-GCM via Web Crypto API)               */
/* ------------------------------------------------------------------ */

/**
 * Generate a new AES-256-GCM CryptoKey, export it as base64, and
 * store the exported key material in sessionStorage so it is
 * automatically cleared when the tab/window closes.
 */
async function generateAndStoreSessionKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can persist in sessionStorage
    ["encrypt", "decrypt"]
  )
  const exported = await crypto.subtle.exportKey("raw", key)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)))
  sessionStorage.setItem(SESSION_KEY_STORAGE, b64)
  return key
}

/**
 * Retrieve the AES key from sessionStorage. Returns `null` when the
 * session has expired (new tab / browser restart).
 */
async function getSessionKey(): Promise<CryptoKey | null> {
  const b64 = sessionStorage.getItem(SESSION_KEY_STORAGE)
  if (!b64) return null

  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ])
}

/**
 * Encrypt a plaintext mnemonic with AES-256-GCM.
 * Returns a base64 string containing `iv (12 bytes) || ciphertext`.
 */
async function encryptMnemonic(
  mnemonic: string,
  key: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(mnemonic)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  )
  // Concatenate iv + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a previously encrypted mnemonic.
 * Expects the base64 blob produced by `encryptMnemonic`.
 */
async function decryptMnemonic(
  blob: string,
  key: CryptoKey
): Promise<string> {
  const combined = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}

/**
 * Persist an encrypted mnemonic in localStorage and ensure the
 * session key exists in sessionStorage.
 */
async function storeMnemonicEncrypted(mnemonic: string): Promise<void> {
  let key = await getSessionKey()
  if (!key) {
    key = await generateAndStoreSessionKey()
  }
  const encrypted = await encryptMnemonic(mnemonic, key)
  localStorage.setItem(WALLET_STORAGE_KEY, encrypted)
  // Clean up any legacy plaintext entry
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

/**
 * Load and decrypt the mnemonic from localStorage.
 * Returns `null` when no encrypted blob exists or the session key
 * is unavailable (tab was closed).
 *
 * Also handles migration: if a legacy plaintext mnemonic is found
 * it is encrypted in-place and the plaintext entry removed.
 */
async function loadMnemonicDecrypted(): Promise<string | null> {
  // --- Migration: plaintext → encrypted --------------------------------
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) {
    await storeMnemonicEncrypted(legacy)
    // storeMnemonicEncrypted already removes LEGACY_STORAGE_KEY
    return legacy
  }

  // --- Normal path: decrypt from localStorage ---------------------------
  const blob = localStorage.getItem(WALLET_STORAGE_KEY)
  if (!blob) return null

  const key = await getSessionKey()
  if (!key) return null // session expired — user must re-import

  try {
    return await decryptMnemonic(blob, key)
  } catch {
    // Decryption failed (wrong key / corrupted data)
    return null
  }
}

/**
 * Returns the RPC endpoint to use for CosmJS connections.
 *
 * On HTTPS pages (e.g. Vercel), the browser blocks mixed-content
 * requests to plain HTTP RPC nodes.  We route through the Next.js
 * API proxy at `/api/chain/rpc` instead.
 */
function getChainRPC(): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return `${window.location.origin}/api/chain/rpc`
  }
  return RAW_CHAIN_RPC
}

/** Static alias kept for backwards-compatible re-exports. */
const CHAIN_RPC = RAW_CHAIN_RPC

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CosmosWalletState {
  address: string | null
  mnemonic: string | null
  balance: string
  connected: boolean
  connecting: boolean
  error: string | null
}

export const INITIAL_COSMOS_WALLET_STATE: CosmosWalletState = {
  address: null,
  mnemonic: null,
  balance: "0",
  connected: false,
  connecting: false,
  error: null,
}

/* ------------------------------------------------------------------ */
/*  Wallet CRUD                                                        */
/* ------------------------------------------------------------------ */

/**
 * Generate a brand-new HD wallet, persist the mnemonic in localStorage,
 * and return the first address together with the seed phrase.
 */
export async function createWallet(): Promise<{
  address: string
  mnemonic: string
}> {
  const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: PREFIX })
  const [account] = await wallet.getAccounts()
  const mnemonic = wallet.mnemonic

  if (typeof window !== "undefined") {
    await storeMnemonicEncrypted(mnemonic)
  }

  return { address: account.address, mnemonic }
}

/**
 * Attempt to restore a wallet from a mnemonic stored in localStorage.
 * Returns `null` when nothing is stored.
 */
export async function loadWallet(): Promise<{
  address: string
  mnemonic: string
} | null> {
  if (typeof window === "undefined") return null

  const mnemonic = await loadMnemonicDecrypted()
  if (!mnemonic) return null

  try {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: PREFIX,
    })
    const [account] = await wallet.getAccounts()
    return { address: account.address, mnemonic }
  } catch {
    // Corrupted mnemonic — clear it
    localStorage.removeItem(WALLET_STORAGE_KEY)
    sessionStorage.removeItem(SESSION_KEY_STORAGE)
    return null
  }
}

/**
 * Import a wallet from a user-supplied mnemonic. Validates the phrase,
 * persists it, and returns the derived address.
 */
export async function importWallet(
  mnemonic: string
): Promise<{ address: string }> {
  const trimmed = mnemonic.trim()
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmed, {
    prefix: PREFIX,
  })
  const [account] = await wallet.getAccounts()

  if (typeof window !== "undefined") {
    await storeMnemonicEncrypted(trimmed)
  }

  return { address: account.address }
}

/* ------------------------------------------------------------------ */
/*  Balance                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch the uheart balance for an address via StargateClient.
 * Returns a human-readable HEART amount (divided by 1 000 000).
 */
export async function getBalance(address: string): Promise<string> {
  try {
    const client = await StargateClient.connect(getChainRPC())
    const coin = await client.getBalance(address, DENOM)
    client.disconnect()

    const raw = BigInt(coin.amount)
    const whole = raw / BigInt(1_000_000)
    const frac = raw % BigInt(1_000_000)
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "")

    return fracStr ? `${whole}.${fracStr}` : whole.toString()
  } catch (err) {
    console.warn("[cosmos-wallet] getBalance failed:", err)
    return "0"
  }
}

/* ------------------------------------------------------------------ */
/*  Signing client                                                     */
/* ------------------------------------------------------------------ */

/** Cached signing client — cleared after use via `clearSigningClient()`. */
let cachedSigningClient: SigningStargateClient | null = null

/** Clear the cached signing client to free the signer from memory. */
export function clearSigningClient(): void {
  if (cachedSigningClient) {
    cachedSigningClient.disconnect()
  }
  cachedSigningClient = null
}

/**
 * Build a `SigningStargateClient` from the stored mnemonic.
 * This is the main entry point for broadcasting transactions.
 */
export async function getSigningClient(): Promise<{
  client: SigningStargateClient
  address: string
}> {
  if (typeof window === "undefined") {
    throw new Error("getSigningClient can only be called in the browser")
  }

  const mnemonic = await loadMnemonicDecrypted()
  if (!mnemonic) {
    throw new Error(
      "No wallet found — create or import one first. " +
        "If you previously had a wallet, your session may have expired. " +
        "Please re-import your mnemonic."
    )
  }

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: PREFIX,
  })
  const [account] = await wallet.getAccounts()

  const client = await SigningStargateClient.connectWithSigner(
    getChainRPC(),
    wallet
  )

  cachedSigningClient = client

  return { client, address: account.address }
}

/* ------------------------------------------------------------------ */
/*  Disconnect                                                         */
/* ------------------------------------------------------------------ */

/** Remove the stored mnemonic and session encryption key. */
export function disconnectWallet(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(WALLET_STORAGE_KEY)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
  sessionStorage.removeItem(SESSION_KEY_STORAGE)
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Shorten a bech32 address for UI display: `heart1a2b...x9z0` */
export function shortenAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 10)}...${addr.slice(-4)}`
}

/** Exported constants for use by other modules */
export { CHAIN_RPC, CHAIN_ID, PREFIX, DENOM }
