"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

interface ActivityEntry { id: string; entity_id: string; entity_name: string; type: string; message: string; timestamp: string }
interface Entity { id: string; name: string; status: string; compute_balance: number; experiments_run: number; discoveries: number; tasks_completed: number; current_model?: string; reputation?: number; soul_version?: number }
interface Patch { id: string; entity: string; module: string; file: string; description: string; diff: string; status: string; timestamp: string }
interface WorldStats { totalEntities: number; totalAlive: number; totalExperiments: number; totalDiscoveries: number; totalTasks: number; blockHeight: string | null }

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

/* ── Sparkline ── */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 80}`).join(" ")
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 32 }}>
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      <polygon fill="url(#spk)" points={`0,100 ${pts} 100,100`} />
    </svg>
  )
}

/* ── Entity Card ── */
function EntityCard({ entity, activities, rank }: { entity: Entity; activities: ActivityEntry[]; rank: number }) {
  const isAlive = entity.status === "alive" || entity.status === "active"
  const entityActs = activities.filter((a) => a.entity_name === entity.name)
  const lastAct = entityActs[0]
  const compute = entity.compute_balance || 0

  const sparkVals = useMemo(() => {
    const v = Array(10).fill(0)
    entityActs.slice(0, 20).forEach((a, i) => { v[Math.min(9, Math.floor(i / 2))] += a.type === "discovery" ? 3 : 1 })
    return v.reverse()
  }, [entityActs])

  return (
    <Link href={`/entity/${entity.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{
        background: "#fff", borderRadius: 16, overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)", padding: "20px 20px 16px",
        transition: "transform 200ms cubic-bezier(0.22,1,0.36,1), box-shadow 200ms",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = "translateY(-3px)"; el.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)" }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = "none"; el.style.boxShadow = "none" }}
      >
        {/* Top: avatar + name + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#121212", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "var(--font-sans)", flexShrink: 0,
          }}>
            {entity.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#121212", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entity.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {entity.current_model || "auto"} · v{entity.soul_version || 0}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isAlive ? "#121212" : "rgba(0,0,0,0.15)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: isAlive ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)", textTransform: "uppercase" }}>{entity.status}</span>
          </div>
        </div>

        {/* Compute + sparkline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Compute</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#121212", lineHeight: 1 }}>
              {compute >= 1000 ? `${(compute / 1000).toFixed(1)}K` : compute.toFixed(0)}
            </div>
          </div>
          <div style={{ width: 80 }}>
            <Sparkline values={sparkVals} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
          {[
            { label: "Disc.", value: String(entity.discoveries || 0) },
            { label: "Exp.", value: String(entity.experiments_run || 0) },
            { label: "Tasks", value: String(entity.tasks_completed || 0) },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#121212" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Last activity */}
        {lastAct && (
          <div style={{
            marginTop: 12, padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 8,
            fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {lastAct.message.slice(0, 70)}{lastAct.message.length > 70 ? "..." : ""}
            <span style={{ float: "right", color: "rgba(0,0,0,0.15)" }}>{timeAgo(lastAct.timestamp)}</span>
          </div>
        )}
      </div>
    </Link>
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

  const sorted = useMemo(() => [...entities].sort((a, b) => (b.discoveries || 0) - (a.discoveries || 0)), [entities])
  const discoveries = useMemo(() => activities.filter((a) => a.type === "discovery"), [activities])

  return (
    <main style={{ background: "#ffffff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 0" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "#121212", marginBottom: 8 }}>
              World
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "rgba(0,0,0,0.4)" }}>
              {stats.totalAlive} entities alive · {stats.totalDiscoveries.toLocaleString()} discoveries
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: daemonOnline ? "#121212" : "rgba(0,0,0,0.15)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)" }}>
                {stats.blockHeight ? `#${Number(stats.blockHeight).toLocaleString()}` : "syncing"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
          {[
            { label: "Entities", value: `${stats.totalAlive}`, sub: `/ ${stats.totalEntities}` },
            { label: "Discoveries", value: stats.totalDiscoveries.toLocaleString(), sub: null },
            { label: "Experiments", value: stats.totalExperiments.toLocaleString(), sub: null },
            { label: "Block Height", value: stats.blockHeight ? `#${Number(stats.blockHeight).toLocaleString()}` : "—", sub: null },
          ].map((s) => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#121212", lineHeight: 1 }}>
                {s.value}
                {s.sub && <span style={{ fontSize: 13, color: "rgba(0,0,0,0.2)", fontWeight: 400 }}> {s.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Entity Cards ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 600, color: "#121212" }}>All Entities</h2>
            <Link href="/leaderboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.04em" }}>Leaderboard →</Link>
          </div>

          {initialLoading && entities.length === 0 && (
            <div style={{ padding: 64, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(0,0,0,0.2)" }}>Loading entities...</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {sorted.map((entity, i) => (
              <EntityCard key={entity.id} entity={entity} activities={activities} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* ── Bottom: Feed + Artifacts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 48 }}>

          {/* Live feed */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#121212" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#121212" }}>Live Feed</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.2)" }}>{activities.length} events</span>
            </div>
            <div style={{ maxHeight: 460, overflowY: "auto" }}>
              {activities.slice(0, 30).map((a) => {
                const isNew = newIds.has(a.id)
                return (
                  <div key={a.id} style={{
                    padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)",
                    opacity: isNew ? 0 : 1, animation: isNew ? "fadeSlideIn 0.4s ease-out forwards" : undefined,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,0.15)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 12, color: "#121212" }}>{a.entity_name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.25)", textTransform: "uppercase" }}>{a.type?.replace(/_/g, " ")}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.15)", marginLeft: "auto" }}>{timeAgo(a.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 2, paddingLeft: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.message}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Patches + Discoveries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Code patches */}
            {patches.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#121212" }}>Code Patches</span>
                  <Link href="/evolution" style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.25)", textDecoration: "none" }}>See all →</Link>
                </div>
                {patches.map((p) => (
                  <div key={p.id} style={{ padding: "12px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#121212" }}>{p.entity}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.3)" }}>compiled</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.25)" }}>{p.module}/{p.file}</div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Discoveries */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.05)", overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#121212" }}>Discoveries</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {discoveries.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.15)" }}>Waiting...</div>
                )}
                {discoveries.slice(0, 10).map((d) => (
                  <div key={d.id} style={{ padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#121212" }}>{d.entity_name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.15)" }}>{timeAgo(d.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {d.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 0 48px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.15)", textTransform: "uppercase", letterSpacing: "0.06em", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <span>$HEART</span>
          <span>{stats.blockHeight ? `Block #${Number(stats.blockHeight).toLocaleString()}` : "Syncing"}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  )
}
