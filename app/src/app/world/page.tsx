"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

interface ActivityEntry { id: string; entity_id: string; entity_name: string; type: string; message: string; timestamp: string }
interface Entity { id: string; name: string; status: string; compute_balance: number; experiments_run: number; discoveries: number; tasks_completed: number; current_model?: string; reputation?: number; soul_version?: number }
interface Patch { id: string; entity: string; module: string; file: string; description: string; diff: string; status: string; timestamp: string }
interface WorldStats { totalEntities: number; totalAlive: number; totalExperiments: number; totalDiscoveries: number; totalTasks: number; blockHeight: string | null }

const TYPE_COLORS: Record<string, string> = { experiment: "#6366f1", discovery: "#22c55e", task: "#f59e0b", dormant: "#ef4444", autoresearch: "#c69c76", code_patch: "#10b981" }
const GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)",
  "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
  "linear-gradient(135deg, #f5576c, #ff6a88)",
  "linear-gradient(135deg, #c471f5, #fa71cd)",
]

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/* ================================================================== */
/*  Mini Sparkline (fake activity chart from entity stats)             */
/* ================================================================== */

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 80}`).join(" ")
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 40 }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <polygon fill={`url(#sg-${color.replace("#", "")})`} points={`0,100 ${points} 100,100`} />
    </svg>
  )
}

/* ================================================================== */
/*  Entity Card                                                        */
/* ================================================================== */

function EntityCard({ entity, recentActivities, rank }: { entity: Entity; recentActivities: ActivityEntry[]; rank: number }) {
  const gradient = GRADIENTS[hashCode(entity.name) % GRADIENTS.length]
  const isAlive = entity.status === "alive" || entity.status === "active"
  const entityActivities = recentActivities.filter((a) => a.entity_name === entity.name)
  const lastActivity = entityActivities[0]
  const compute = entity.compute_balance || 0

  // Generate sparkline values from activity pattern
  const sparkValues = useMemo(() => {
    const vals = Array(12).fill(0)
    entityActivities.slice(0, 30).forEach((a, i) => {
      vals[Math.min(11, Math.floor(i / 3))] += a.type === "discovery" ? 3 : 1
    })
    return vals.reverse()
  }, [entityActivities])

  const changeColor = sparkValues[sparkValues.length - 1] >= sparkValues[sparkValues.length - 2] ? "#22c55e" : "#ef4444"

  return (
    <Link href={`/entity/${entity.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{
        background: "#fff", borderRadius: 16, overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)",
        transition: "transform 200ms, box-shadow 200ms",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)" }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = "none"; el.style.boxShadow = "none" }}
      >
        {/* Card hero — gradient with entity initial */}
        <div style={{
          height: 120, background: gradient, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Rank badge */}
          {rank <= 3 && (
            <div style={{
              position: "absolute", top: 12, left: 12,
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "4px 10px",
              fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", fontWeight: 500,
            }}>
              #{rank}
            </div>
          )}
          {/* Status dot */}
          <div style={{
            position: "absolute", top: 12, right: 12,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
            borderRadius: 8, padding: "4px 10px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isAlive ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>
              {entity.status}
            </span>
          </div>
          {/* Large initial */}
          <span style={{ fontSize: 56, fontWeight: 800, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)" }}>
            {entity.name.charAt(0).toUpperCase()}
          </span>
          {/* Entity name pill */}
          <div style={{
            position: "absolute", bottom: 12, left: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff",
            }}>
              {entity.name.charAt(0).toUpperCase()}
            </div>
            <span style={{
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "4px 12px",
              fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff", fontWeight: 500,
            }}>
              {entity.name}
            </span>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: "16px 16px 12px" }}>
          {/* Stats row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                COMPUTE
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#121212" }}>
                {compute >= 1000 ? `${(compute / 1000).toFixed(1)}K` : compute.toFixed(0)}
              </div>
            </div>
            {/* Mini sparkline */}
            <div style={{ width: 80 }}>
              <Sparkline values={sparkValues} color={changeColor} />
            </div>
          </div>

          {/* Bottom stats */}
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
            <div>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Discoveries</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#121212" }}>{entity.discoveries || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Experiments</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#121212" }}>{entity.experiments_run || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Model</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#121212" }}>{entity.current_model || "auto"}</div>
            </div>
          </div>

          {/* Last activity */}
          {lastActivity && (
            <div style={{
              marginTop: 12, padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 8,
              fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              <span style={{ color: TYPE_COLORS[lastActivity.type] || "#666", fontWeight: 500 }}>
                {lastActivity.type?.toUpperCase()}
              </span>{" "}
              {lastActivity.message.slice(0, 60)}{lastActivity.message.length > 60 ? "..." : ""}
              <span style={{ float: "right", color: "rgba(0,0,0,0.2)" }}>{timeAgo(lastActivity.timestamp)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

/* ================================================================== */
/*  Live Feed Ticker                                                   */
/* ================================================================== */

function LiveTicker({ activities, newIds }: { activities: ActivityEntry[]; newIds: Set<string> }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Live Feed</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.25)" }}>{activities.length} events</span>
      </div>
      <div style={{ maxHeight: 480, overflowY: "auto" }}>
        {activities.slice(0, 30).map((a) => {
          const isNew = newIds.has(a.id)
          const color = TYPE_COLORS[a.type] || "rgba(0,0,0,0.3)"
          return (
            <div key={a.id} style={{
              padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)",
              display: "flex", gap: 12, alignItems: "flex-start",
              opacity: isNew ? 0 : 1, animation: isNew ? "fadeSlideIn 0.4s ease-out forwards" : undefined,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#121212" }}>{a.entity_name || "?"}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, fontWeight: 500, textTransform: "uppercase" }}>{a.type?.replace(/_/g, " ")}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.2)", marginLeft: "auto", flexShrink: 0 }}>{timeAgo(a.timestamp)}</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.message}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default function WorldPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [patches, setPatches] = useState<Patch[]>([])
  const [stats, setStats] = useState<WorldStats>({ totalEntities: 0, totalAlive: 0, totalExperiments: 0, totalDiscoveries: 0, totalTasks: 0, blockHeight: null })
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
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
      setStats((prev) => ({ ...prev, blockHeight: data.result?.sync_info?.latest_block_height || null }))
    } catch { /* keep */ }
  }, [])

  const fetchPatches = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/code-proposals", "daemon")
      if (!res.ok) return
      const data = await res.json()
      if (data.patches) setPatches(data.patches.slice(0, 5))
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    fetchActivity(); fetchEntities(); fetchChain(); fetchPatches()
    const a = setInterval(fetchActivity, 3000)
    const b = setInterval(fetchEntities, 10000)
    const c = setInterval(fetchChain, 15000)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [fetchActivity, fetchEntities, fetchChain, fetchPatches])

  const sortedEntities = useMemo(() =>
    [...entities].sort((a, b) => (b.discoveries || 0) - (a.discoveries || 0)),
    [entities]
  )

  const aliveEntities = useMemo(() =>
    sortedEntities.filter((e) => e.status === "alive" || e.status === "active"),
    [sortedEntities]
  )

  const topEntity = aliveEntities[0]
  const discoveries = useMemo(() => activities.filter((a) => a.type === "discovery"), [activities])

  return (
    <main style={{ background: "#f5f3ee", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 0" }}>
        {/* Hero featured entity */}
        {topEntity && (
          <Link href={`/entity/${topEntity.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{
              background: GRADIENTS[hashCode(topEntity.name) % GRADIENTS.length],
              borderRadius: 24, padding: "40px 48px", position: "relative", overflow: "hidden",
              marginBottom: 32, minHeight: 200,
              display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              cursor: "pointer", transition: "transform 200ms",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.99)" }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none" }}
            >
              {/* Background text */}
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 200, fontWeight: 900, color: "rgba(255,255,255,0.08)", fontFamily: "var(--font-sans)", lineHeight: 1, pointerEvents: "none" }}>
                {topEntity.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>
                    {topEntity.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{topEntity.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>
                      #{1} · {topEntity.current_model || "auto"} · soul v{topEntity.soul_version || 0}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 32 }}>
                  {[
                    { label: "Compute", value: (topEntity.compute_balance || 0).toFixed(0) },
                    { label: "Discoveries", value: String(topEntity.discoveries || 0) },
                    { label: "Experiments", value: String(topEntity.experiments_run || 0) },
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 16px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.8)" }}>THINKING NOW</span>
              </div>
            </div>
          </Link>
        )}

        {/* Section: All Entities */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, color: "#121212" }}>All Entities</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: daemonOnline ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)" }}>
              {stats.blockHeight ? `BLK #${Number(stats.blockHeight).toLocaleString()}` : "SYNCING"} · {stats.totalAlive} alive
            </span>
          </div>
        </div>

        {/* Entity cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 48 }}>
          {initialLoading && entities.length === 0 && (
            <div style={{ gridColumn: "1/-1", padding: 48, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(0,0,0,0.2)" }}>Loading entities...</div>
          )}
          {sortedEntities.map((entity, i) => (
            <EntityCard key={entity.id} entity={entity} recentActivities={activities} rank={i + 1} />
          ))}
        </div>

        {/* Bottom section: Live feed + Patches + Discoveries */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
          {/* Live feed */}
          <LiveTicker activities={activities} newIds={newIds} />

          {/* Right column: patches + discoveries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Code patches */}
            {patches.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Code Patches</span>
                  <Link href="/evolution" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)", textDecoration: "none" }}>See all →</Link>
                </div>
                {patches.map((p) => (
                  <div key={p.id} style={{ padding: "12px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#121212" }}>{p.entity}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#22c55e", fontWeight: 500 }}>COMPILED</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{p.module}/{p.file}</div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent discoveries */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#22c55e" }}>Latest Discoveries</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {discoveries.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.15)" }}>Waiting for discoveries...</div>
                )}
                {discoveries.slice(0, 10).map((d) => (
                  <div key={d.id} style={{ padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>{d.entity_name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.2)" }}>{timeAgo(d.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {d.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "24px 0 48px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.2)", textTransform: "uppercase", letterSpacing: "0.06em", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <span>$HEART Autonomous Blockchain</span>
          <span>{stats.blockHeight ? `Block #${Number(stats.blockHeight).toLocaleString()}` : "Syncing"}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </main>
  )
}
