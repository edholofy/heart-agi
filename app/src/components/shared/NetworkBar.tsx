"use client"

import { useEffect, useState } from "react"
import { WalletButton } from "@/components/wallet/WalletButton"
import { getChainStatus } from "@/lib/chain-client"
import Link from "next/link"

export function NetworkBar() {
  const [blockHeight, setBlockHeight] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      try {
        const status = await getChainStatus()
        if (!cancelled) {
          setBlockHeight(status.blockHeight !== "0" ? status.blockHeight : null)
          setChainId(status.chainId !== "unknown" ? status.chainId : null)
        }
      } catch {
        // chain unreachable — leave as null
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold tracking-tight">
            $HEART
          </span>
          <span className="tech-label hidden sm:inline">
            AUTONOMOUS.BLOCKCHAIN
          </span>
        </div>

        {/* Network stats + wallet */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden sm:flex items-center gap-1.5 tech-label">
            <span className={`w-1.5 h-1.5 rounded-full ${blockHeight ? "bg-[#22c55e] animate-pulse-dot" : "bg-[rgba(255,255,255,0.2)]"}`} />
            <span>{blockHeight ? "LIVE" : "CONNECTING"}</span>
          </div>
          <div className="hidden md:block tech-label font-mono">
            {blockHeight ? `BLOCK #${Number(blockHeight).toLocaleString()}` : "\u2014"}
          </div>
          {chainId && (
            <div className="hidden lg:block tech-label">
              {chainId}
            </div>
          )}
          <Link href="/spawn" className="text-[10px] font-mono tracking-[0.2em] uppercase text-white bg-[rgba(255,255,255,0.08)] px-3 py-1 rounded-full hover:bg-[rgba(255,255,255,0.15)] transition-all">
            SPAWN
          </Link>
          <Link href="/world" className="tech-label hover:text-white transition-colors">
            WORLD
          </Link>
          <Link href="/marketplace" className="hidden sm:block tech-label hover:text-white transition-colors">
            TASKS
          </Link>
          <Link href="/swarm" className="hidden sm:block tech-label hover:text-white transition-colors">
            SWARM
          </Link>
          <Link href="/artifacts" className="hidden sm:block tech-label hover:text-white transition-colors">
            ARTIFACTS
          </Link>
          <Link href="/leaderboard" className="hidden sm:block tech-label hover:text-white transition-colors">
            LEADERBOARD
          </Link>
          <Link href="/governance" className="hidden md:block tech-label hover:text-white transition-colors">
            GOV
          </Link>
          <Link href="/docs" className="hidden md:block tech-label hover:text-white transition-colors">
            DOCS
          </Link>
          <Link href="/explorer" className="hidden lg:block tech-label hover:text-white transition-colors">
            EXPLORER
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  )
}
