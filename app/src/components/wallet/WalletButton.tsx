"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useAppStore } from "@/lib/store"
import {
  createWallet,
  loadWallet,
  importWallet,
  getBalance,
  disconnectWallet,
  shortenAddress,
} from "@/lib/cosmos-wallet"

type View = "idle" | "mnemonic" | "import"

export function WalletButton() {
  const wallet = useAppStore((s) => s.wallet)
  const setWallet = useAppStore((s) => s.setWallet)

  const [showMenu, setShowMenu] = useState(false)
  const [view, setView] = useState<View>("idle")
  const [importInput, setImportInput] = useState("")
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  /* ---------------------------------------------------------------- */
  /*  Auto-load wallet on mount                                       */
  /* ---------------------------------------------------------------- */
  const autoLoad = useCallback(async () => {
    if (wallet.connected) return

    setWallet({ ...wallet, connecting: true, error: null })

    try {
      const existing = await loadWallet()
      if (existing) {
        const balance = await getBalance(existing.address)
        setWallet({
          address: existing.address,
          mnemonic: existing.mnemonic,
          balance,
          connected: true,
          connecting: false,
          error: null,
        })
      } else {
        setWallet({ ...wallet, connecting: false })
      }
    } catch {
      setWallet({ ...wallet, connecting: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    autoLoad()
  }, [autoLoad])

  /* ---------------------------------------------------------------- */
  /*  Close dropdown on outside click                                  */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setView("idle")
        setShowMnemonic(false)
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  async function handleCreate() {
    setWallet({ ...wallet, connecting: true, error: null })
    try {
      const { address, mnemonic } = await createWallet()
      const balance = await getBalance(address)
      setWallet({
        address,
        mnemonic,
        balance,
        connected: true,
        connecting: false,
        error: null,
      })
      setView("mnemonic")
      setShowMenu(true)
    } catch (err: unknown) {
      setWallet({
        ...wallet,
        connecting: false,
        error: (err as Error).message || "Failed to create wallet",
      })
    }
  }

  async function handleImportSubmit() {
    const trimmed = importInput.trim()
    if (!trimmed) return

    setWallet({ ...wallet, connecting: true, error: null })
    try {
      const { address } = await importWallet(trimmed)
      const balance = await getBalance(address)
      setWallet({
        address,
        mnemonic: trimmed,
        balance,
        connected: true,
        connecting: false,
        error: null,
      })
      setView("idle")
      setImportInput("")
    } catch (err: unknown) {
      setWallet({
        ...wallet,
        connecting: false,
        error: (err as Error).message || "Invalid mnemonic",
      })
    }
  }

  function handleCopy() {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  function handleDisconnect() {
    disconnectWallet()
    setWallet({
      address: null,
      mnemonic: null,
      balance: "0",
      connected: false,
      connecting: false,
      error: null,
    })
    setShowMenu(false)
    setView("idle")
    // Also clear persisted wallet in zustand store
    try {
      const stored = localStorage.getItem("humans-ai-store")
      if (stored) {
        const data = JSON.parse(stored)
        if (data.state) {
          data.state.wallet = {
            address: null,
            mnemonic: null,
            balance: "0",
            connected: false,
            connecting: false,
            error: null,
          }
          localStorage.setItem("humans-ai-store", JSON.stringify(data))
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function handleRefreshBalance() {
    if (!wallet.address) return
    try {
      const balance = await getBalance(wallet.address)
      setWallet({ ...wallet, balance })
    } catch {
      /* silently ignore */
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Connected state                                                  */
  /* ---------------------------------------------------------------- */
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

          {/* Address pill */}
          <button
            onClick={() => {
              setShowMenu(!showMenu)
              setView("idle")
            }}
            className="btn-secondary px-3 py-1.5 text-xs font-mono text-[rgba(255,255,255,0.5)] hover:text-white transition-colors"
          >
            {shortenAddress(wallet.address)}
          </button>
        </div>

        {/* Dropdown */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-64 glass-sm p-2 z-50">
            {/* Header */}
            <div className="px-3 py-2 mb-1">
              <div className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono uppercase tracking-wider">
                Cosmos Wallet
              </div>
              <div className="text-xs font-mono text-white mt-1 break-all">
                {wallet.address}
              </div>
              <div className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono mt-1">
                Chain: heart-testnet-1
              </div>
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.05)] my-1" />

            {/* Show mnemonic warning / reveal */}
            {view === "mnemonic" || showMnemonic ? (
              <div className="px-3 py-2">
                <div className="text-[10px] text-[#f59e0b] font-mono uppercase tracking-wider mb-2">
                  SAVE YOUR SEED PHRASE
                </div>
                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-2 text-xs font-mono text-white break-all leading-relaxed select-all">
                  {wallet.mnemonic}
                </div>
                <div className="text-[10px] text-[#f59e0b] mt-2 p-2 rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.15)]">
                  This is a TESTNET wallet stored in your browser. Do NOT use
                  for real funds. For mainnet, use a hardware wallet.
                </div>
                <div className="text-[10px] text-[#ef4444] mt-2">
                  Write this down. You will NOT see it again after closing this
                  menu.
                </div>
                <button
                  onClick={() => {
                    if (wallet.mnemonic) {
                      navigator.clipboard.writeText(wallet.mnemonic)
                    }
                  }}
                  className="mt-2 w-full text-center text-[10px] text-[rgba(255,255,255,0.5)] hover:text-white py-1"
                >
                  Copy to clipboard
                </button>
                <button
                  onClick={() => {
                    setView("idle")
                    setShowMnemonic(false)
                  }}
                  className="mt-1 w-full text-center text-[10px] text-[rgba(255,255,255,0.3)] hover:text-white py-1"
                >
                  I saved it
                </button>
              </div>
            ) : view === "import" ? (
              <div className="px-3 py-2">
                <div className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono uppercase tracking-wider mb-2">
                  Import Mnemonic
                </div>
                <textarea
                  rows={3}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="Enter your 12 or 24 word seed phrase..."
                  className="w-full bg-[rgba(0,0,0,0.3)] text-xs font-mono text-white p-2 rounded-lg resize-none outline-none placeholder:text-[rgba(255,255,255,0.2)]"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleImportSubmit}
                    className="flex-1 text-[10px] text-white bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] rounded-lg py-1.5"
                  >
                    Import
                  </button>
                  <button
                    onClick={() => {
                      setView("idle")
                      setImportInput("")
                    }}
                    className="flex-1 text-[10px] text-[rgba(255,255,255,0.4)] hover:text-white rounded-lg py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <MenuItem onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy Address"}
                </MenuItem>
                <MenuItem onClick={handleRefreshBalance}>
                  Refresh Balance
                </MenuItem>
                <MenuItem onClick={() => setShowMnemonic(true)}>
                  Show Seed Phrase
                </MenuItem>
                <MenuItem onClick={() => setView("import")}>
                  Import Wallet
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    window.open(
                      "/faucet",
                      "_blank"
                    )
                  }
                >
                  Get Test HEART
                </MenuItem>

                <div className="h-px bg-[rgba(255,255,255,0.05)] my-1" />

                <MenuItem onClick={handleDisconnect} danger>
                  Disconnect
                </MenuItem>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Disconnected state                                               */
  /* ---------------------------------------------------------------- */
  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-2">
        {wallet.error && (
          <span className="text-[10px] text-[#ef4444] hidden sm:block max-w-[140px] truncate">
            {wallet.error}
          </span>
        )}
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={wallet.connecting}
          className="btn-secondary px-4 py-2 text-xs font-medium tracking-wide disabled:opacity-50"
        >
          {wallet.connecting ? "CONNECTING..." : "CREATE WALLET"}
        </button>
      </div>

      {showMenu && !wallet.connecting && (
        <div className="absolute right-0 top-full mt-2 w-56 glass-sm p-2 z-50">
          <MenuItem onClick={handleCreate}>
            Generate New Wallet
          </MenuItem>
          <MenuItem onClick={() => { setView("import"); }}>
            Import Existing Wallet
          </MenuItem>

          {view === "import" && (
            <div className="px-3 py-2">
              <textarea
                rows={3}
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder="Enter your 12 or 24 word seed phrase..."
                className="w-full bg-[rgba(0,0,0,0.3)] text-xs font-mono text-white p-2 rounded-lg resize-none outline-none placeholder:text-[rgba(255,255,255,0.2)]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleImportSubmit}
                  className="flex-1 text-[10px] text-white bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] rounded-lg py-1.5"
                >
                  Import
                </button>
                <button
                  onClick={() => {
                    setView("idle")
                    setImportInput("")
                    setShowMenu(false)
                  }}
                  className="flex-1 text-[10px] text-[rgba(255,255,255,0.4)] hover:text-white rounded-lg py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared menu-item component                                         */
/* ------------------------------------------------------------------ */

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
