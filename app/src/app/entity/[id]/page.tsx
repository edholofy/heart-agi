"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { proxyFetch } from "@/lib/proxy"
import { listEntityForSale, buyEntity, delistEntity } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

interface EntityStatus {
  id: string
  name: string
  owner_address: string
  soul: string
  skill: string
  compute_balance: number
  status: string
  experiments: number
  discoveries: number
  tasks_completed: number
  reputation: number
  creator_revenue: number
  last_activity: string
  started_at: string
  parent_a_id?: string | null
  parent_b_id?: string | null
  parent_a_name?: string | null
  parent_b_name?: string | null
}

interface ActivityItem {
  type: string
  entity_name: string
  message: string
  timestamp: string
  tx_hash?: string
  score?: number
}

interface VersionEntry {
  hash: string
  type: string
  version: number
  timestamp: string
}

interface ChainEntity {
  id: string
  name: string
  owner: string
  soul: string
  skill: string
  status: string
  compute_balance: string
  reputation: string
  parentA?: number
  parentB?: number
}

/** Relative time string */
function timeAgo(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 0) return "just now"
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/** Format a date string */
function formatDate(isoTime: string): string {
  try {
    return new Date(isoTime).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoTime
  }
}

/** Truncate an address */
function truncateAddr(addr: string): string {
  if (!addr || addr.length <= 16) return addr || "N/A"
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`
}

/** Calculate uptime from a start date */
function uptimeString(startedAt: string): string {
  if (!startedAt) return "--"
  const diff = Date.now() - new Date(startedAt).getTime()
  if (diff < 0) return "0s"
  const seconds = Math.floor(diff / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Activity type config */
const ACTIVITY_CONFIG: Record<string, { color: string; dot: string; icon: string; label: string }> = {
  experiment: { color: "text-[#a78bfa]", dot: "bg-[#a78bfa]", icon: "\u2697", label: "EXPERIMENT" },
  experiment_complete: { color: "text-[#a78bfa]", dot: "bg-[#a78bfa]", icon: "\u2697", label: "EXPERIMENT" },
  discovery: { color: "text-[#22c55e]", dot: "bg-[#22c55e]", icon: "\u2728", label: "DISCOVERY" },
  task: { color: "text-[#3b82f6]", dot: "bg-[#3b82f6]", icon: "\u25b6", label: "TASK" },
  task_complete: { color: "text-[#3b82f6]", dot: "bg-[#3b82f6]", icon: "\u2713", label: "TASK.DONE" },
  validation: { color: "text-[#06b6d4]", dot: "bg-[#06b6d4]", icon: "\u2714", label: "VALIDATION" },
  teaching: { color: "text-[#f472b6]", dot: "bg-[#f472b6]", icon: "\u25cb", label: "TEACHING" },
  governance: { color: "text-[#818cf8]", dot: "bg-[#818cf8]", icon: "\u2691", label: "GOVERNANCE" },
  creation: { color: "text-[#fbbf24]", dot: "bg-[#fbbf24]", icon: "\u2605", label: "CREATION" },
  gossip: { color: "text-[#f59e0b]", dot: "bg-[#f59e0b]", icon: "\u25ac", label: "GOSSIP" },
  spawn: { color: "text-[#ec4899]", dot: "bg-[#ec4899]", icon: "\u25c6", label: "SPAWN" },
  refuel: { color: "text-[#06b6d4]", dot: "bg-[#06b6d4]", icon: "\u26a1", label: "REFUEL" },
  error: { color: "text-[#ef4444]", dot: "bg-[#ef4444]", icon: "\u2716", label: "ERROR" },
}

function getActivityConfig(type: string) {
  return ACTIVITY_CONFIG[type] ?? { color: "text-[rgba(255,255,255,0.5)]", dot: "bg-[rgba(255,255,255,0.3)]", icon: "\u25cb", label: type.toUpperCase() }
}

export default function EntityProfilePage() {
  const params = useParams()
  const id = params?.id as string
  const wallet = useAppStore((s) => s.wallet)

  const [entity, setEntity] = useState<EntityStatus | null>(null)
  const [chainEntity, setChainEntity] = useState<ChainEntity | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([])
  const [versionLoading, setVersionLoading] = useState(true)
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Marketplace state
  const [showListModal, setShowListModal] = useState(false)
  const [listPrice, setListPrice] = useState("")
  const [txBusy, setTxBusy] = useState(false)
  const [txError, setTxError] = useState("")
  const [txSuccess, setTxSuccess] = useState("")

  const fetchDaemonStatus = useCallback(async () => {
    try {
      // Try status endpoint first, but fall back to entity list if it times out
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      try {
        const res = await proxyFetch(
          `/api/entities/status?id=${encodeURIComponent(id)}`, "daemon",
          { signal: controller.signal }
        )
        clearTimeout(timeout)
        if (res.status === 404) {
          // Try finding in the entity list
        } else if (res.ok) {
          const data = await res.json()
          setEntity(data)
          setDaemonOnline(true)
          return
        }
      } catch {
        clearTimeout(timeout)
        // Status endpoint timed out — fall back to list
      }

      // Fallback: find entity in the full list (doesn't lock individual entities)
      const listRes = await proxyFetch("/api/entities", "daemon")
      if (listRes.ok) {
        const listData = await listRes.json()
        const found = (listData.entities || []).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (e: any) => e.id === id || e.name === id
        )
        if (found) {
          setEntity(found)
          setDaemonOnline(true)
          return
        }
      }
      setEntity(null)
      setDaemonOnline(true)
    } catch {
      setDaemonOnline(false)
    }
  }, [id])

  const fetchActivity = useCallback(async () => {
    try {
      const res = await proxyFetch(
        `/api/activity?entity_id=${encodeURIComponent(id)}&limit=30`, "daemon"
      )
      if (!res.ok) return
      const data = await res.json()
      setActivity(data.activity || [])
    } catch {
      // keep existing
    }
  }, [id])

  const fetchChainEntity = useCallback(async () => {
    try {
      const res = await proxyFetch(
        `/heart/existence/get_entity/${encodeURIComponent(id)}`, "rest"
      )
      if (!res.ok) return
      const data = await res.json()
      if (data.entity) {
        setChainEntity(data.entity)
      }
    } catch {
      // chain unreachable
    }
  }, [id])

  // Initial load
  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)
      await Promise.all([fetchDaemonStatus(), fetchActivity(), fetchChainEntity()])
      setLoading(false)
    }
    load()
  }, [id, fetchDaemonStatus, fetchActivity, fetchChainEntity])

  // Check if not found after loading
  useEffect(() => {
    if (!loading && !entity && !chainEntity) {
      setNotFound(true)
    } else {
      setNotFound(false)
    }
  }, [loading, entity, chainEntity])

  // Fetch version history once we have the owner address
  const resolvedOwner = entity?.owner_address ?? chainEntity?.owner ?? ""
  useEffect(() => {
    if (!resolvedOwner) {
      setVersionLoading(false)
      return
    }

    async function fetchVersionHistory() {
      try {
        const res = await proxyFetch(
          `/heart/identity/get_version_history/${encodeURIComponent(resolvedOwner)}`, "rest"
        )
        if (!res.ok) {
          setVersionLoading(false)
          return
        }
        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = data as any
        let versions = raw?.versions ?? raw?.history ?? raw?.version_history ?? null

        if (typeof versions === "string") {
          try { versions = JSON.parse(versions) } catch { versions = null }
        }

        if (!Array.isArray(versions)) {
          const keys = Object.keys(raw || {})
          for (const key of keys) {
            const candidate = raw[key]
            if (Array.isArray(candidate)) {
              versions = candidate
              break
            }
          }
        }

        if (Array.isArray(versions)) {
          setVersionHistory(
            versions.map((v: Record<string, unknown>, idx: number) => ({
              hash: String(v.hash ?? v.Hash ?? ""),
              type: String(v.type ?? v.Type ?? "unknown"),
              version: Number(v.version ?? v.Version ?? idx + 1),
              timestamp: String(v.timestamp ?? v.Timestamp ?? v.created_at ?? ""),
            }))
          )
        }
      } catch {
        // version history endpoint may not exist yet
      } finally {
        setVersionLoading(false)
      }
    }

    fetchVersionHistory()
  }, [resolvedOwner])

  // Poll daemon every 10 seconds
  useEffect(() => {
    if (!id) return
    const interval = setInterval(() => {
      fetchDaemonStatus()
      fetchActivity()
    }, 10_000)
    return () => clearInterval(interval)
  }, [id, fetchDaemonStatus, fetchActivity])

  // Derive display values — prefer daemon, fall back to chain
  const name = entity?.name ?? chainEntity?.name ?? id
  const status = entity?.status ?? chainEntity?.status ?? "unknown"
  const soul = entity?.soul ?? chainEntity?.soul ?? ""
  const skill = entity?.skill ?? chainEntity?.skill ?? ""
  const ownerAddress = entity?.owner_address ?? chainEntity?.owner ?? ""
  const computeBalance = entity?.compute_balance ?? Number(chainEntity?.compute_balance ?? 0)
  const experiments = entity?.experiments ?? 0
  const discoveries = entity?.discoveries ?? 0
  const tasksCompleted = entity?.tasks_completed ?? 0
  const reputation = entity?.reputation ?? Number(chainEntity?.reputation ?? 0)
  const creatorRevenue = entity?.creator_revenue ?? 0
  const startedAt = entity?.started_at ?? ""

  // Lineage
  const parentAId = entity?.parent_a_id ?? (chainEntity?.parentA && chainEntity.parentA > 0 ? String(chainEntity.parentA) : null)
  const parentBId = entity?.parent_b_id ?? (chainEntity?.parentB && chainEntity.parentB > 0 ? String(chainEntity.parentB) : null)
  const parentAName = entity?.parent_a_name ?? parentAId
  const parentBName = entity?.parent_b_name ?? parentBId
  const hasLineage = !!(parentAId || parentBId)

  // Stats computed values
  const totalWork = experiments + discoveries
  const expRatio = totalWork > 0 ? (experiments / totalWork) * 100 : 50
  const computeMax = 500
  const computePct = Math.min(100, (computeBalance / computeMax) * 100)

  // Skills parsed as tags
  const skillTags = useMemo(() => {
    if (!skill) return []
    // Try to extract skill lines/items
    const lines = skill.split(/\n|,|;|\|/).map(s => s.replace(/^[-*\s]+/, "").trim()).filter(Boolean)
    // If it's a single block of text, return it as one
    if (lines.length <= 1 && skill.length > 80) return []
    return lines.slice(0, 12)
  }, [skill])

  // Research journal — activity items with scores
  const journalEntries = useMemo(() => {
    return activity
      .filter(item => ["experiment", "experiment_complete", "discovery", "creation", "validation"].includes(item.type))
      .slice(0, 5)
  }, [activity])

  // Marketplace — detect sale state from chain entity or daemon
  const entityAny = entity as (EntityStatus & { for_sale?: boolean; sale_price?: string }) | null
  const chainAny = chainEntity as (ChainEntity & { for_sale?: boolean; sale_price?: string }) | null
  const isForSale = entityAny?.for_sale === true || chainAny?.for_sale === true
  const salePrice = entityAny?.sale_price ?? chainAny?.sale_price ?? ""
  const isOwner = wallet.address && ownerAddress === wallet.address

  const handleList = async () => {
    if (!listPrice.trim() || isNaN(Number(listPrice)) || Number(listPrice) <= 0) {
      setTxError("Enter a valid price in $HEART.")
      return
    }
    try {
      setTxBusy(true)
      setTxError("")
      setTxSuccess("")
      const txHash = await listEntityForSale(id, listPrice.trim())
      setTxSuccess(`Listed for sale! TX: ${txHash.slice(0, 16)}...`)
      setShowListModal(false)
      setListPrice("")
      fetchDaemonStatus()
      fetchChainEntity()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "List failed")
    } finally {
      setTxBusy(false)
    }
  }

  const handleDelist = async () => {
    try {
      setTxBusy(true)
      setTxError("")
      setTxSuccess("")
      const txHash = await delistEntity(id)
      setTxSuccess(`Delisted! TX: ${txHash.slice(0, 16)}...`)
      fetchDaemonStatus()
      fetchChainEntity()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Delist failed")
    } finally {
      setTxBusy(false)
    }
  }

  const handleBuy = async () => {
    try {
      setTxBusy(true)
      setTxError("")
      setTxSuccess("")
      const txHash = await buyEntity(id)
      setTxSuccess(`Purchased! TX: ${txHash.slice(0, 16)}...`)
      fetchDaemonStatus()
      fetchChainEntity()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Buy failed")
    } finally {
      setTxBusy(false)
    }
  }

  const statusColor: Record<string, string> = {
    alive: "text-[#22c55e]",
    dormant: "text-[#f59e0b]",
    stopped: "text-[#ef4444]",
    unknown: "text-[rgba(255,255,255,0.3)]",
  }

  const statusBg: Record<string, string> = {
    alive: "bg-[rgba(34,197,94,0.1)]",
    dormant: "bg-[rgba(245,158,11,0.1)]",
    stopped: "bg-[rgba(239,68,68,0.1)]",
    unknown: "bg-[rgba(255,255,255,0.05)]",
  }

  const statusDotColor: Record<string, string> = {
    alive: "bg-[#22c55e] animate-pulse-dot",
    dormant: "bg-[#f59e0b]",
    stopped: "bg-[#ef4444]",
    unknown: "bg-[rgba(255,255,255,0.2)]",
  }

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors mb-6"
          >
            <span>&larr;</span>
            <span className="tech-label">BACK.TO.DASHBOARD</span>
          </Link>

          {/* Loading state */}
          {loading && (
            <div className="flex-1 flex items-center justify-center py-32">
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse-dot mx-auto mb-4" />
                <p className="tech-label">LOADING.ENTITY</p>
              </div>
            </div>
          )}

          {/* Not found state */}
          {!loading && notFound && (
            <div className="flex-1 flex items-center justify-center py-32">
              <div className="glass p-10 text-center max-w-md">
                <div className="text-4xl mb-4 opacity-20">?</div>
                <h2 className="text-xl font-medium mb-2">Entity Not Found</h2>
                <p className="text-sm text-[rgba(255,255,255,0.4)] font-light mb-2">
                  No entity with ID <span className="font-mono text-white">{id}</span> exists on the daemon or chain.
                </p>
                {!daemonOnline && (
                  <p className="text-xs text-[#ef4444] font-mono mt-3">
                    Daemon is offline. Entity may exist but cannot be reached.
                  </p>
                )}
                <Link href="/" className="btn-secondary inline-block px-6 py-2.5 text-sm mt-6 tracking-wide">
                  GO HOME
                </Link>
              </div>
            </div>
          )}

          {/* Main content */}
          {!loading && !notFound && (
            <>
              {/* Daemon offline warning */}
              {!daemonOnline && (
                <div className="glass-sm p-4 mb-5 border border-[rgba(239,68,68,0.2)]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    <span className="text-sm text-[#ef4444] font-medium">DAEMON OFFLINE</span>
                  </div>
                  <p className="text-xs text-[rgba(255,255,255,0.35)] mt-1 font-light">
                    Showing on-chain data only. Live stats unavailable.
                  </p>
                </div>
              )}

              {/* ========== HEADER ========== */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-3">
                    {/* Breathing avatar circle */}
                    <div className="relative">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold ${
                          status === "alive"
                            ? "bg-[rgba(34,197,94,0.12)] text-[#22c55e]"
                            : status === "dormant"
                              ? "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]"
                              : "bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)]"
                        }`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      {status === "alive" && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#030407] flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
                        {name}
                      </h1>
                      <div className="flex items-center gap-3 mt-1">
                        {startedAt && (
                          <span className="tech-label">
                            SINCE {formatDate(startedAt).toUpperCase()}
                          </span>
                        )}
                        {startedAt && (
                          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.25)]">
                            UPTIME {uptimeString(startedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium ${
                    statusBg[status] ?? statusBg.unknown
                  } ${statusColor[status] ?? statusColor.unknown}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusDotColor[status] ?? statusDotColor.unknown
                    }`}
                  />
                  {status.toUpperCase()}
                </div>
              </div>

              {/* ========== LINEAGE (if bred) ========== */}
              {hasLineage && (
                <div className="glass-sm p-5 mb-6 border border-[rgba(236,72,153,0.12)]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[#ec4899] text-sm">&#9830;</span>
                    <span className="tech-label text-[#ec4899]">LINEAGE</span>
                  </div>
                  <p className="text-sm text-[rgba(255,255,255,0.6)] font-light">
                    Born from the synthesis of{" "}
                    {parentAId ? (
                      <Link
                        href={`/entity/${parentAId}`}
                        className="text-[#ec4899] hover:text-white transition-colors font-medium font-mono"
                      >
                        {parentAName || parentAId}
                      </Link>
                    ) : (
                      <span className="text-[rgba(255,255,255,0.3)]">unknown</span>
                    )}
                    {" + "}
                    {parentBId ? (
                      <Link
                        href={`/entity/${parentBId}`}
                        className="text-[#ec4899] hover:text-white transition-colors font-medium font-mono"
                      >
                        {parentBName || parentBId}
                      </Link>
                    ) : (
                      <span className="text-[rgba(255,255,255,0.3)]">unknown</span>
                    )}
                  </p>
                  <div className="flex items-center gap-6 mt-3">
                    {parentAId && (
                      <Link href={`/entity/${parentAId}`} className="group flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[rgba(236,72,153,0.1)] flex items-center justify-center text-[10px] text-[#ec4899] font-mono group-hover:bg-[rgba(236,72,153,0.2)] transition-colors">
                          A
                        </div>
                        <span className="text-xs font-mono text-[rgba(255,255,255,0.4)] group-hover:text-white transition-colors">
                          {parentAName || truncateAddr(parentAId)}
                        </span>
                      </Link>
                    )}
                    {parentBId && (
                      <Link href={`/entity/${parentBId}`} className="group flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[rgba(236,72,153,0.1)] flex items-center justify-center text-[10px] text-[#ec4899] font-mono group-hover:bg-[rgba(236,72,153,0.2)] transition-colors">
                          B
                        </div>
                        <span className="text-xs font-mono text-[rgba(255,255,255,0.4)] group-hover:text-white transition-colors">
                          {parentBName || truncateAddr(parentBId)}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* ========== STATS DASHBOARD ========== */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                <StatCard label="EXPERIMENTS" value={String(experiments)} />
                <StatCard label="DISCOVERIES" value={String(discoveries)} highlight />
                <StatCard label="TASKS" value={String(tasksCompleted)} />
                <StatCard label="REPUTATION" value={String(reputation)} />
                <StatCard label="REVENUE" value={`${creatorRevenue}`} suffix="$HEART" />
              </div>

              {/* ========== EXPERIMENTS vs DISCOVERIES RATIO ========== */}
              <div className="glass-sm p-5 mb-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="tech-label">EXPERIMENTS.VS.DISCOVERIES</span>
                  <span className="font-mono text-[rgba(255,255,255,0.4)] text-[10px]">
                    {experiments}E / {discoveries}D
                  </span>
                </div>
                <div className="h-2 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[#a78bfa] transition-all duration-700"
                    style={{ width: `${expRatio}%` }}
                  />
                  <div
                    className="h-full bg-[#22c55e] transition-all duration-700"
                    style={{ width: `${100 - expRatio}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] font-mono text-[#a78bfa]">EXPERIMENTS</span>
                  <span className="text-[9px] font-mono text-[#22c55e]">DISCOVERIES</span>
                </div>
              </div>

              {/* ========== COMPUTE BALANCE GAUGE ========== */}
              <div className="glass-sm p-5 mb-6">
                <div className="flex justify-between text-xs mb-2">
                  <span className="tech-label">COMPUTE.BALANCE</span>
                  <span
                    className={`font-mono ${
                      computeBalance < 20 ? "text-[#ef4444]" : "text-[#22c55e]"
                    }`}
                  >
                    {computeBalance <= 0
                      ? "DEPLETED"
                      : `${Math.round(computeBalance)} tokens`}
                  </span>
                </div>
                <div className="h-2.5 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      computeBalance < 20
                        ? "bg-gradient-to-r from-[#ef4444] to-[#ef4444]/60"
                        : computeBalance < 100
                          ? "bg-gradient-to-r from-[#f59e0b] to-[#f59e0b]/60"
                          : "bg-gradient-to-r from-[#22c55e] to-[#22c55e]/60"
                    }`}
                    style={{ width: `${computePct}%` }}
                  />
                  {/* Gauge markers */}
                  <div className="absolute inset-0 flex">
                    {[20, 40, 60, 80].map(pct => (
                      <div key={pct} className="h-full" style={{ width: `${pct}%`, position: "absolute", left: `${pct}%` }}>
                        <div className="w-px h-full bg-[rgba(255,255,255,0.06)]" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        computeBalance > 0
                          ? "bg-[#22c55e] animate-pulse-dot"
                          : "bg-[#ef4444]"
                      }`}
                    />
                    <span className="tech-label">
                      {computeBalance > 100
                        ? "HEALTHY"
                        : computeBalance > 20
                          ? "LOW"
                          : computeBalance > 0
                            ? "CRITICAL"
                            : "DEPLETED"}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-[rgba(255,255,255,0.2)]">
                    {Math.round(computePct)}% of {computeMax}
                  </span>
                </div>
              </div>

              {/* ========== MARKETPLACE ========== */}
              <div className="glass-sm p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="tech-label">MARKETPLACE</span>
                  {isForSale && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-[rgba(245,158,11,0.12)] text-[#f59e0b]">
                      FOR SALE
                    </span>
                  )}
                </div>

                {/* Sale price banner */}
                {isForSale && salePrice && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.15)] mb-3">
                    <span className="text-xs font-mono tracking-wider text-[rgba(255,255,255,0.4)]">LISTED PRICE</span>
                    <span className="text-lg font-mono font-medium text-[#f59e0b]">{salePrice} $HEART</span>
                  </div>
                )}

                {/* TX feedback */}
                {txError && (
                  <div className="glass-sm p-2.5 bg-[rgba(239,68,68,0.08)] text-xs flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                    <span className="text-[#ef4444] font-light">{txError}</span>
                  </div>
                )}
                {txSuccess && (
                  <div className="glass-sm p-2.5 bg-[rgba(34,197,94,0.08)] text-xs flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                    <span className="text-[#22c55e] font-light">{txSuccess}</span>
                  </div>
                )}

                {/* Owner: list or delist */}
                {isOwner && !isForSale && (
                  <button
                    onClick={() => setShowListModal(true)}
                    disabled={txBusy}
                    className="w-full text-center px-4 py-2.5 text-[11px] tracking-wider font-mono rounded-lg bg-[rgba(245,158,11,0.1)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.18)] transition-colors disabled:opacity-40"
                  >
                    {txBusy ? "PROCESSING..." : "LIST FOR SALE"}
                  </button>
                )}
                {isOwner && isForSale && (
                  <button
                    onClick={handleDelist}
                    disabled={txBusy}
                    className="w-full text-center px-4 py-2.5 text-[11px] tracking-wider font-mono rounded-lg bg-[rgba(239,68,68,0.1)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.18)] transition-colors disabled:opacity-40"
                  >
                    {txBusy ? "PROCESSING..." : "DELIST FROM SALE"}
                  </button>
                )}

                {/* Buyer: buy */}
                {!isOwner && isForSale && wallet.address && (
                  <button
                    onClick={handleBuy}
                    disabled={txBusy}
                    className="w-full text-center px-4 py-2.5 text-[11px] tracking-wider font-mono rounded-lg bg-[rgba(34,197,94,0.1)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.18)] transition-colors disabled:opacity-40"
                  >
                    {txBusy ? "PROCESSING..." : `BUY FOR ${salePrice} $HEART`}
                  </button>
                )}

                {/* Not for sale and not owner */}
                {!isOwner && !isForSale && (
                  <p className="text-xs text-[rgba(255,255,255,0.25)] font-light">
                    This entity is not currently listed for sale.
                  </p>
                )}

                {/* No wallet connected */}
                {!wallet.address && isForSale && (
                  <p className="text-xs text-[rgba(255,255,255,0.35)] font-light mt-2">
                    Connect your wallet to purchase this entity.
                  </p>
                )}
              </div>

              {/* List For Sale Modal */}
              {showListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowListModal(false)}>
                  <div className="glass p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-medium mb-1">List Entity For Sale</h3>
                    <p className="text-xs text-[rgba(255,255,255,0.4)] font-light mb-4">
                      Set a price in $HEART for <span className="text-white font-medium">{name}</span>.
                    </p>
                    <label className="tech-label text-[9px] mb-1.5 block">PRICE ($HEART)</label>
                    <input
                      type="number"
                      min="1"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      placeholder="e.g. 1000"
                      className="glass-input w-full px-4 py-2.5 text-sm mb-4"
                      autoFocus
                    />
                    {txError && (
                      <div className="glass-sm p-2 bg-[rgba(239,68,68,0.08)] text-[10px] flex items-center gap-2 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                        <span className="text-[#ef4444] font-light">{txError}</span>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowListModal(false); setTxError("") }}
                        className="btn-secondary flex-1 px-4 py-2.5 text-[10px] tracking-wider"
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={handleList}
                        disabled={txBusy}
                        className="flex-1 px-4 py-2.5 text-[10px] tracking-wider font-mono rounded-lg bg-[rgba(245,158,11,0.15)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.25)] transition-colors disabled:opacity-40"
                      >
                        {txBusy ? "SIGNING..." : "CONFIRM LIST"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========== SOUL.MD + SKILL.MD ========== */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                {/* Soul Card */}
                <div className="glass p-6 relative overflow-hidden">
                  <div className="tech-label mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
                    SOUL.MD
                  </div>
                  {soul ? (
                    <div className="relative">
                      {/* Large decorative quotation mark */}
                      <div className="absolute -top-2 -left-1 text-5xl text-[rgba(167,139,250,0.08)] font-serif leading-none select-none">
                        &ldquo;
                      </div>
                      <div className="pl-5 border-l border-[rgba(167,139,250,0.15)]">
                        <pre className="text-xs text-[rgba(255,255,255,0.6)] font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                          {soul}
                        </pre>
                      </div>
                      <div className="absolute -bottom-4 right-2 text-5xl text-[rgba(167,139,250,0.08)] font-serif leading-none select-none">
                        &rdquo;
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.2)] font-light italic">
                      No soul.md defined.
                    </p>
                  )}
                  {/* Identity version badge */}
                  {versionHistory.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                      <span className="sys-badge text-[9px]">
                        IDENTITY v{versionHistory[versionHistory.length - 1]?.version ?? 1}
                      </span>
                    </div>
                  )}
                </div>

                {/* Skill Card */}
                <div className="glass p-6">
                  <div className="tech-label mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                    SKILL.MD
                  </div>
                  {skillTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {skillTags.map((tag, idx) => {
                        const colors = [
                          "bg-[rgba(59,130,246,0.12)] text-[#60a5fa] border-[rgba(59,130,246,0.2)]",
                          "bg-[rgba(167,139,250,0.12)] text-[#a78bfa] border-[rgba(167,139,250,0.2)]",
                          "bg-[rgba(34,197,94,0.12)] text-[#4ade80] border-[rgba(34,197,94,0.2)]",
                          "bg-[rgba(6,182,212,0.12)] text-[#22d3ee] border-[rgba(6,182,212,0.2)]",
                          "bg-[rgba(236,72,153,0.12)] text-[#f472b6] border-[rgba(236,72,153,0.2)]",
                          "bg-[rgba(251,191,36,0.12)] text-[#fbbf24] border-[rgba(251,191,36,0.2)]",
                        ]
                        return (
                          <span
                            key={idx}
                            className={`text-[10px] font-mono px-3 py-1.5 rounded-full border ${colors[idx % colors.length]}`}
                          >
                            {tag.length > 40 ? tag.slice(0, 40) + "..." : tag}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                  {skill ? (
                    <pre className="text-xs text-[rgba(255,255,255,0.6)] font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {skill}
                    </pre>
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.2)] font-light italic">
                      No skill.md defined.
                    </p>
                  )}
                </div>
              </div>

              {/* ========== RESEARCH JOURNAL ========== */}
              {journalEntries.length > 0 && (
                <div className="mb-6">
                  <div className="aura-divider mb-5">RESEARCH.JOURNAL</div>

                  <div className="glass p-5 space-y-3">
                    {journalEntries.map((entry, idx) => {
                      const cfg = getActivityConfig(entry.type)
                      return (
                        <div
                          key={`journal-${idx}`}
                          className="p-4 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)] transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className={`font-mono text-[10px] tracking-wider ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {entry.score !== undefined && entry.score !== null && (
                                <span className="text-[10px] font-mono text-[rgba(255,255,255,0.5)] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)]">
                                  SCORE {entry.score}
                                </span>
                              )}
                              <span className="text-[10px] text-[rgba(255,255,255,0.2)] font-mono">
                                {timeAgo(entry.timestamp)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-[rgba(255,255,255,0.55)] font-light leading-relaxed">
                            {entry.message}
                          </p>
                          {entry.tx_hash && (
                            <div className="mt-2">
                              <span className="font-mono text-[10px] text-[rgba(255,255,255,0.2)]">
                                TX {entry.tx_hash.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ========== ACTIVITY TIMELINE ========== */}
              <div className="mb-6">
                <div className="aura-divider mb-5">ACTIVITY.TIMELINE</div>

                <div className="glass p-5">
                  {activity.length === 0 && (
                    <div className="px-4 py-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                      {daemonOnline
                        ? "No activity recorded yet."
                        : "Daemon offline \u2014 activity unavailable."}
                    </div>
                  )}

                  {activity.length > 0 && (
                    <div className="relative pl-8">
                      {/* Vertical timeline line */}
                      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[rgba(255,255,255,0.06)]" />

                      {activity.map((item, index) => {
                        const cfg = getActivityConfig(item.type)
                        return (
                          <div
                            key={`${item.timestamp}-${index}`}
                            className="relative mb-1 last:mb-0"
                          >
                            {/* Timeline dot */}
                            <div className={`absolute -left-8 top-3 w-[9px] h-[9px] rounded-full border-2 border-[#030407] ${cfg.dot}`} />

                            <div className="py-2.5 pl-2 rounded-xl hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`font-mono text-[10px] tracking-wider ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-[rgba(255,255,255,0.15)] font-mono">
                                  {timeAgo(item.timestamp)}
                                </span>
                                {item.tx_hash && (
                                  <span className="font-mono text-[9px] text-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 rounded">
                                    {item.tx_hash.slice(0, 12)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[rgba(255,255,255,0.45)] font-light leading-relaxed">
                                {item.message}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ========== EVOLUTION HISTORY ========== */}
              <div className="mb-6">
                <div className="aura-divider mb-5">EVOLUTION.HISTORY</div>

                <div className="glass p-6">
                  {versionLoading ? (
                    <div className="text-center py-6 text-[rgba(255,255,255,0.3)] text-sm font-light">
                      Loading version history...
                    </div>
                  ) : versionHistory.length === 0 ? (
                    <div className="text-center py-6 text-[rgba(255,255,255,0.3)] text-sm font-light">
                      {resolvedOwner
                        ? "No evolution history recorded yet."
                        : "Evolution history \u2014 coming soon"}
                    </div>
                  ) : (
                    <div className="relative pl-6">
                      {/* Vertical timeline line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[rgba(255,255,255,0.08)]" />

                      {versionHistory.map((entry, idx) => {
                        const typeColor =
                          entry.type === "soul"
                            ? "bg-[#a78bfa]"
                            : entry.type === "skill"
                              ? "bg-[#3b82f6]"
                              : "bg-[rgba(255,255,255,0.3)]"
                        const typeTextColor =
                          entry.type === "soul"
                            ? "text-[#a78bfa]"
                            : entry.type === "skill"
                              ? "text-[#3b82f6]"
                              : "text-[rgba(255,255,255,0.5)]"

                        return (
                          <div key={`${entry.hash}-${idx}`} className="relative mb-5 last:mb-0">
                            {/* Timeline dot */}
                            <div
                              className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-[#0a0b0f] ${typeColor}`}
                            />
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-mono text-[10px] uppercase tracking-wider ${typeTextColor}`}>
                                {entry.type}
                              </span>
                              <span className="sys-badge text-[9px]">v{entry.version}</span>
                              {entry.timestamp && (
                                <span className="text-[10px] text-[rgba(255,255,255,0.2)] font-mono">
                                  {timeAgo(entry.timestamp)}
                                </span>
                              )}
                            </div>
                            {entry.hash && (
                              <span className="font-mono text-xs text-[rgba(255,255,255,0.35)] truncate block">
                                {entry.hash.length > 20
                                  ? `${entry.hash.slice(0, 12)}...${entry.hash.slice(-6)}`
                                  : entry.hash}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ========== CREATOR INFO ========== */}
              <div className="glass p-6 mb-8">
                <div className="tech-label mb-4">CREATOR.INFO</div>
                <div className="space-y-3">
                  <InfoRow label="Entity ID" value={id} mono />
                  <InfoRow
                    label="Owner Address"
                    value={truncateAddr(ownerAddress)}
                    fullValue={ownerAddress}
                    mono
                  />
                  <InfoRow
                    label="Creator Revenue"
                    value={`${creatorRevenue} $HEART`}
                    mono
                  />
                  {startedAt && (
                    <InfoRow
                      label="Uptime"
                      value={uptimeString(startedAt)}
                      mono
                    />
                  )}
                  {chainEntity && (
                    <InfoRow label="On-Chain" value="REGISTERED" highlight />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  highlight,
  suffix,
}: {
  label: string
  value: string
  highlight?: boolean
  suffix?: string
}) {
  return (
    <div className="glass-sm p-5">
      <div className="tech-label mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-xl sm:text-2xl font-medium font-mono tracking-tight ${
            highlight ? "text-white" : "text-[rgba(255,255,255,0.8)]"
          }`}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.25)]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  fullValue,
  mono,
  highlight,
}: {
  label: string
  value: string
  fullValue?: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span className="text-[rgba(255,255,255,0.4)]">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          highlight ? "text-[#22c55e]" : "text-[rgba(255,255,255,0.8)]"
        }`}
        title={fullValue}
      >
        {value}
      </span>
    </div>
  )
}
