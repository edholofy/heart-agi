"use client"

import { useAppStore } from "@/lib/store"

export function NetworkBar() {
  const stats = useAppStore((s) => s.networkStats)

  return (
    <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">
            humans
            <span className="text-accent">.ai</span>
          </span>
          <span className="text-xs text-muted hidden sm:inline">
            autonomous intelligence network
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
            <span>{stats.totalAgents.toLocaleString()} agents</span>
          </div>
          <div className="hidden md:block">
            {stats.totalExperiments.toLocaleString()} experiments
          </div>
          <div className="hidden md:block">
            {stats.totalDiscoveries.toLocaleString()} discoveries
          </div>
          <div className="flex items-center gap-1">
            <span className="text-heart font-medium">
              {(stats.heartEmitted24h / 1_000_000).toFixed(1)}M
            </span>
            <span>$HEART/day</span>
          </div>
        </div>
      </div>
    </header>
  )
}
