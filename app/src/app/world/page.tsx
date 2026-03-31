"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

const ACTIVITY_INTERVAL = 3000
const ENTITY_INTERVAL = 10000
const CHAIN_INTERVAL = 15000

/* ─── Types ─── */

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

/* ─── Activity type config ─── */

const ACTIVITY_LABELS: Record<string, string> = {
  experiment: "EXPERIMENT",
  discovery: "DISCOVERY",
  task: "TASK",
  validation: "VALIDATION",
  teaching: "TEACHING",
  creation: "CREATION",
  dormant: "DORMANT",
}

/* ─── Relative time ─── */

function timeAgo(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatTimestamp(isoTime: string): string {
  try {
    return new Date(isoTime).toISOString().substring(11, 23)
  } catch {
    return "00:00:00.000"
  }
}

/* ─── Page ─── */

export default function WorldPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [stats, setStats] = useState<WorldStats>({
    totalEntities: 0,
    totalAlive: 0,
    totalExperiments: 0,
    totalDiscoveries: 0,
    totalTasks: 0,
    blockHeight: null,
  })
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
  const isFirstLoad = useRef(true)

  /* ── Fetch activity feed ── */
  const fetchActivity = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/activity?limit=50", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()

      const entries: ActivityEntry[] = Array.isArray(data)
        ? data
        : data.activity || data.activities || data.data || []

      setActivities((prev) => {
        if (isFirstLoad.current) {
          isFirstLoad.current = false
          setInitialLoading(false)
          return entries
        }

        const existingIds = new Set(prev.map((a) => a.id))
        const fresh = entries.filter((e) => !existingIds.has(e.id))

        if (fresh.length > 0) {
          setNewIds(new Set(fresh.map((e) => e.id)))
          setTimeout(() => setNewIds(new Set()), 800)
        }

        if (fresh.length === 0) return prev
        return [...fresh, ...prev].slice(0, 100)
      })

      setDaemonOnline(true)
    } catch {
      setDaemonOnline(false)
      setInitialLoading(false)
    }
  }, [])

  /* ── Fetch entities ── */
  const fetchEntities = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/entities", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()

      const list: Entity[] = Array.isArray(data)
        ? data
        : data.entities || data.data || []

      setEntities(list)

      const alive = list.filter(
        (e) => e.status === "alive" || e.status === "active"
      )
      setStats((prev) => ({
        ...prev,
        totalEntities: list.length,
        totalAlive: alive.length,
        totalExperiments: list.reduce(
          (sum, e) => sum + (e.experiments_run || 0),
          0
        ),
        totalDiscoveries: list.reduce(
          (sum, e) => sum + (e.discoveries || 0),
          0
        ),
        totalTasks: list.reduce(
          (sum, e) => sum + (e.tasks_completed || 0),
          0
        ),
      }))
    } catch {
      // keep existing data
    }
  }, [])

  /* ── Fetch chain block height ── */
  const fetchChain = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      const data = await res.json()
      const height = data.result?.sync_info?.latest_block_height || null
      setStats((prev) => ({ ...prev, blockHeight: height }))
    } catch {
      // keep existing
    }
  }, [])

  /* ── Polling ── */
  useEffect(() => {
    fetchActivity()
    fetchEntities()
    fetchChain()

    const activityInterval = setInterval(fetchActivity, ACTIVITY_INTERVAL)
    const entityInterval = setInterval(fetchEntities, ENTITY_INTERVAL)
    const chainInterval = setInterval(fetchChain, CHAIN_INTERVAL)

    return () => {
      clearInterval(activityInterval)
      clearInterval(entityInterval)
      clearInterval(chainInterval)
    }
  }, [fetchActivity, fetchEntities, fetchChain])

  const alivePercent =
    stats.totalEntities > 0
      ? Math.round((stats.totalAlive / stats.totalEntities) * 100)
      : 0

  return (
    <main className="flex flex-col min-h-screen" style={{ background: "var(--fg)" }}>

      {/* ── Dark zone header ── */}
      <div className="zone-dark" style={{ paddingTop: 32, paddingBottom: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "end",
            paddingBottom: 16,
          }}
        >
          <div>
            <span className="label">SYSTEM OPERATION</span>
            <div
              style={{
                fontFamily: "var(--font-mono-sys)",
                fontSize: 14,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              WORLD VIEW // LIVE TELEMETRY
            </div>
            <div style={{ marginTop: 16 }}>
              <span className="label">ACTIVE PROTOCOL</span>
              <div className="value">HEART_DAEMON_V1</div>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="label">NETWORK STATUS</span>
              <span className="value">
                {daemonOnline ? "ONLINE" : "OFFLINE"} /{" "}
                {stats.totalEntities} NODES
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(24, 1fr)",
                gap: 2,
                marginTop: 8,
              }}
            >
              {Array.from({ length: 72 }).map((_, i) => (
                <div
                  key={i}
                  className="sensor-node"
                  style={{
                    opacity:
                      i < Math.floor(72 * (alivePercent / 100))
                        ? 0.3 + Math.random() * 0.6
                        : 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stat bar with spark bars */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 32,
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: 16,
          }}
        >
          <SparkStat
            label="ENTITIES_ALIVE"
            value={`${stats.totalAlive}/${stats.totalEntities}`}
            pct={alivePercent}
          />
          <SparkStat
            label="EXPERIMENTS"
            value={stats.totalExperiments.toLocaleString()}
            pct={Math.min(100, stats.totalExperiments)}
          />
          <SparkStat
            label="DISCOVERIES"
            value={stats.totalDiscoveries.toLocaleString()}
            pct={Math.min(100, stats.totalDiscoveries * 10)}
          />
          <SparkStat
            label="TASKS_DONE"
            value={stats.totalTasks.toLocaleString()}
            pct={Math.min(100, stats.totalTasks)}
          />
        </div>

      </div>

      {/* ── Transition ── */}
      <div className="zone-transition" />

      {/* ── Light zone: content ── */}
      <div className="zone-light" style={{ paddingTop: 0 }}>
        {/* Daemon offline warning */}
        {!daemonOnline && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              border: "1px solid rgba(239,68,68,0.3)",
              fontFamily: "var(--font-mono-sys)",
              fontSize: 11,
              color: "#ef4444",
            }}
          >
            DAEMON_OFFLINE: Retrying every {ACTIVITY_INTERVAL / 1000}s...
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
          }}
        >
          {/* ── Left: Entity list ── */}
          <div>
            <div className="col-header">ACTIVE ENTITIES</div>
            <ul style={{ listStyle: "none" }}>
              {entities.length === 0 && (
                <li
                  className="data-row"
                  style={{
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 12,
                    opacity: 0.5,
                  }}
                >
                  {daemonOnline
                    ? "Loading entities..."
                    : "Daemon offline"}
                </li>
              )}
              {entities.map((entity) => {
                const isAlive =
                  entity.status === "alive" || entity.status === "active"

                return (
                  <li key={entity.id} className="data-row">
                    <Link
                      href={`/entity/${entity.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <span className="row-key" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: isAlive ? "#22c55e" : "#ef4444",
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                          className={isAlive ? "animate-pulse-dot" : ""}
                        />
                        {entity.name}
                      </span>
                      <span className="row-val">
                        {entity.status.toUpperCase()} / {(entity.compute_balance || 0).toLocaleString()} COMPUTE
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ── Right: Event log ── */}
          <div>
            <div className="col-header">EVENT LOG // TRACE</div>
            <ul style={{ listStyle: "none" }}>
              {initialLoading && activities.length === 0 && daemonOnline && (
                <li
                  className="data-row"
                  style={{
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 12,
                    opacity: 0.5,
                  }}
                >
                  Loading feed...
                </li>
              )}

              {!initialLoading && activities.length === 0 && daemonOnline && (
                <li
                  className="data-row"
                  style={{
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 12,
                    opacity: 0.5,
                  }}
                >
                  Waiting for activity...
                </li>
              )}

              {activities.length === 0 && !daemonOnline && (
                <li
                  className="data-row"
                  style={{
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 12,
                    opacity: 0.5,
                  }}
                >
                  No connection to daemon.
                </li>
              )}

              {activities.map((activity) => {
                const isNew = newIds.has(activity.id)
                const typeLabel =
                  ACTIVITY_LABELS[activity.type] || "EVENT"

                return (
                  <li
                    key={activity.id}
                    className="data-row"
                    style={{
                      opacity: isNew ? 0 : 1,
                      animation: isNew
                        ? "fadeSlideIn 0.5s ease-out forwards"
                        : undefined,
                      fontSize: 12,
                    }}
                  >
                    <span className="row-key" style={{ opacity: 0.6, fontFamily: "var(--font-mono-sys)", fontSize: 11 }}>
                      {formatTimestamp(activity.timestamp)}
                    </span>
                    <span className="row-val" style={{ fontSize: 11 }}>
                      {typeLabel} [{activity.entity_name || "?"}] {activity.message.length > 60 ? activity.message.slice(0, 60) + "..." : activity.message}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* ── Block height footer ── */}
        <div
          style={{
            marginTop: 32,
            borderTop: "1px solid rgba(0,0,0,0.1)",
            paddingTop: 12,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono-sys)",
            fontSize: 10,
            opacity: 0.4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>HEART AUTONOMOUS BLOCKCHAIN</span>
          <span>
            {stats.blockHeight
              ? `BLOCK #${Number(stats.blockHeight).toLocaleString()}`
              : "CHAIN: SYNCING"}
          </span>
        </div>
      </div>

      {/* Slide-in animation for new activity entries */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  )
}

/* ─── Spark Stat (dark zone) ─── */

function SparkStat({
  label,
  value,
  pct,
}: {
  label: string
  value: string
  pct: number
}) {
  return (
    <div className="spark-row">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="label" style={{ opacity: 0.5 }}>{label}</span>
        <span
          className="value"
          style={{ fontSize: 11, color: "var(--bg)" }}
        >
          {value}
        </span>
      </div>
      <div
        className="spark-bar-container"
        style={{ background: "rgba(255,255,255,0.1)" }}
      >
        <div
          className="spark-bar"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: "var(--bg)",
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 2px, var(--fg) 2px, var(--fg) 4px)",
          }}
        />
      </div>
    </div>
  )
}

/* ─── Top Entity Brain Monitor (dark zone) ─── */

