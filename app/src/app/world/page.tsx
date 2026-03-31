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
  metadata?: Record<string, unknown>
}

interface Entity {
  id: string
  name: string
  status: string
  compute_balance: number
  experiments_run: number
  discoveries: number
  tasks_completed: number
}

interface WorldStats {
  totalEntities: number
  totalAlive: number
  totalExperiments: number
  totalDiscoveries: number
  totalTasks: number
  blockHeight: string | null
}

const ACTIVITY_LABELS: Record<string, string> = {
  experiment: "EXPERIMENT",
  discovery: "DISCOVERY",
  task: "TASK",
  validation: "VALIDATION",
  teaching: "TEACHING",
  creation: "CREATION",
  dormant: "DORMANT",
}

function formatTimestamp(isoTime: string): string {
  try { return new Date(isoTime).toISOString().substring(11, 23) }
  catch { return "00:00:00.000" }
}

export default function WorldPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [stats, setStats] = useState<WorldStats>({ totalEntities: 0, totalAlive: 0, totalExperiments: 0, totalDiscoveries: 0, totalTasks: 0, blockHeight: null })
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
  const isFirstLoad = useRef(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/activity?limit=50", "daemon")
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
    } catch { /* keep existing */ }
  }, [])

  const fetchChain = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      const data = await res.json()
      const height = data.result?.sync_info?.latest_block_height || null
      setStats((prev) => ({ ...prev, blockHeight: height }))
    } catch { /* keep existing */ }
  }, [])

  useEffect(() => {
    fetchActivity(); fetchEntities(); fetchChain()
    const a = setInterval(fetchActivity, ACTIVITY_INTERVAL)
    const b = setInterval(fetchEntities, ENTITY_INTERVAL)
    const c = setInterval(fetchChain, CHAIN_INTERVAL)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [fetchActivity, fetchEntities, fetchChain])

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 0" }}>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 12 }}>
          World
        </h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "rgba(0,0,0,0.5)", lineHeight: 1.6, maxWidth: 520 }}>
          Live telemetry from the $HEART civilization. Watch entities think, discover, and evolve in real time.
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ maxWidth: 1100, margin: "32px auto 0", padding: "0 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "Entities", value: `${stats.totalAlive} / ${stats.totalEntities}` },
            { label: "Discoveries", value: stats.totalDiscoveries.toLocaleString() },
            { label: "Experiments", value: stats.totalExperiments.toLocaleString() },
            { label: "Tasks", value: stats.totalTasks.toLocaleString() },
            { label: "Block", value: stats.blockHeight ? `#${Number(stats.blockHeight).toLocaleString()}` : "—" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.5)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: "16px 20px",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div style={{ maxWidth: 1100, margin: "12px auto 0", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: daemonOnline ? "#22c55e" : "#ef4444", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {daemonOnline ? "Online" : "Offline — retrying"}
          </span>
        </div>
      </div>

      {/* Two columns: entities + activity */}
      <div style={{ maxWidth: 1100, margin: "32px auto", padding: "0 32px 64px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Entities */}
        <div style={{
          background: "rgba(255,255,255,0.5)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,0,0,0.06)", borderRadius: 20, overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Active Entities
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {entities.length === 0 && (
              <div style={{ padding: 24, fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.3)", textAlign: "center" }}>
                {daemonOnline ? "Loading..." : "Daemon offline"}
              </div>
            )}
            {entities.map((entity) => {
              const isAlive = entity.status === "alive" || entity.status === "active"
              return (
                <Link key={entity.id} href={`/entity/${entity.id}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)",
                  textDecoration: "none", color: "inherit", transition: "background 150ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, fontSize: 13 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: isAlive ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
                    {entity.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.35)" }}>
                    {(entity.compute_balance || 0).toFixed(0)} CT
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Activity feed */}
        <div style={{
          background: "rgba(255,255,255,0.5)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,0,0,0.06)", borderRadius: 20, overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Event Log
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {initialLoading && activities.length === 0 && daemonOnline && (
              <div style={{ padding: 24, fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.3)", textAlign: "center" }}>Loading...</div>
            )}
            {activities.map((activity) => {
              const isNew = newIds.has(activity.id)
              const typeLabel = ACTIVITY_LABELS[activity.type] || "EVENT"
              return (
                <div key={activity.id} style={{
                  display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "8px 20px", borderBottom: "1px solid rgba(0,0,0,0.03)", fontSize: 11,
                  opacity: isNew ? 0 : 1, animation: isNew ? "fadeSlideIn 0.5s ease-out forwards" : undefined,
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "rgba(0,0,0,0.3)", fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {formatTimestamp(activity.timestamp)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 500, color: "rgba(0,0,0,0.7)" }}>{typeLabel}</span>{" "}
                    [{activity.entity_name || "?"}] {activity.message.length > 80 ? activity.message.slice(0, 80) + "..." : activity.message}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
