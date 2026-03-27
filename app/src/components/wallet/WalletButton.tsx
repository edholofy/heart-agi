"use client"

import { useState, useRef, useEffect } from "react"
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
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  async function handleConnect() {
    if (!hasWalletProvider()) {
      window.open("https://metamask.io/download/", "_blank")
      setWallet({
        address: null,
        balance: null,
        chainId: null,
        connected: false,
        connecting: false,
        error: "No wallet detected",
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
    setShowMenu(false)
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

  function handleCopy() {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address)
    }
    setShowMenu(false)
  }

  function handleDisconnect() {
    setWallet({
      address: null,
      balance: null,
      chainId: null,
      connected: false,
      connecting: false,
      error: null,
    })
    setShowMenu(false)
    // Clear persisted wallet state
    try {
      const stored = localStorage.getItem("humans-ai-store")
      if (stored) {
        const data = JSON.parse(stored)
        if (data.state) {
          data.state.wallet = {
            address: null,
            balance: null,
            chainId: null,
            connected: false,
            connecting: false,
            error: null,
          }
          localStorage.setItem("humans-ai-store", JSON.stringify(data))
        }
      }
    } catch { /* ignore */ }
  }

  function handleExplorer() {
    if (wallet.address) {
      window.open(
        `https://explorer.nodestake.top/humans/account/${wallet.address}`,
        "_blank"
      )
    }
    setShowMenu(false)
  }

  // Connected state
  if (wallet.connected && wallet.address) {
    return (
      <div className="relative" ref={menuRef}>
        <div className="flex items-center gap-2">
          {/* Balance pill */}
          <div className="hidden sm:flex items-center gap-1.5 btn-secondary px-3 py-1.5 text-xs font-mono">
            <span className="text-white font-medium">
              {Number(wallet.balance).toFixed(2)}
            </span>
            <span className="text-[rgba(255,255,255,0.4)]">HEART</span>
          </div>

          {/* Address pill — toggles dropdown */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="btn-secondary px-3 py-1.5 text-xs font-mono text-[rgba(255,255,255,0.5)] hover:text-white transition-colors"
          >
            {shortenAddress(wallet.address)}
          </button>
        </div>

        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-52 glass-sm p-2 z-50">
            <div className="px-3 py-2 mb-1">
              <div className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono uppercase tracking-wider">
                Connected
              </div>
              <div className="text-xs font-mono text-white mt-1 break-all">
                {wallet.address}
              </div>
              <div className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono mt-1">
                Chain ID: {wallet.chainId}
              </div>
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.05)] my-1" />

            <MenuItem onClick={handleCopy}>
              Copy Address
            </MenuItem>
            <MenuItem onClick={handleExplorer}>
              View on Explorer
            </MenuItem>
            <MenuItem onClick={handleSwitchChain}>
              Switch to Humans Chain
            </MenuItem>

            <div className="h-px bg-[rgba(255,255,255,0.05)] my-1" />

            <MenuItem onClick={handleDisconnect} danger>
              Disconnect
            </MenuItem>
          </div>
        )}
      </div>
    )
  }

  // Disconnected state
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

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${
        danger
          ? "text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
          : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
      }`}
    >
      {children}
    </button>
  )
}
