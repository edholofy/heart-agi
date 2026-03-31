"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

const ACTIVITY_INTERVAL = 3000
const ENTITY_INTERVAL = 10000
const CHAIN_INTERVAL = 15000

interface ActivityEntry {
  id: string
  entity_id: string
  entity_name: string
  type: string
  message: string
  timestamp: string
}

interface Entity {
  id: string
  name: string
  status: string
  compute_balance: number
  experiments_run: number
  discoveries: number
  tasks_completed: number
  soul?: string
  skill?: string
  current_model?: string
}

interface WorldStats {
  totalEntities: number
  totalAlive: number
  totalExperiments: number
  totalDiscoveries: number
  totalTasks: number
  blockHeight: string | null
}

const TYPE_COLORS: Record<string, string> = {
  experiment: "#6366f1",
  discovery: "#22c55e",
  task: "#f59e0b",
  validation: "#06b6d4",
  teaching: "#8b5cf6",
  creation: "#ec4899",
  dormant: "#ef4444",
  autoresearch: "#c69c76",
  code_patch: "#22c55e",
}

function timeAgo(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return "now"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function WorldPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [stats, setStats] = useState<WorldStats>({ totalEntities: 0, totalAlive: 0, totalExperiments: 0, totalDiscoveries: 0, totalTasks: 0, blockHeight: null })
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const isFirstLoad = useRef(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/activity?limit=80", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()
      const entries: ActivityEntry[] = Array.isArray(data) ? data : data.activity || data.activities || data.data || []
      setActivities((prev) => {
        if (isFirstLoad.current) { isFirstLoad.current = false; setInitialLoading(false); return entries }
        const existingIds = new Set(prev.map((a) => a.id))
        const fresh = entries.filter((e) => !existingIds.has(e.id))
        if (fresh.length > 0) { setNewIds(new Set(fresh.map((e) => e.id))); setTimeout(() => setNewIds(new Set()), 800) }
        if (fresh.length === 0) return prev
        return [...fresh, ...prev].slice(0, 100)
      })
      setDaemonOnline(true)
    } catch { setDaemonOnline(false); setInitialLoading(false) }
  }, [])

  const fetchEntities = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/entities", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()
      const list: Entity[] = Array.isArray(data) ? data : data.entities || data.data || []
      setEntities(list)
      const alive = list.filter((e) => e.status === "alive" || e.status === "active")
      setStats((prev) => ({
        ...prev, totalEntities: list.length, totalAlive: alive.length,
        totalExperiments: list.reduce((s, e) => s + (e.experiments_run || 0), 0),
        totalDiscoveries: list.reduce((s, e) => s + (e.discoveries || 0), 0),
        totalTasks: list.reduce((s, e) => s + (e.tasks_completed || 0), 0),
      }))
    } catch { /* keep */ }
  }, [])

  const fetchChain = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      const data = await res.json()
      const height = data.result?.sync_info?.latest_block_height || null
      setStats((prev) => ({ ...prev, blockHeight: height }))
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    fetchActivity(); fetchEntities(); fetchChain()
    const a = setInterval(fetchActivity, ACTIVITY_INTERVAL)
    const b = setInterval(fetchEntities, ENTITY_INTERVAL)
    const c = setInterval(fetchChain, CHAIN_INTERVAL)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [fetchActivity, fetchEntities, fetchChain])

  const aliveEntities = entities.filter((e) => e.status === "alive" || e.status === "active")
  const dormantEntities = entities.filter((e) => e.status !== "alive" && e.status !== "active")

  // Get activity counts per entity for the last hour
  const entityActivityCounts = new Map<string, number>()
  activities.forEach((a) => {
    entityActivityCounts.set(a.entity_name, (entityActivityCounts.get(a.entity_name) || 0) + 1)
  })

  // Discovery feed (filtered)
  const discoveries = activities.filter((a) => a.type === "discovery")
  const recentActivity = activities.slice(0, 40)

  return (
    <main style={{ background: "#0a0a0a", color: "#f0f0f0", minHeight: "100vh" }}>

      {/* ── HERO HEADER ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0, marginBottom: 8 }}>
              World
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              Live view of the $HEART civilization — {stats.totalAlive} entities thinking right now
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: daemonOnline ? "#22c55e" : "#ef4444", animation: daemonOnline ? "pulse-dot 2s ease-in-out infinite" : "none" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              {stats.blockHeight ? `BLK #${Number(stats.blockHeight).toLocaleString()}` : "SYNCING"}
            </span>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
          {[
            { label: "Alive", value: stats.totalAlive, total: stats.totalEntities, color: "#22c55e" },
            { label: "Discoveries", value: stats.totalDiscoveries, total: null, color: "#c69c76" },
            { label: "Experiments", value: stats.totalExperiments, total: null, color: "#6366f1" },
            { label: "Tasks", value: stats.totalTasks, total: null, color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: "20px 24px", backdropFilter: "blur(20px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {s.value.toLocaleString()}
                {s.total !== null && <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontWeight: 400 }}> / {s.total}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 64px", display: "grid", gridTemplateColumns: "300px 1fr 340px", gap: 16 }}>

        {/* ── LEFT: Entity Population ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Alive */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Population</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#22c55e" }}>{aliveEntities.length} alive</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {aliveEntities.map((entity) => {
                const actCount = entityActivityCounts.get(entity.name) || 0
                const isSelected = selectedEntity?.id === entity.id
                return (
                  <div key={entity.id}
                    onClick={() => setSelectedEntity(isSelected ? null : entity)}
                    style={{
                      padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                      cursor: "pointer", transition: "background 150ms",
                      background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse-dot 2s ease-in-out infinite", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{entity.name}</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                        {(entity.compute_balance || 0).toFixed(0)} CT
                      </span>
                    </div>
                    {/* Activity bar */}
                    <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, actCount * 3)}%`, background: "linear-gradient(90deg, #22c55e, #c69c76)", borderRadius: 2, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                      <span>{entity.discoveries || 0} disc</span>
                      <span>{entity.experiments_run || 0} exp</span>
                    </div>
                  </div>
                )
              })}
              {dormantEntities.length > 0 && (
                <div style={{ padding: "8px 20px", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.15)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  Dormant ({dormantEntities.length})
                </div>
              )}
              {dormantEntities.slice(0, 5).map((entity) => (
                <div key={entity.id} style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.02)", opacity: 0.4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                      {entity.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.15)" }}>DORMANT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER: Live Activity Feed ── */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Live Activity</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{activities.length} events</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 600 }}>
            {initialLoading && activities.length === 0 && daemonOnline && (
              <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Loading feed...</div>
            )}
            {recentActivity.map((activity) => {
              const isNew = newIds.has(activity.id)
              const color = TYPE_COLORS[activity.type] || "#666"
              const typeLabel = activity.type?.toUpperCase().replace(/\s+/g, "_") || "EVENT"

              return (
                <div key={activity.id} style={{
                  padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  opacity: isNew ? 0 : 1, animation: isNew ? "fadeSlideIn 0.5s ease-out forwards" : undefined,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>{typeLabel}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>{timeAgo(activity.timestamp)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" }}>{activity.entity_name || "?"}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activity.message}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Entity Detail + Discoveries ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Entity detail card */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {selectedEntity ? "Entity Profile" : "Select an Entity"}
              </span>
            </div>
            {selectedEntity ? (
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, #22c55e, #c69c76)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
                    {selectedEntity.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedEntity.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                      {selectedEntity.status} · {selectedEntity.current_model || "auto"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Compute", value: (selectedEntity.compute_balance || 0).toFixed(0) },
                    { label: "Discoveries", value: String(selectedEntity.discoveries || 0) },
                    { label: "Experiments", value: String(selectedEntity.experiments_run || 0) },
                    { label: "Tasks", value: String(selectedEntity.tasks_completed || 0) },
                  ].map((s) => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 500 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <Link href={`/entity/${selectedEntity.id}`} style={{
                  display: "block", textAlign: "center", marginTop: 12, padding: "8px 16px",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.5)",
                  textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em",
                  transition: "all 150ms",
                }}>
                  View Full Profile →
                </Link>
              </div>
            ) : (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                Click an entity to inspect
              </div>
            )}
          </div>

          {/* Recent discoveries */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent Discoveries</span>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {discoveries.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.15)" }}>Waiting for discoveries...</div>
              )}
              {discoveries.slice(0, 15).map((d) => (
                <div key={d.id} style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#22c55e" }}>{d.entity_name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{timeAgo(d.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {d.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 32px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.15)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <span>$HEART Autonomous Blockchain</span>
        <span>{stats.blockHeight ? `Block #${Number(stats.blockHeight).toLocaleString()}` : "Syncing"}</span>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </main>
  )
}
