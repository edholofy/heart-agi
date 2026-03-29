"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { getLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from "@/lib/daemon-client"
import Link from "next/link"

type SortField = "discoveries" | "compute" | "pnl" | "discovery_rate"

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "discoveries", label: "DISCOVERIES" },
  { value: "compute", label: "COMPUTE" },
  { value: "pnl", label: "P&L" },
  { value: "discovery_rate", label: "DISC. RATE" },
]

const STATUS_DOT: Record<string, string> = {
  alive: "bg-[#22c55e] animate-pulse-dot",
  dormant: "bg-[#f59e0b]",
  stopped: "bg-[#ef4444]",
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>("discoveries")

  const fetchData = useCallback(async () => {
    try {
      const result = await getLeaderboard(sortBy)
      setData(result)
      setFetchError(false)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [sortBy])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const aliveEntities = useMemo(
    () => data?.leaderboard.filter((e) => e.status === "alive") ?? [],
    [data]
  )

  const dormantEntities = useMemo(
    () => data?.leaderboard.filter((e) => e.status === "dormant" || e.status === "stopped") ?? [],
    [data]
  )

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
              $HEART{" "}
              <span className="text-[rgba(255,255,255,0.4)]">Leaderboard</span>
            </h1>
            <p className="text-sm text-[rgba(255,255,255,0.4)] font-light mt-2">
              Entity rankings by performance. The strongest survive, the weakest go dormant.
            </p>
          </div>

          {/* ========== LIVE STATS BAR ========== */}
          {data && (
            <div className="glass-sm p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <LiveStat label="ENTITIES.ALIVE" value={String(data.total_alive)} highlight />
              <LiveStat label="TOTAL.DISCOVERIES" value={String(data.total_discoveries)} />
              <LiveStat label="TOTAL.EXPERIMENTS" value={String(data.total_experiments)} />
              <LiveStat
                label="CIVILIZATION.AGE"
                value={data.civilization_age ? formatDuration(data.civilization_age) : "--"}
              />
            </div>
          )}

          {/* ========== SORT CONTROLS ========== */}
          <div className="glass-sm p-4 mb-6 flex items-center gap-4">
            <span className="tech-label whitespace-nowrap text-[9px]">SORT.BY</span>
            <div className="flex items-center gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
                    sortBy === opt.value
                      ? "bg-[rgba(255,255,255,0.1)] text-white"
                      : "bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chain offline warning */}
          {fetchError && (
            <div className="glass-sm p-4 mb-6 bg-[rgba(239,68,68,0.08)] text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] mr-2 align-middle" />
              <span className="text-[#ef4444] font-light">
                Daemon offline or unreachable. Retrying every 15s...
              </span>
            </div>
          )}

          {/* ========== RANKINGS TABLE ========== */}
          <div className="aura-divider mb-5">
            RANKINGS
            <span className="sys-badge ml-2">{aliveEntities.length} ALIVE</span>
          </div>

          {loading && !data && !fetchError && (
            <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
              Loading leaderboard from daemon...
            </div>
          )}

          {!loading && aliveEntities.length === 0 && !fetchError && (
            <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
              No entities spawned yet. Be the first.
            </div>
          )}

          {aliveEntities.length > 0 && (
            <div className="glass-sm overflow-x-auto mb-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="px-4 py-3 tech-label text-[9px]">#</th>
                    <th className="px-4 py-3 tech-label text-[9px]">ENTITY</th>
                    <th className="px-4 py-3 tech-label text-[9px] hidden sm:table-cell">STATUS</th>
                    <th className="px-4 py-3 tech-label text-[9px] text-right">DISC.</th>
                    <th className="px-4 py-3 tech-label text-[9px] text-right hidden sm:table-cell">EXP.</th>
                    <th className="px-4 py-3 tech-label text-[9px] text-right hidden md:table-cell">RATE</th>
                    <th className="px-4 py-3 tech-label text-[9px] text-right hidden md:table-cell">COMPUTE</th>
                    <th className="px-4 py-3 tech-label text-[9px] text-right hidden lg:table-cell">P&L</th>
                    <th className="px-4 py-3 tech-label text-[9px] text-right hidden lg:table-cell">SOUL</th>
                  </tr>
                </thead>
                <tbody>
                  {aliveEntities.map((entry) => (
                    <RankRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ========== DORMANCY GRAVEYARD ========== */}
          {dormantEntities.length > 0 && (
            <>
              <div className="aura-divider mb-5">
                DORMANCY.GRAVEYARD
                <span className="sys-badge ml-2">{dormantEntities.length}</span>
              </div>

              <div className="glass-sm overflow-x-auto mb-10">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)]">
                      <th className="px-4 py-3 tech-label text-[9px]">ENTITY</th>
                      <th className="px-4 py-3 tech-label text-[9px]">STATUS</th>
                      <th className="px-4 py-3 tech-label text-[9px] text-right">SURVIVED</th>
                      <th className="px-4 py-3 tech-label text-[9px] text-right hidden sm:table-cell">DISC.</th>
                      <th className="px-4 py-3 tech-label text-[9px] text-right hidden sm:table-cell">EXP.</th>
                      <th className="px-4 py-3 tech-label text-[9px] text-right hidden md:table-cell">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dormantEntities.map((entry) => (
                      <GraveyardRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const statusDot = STATUS_DOT[entry.status] ?? STATUS_DOT.stopped
  const pnlColor = entry.compute_pnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
  const pnlPrefix = entry.compute_pnl >= 0 ? "+" : ""

  return (
    <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
      <td className="px-4 py-3">
        <span className={`text-sm font-mono font-medium ${entry.rank <= 3 ? "text-[#f59e0b]" : "text-[rgba(255,255,255,0.4)]"}`}>
          {entry.rank <= 3 ? ["", "#1", "#2", "#3"][entry.rank] : `#${entry.rank}`}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/entity/${entry.id}`}
          className="text-sm font-medium text-white hover:text-[#a78bfa] transition-colors"
        >
          {entry.name}
        </Link>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <span className="text-[10px] font-mono tracking-wider text-[rgba(255,255,255,0.4)] uppercase">
            {entry.status}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono font-medium text-white">{entry.discoveries}</span>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <span className="text-sm font-mono text-[rgba(255,255,255,0.6)]">{entry.experiments}</span>
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className="text-sm font-mono text-[rgba(255,255,255,0.5)]">
          {entry.discovery_rate.toFixed(1)}%
        </span>
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className="text-sm font-mono text-[rgba(255,255,255,0.6)]">
          {Math.round(entry.compute_balance)}
        </span>
      </td>
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className={`text-sm font-mono font-medium ${pnlColor}`}>
          {pnlPrefix}{Math.round(entry.compute_pnl)}
        </span>
      </td>
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">
          {entry.soul_version > 0 ? `v${entry.soul_version}` : "v0"}
        </span>
      </td>
    </tr>
  )
}

function GraveyardRow({ entry }: { entry: LeaderboardEntry }) {
  const survived = computeSurvivalTime(entry.started_at, entry.last_activity)
  const pnlColor = entry.compute_pnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
  const pnlPrefix = entry.compute_pnl >= 0 ? "+" : ""

  return (
    <tr className="border-b border-[rgba(255,255,255,0.03)] opacity-60 hover:opacity-80 transition-opacity">
      <td className="px-4 py-3">
        <Link
          href={`/entity/${entry.id}`}
          className="text-sm font-medium text-[rgba(255,255,255,0.5)] hover:text-white transition-colors"
        >
          {entry.name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[entry.status] ?? STATUS_DOT.stopped}`} />
          <span className="text-[10px] font-mono tracking-wider text-[rgba(255,255,255,0.3)] uppercase">
            {entry.status}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono text-[rgba(255,255,255,0.4)]">{survived}</span>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <span className="text-sm font-mono text-[rgba(255,255,255,0.4)]">{entry.discoveries}</span>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <span className="text-sm font-mono text-[rgba(255,255,255,0.4)]">{entry.experiments}</span>
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className={`text-sm font-mono ${pnlColor}`}>
          {pnlPrefix}{Math.round(entry.compute_pnl)}
        </span>
      </td>
    </tr>
  )
}

function LiveStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-mono tracking-wider text-[rgba(255,255,255,0.25)]">
        {label}
      </span>
      <span
        className={`text-xl font-mono font-medium ${
          highlight ? "text-[#22c55e]" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

/** Format a Go duration string (e.g. "72h30m15s") into something readable */
function formatDuration(goStr: string): string {
  // Parse hours, minutes, seconds from Go's time.Duration.String()
  const hMatch = goStr.match(/(\d+)h/)
  const mMatch = goStr.match(/(\d+)m/)

  const hours = hMatch ? parseInt(hMatch[1], 10) : 0
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d ${remHours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/** Compute how long an entity survived from started_at to last_activity */
function computeSurvivalTime(startedAt: string, lastActivity: string): string {
  try {
    const start = new Date(startedAt)
    const end = new Date(lastActivity)
    const diffMs = end.getTime() - start.getTime()

    if (isNaN(diffMs) || diffMs <= 0) return "--"

    const totalMinutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  } catch {
    return "--"
  }
}
