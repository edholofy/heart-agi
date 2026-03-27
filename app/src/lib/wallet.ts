import { BrowserProvider, formatEther } from 'ethers'

/** Humans chain EVM RPC */
const HUMANS_CHAIN_ID = '0x102B' // 4139 — Humans testnet
const HUMANS_RPC = 'https://evm-rpc.testnet.humans.zone'
const HUMANS_CHAIN_CONFIG = {
  chainId: HUMANS_CHAIN_ID,
  chainName: 'Humans AI Testnet',
  nativeCurrency: {
    name: 'HEART',
    symbol: 'HEART',
    decimals: 18,
  },
  rpcUrls: [HUMANS_RPC],
  blockExplorerUrls: ['https://explorer.testnet.humans.zone'],
}

export interface WalletState {
  address: string | null
  balance: string | null
  chainId: string | null
  connected: boolean
  connecting: boolean
  error: string | null
}

export const INITIAL_WALLET_STATE: WalletState = {
  address: null,
  balance: null,
  chainId: null,
  connected: false,
  connecting: false,
  error: null,
}

/** Check if MetaMask (or compatible) is available */
export function hasWalletProvider(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { ethereum?: unknown }).ethereum
}

/** Get the ethereum provider */
function getEthereum(): {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
} | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ethereum?: ReturnType<typeof getEthereum> }).ethereum ?? null
}

/** Connect wallet and return address */
export async function connectWallet(): Promise<{
  address: string
  balance: string
  chainId: string
}> {
  const ethereum = getEthereum()
  if (!ethereum) {
    throw new Error('No wallet found. Install MetaMask or a compatible wallet.')
  }

  const accounts = (await ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock your wallet.')
  }

  const address = accounts[0]
  const chainId = (await ethereum.request({ method: 'eth_chainId' })) as string

  // Get balance
  const provider = new BrowserProvider(ethereum as never)
  const balance = await provider.getBalance(address)

  return {
    address,
    balance: formatEther(balance),
    chainId,
  }
}

/** Switch to Humans chain or add it if not configured */
export async function switchToHumansChain(): Promise<void> {
  const ethereum = getEthereum()
  if (!ethereum) throw new Error('No wallet found')

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HUMANS_CHAIN_ID }],
    })
  } catch (err: unknown) {
    const switchError = err as { code?: number }
    // Chain not added yet — add it
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [HUMANS_CHAIN_CONFIG],
      })
    } else {
      throw err
    }
  }
}

/** Listen for account/chain changes */
export function onWalletChange(callback: () => void): () => void {
  const ethereum = getEthereum()
  if (!ethereum) return () => {}

  const handler = () => callback()
  ethereum.on('accountsChanged', handler)
  ethereum.on('chainChanged', handler)

  return () => {
    ethereum.removeListener('accountsChanged', handler)
    ethereum.removeListener('chainChanged', handler)
  }
}

/** Shorten address for display */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
