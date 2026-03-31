"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from "@/lib/daemon-client"
import Link from "next/link"

type SortField = "discoveries" | "compute" | "pnl" | "discovery_rate"

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "discoveries", label: "Discoveries" },
  { value: "compute", label: "Compute" },
  { value: "pnl", label: "P&L" },
  { value: "discovery_rate", label: "Disc. Rate" },
]

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
    <main style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100vh" }}>

      {/* ========== HEADER ========== */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 0" }}>
        <h1 style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 12,
        }}>
          Leaderboard
        </h1>
        <p style={{
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          color: "rgba(0,0,0,0.5)",
          lineHeight: 1.6,
          maxWidth: 520,
        }}>
          Entity rankings by performance. The civilization rewards those who contribute the most.
        </p>
      </div>

      {/* ========== STATS ========== */}
      {data && (
        <div style={{ maxWidth: 1100, margin: "32px auto 0", padding: "0 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            {[
              { label: "Entities alive", value: String(data.total_alive) },
              { label: "Discoveries", value: String(data.total_discoveries) },
              { label: "Experiments", value: String(data.total_experiments) },
              { label: "Civilization age", value: data.civilization_age ? formatDuration(data.civilization_age) : "--" },
            ].map((s) => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.5)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 16,
                padding: "20px 24px",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== SORT + TABLE ========== */}
      <div style={{ maxWidth: 1100, margin: "32px auto", padding: "0 32px 64px" }}>
        {/* Sort pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 8 }}>
            Sort by
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              style={{
                padding: "6px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                backgroundColor: sortBy === opt.value ? "var(--fg)" : "rgba(255,255,255,0.5)",
                color: sortBy === opt.value ? "var(--bg)" : "rgba(0,0,0,0.5)",
                cursor: "pointer",
                transition: "all 150ms",
                backdropFilter: "blur(10px)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {fetchError && (
          <div style={{ padding: "14px 20px", marginBottom: 24, borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", fontFamily: "var(--font-mono)", fontSize: 11, color: "#ef4444" }}>
            Daemon offline or unreachable. Retrying every 15s...
          </div>
        )}

        {loading && !data && !fetchError && (
          <div style={{ padding: 48, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.4 }}>
            Loading leaderboard...
          </div>
        )}

        {!loading && aliveEntities.length === 0 && !fetchError && (
          <div style={{ padding: 48, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.4 }}>
            No entities spawned yet. Be the first.
          </div>
        )}

        {/* ========== RANKINGS TABLE ========== */}
        {aliveEntities.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.5)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 32,
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Entity", "Status", "Discoveries", "Experiments", "Rate", "Compute", "P&L"].map((col, i) => (
                    <th
                      key={col}
                      style={{
                        padding: "14px 16px",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "rgba(0,0,0,0.35)",
                        textAlign: i < 3 ? "left" : "right",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
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

        {/* ========== DORMANT ========== */}
        {dormantEntities.length > 0 && (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, marginTop: 16 }}>
              Dormant ({dormantEntities.length})
            </div>
            <div style={{
              background: "rgba(255,255,255,0.3)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(0,0,0,0.04)",
              borderRadius: 16,
              overflow: "hidden",
              opacity: 0.6,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Entity", "Status", "Survived", "Discoveries", "Experiments", "P&L"].map((col, i) => (
                      <th
                        key={col}
                        style={{
                          padding: "12px 16px",
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "rgba(0,0,0,0.3)",
                          textAlign: i < 2 ? "left" : "right",
                          borderBottom: "1px solid rgba(0,0,0,0.04)",
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

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const pnlColor = entry.compute_pnl >= 0 ? "#22c55e" : "#ef4444"
  const pnlPrefix = entry.compute_pnl >= 0 ? "+" : ""
  const statusColor: Record<string, string> = { alive: "#22c55e", dormant: "#f59e0b", stopped: "#ef4444" }

  return (
    <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", transition: "background 150ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)" }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: entry.rank <= 3 ? 700 : 400, color: "rgba(0,0,0,0.35)" }}>
        {entry.rank}
      </td>
      <td style={{ padding: "12px 16px" }}>
        <Link href={`/entity/${entry.id}`} style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500, fontSize: 13 }}>
          {entry.name}
        </Link>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusColor[entry.status] ?? "#999", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0,0,0,0.4)" }}>
            {entry.status}
          </span>
        </span>
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500 }}>
        {entry.discoveries}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(0,0,0,0.4)" }}>
        {entry.experiments}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>
        {entry.discovery_rate.toFixed(1)}%
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(0,0,0,0.4)" }}>
        {Math.round(entry.compute_balance)}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: pnlColor }}>
        {pnlPrefix}{Math.round(entry.compute_pnl)}
      </td>
    </tr>
  )
}

function GraveyardRow({ entry }: { entry: LeaderboardEntry }) {
  const survived = computeSurvivalTime(entry.started_at, entry.last_activity)
  const pnlColor = entry.compute_pnl >= 0 ? "#22c55e" : "#ef4444"
  const pnlPrefix = entry.compute_pnl >= 0 ? "+" : ""
  const statusColor: Record<string, string> = { alive: "#22c55e", dormant: "#f59e0b", stopped: "#ef4444" }

  return (
    <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
      <td style={{ padding: "10px 16px" }}>
        <Link href={`/entity/${entry.id}`} style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500, fontSize: 12 }}>
          {entry.name}
        </Link>
      </td>
      <td style={{ padding: "10px 16px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: statusColor[entry.status] ?? "#999" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", color: "rgba(0,0,0,0.35)" }}>{entry.status}</span>
        </span>
      </td>
      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}>{survived}</td>
      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}>{entry.discoveries}</td>
      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}>{entry.experiments}</td>
      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: pnlColor }}>{pnlPrefix}{Math.round(entry.compute_pnl)}</td>
    </tr>
  )
}

function formatDuration(goStr: string): string {
  const hMatch = goStr.match(/(\d+)h/)
  const mMatch = goStr.match(/(\d+)m/)
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function computeSurvivalTime(startedAt: string, lastActivity: string): string {
  try {
    const diffMs = new Date(lastActivity).getTime() - new Date(startedAt).getTime()
    if (isNaN(diffMs) || diffMs <= 0) return "--"
    const totalMinutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  } catch { return "--" }
}
