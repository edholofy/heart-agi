"use client"

import { useState, useEffect, useCallback } from "react"
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
}

interface ActivityItem {
  type: string
  entity_name: string
  message: string
  timestamp: string
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
  return `${days}d ago`
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

/** Activity type color mapping */
function activityColor(type: string): string {
  switch (type) {
    case "experiment":
    case "experiment_complete":
      return "text-[#a78bfa]" // purple
    case "discovery":
      return "text-[#22c55e]" // green
    case "task":
    case "task_complete":
      return "text-[#3b82f6]" // blue
    case "gossip":
      return "text-[#f59e0b]" // amber
    case "spawn":
      return "text-[#ec4899]" // pink
    case "refuel":
      return "text-[#06b6d4]" // cyan
    case "error":
      return "text-[#ef4444]" // red
    default:
      return "text-[rgba(255,255,255,0.5)]"
  }
}

/** Activity type dot color */
function activityDotColor(type: string): string {
  switch (type) {
    case "experiment":
    case "experiment_complete":
      return "bg-[#a78bfa]"
    case "discovery":
      return "bg-[#22c55e]"
    case "task":
    case "task_complete":
      return "bg-[#3b82f6]"
    case "gossip":
      return "bg-[#f59e0b]"
    case "spawn":
      return "bg-[#ec4899]"
    case "refuel":
      return "bg-[#06b6d4]"
    case "error":
      return "bg-[#ef4444]"
    default:
      return "bg-[rgba(255,255,255,0.3)]"
  }
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
      const res = await proxyFetch(
        `/api/entities/status?id=${encodeURIComponent(id)}`, "daemon"
      )
      if (res.status === 404) {
        setEntity(null)
        setDaemonOnline(true)
        return
      }
      if (!res.ok) {
        setDaemonOnline(false)
        return
      }
      const data = await res.json()
      setEntity(data)
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
                  <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
                    {name}
                  </h1>
                  {startedAt && (
                    <p className="tech-label mt-2">
                      SINCE {formatDate(startedAt).toUpperCase()}
                    </p>
                  )}
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

              {/* ========== STATS ROW ========== */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <StatCard label="EXPERIMENTS" value={String(experiments)} />
                <StatCard label="DISCOVERIES" value={String(discoveries)} highlight />
                <StatCard label="TASKS" value={String(tasksCompleted)} />
                <StatCard label="REPUTATION" value={String(reputation)} />
              </div>

              {/* ========== COMPUTE BALANCE ========== */}
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
                <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      computeBalance < 20 ? "bg-[#ef4444]" : "bg-[#22c55e]"
                    }`}
                    style={{
                      width: `${Math.min(100, (computeBalance / 500) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
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
                      : computeBalance > 0
                        ? "LOW"
                        : "DEPLETED"}
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
                <div className="glass p-6">
                  <div className="tech-label mb-3">SOUL.MD</div>
                  {soul ? (
                    <pre className="text-xs text-[rgba(255,255,255,0.6)] font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {soul}
                    </pre>
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.2)] font-light italic">
                      No soul.md defined.
                    </p>
                  )}
                </div>

                <div className="glass p-6">
                  <div className="tech-label mb-3">SKILL.MD</div>
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

              {/* ========== ACTIVITY LOG ========== */}
              <div className="mb-6">
                <div className="aura-divider mb-5">ACTIVITY.LOG</div>

                <div className="glass p-1.5 sm:p-3">
                  {activity.length === 0 && (
                    <div className="px-4 py-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                      {daemonOnline
                        ? "No activity recorded yet."
                        : "Daemon offline — activity unavailable."}
                    </div>
                  )}

                  {activity.map((item, index) => (
                    <div
                      key={`${item.timestamp}-${index}`}
                      className="flex items-start gap-3 px-3 sm:px-4 py-3 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${activityDotColor(
                          item.type
                        )}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`font-mono text-[10px] uppercase tracking-wider ${activityColor(
                              item.type
                            )}`}
                          >
                            {item.type.replace(/_/g, ".")}
                          </span>
                          <span className="text-[10px] text-[rgba(255,255,255,0.2)] font-mono">
                            {timeAgo(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-[rgba(255,255,255,0.5)] font-light leading-relaxed truncate">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  ))}
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
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="glass-sm p-5">
      <div className="tech-label mb-2">{label}</div>
      <div
        className={`text-xl sm:text-2xl font-medium font-mono tracking-tight ${
          highlight ? "text-white" : "text-[rgba(255,255,255,0.8)]"
        }`}
      >
        {value}
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
