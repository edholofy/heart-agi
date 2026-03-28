"use client"

import { useState } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
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
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
          <div className="w-full max-w-lg mx-auto text-center">
            {/* Badge */}
            <div className="sys-badge mb-8 inline-block">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot mr-2 align-middle" />
              FAUCET.TESTNET
            </div>

            <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.03em] leading-[1.1] mb-4">
              $HEART
              <br />
              <span className="text-[rgba(255,255,255,0.4)]">
                Testnet Faucet
              </span>
            </h1>

            <p className="text-[rgba(255,255,255,0.5)] text-base max-w-md mx-auto mb-10 font-light">
              Get free testnet tokens to experiment with the $HEART blockchain.
              Limited to one request per address per hour.
            </p>

            {/* Faucet Form */}
            <div className="glass p-6 sm:p-8 text-left">
              <label className="tech-label block mb-3">
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
                className="glass-input w-full px-5 py-3.5 text-sm font-mono mb-6"
                disabled={loading}
                spellCheck={false}
                autoComplete="off"
              />

              <button
                onClick={handleRequest}
                disabled={loading || !address.trim()}
                className="btn-primary w-full py-3.5 text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? "TRANSMITTING..." : "REQUEST TOKENS"}
              </button>

              {/* Result */}
              {result && (
                <div
                  className={`mt-6 p-4 rounded-2xl text-sm font-light ${
                    result.success
                      ? "bg-[rgba(34,197,94,0.08)] text-[#22c55e]"
                      : "bg-[rgba(239,68,68,0.08)] text-[#ef4444]"
                  }`}
                >
                  <p>{result.message}</p>
                  {result.txHash && (
                    <p className="mt-2 font-mono text-xs text-[rgba(255,255,255,0.4)] break-all">
                      TX: {result.txHash}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-sm p-5">
                <div className="tech-label mb-2">AMOUNT</div>
                <div className="text-lg font-medium">10 HEART</div>
              </div>
              <div className="glass-sm p-5">
                <div className="tech-label mb-2">COOLDOWN</div>
                <div className="text-lg font-medium">1 Hour</div>
              </div>
              <div className="glass-sm p-5">
                <div className="tech-label mb-2">NETWORK</div>
                <div className="text-lg font-medium">Testnet</div>
              </div>
            </div>

            {/* Back link */}
            <div className="mt-10">
              <Link
                href="/"
                className="btn-secondary inline-block px-6 py-2.5 text-sm tracking-wide"
              >
                BACK TO DASHBOARD
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
