"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from "@/lib/daemon-client"
import Link from "next/link"

type SortField = "discoveries" | "compute" | "pnl" | "discovery_rate"

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "discoveries", label: "DISCOVERIES" },
  { value: "compute", label: "COMPUTE" },
  { value: "pnl", label: "P&L" },
  { value: "discovery_rate", label: "DISC. RATE" },
]

const ROOT_STYLES = {
  "--bg": "#f0f0f0",
  "--fg": "#121212",
  "--dot-size": "1.5px",
  "--grid-size": "6px",
  "--font-mono": "'SF Mono', 'Roboto Mono', 'Courier New', monospace",
} as React.CSSProperties

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>("discoveries")
  const [clock, setClock] = useState("00:00:00.0")

  /** Clock */
  useEffect(() => {
    function tick() {
      const now = new Date()
      const t = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      setClock(`${t}.${Math.floor(now.getMilliseconds() / 100)}`)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [])

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

  const totalDiscoveries = data?.total_discoveries ?? 0

  return (
    <main style={{ ...ROOT_STYLES, background: "var(--bg)", color: "var(--fg)", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", fontSize: 12, lineHeight: 1.4, WebkitFontSmoothing: "antialiased" }}>

      {/* ========== DARK ZONE HEADER ========== */}
      <div style={{ backgroundColor: "var(--fg)", color: "var(--bg)", padding: "24px 32px 0 32px" }}>
        {/* Header bar */}
        <header style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 16, marginBottom: 32 }}>
          <div>
            <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 4 }}>SYSTEM OPERATION</span>
            <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>CIVILIZATION LEADERBOARD // RANKING PROTOCOL</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 4 }}>ACTIVE PROTOCOL</span>
            <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>RANK_SORT_{sortBy.toUpperCase()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 4 }}>LOCAL TIME</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 400, letterSpacing: "-0.02em" }}>{clock}</div>
          </div>
        </header>

        {/* Giant dot-matrix hero + sensor grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", paddingBottom: 24 }}>
          <div>
            <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: 4 }}>TOTAL DISCOVERIES</span>
            <div style={{
              fontSize: "14vw",
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontWeight: 900,
              lineHeight: 0.8,
              letterSpacing: "-0.02em",
              marginLeft: "-0.05em",
              backgroundImage: "radial-gradient(circle at center, #f0f0f0 2px, transparent 2px)",
              backgroundSize: "8px 8px",
              color: "transparent",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}>
              {totalDiscoveries}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>ENTITY ACTIVITY MATRIX</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                {data?.total_alive ?? 0} ALIVE / {(data?.leaderboard.length ?? 0)} TOTAL
              </span>
            </div>
            <SensorGrid />
          </div>
        </div>
      </div>

      {/* ========== DOT TRANSITION ========== */}
      <div style={{
        height: 120,
        backgroundColor: "var(--bg)",
        position: "relative",
        borderBottom: "1px solid rgba(0,0,0,0.1)",
      }}>
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "var(--fg)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 10%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 10%)",
        }} />
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle at center, var(--fg) var(--dot-size), transparent var(--dot-size))",
          backgroundSize: "var(--grid-size) var(--grid-size)",
          backgroundPosition: "center top",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 90%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 90%)",
        }} />
      </div>

      {/* ========== LIGHT ZONE CONTENT ========== */}
      <div style={{ padding: "0 32px 64px 32px" }}>

        {/* ========== LIVE STATS BAR ========== */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, marginBottom: 32, paddingTop: 8 }}>
            <StatCell label="ENTITIES.ALIVE" value={String(data.total_alive)} />
            <StatCell label="TOTAL.DISCOVERIES" value={String(data.total_discoveries)} />
            <StatCell label="TOTAL.EXPERIMENTS" value={String(data.total_experiments)} />
            <StatCell label="CIVILIZATION.AGE" value={data.civilization_age ? formatDuration(data.civilization_age) : "--"} />
          </div>
        )}

        {/* ========== SORT CONTROLS ========== */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, borderTop: "1px solid var(--fg)", paddingTop: 12 }}>
          <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>SORT.BY</span>
          <div style={{ display: "flex", gap: 4 }}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                style={{
                  padding: "6px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  border: "1px solid var(--fg)",
                  backgroundColor: sortBy === opt.value ? "var(--fg)" : "transparent",
                  color: sortBy === opt.value ? "var(--bg)" : "var(--fg)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chain offline warning */}
        {fetchError && (
          <div style={{
            padding: "12px 16px",
            marginBottom: 24,
            border: "1px solid #ef4444",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "#ef4444",
          }}>
            DAEMON OFFLINE OR UNREACHABLE. RETRYING EVERY 15S...
          </div>
        )}

        {/* ========== RANKINGS HEADER ========== */}
        <div style={{ fontSize: 11, fontWeight: 700, borderTop: "1px solid var(--fg)", paddingTop: 8, marginBottom: 16, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
          <span>RANKINGS</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: 11 }}>{aliveEntities.length} ALIVE</span>
        </div>

        {/* Loading / empty states */}
        {loading && !data && !fetchError && (
          <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.4 }}>
            LOADING LEADERBOARD FROM DAEMON...
          </div>
        )}

        {!loading && aliveEntities.length === 0 && !fetchError && (
          <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.4 }}>
            NO ENTITIES SPAWNED YET. BE THE FIRST.
          </div>
        )}

        {/* ========== RANKINGS TABLE ========== */}
        {aliveEntities.length > 0 && (
          <div style={{ overflowX: "auto", marginBottom: 48 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["RANK", "ENTITY", "STATUS", "DISCOVERIES", "EXPERIMENTS", "DISCOVERY RATE", "COMPUTE", "P&L"].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "8px 12px",
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        opacity: 0.7,
                        textAlign: col === "RANK" || col === "ENTITY" || col === "STATUS" ? "left" : "right",
                        borderBottom: "1px solid var(--fg)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
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
            <div style={{ fontSize: 11, fontWeight: 700, borderTop: "1px solid var(--fg)", paddingTop: 8, marginBottom: 16, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
              <span>DORMANCY.GRAVEYARD</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: 11 }}>{dormantEntities.length}</span>
            </div>

            <div style={{ overflowX: "auto", marginBottom: 48 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["ENTITY", "STATUS", "SURVIVED", "DISCOVERIES", "EXPERIMENTS", "P&L"].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "8px 12px",
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          opacity: 0.7,
                          textAlign: col === "ENTITY" || col === "STATUS" ? "left" : "right",
                          borderBottom: "1px solid var(--fg)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
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
    </main>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const pnlColor = entry.compute_pnl >= 0 ? "#22c55e" : "#ef4444"
  const pnlPrefix = entry.compute_pnl >= 0 ? "+" : ""

  const statusColor: Record<string, string> = {
    alive: "#22c55e",
    dormant: "#f59e0b",
    stopped: "#ef4444",
  }

  const maxDiscoveries = 100
  const discPct = Math.min(100, Math.round((entry.discoveries / Math.max(maxDiscoveries, 1)) * 100))

  return (
    <tr style={{ borderBottom: "1px dotted rgba(0,0,0,0.15)" }}>
      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: entry.rank <= 3 ? 700 : 400 }}>
        #{entry.rank}
      </td>
      <td style={{ padding: "10px 12px" }}>
        <Link
          href={`/entity/${entry.id}`}
          style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500 }}
        >
          {entry.name}
        </Link>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: statusColor[entry.status] ?? statusColor.stopped,
            display: "inline-block",
          }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>
            {entry.status}
          </span>
        </span>
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right" }}>
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500 }}>{entry.discoveries}</span>
        </div>
        {/* Spark bar */}
        <div style={{ height: 3, background: "rgba(0,0,0,0.1)", width: 60, marginLeft: "auto", marginTop: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${discPct}%`,
            background: "var(--fg)",
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(128,128,128,0.3) 2px, rgba(128,128,128,0.3) 4px)",
          }} />
        </div>
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, opacity: 0.6 }}>
        {entry.experiments}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, opacity: 0.5 }}>
        {entry.discovery_rate.toFixed(1)}%
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, opacity: 0.6 }}>
        {Math.round(entry.compute_balance)}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: pnlColor }}>
        {pnlPrefix}{Math.round(entry.compute_pnl)}
      </td>
    </tr>
  )
}

function GraveyardRow({ entry }: { entry: LeaderboardEntry }) {
  const survived = computeSurvivalTime(entry.started_at, entry.last_activity)
  const pnlColor = entry.compute_pnl >= 0 ? "#22c55e" : "#ef4444"
  const pnlPrefix = entry.compute_pnl >= 0 ? "+" : ""

  const statusColor: Record<string, string> = {
    alive: "#22c55e",
    dormant: "#f59e0b",
    stopped: "#ef4444",
  }

  return (
    <tr style={{ borderBottom: "1px dotted rgba(0,0,0,0.15)", opacity: 0.5 }}>
      <td style={{ padding: "10px 12px" }}>
        <Link
          href={`/entity/${entry.id}`}
          style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500 }}
        >
          {entry.name}
        </Link>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: statusColor[entry.status] ?? statusColor.stopped,
            display: "inline-block",
          }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {entry.status}
          </span>
        </span>
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {survived}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {entry.discoveries}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {entry.experiments}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: pnlColor }}>
        {pnlPrefix}{Math.round(entry.compute_pnl)}
      </td>
    </tr>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  )
}

function SensorGrid() {
  const [opacities, setOpacities] = useState<number[]>(() => Array(192).fill(0.1))

  useEffect(() => {
    const id = setInterval(() => {
      setOpacities((prev) => {
        const next = [...prev]
        for (let i = 0; i < 15; i++) {
          const r = Math.floor(Math.random() * next.length)
          next[r] = Math.random() * 0.8 + 0.2
        }
        for (let i = 0; i < 10; i++) {
          const r = Math.floor(Math.random() * next.length)
          next[r] = 0.1
        }
        return next
      })
    }, 150)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(32, 1fr)", gap: 2, width: "100%", marginTop: 16 }}>
      {opacities.map((op, i) => (
        <div
          key={i}
          style={{
            aspectRatio: "1",
            backgroundColor: "#f0f0f0",
            borderRadius: "50%",
            opacity: op,
            transition: "opacity 0.4s ease",
          }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Utility functions                                                   */
/* ------------------------------------------------------------------ */

/** Format a Go duration string (e.g. "72h30m15s") into something readable */
function formatDuration(goStr: string): string {
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
