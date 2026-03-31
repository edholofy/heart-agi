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

const MONO = "'IBM Plex Mono', 'SF Mono', 'Roboto Mono', monospace"

const DROPDOWN: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  width: 240,
  background: "rgba(18,18,18,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  padding: 6,
  zIndex: 9999,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
}

const PILL: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.6)",
  cursor: "pointer",
  transition: "all 150ms",
  whiteSpace: "nowrap",
}

export function WalletButton() {
  const wallet = useAppStore((s) => s.wallet)
  const setWallet = useAppStore((s) => s.setWallet)

  const [showMenu, setShowMenu] = useState(false)
  const [view, setView] = useState<View>("idle")
  const [importInput, setImportInput] = useState("")
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  /* Auto-load wallet on mount */
  const autoLoad = useCallback(async () => {
    if (wallet.connected) return
    setWallet({ ...wallet, connecting: true, error: null })
    try {
      const existing = await loadWallet()
      if (existing) {
        const balance = await getBalance(existing.address)
        setWallet({ address: existing.address, mnemonic: existing.mnemonic, balance, connected: true, connecting: false, error: null })
      } else {
        setWallet({ ...wallet, connecting: false })
      }
    } catch {
      setWallet({ ...wallet, connecting: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { autoLoad() }, [autoLoad])

  /* Close dropdown on outside click */
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

  /* Handlers */
  async function handleCreate() {
    setWallet({ ...wallet, connecting: true, error: null })
    try {
      const { address, mnemonic } = await createWallet()
      const balance = await getBalance(address)
      setWallet({ address, mnemonic, balance, connected: true, connecting: false, error: null })
      setView("mnemonic")
      setShowMenu(true)
    } catch (err: unknown) {
      setWallet({ ...wallet, connecting: false, error: (err as Error).message || "Failed to create wallet" })
    }
  }

  async function handleImportSubmit() {
    const trimmed = importInput.trim()
    if (!trimmed) return
    setWallet({ ...wallet, connecting: true, error: null })
    try {
      const { address } = await importWallet(trimmed)
      const balance = await getBalance(address)
      setWallet({ address, mnemonic: trimmed, balance, connected: true, connecting: false, error: null })
      setView("idle")
      setImportInput("")
    } catch (err: unknown) {
      setWallet({ ...wallet, connecting: false, error: (err as Error).message || "Invalid mnemonic" })
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
    setWallet({ address: null, mnemonic: null, balance: "0", connected: false, connecting: false, error: null })
    setShowMenu(false)
    setView("idle")
    try {
      const stored = localStorage.getItem("humans-ai-store")
      if (stored) {
        const data = JSON.parse(stored)
        if (data.state) {
          data.state.wallet = { address: null, mnemonic: null, balance: "0", connected: false, connecting: false, error: null }
          localStorage.setItem("humans-ai-store", JSON.stringify(data))
        }
      }
    } catch { /* ignore */ }
  }

  async function handleRefreshBalance() {
    if (!wallet.address) return
    try {
      const balance = await getBalance(wallet.address)
      setWallet({ ...wallet, balance })
    } catch { /* silently ignore */ }
  }

  /* ---------------------------------------------------------------- */
  /*  Connected state                                                  */
  /* ---------------------------------------------------------------- */
  if (wallet.connected && wallet.address) {
    return (
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          onClick={() => { setShowMenu(!showMenu); setView("idle") }}
          style={PILL}
        >
          {shortenAddress(wallet.address)}
        </button>

        {showMenu && (
          <div style={DROPDOWN}>
            {/* Header */}
            <div style={{ padding: "10px 12px 8px" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Cosmos Wallet
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: "#fff", marginTop: 4, wordBreak: "break-all", lineHeight: 1.5 }}>
                {wallet.address}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                {Number(wallet.balance).toFixed(2)} HEART
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

            {view === "mnemonic" || showMnemonic ? (
              <div style={{ padding: "8px 12px" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  SAVE YOUR SEED PHRASE
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 10, lineHeight: 1.7, wordBreak: "break-all", userSelect: "all" }}>
                  {wallet.mnemonic}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#f59e0b", marginTop: 8, padding: 8, background: "rgba(245,158,11,0.08)", borderRadius: 6, border: "1px solid rgba(245,158,11,0.15)" }}>
                  TESTNET wallet. Do NOT use for real funds.
                </div>
                <MnItem onClick={() => { if (wallet.mnemonic) navigator.clipboard.writeText(wallet.mnemonic) }}>Copy seed phrase</MnItem>
                <MnItem onClick={() => { setView("idle"); setShowMnemonic(false) }}>I saved it</MnItem>
              </div>
            ) : view === "import" ? (
              <div style={{ padding: "8px 12px" }}>
                <textarea
                  rows={3}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="Enter your seed phrase..."
                  style={{ width: "100%", fontFamily: MONO, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, resize: "none", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <MnItem onClick={handleImportSubmit}>Import</MnItem>
                  <MnItem onClick={() => { setView("idle"); setImportInput(""); }}>Cancel</MnItem>
                </div>
              </div>
            ) : (
              <>
                <MnItem onClick={handleCopy}>{copied ? "Copied!" : "Copy Address"}</MnItem>
                <MnItem onClick={handleRefreshBalance}>Refresh Balance</MnItem>
                <MnItem onClick={() => setShowMnemonic(true)}>Show Seed Phrase</MnItem>
                <MnItem onClick={() => setView("import")}>Import Wallet</MnItem>
                <MnItem onClick={() => window.open("/faucet", "_blank")}>Get Test HEART</MnItem>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                <MnItem onClick={handleDisconnect} danger>Disconnect</MnItem>
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
    <div style={{ position: "relative" }} ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={wallet.connecting}
        style={{
          ...PILL,
          opacity: wallet.connecting ? 0.5 : 1,
          cursor: wallet.connecting ? "wait" : "pointer",
        }}
      >
        {wallet.connecting ? "..." : "CONNECT"}
      </button>

      {showMenu && !wallet.connecting && (
        <div style={DROPDOWN}>
          <MnItem onClick={handleCreate}>Generate New Wallet</MnItem>
          <MnItem onClick={() => setView("import")}>Import Existing Wallet</MnItem>

          {view === "import" && (
            <div style={{ padding: "8px 12px" }}>
              <textarea
                rows={3}
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder="Enter your seed phrase..."
                style={{ width: "100%", fontFamily: MONO, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, resize: "none", outline: "none" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <MnItem onClick={handleImportSubmit}>Import</MnItem>
                <MnItem onClick={() => { setView("idle"); setImportInput(""); setShowMenu(false) }}>Cancel</MnItem>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Menu item                                                          */
/* ------------------------------------------------------------------ */

function MnItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        fontFamily: MONO,
        fontSize: 11,
        padding: "8px 12px",
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: danger ? "#ef4444" : "rgba(255,255,255,0.6)",
        cursor: "pointer",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.06)" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
    >
      {children}
    </button>
  )
}
