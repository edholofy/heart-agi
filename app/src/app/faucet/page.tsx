"use client"

import { useState } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

interface FaucetResult {
  success: boolean
  message: string
  txHash?: string
}

export default function FaucetPage() {
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FaucetResult | null>(null)

  async function handleRequest() {
    const trimmed = address.trim()
    if (!trimmed) return

    if (!trimmed.startsWith("heart1") || trimmed.length < 30) {
      setResult({
        success: false,
        message: "Invalid address. Must start with heart1",
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await proxyFetch("/api/faucet", "faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
      })

      const data: FaucetResult = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message:
          error instanceof Error
            ? `Network error: ${error.message}`
            : "Failed to connect to faucet service",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col min-h-screen">

      {/* DARK ZONE */}
      <div className="zone-dark">
        <header className="grid grid-cols-3 border-b border-[rgba(255,255,255,0.2)] pb-4 mb-8">
          <div>
            <span className="sys-label">SYSTEM MODULE</span>
            <div className="text-sm font-bold tracking-wide">TESTNET FAUCET // TOKEN DISTRIBUTION</div>
          </div>
          <div className="text-center">
            <span className="sys-label">NETWORK</span>
            <div className="sys-value">TESTNET</div>
          </div>
          <div className="text-right">
            <span className="sys-label">STATUS</span>
            <div className="sys-value flex items-center justify-end gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
              ONLINE
            </div>
          </div>
        </header>

        <div className="primary-vis-layout pb-6">
          <div>
            <span className="sys-label">DISTRIBUTION AMOUNT</span>
            <div className="dot-hero">10</div>
          </div>
          <div className="flex flex-col justify-end">
            <span className="sys-label">$HEART TOKENS PER REQUEST</span>
            <p className="text-xs opacity-60 mt-2 leading-relaxed max-w-md">
              Get free testnet tokens to experiment with the $HEART blockchain.
              Limited to one request per address per hour.
            </p>
          </div>
        </div>
      </div>

      <div className="zone-transition" />

      {/* LIGHT ZONE */}
      <div className="zone-light">
        <div className="max-w-2xl mx-auto">
          {/* FAUCET FORM */}
          <div className="col-header">REQUEST TOKENS</div>
          <div className="border border-[rgba(0,0,0,0.1)] p-6 mb-6">
            <label className="sys-label block mb-3">
              RECIPIENT.ADDRESS
            </label>

            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleRequest()
              }}
              placeholder="heart1..."
              className="w-full px-5 py-3.5 text-sm font-mono border border-[var(--fg)] bg-transparent mb-6 focus:outline-none placeholder:text-[rgba(0,0,0,0.3)]"
              disabled={loading}
              spellCheck={false}
              autoComplete="off"
            />

            <button
              onClick={handleRequest}
              disabled={loading || !address.trim()}
              className="btn-primary w-full py-3.5 text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "TRANSMITTING..." : "REQUEST TOKENS"}
            </button>
          </div>

          {/* Result as data rows */}
          {result && (
            <>
              <div className="col-header">TRANSACTION STATUS</div>
              <div className="border border-[rgba(0,0,0,0.1)] p-4 mb-6">
                <div className="data-row" style={{
                  borderBottom: `1px solid ${result.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                }}>
                  <span className="row-key flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${result.success ? "bg-[#22c55e]" : "bg-[#ef4444]"}`} />
                    {result.success ? "TX_SUCCESS" : "TX_FAILED"}
                  </span>
                  <span className={`row-val ${result.success ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {result.message}
                  </span>
                </div>
                {result.txHash && (
                  <div className="data-row">
                    <span className="row-key">TX_HASH</span>
                    <span className="row-val text-xs break-all">{result.txHash}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Info as data rows */}
          <div className="col-header">FAUCET PARAMETERS</div>
          <div className="mb-8">
            <div className="data-row">
              <span className="row-key">AMOUNT</span>
              <span className="row-val">10 HEART</span>
            </div>
            <div className="data-row">
              <span className="row-key">COOLDOWN</span>
              <span className="row-val">1 HOUR</span>
            </div>
            <div className="data-row">
              <span className="row-key">NETWORK</span>
              <span className="row-val">TESTNET</span>
            </div>
            <div className="data-row">
              <span className="row-key">PREFIX</span>
              <span className="row-val">heart1...</span>
            </div>
          </div>

          {/* Back link */}
          <div className="text-center mb-8">
            <Link href="/" className="btn-primary inline-block px-6 py-3">
              BACK TO DASHBOARD
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
