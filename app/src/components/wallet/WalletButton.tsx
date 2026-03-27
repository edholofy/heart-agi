"use client"

import { useAppStore } from "@/lib/store"
import {
  connectWallet,
  hasWalletProvider,
  shortenAddress,
  switchToHumansChain,
} from "@/lib/wallet"

export function WalletButton() {
  const wallet = useAppStore((s) => s.wallet)
  const setWallet = useAppStore((s) => s.setWallet)

  async function handleConnect() {
    if (!hasWalletProvider()) {
      // Open MetaMask install page
      window.open('https://metamask.io/download/', '_blank')
      setWallet({
        address: null,
        balance: null,
        chainId: null,
        connected: false,
        connecting: false,
        error: "No wallet detected — install MetaMask",
      })
      return
    }

    setWallet({ ...wallet, connecting: true, error: null })

    try {
      const result = await connectWallet()
      setWallet({
        address: result.address,
        balance: result.balance,
        chainId: result.chainId,
        connected: true,
        connecting: false,
        error: null,
      })
    } catch (err: unknown) {
      const error = err as Error
      setWallet({
        ...wallet,
        connecting: false,
        error: error.message || "Failed",
      })
    }
  }

  async function handleSwitchChain() {
    try {
      await switchToHumansChain()
      const result = await connectWallet()
      setWallet({
        address: result.address,
        balance: result.balance,
        chainId: result.chainId,
        connected: true,
        connecting: false,
        error: null,
      })
    } catch (err: unknown) {
      const error = err as Error
      setWallet({ ...wallet, error: error.message })
    }
  }

  if (wallet.connected && wallet.address) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 btn-secondary px-3 py-1.5 text-xs font-mono">
          <span className="text-white font-medium">
            {Number(wallet.balance).toFixed(2)}
          </span>
          <span className="text-[rgba(255,255,255,0.4)]">HEART</span>
        </div>
        <button
          onClick={handleSwitchChain}
          className="btn-secondary px-3 py-1.5 text-xs font-mono text-[rgba(255,255,255,0.5)]"
        >
          {shortenAddress(wallet.address)}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {wallet.error && (
        <span className="text-[10px] text-[#ef4444] hidden sm:block max-w-[140px] truncate">
          {wallet.error}
        </span>
      )}
      <button
        onClick={handleConnect}
        disabled={wallet.connecting}
        className="btn-secondary px-4 py-2 text-xs font-medium tracking-wide disabled:opacity-50"
      >
        {wallet.connecting ? "CONNECTING..." : "CONNECT"}
      </button>
    </div>
  )
}
