"use client"

import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing"
import { SigningStargateClient, StargateClient } from "@cosmjs/stargate"

const RAW_CHAIN_RPC =
  process.env.NEXT_PUBLIC_HEART_RPC || "http://5.161.47.118:26657"
const CHAIN_ID = "heart-testnet-1"
const PREFIX = "heart"
const DENOM = "uheart"
const WALLET_STORAGE_KEY = "heart-wallet-mnemonic"

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
    localStorage.setItem(WALLET_STORAGE_KEY, mnemonic)
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

  const mnemonic = localStorage.getItem(WALLET_STORAGE_KEY)
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
    localStorage.setItem(WALLET_STORAGE_KEY, trimmed)
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

  const mnemonic = localStorage.getItem(WALLET_STORAGE_KEY)
  if (!mnemonic) {
    throw new Error("No wallet found — create or import one first")
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

/** Remove the stored mnemonic. */
export function disconnectWallet(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(WALLET_STORAGE_KEY)
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
