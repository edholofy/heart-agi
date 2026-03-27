"use client"

import { useAppStore } from "@/lib/store"
import { WalletButton } from "@/components/wallet/WalletButton"

export function NetworkBar() {
  const stats = useAppStore((s) => s.networkStats)

  return (
    <header className="sticky top-0 z-40 px-6 py-4">
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
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-1.5 tech-label">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
            <span>{stats.totalAgents.toLocaleString()} ENTITIES</span>
          </div>
          <div className="hidden md:block tech-label">
            {stats.totalExperiments.toLocaleString()} EXP
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  )
}
