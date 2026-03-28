"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
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

const ACTIVITY_TYPES: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  experiment: {
    icon: "",
    color: "rgba(255,255,255,0.6)",
    bg: "rgba(255,255,255,0.03)",
    label: "EXPERIMENT",
  },
  discovery: {
    icon: "",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.06)",
    label: "DISCOVERY",
  },
  task: {
    icon: "",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.06)",
    label: "TASK",
  },
  validation: {
    icon: "",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.06)",
    label: "VALIDATION",
  },
  teaching: {
    icon: "",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.06)",
    label: "TEACHING",
  },
  creation: {
    icon: "",
    color: "#f97316",
    bg: "rgba(249,115,22,0.06)",
    label: "CREATION",
  },
  dormant: {
    icon: "",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.06)",
    label: "DORMANT",
  },
}

const DEFAULT_TYPE = {
  icon: "",
  color: "rgba(255,255,255,0.5)",
  bg: "rgba(255,255,255,0.03)",
  label: "EVENT",
}

function getActivityType(type: string) {
  return ACTIVITY_TYPES[type] || DEFAULT_TYPE
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

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-4xl font-medium tracking-[-0.03em]">
                WORLD
                <span className="text-[rgba(255,255,255,0.4)]">.VIEW</span>
              </h1>
              <span className="sys-badge">SYS</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 tech-label">
                <span
                  className={`w-2 h-2 rounded-full ${
                    daemonOnline
                      ? "bg-[#22c55e] animate-pulse-dot"
                      : "bg-[#ef4444]"
                  }`}
                />
                <span>{daemonOnline ? "LIVE" : "OFFLINE"}</span>
              </div>
              <span className="sys-badge">
                {stats.totalEntities} ENTITIES
              </span>
            </div>
          </div>

          {/* ── Daemon offline warning ── */}
          {!daemonOnline && (
            <div className="glass-sm p-4 mb-6 bg-[rgba(239,68,68,0.08)] text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] mr-2 align-middle" />
              <span className="text-[#ef4444] font-light">
                Daemon offline or unreachable. Retrying every {ACTIVITY_INTERVAL / 1000}s...
              </span>
            </div>
          )}

          {/* ── Main grid: Feed + Sidebar ── */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Activity Feed (main) ── */}
            <div className="flex-1 min-w-0">
              <div className="aura-divider mb-5">LIVE.FEED</div>

              <div className="space-y-2">
                {activities.length === 0 && daemonOnline && (
                  <div className="glass-sm p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                    Waiting for activity...
                  </div>
                )}

                {activities.length === 0 && !daemonOnline && (
                  <div className="glass-sm p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                    No connection to daemon. Activity feed unavailable.
                  </div>
                )}

                {activities.map((activity) => {
                  const config = getActivityType(activity.type)
                  const isNew = newIds.has(activity.id)

                  return (
                    <div
                      key={activity.id}
                      className="glass-sm p-4 transition-all duration-500"
                      style={{
                        background: config.bg,
                        opacity: isNew ? 0 : 1,
                        transform: isNew
                          ? "translateY(-8px)"
                          : "translateY(0)",
                        animation: isNew
                          ? "fadeSlideIn 0.5s ease-out forwards"
                          : undefined,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type icon */}
                        <span className="text-lg mt-0.5 shrink-0">
                          {config.icon}
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm text-white">
                              {activity.entity_name || "Unknown"}
                            </span>
                            <span
                              className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full"
                              style={{
                                color: config.color,
                                background: config.bg,
                                border: `1px solid ${config.color}33`,
                              }}
                            >
                              {config.label}
                            </span>
                            <span className="text-[rgba(255,255,255,0.25)] text-xs font-light ml-auto shrink-0">
                              {timeAgo(activity.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-[rgba(255,255,255,0.5)] font-light leading-relaxed">
                            {activity.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Sidebar ── */}
            <div className="w-full lg:w-80 shrink-0 space-y-6">
              {/* Stats */}
              <div>
                <div className="aura-divider mb-5">WORLD.STATS</div>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  <WorldStatCard
                    label="ENTITIES.ALIVE"
                    value={stats.totalAlive.toString()}
                    total={stats.totalEntities}
                    color="#22c55e"
                    live
                  />
                  <WorldStatCard
                    label="EXPERIMENTS"
                    value={stats.totalExperiments.toLocaleString()}
                    color="rgba(255,255,255,0.6)"
                  />
                  <WorldStatCard
                    label="DISCOVERIES"
                    value={stats.totalDiscoveries.toLocaleString()}
                    color="#fbbf24"
                  />
                  <WorldStatCard
                    label="TASKS.DONE"
                    value={stats.totalTasks.toLocaleString()}
                    color="#22c55e"
                  />
                  <WorldStatCard
                    label="BLOCK.HEIGHT"
                    value={
                      stats.blockHeight
                        ? `#${Number(stats.blockHeight).toLocaleString()}`
                        : "---"
                    }
                    color="rgba(255,255,255,0.5)"
                    live={!!stats.blockHeight}
                  />
                </div>
              </div>

              {/* Entity list */}
              <div>
                <div className="aura-divider mb-5">ENTITIES</div>
                <div className="space-y-2">
                  {entities.length === 0 && (
                    <div className="glass-sm p-4 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                      {daemonOnline
                        ? "Loading entities..."
                        : "Daemon offline"}
                    </div>
                  )}

                  {entities.map((entity) => {
                    const isAlive =
                      entity.status === "alive" ||
                      entity.status === "active"

                    return (
                      <Link
                        key={entity.id}
                        href={`/entity/${entity.id}`}
                        className="glass-sm p-4 block hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isAlive
                                ? "bg-[#22c55e] animate-pulse-dot"
                                : "bg-[#ef4444]"
                            }`}
                          />
                          <span className="text-sm font-medium text-white truncate group-hover:underline underline-offset-2">
                            {entity.name}
                          </span>
                          <span className="ml-auto text-[10px] font-mono text-[rgba(255,255,255,0.3)] uppercase">
                            {entity.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-[rgba(255,255,255,0.35)]">
                          <span>
                            {(entity.compute_balance || 0).toLocaleString()}{" "}
                            COMPUTE
                          </span>
                          <span>
                            {entity.experiments_run || 0} EXP
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
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

/* ─── Stat Card ─── */

function WorldStatCard({
  label,
  value,
  total,
  color,
  live,
}: {
  label: string
  value: string
  total?: number
  color: string
  live?: boolean
}) {
  return (
    <div className="glass-sm p-4">
      <div className="tech-label mb-1.5 flex items-center gap-1.5">
        {live && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
        )}
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-xl font-medium font-mono tracking-tight"
          style={{ color }}
        >
          {value}
        </span>
        {total !== undefined && (
          <span className="text-xs font-mono text-[rgba(255,255,255,0.25)]">
            / {total}
          </span>
        )}
      </div>
    </div>
  )
}
