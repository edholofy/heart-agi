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
      setWallet({
        address: null,
        balance: null,
        chainId: null,
        connected: false,
        connecting: false,
        error: "Install MetaMask to connect",
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
        error: error.message || "Failed to connect",
      })
    }
  }

  async function handleSwitchChain() {
    try {
      await switchToHumansChain()
      // Reconnect to get updated chain info
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
        error: error.message || "Failed to switch chain",
      })
    }
  }

  if (wallet.connected && wallet.address) {
    return (
      <div className="flex items-center gap-3">
        {/* Balance */}
        <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-heart/10 border border-heart/20">
          <span className="text-heart text-sm font-semibold">
            {Number(wallet.balance).toFixed(2)}
          </span>
          <span className="text-heart/60 text-xs">$HEART</span>
        </div>

        {/* Address */}
        <button
          onClick={handleSwitchChain}
          className="px-3 py-1.5 rounded-lg bg-card border border-card-border text-sm font-mono text-muted hover:text-foreground transition-colors"
          title="Click to switch to Humans chain"
        >
          {shortenAddress(wallet.address)}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {wallet.error && (
        <span className="text-xs text-heart hidden sm:block">
          {wallet.error}
        </span>
      )}
      <button
        onClick={handleConnect}
        disabled={wallet.connecting}
        className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-dim text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {wallet.connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    </div>
  )
}
