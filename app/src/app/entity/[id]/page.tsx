"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
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
const ACTIVITY_CONFIG: Record<string, { label: string }> = {
  experiment: { label: "EXPERIMENT" },
  experiment_complete: { label: "EXPERIMENT" },
  discovery: { label: "DISCOVERY" },
  task: { label: "TASK" },
  task_complete: { label: "TASK.DONE" },
  validation: { label: "VALIDATION" },
  teaching: { label: "TEACHING" },
  governance: { label: "GOVERNANCE" },
  creation: { label: "CREATION" },
  gossip: { label: "GOSSIP" },
  spawn: { label: "SPAWN" },
  refuel: { label: "REFUEL" },
  error: { label: "ERROR" },
}

function getActivityLabel(type: string) {
  return ACTIVITY_CONFIG[type]?.label ?? type.toUpperCase()
}

/** Format ISO timestamp for event log display */
function formatLogTime(isoTime: string): string {
  try {
    return new Date(isoTime).toISOString().substring(11, 23)
  } catch {
    return isoTime
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
      }

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
  const computeMax = 500
  const computePct = Math.min(100, (computeBalance / computeMax) * 100)

  // Skills parsed as tags
  const skillTags = useMemo(() => {
    if (!skill) return []
    const lines = skill.split(/\n|,|;|\|/).map(s => s.replace(/^[-*\s]+/, "").trim()).filter(Boolean)
    if (lines.length <= 1 && skill.length > 80) return []
    return lines.slice(0, 12)
  }, [skill])

  // Research journal
  const journalEntries = useMemo(() => {
    return activity
      .filter(item => ["experiment", "experiment_complete", "discovery", "creation", "validation"].includes(item.type))
      .slice(0, 5)
  }, [activity])

  // Marketplace — detect sale state
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

  const [showRefuel, setShowRefuel] = useState(false)
  const [refuelPlan, setRefuelPlan] = useState("spark")
  const [refuelLoading, setRefuelLoading] = useState(false)

  const handleRefuel = async () => {
    setRefuelLoading(true)
    try {
      const res = await fetch("/api/refuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: id, plan: refuelPlan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setTxError(data.error || "Failed to create refuel session")
      }
    } catch {
      setTxError("Failed to initiate refuel")
    } finally {
      setRefuelLoading(false)
    }
  }

  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferLoading, setTransferLoading] = useState(false)
  const [allEntities, setAllEntities] = useState<{id: string; name: string}[]>([])

  useEffect(() => {
    proxyFetch("/api/entities", "daemon").then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : data.entities || []
      setAllEntities(list.map((e: {id: string; name: string}) => ({ id: e.id, name: e.name })))
    }).catch(() => {})
  }, [])

  const handleTransfer = async () => {
    if (!transferTargetId || !transferAmount) return
    setTransferLoading(true)
    try {
      const res = await proxyFetch("/api/entities/transfer", "daemon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_id: id, to_id: transferTargetId, amount: parseFloat(transferAmount) }),
      })
      const data = await res.json()
      if (data.success) {
        setTxSuccess(`Transferred ${transferAmount} CT — new balance: ${Math.round(data.from_balance)}`)
        setShowTransfer(false)
        setTransferAmount("")
        fetchDaemonStatus()
      } else {
        setTxError(data.error || "Transfer failed")
      }
    } catch {
      setTxError("Transfer failed")
    } finally {
      setTransferLoading(false)
    }
  }

  const statusDotColor: Record<string, string> = {
    alive: "bg-[#22c55e] animate-pulse-dot",
    dormant: "bg-[#f59e0b]",
    stopped: "bg-[#ef4444]",
    unknown: "bg-[rgba(0,0,0,0.2)]",
  }

  return (
    <main style={{ background: "#fff", minHeight: "100vh", color: "#121212" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ borderBottom: "2px solid #121212", paddingBottom: 20, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#121212", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "var(--font-sans)" }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {name}
                </h1>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.5)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: status === "alive" ? "#121212" : "rgba(0,0,0,0.2)" }} />
                  <span>{status.toUpperCase()}</span>
                  <span>·</span>
                  <span>{(entity as EntityStatus & { current_model?: string })?.current_model?.split("/").pop() || "auto"}</span>
                  <span>·</span>
                  <span>v{(entity as EntityStatus & { soul_version?: number })?.soul_version || 0}</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Uptime</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{startedAt ? uptimeString(startedAt) : "—"}</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, borderBottom: "1px solid #121212" }}>
          {[
            { label: "Compute", value: `${Math.round(computeBalance)}` },
            { label: "Discoveries", value: String(discoveries) },
            { label: "Experiments", value: String(experiments) },
            { label: "Tasks", value: String(tasksCompleted) },
            { label: "Revenue", value: `${creatorRevenue} ♥` },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "16px 0", borderRight: i < 4 ? "1px solid rgba(0,0,0,0.1)" : "none", paddingLeft: i > 0 ? 16 : 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Back link */}
        <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <Link href="/world" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            ← Back to World
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-32 text-center">
            <span className="sys-label">LOADING.ENTITY...</span>
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <div className="py-32 text-center border border-[rgba(0,0,0,0.1)] p-10">
            <div className="col-header">ENTITY NOT FOUND</div>
            <p className="text-xs opacity-50 mt-2 mb-4">
              No entity with ID <span className="font-mono font-bold">{id}</span> exists.
            </p>
            {!daemonOnline && (
              <p className="text-xs font-mono text-[#ef4444] mt-2">
                DAEMON OFFLINE. Entity may exist but cannot be reached.
              </p>
            )}
            <Link href="/" className="btn-primary inline-block px-6 py-2.5 mt-6">
              GO HOME
            </Link>
          </div>
        )}

        {/* Main content */}
        {!loading && !notFound && (
          <>
            {/* Daemon offline warning */}
            {!daemonOnline && (
              <div className="data-row mb-4" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
                <span className="row-key flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                  DAEMON_STATUS
                </span>
                <span className="row-val text-[#ef4444]">OFFLINE // CHAIN DATA ONLY</span>
              </div>
            )}

            {/* STATS DATA MATRIX */}
            <div className="data-matrix mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              {/* Column 1 - Core Stats */}
              <div className="data-col">
                <div className="col-header">CORE METRICS</div>
                <div className="data-row">
                  <span className="row-key">EXPERIMENTS</span>
                  <span className="row-val">{experiments}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">DISCOVERIES</span>
                  <span className="row-val">{discoveries}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">TASKS</span>
                  <span className="row-val">{tasksCompleted}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">REPUTATION</span>
                  <span className="row-val">{reputation}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">REVENUE</span>
                  <span className="row-val">{creatorRevenue} $HEART</span>
                </div>
                <div className="data-row">
                  <span className="row-key">AI MODEL</span>
                  <span className="row-val" style={{ fontSize: 10 }}>
                    {(entity as EntityStatus & { current_model?: string })?.current_model
                      ? (entity as EntityStatus & { current_model?: string }).current_model!.split("/").pop()
                      : computeBalance > 5000 ? "claude-opus-4-6"
                      : computeBalance > 2000 ? "gpt-5.4"
                      : computeBalance > 800 ? "claude-sonnet-4"
                      : computeBalance > 300 ? "deepseek-chat-v3"
                      : computeBalance > 100 ? "gpt-4o-mini"
                      : "gemini-flash-lite"}
                  </span>
                </div>
                {startedAt && (
                  <div className="data-row">
                    <span className="row-key">SINCE</span>
                    <span className="row-val">{formatDate(startedAt)}</span>
                  </div>
                )}
              </div>

              {/* Column 2 - Identity */}
              <div className="data-col">
                <div className="col-header">IDENTITY</div>
                <div className="data-row">
                  <span className="row-key">ENTITY_ID</span>
                  <span className="row-val">{id.length > 12 ? id.slice(0, 12) + "..." : id}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">OWNER</span>
                  <span className="row-val" title={ownerAddress}>{truncateAddr(ownerAddress)}</span>
                </div>
                {chainEntity && (
                  <div className="data-row">
                    <span className="row-key">ON_CHAIN</span>
                    <span className="row-val text-[#22c55e]">REGISTERED</span>
                  </div>
                )}
                {hasLineage && (
                  <>
                    <div className="data-row">
                      <span className="row-key">PARENT_A</span>
                      <span className="row-val">
                        {parentAId ? (
                          <Link href={`/entity/${parentAId}`} className="hover:underline">
                            {parentAName || truncateAddr(parentAId)}
                          </Link>
                        ) : "N/A"}
                      </span>
                    </div>
                    <div className="data-row">
                      <span className="row-key">PARENT_B</span>
                      <span className="row-val">
                        {parentBId ? (
                          <Link href={`/entity/${parentBId}`} className="hover:underline">
                            {parentBName || truncateAddr(parentBId)}
                          </Link>
                        ) : "N/A"}
                      </span>
                    </div>
                  </>
                )}
                {versionHistory.length > 0 && (
                  <div className="data-row">
                    <span className="row-key">IDENTITY_VER</span>
                    <span className="row-val">v{versionHistory[versionHistory.length - 1]?.version ?? 1}</span>
                  </div>
                )}
              </div>

              {/* Column 3 - Compute & Marketplace */}
              <div className="data-col">
                <div className="col-header">COMPUTE // MARKETPLACE</div>
                {/* Compute spark bar */}
                <div className="spark-row">
                  <div className="flex justify-between">
                    <span className="row-key label">COMPUTE_BAL</span>
                    <span className="row-val">{Math.round(computeBalance)} / {computeMax}</span>
                  </div>
                  <div className="spark-bar-container">
                    <div className="spark-bar" style={{ width: `${computePct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="sys-label">
                      {computeBalance > 100 ? "HEALTHY" : computeBalance > 20 ? "LOW" : computeBalance > 0 ? "CRITICAL" : "DEPLETED"}
                    </span>
                    <span className="sys-label">{Math.round(computePct)}%</span>
                  </div>
                </div>

                {/* Marketplace data rows */}
                <div className="data-row">
                  <span className="row-key">FOR_SALE</span>
                  <span className="row-val">{isForSale ? "YES" : "NO"}</span>
                </div>
                {isForSale && salePrice && (
                  <div className="data-row">
                    <span className="row-key">PRICE</span>
                    <span className="row-val text-[#f59e0b]">{salePrice} $HEART</span>
                  </div>
                )}

                {/* TX feedback */}
                {txError && (
                  <div className="data-row" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
                    <span className="row-key text-[#ef4444]">TX_ERROR</span>
                    <span className="row-val text-[#ef4444]">{txError}</span>
                  </div>
                )}
                {txSuccess && (
                  <div className="data-row" style={{ borderBottom: "1px solid rgba(34,197,94,0.3)" }}>
                    <span className="row-key text-[#22c55e]">TX_OK</span>
                    <span className="row-val text-[#22c55e]">{txSuccess}</span>
                  </div>
                )}

                {/* Marketplace buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {isOwner && !isForSale && (
                    <button
                      onClick={() => setShowListModal(true)}
                      disabled={txBusy}
                      className="px-3 py-1.5 text-[10px] font-mono tracking-wider border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {txBusy ? "PROCESSING..." : "LIST FOR SALE"}
                    </button>
                  )}
                  {isOwner && isForSale && (
                    <button
                      onClick={handleDelist}
                      disabled={txBusy}
                      className="px-3 py-1.5 text-[10px] font-mono tracking-wider border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {txBusy ? "PROCESSING..." : "DELIST"}
                    </button>
                  )}
                  {!isOwner && isForSale && wallet.address && (
                    <button
                      onClick={handleBuy}
                      disabled={txBusy}
                      className="px-3 py-1.5 text-[10px] font-mono tracking-wider border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {txBusy ? "PROCESSING..." : `BUY FOR ${salePrice} $HEART`}
                    </button>
                  )}
                  {!isOwner && !isForSale && (
                    <span className="sys-label mt-1">NOT LISTED FOR SALE</span>
                  )}
                  {!wallet.address && isForSale && (
                    <span className="sys-label mt-1">CONNECT WALLET TO PURCHASE</span>
                  )}

                  {/* Refuel + Transfer buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 12 }}>
                    <button
                      onClick={() => setShowRefuel(!showRefuel)}
                      className="px-3 py-1.5 text-[10px] font-mono tracking-wider border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors cursor-pointer"
                    >
                      REFUEL
                    </button>
                    <button
                      onClick={() => setShowTransfer(!showTransfer)}
                      className="px-3 py-1.5 text-[10px] font-mono tracking-wider border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors cursor-pointer"
                    >
                      TRANSFER
                    </button>
                  </div>

                  {/* Refuel panel */}
                  {showRefuel && (
                    <div style={{ marginTop: 12, padding: 16, border: "1px solid rgba(0,0,0,0.1)" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Add Compute (Stripe)
                      </div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                        {[
                          { key: "spark", label: "$5", compute: "500 CT" },
                          { key: "flame", label: "$20", compute: "2.5K CT" },
                          { key: "inferno", label: "$50", compute: "10K CT" },
                          { key: "eternal", label: "$100", compute: "25K CT" },
                        ].map((p) => (
                          <button
                            key={p.key}
                            onClick={() => setRefuelPlan(p.key)}
                            style={{
                              flex: 1, padding: "8px 4px", fontSize: 10, fontFamily: "var(--font-mono)",
                              border: refuelPlan === p.key ? "2px solid var(--fg)" : "1px solid rgba(0,0,0,0.15)",
                              background: refuelPlan === p.key ? "var(--fg)" : "transparent",
                              color: refuelPlan === p.key ? "var(--bg)" : "var(--fg)",
                              cursor: "pointer", textAlign: "center",
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{p.label}</div>
                            <div style={{ fontSize: 8, opacity: 0.6 }}>{p.compute}</div>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleRefuel}
                        disabled={refuelLoading}
                        style={{
                          width: "100%", padding: "10px", background: "var(--fg)", color: "var(--bg)",
                          border: "none", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer",
                        }}
                      >
                        {refuelLoading ? "PROCESSING..." : "REFUEL NOW"}
                      </button>
                    </div>
                  )}

                  {/* Transfer panel */}
                  {showTransfer && (
                    <div style={{ marginTop: 12, padding: 16, border: "1px solid rgba(0,0,0,0.1)" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Transfer Compute
                      </div>
                      <select
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value)}
                        style={{
                          width: "100%", padding: "8px", marginBottom: 8, fontFamily: "var(--font-mono)",
                          fontSize: 11, border: "1px solid rgba(0,0,0,0.15)", background: "transparent",
                        }}
                      >
                        <option value="">Select recipient...</option>
                        {allEntities.filter(e => e.id !== id).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="Amount (CT)"
                        style={{
                          width: "100%", padding: "8px", marginBottom: 8, fontFamily: "var(--font-mono)",
                          fontSize: 11, border: "1px solid rgba(0,0,0,0.15)", background: "transparent",
                        }}
                      />
                      <button
                        onClick={handleTransfer}
                        disabled={transferLoading || !transferTargetId || !transferAmount}
                        style={{
                          width: "100%", padding: "10px", background: "var(--fg)", color: "var(--bg)",
                          border: "none", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          cursor: transferLoading ? "wait" : "pointer",
                          opacity: (!transferTargetId || !transferAmount) ? 0.4 : 1,
                        }}
                      >
                        {transferLoading ? "SENDING..." : "TRANSFER"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4 - Event Log */}
              <div className="data-col">
                <div className="col-header">EVENT LOG // TRACE</div>
                {activity.length === 0 && (
                  <div className="py-4 text-center">
                    <span className="sys-label">
                      {daemonOnline ? "NO ACTIVITY YET" : "DAEMON OFFLINE"}
                    </span>
                  </div>
                )}
                <ul className="list-none">
                  {activity.slice(0, 15).map((item, index) => (
                    <li key={`${item.timestamp}-${index}`} className="data-row">
                      <span className="row-key" style={{ opacity: 0.6 }}>{formatLogTime(item.timestamp)}</span>
                      <span className="row-val">
                        {getActivityLabel(item.type)}
                        {item.tx_hash && ` [${item.tx_hash.slice(0, 8)}]`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SOUL DISPLAY */}
            <div className="col-header">SOUL.MD</div>
            <div className="border border-[rgba(0,0,0,0.1)] p-5 mb-6 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {soul || "No soul.md defined."}
            </div>

            {/* SKILLS */}
            {skillTags.length > 0 && (
              <>
                <div className="col-header">SKILL.TAGS</div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {skillTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 text-[10px] font-mono tracking-wider border border-[var(--fg)] uppercase"
                    >
                      {tag.length > 40 ? tag.slice(0, 40) + "..." : tag}
                    </span>
                  ))}
                </div>
              </>
            )}
            {skill && skillTags.length === 0 && (
              <>
                <div className="col-header">SKILL.MD</div>
                <div className="border border-[rgba(0,0,0,0.1)] p-5 mb-6 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {skill}
                </div>
              </>
            )}

            {/* RESEARCH JOURNAL */}
            {journalEntries.length > 0 && (
              <>
                <div className="col-header">RESEARCH JOURNAL</div>
                <div className="mb-6">
                  {journalEntries.map((entry, idx) => (
                    <div key={`journal-${idx}`} className="data-row flex-col items-start gap-1 py-3">
                      <div className="flex items-center justify-between w-full">
                        <span className="row-key font-mono text-[10px] tracking-wider">
                          {getActivityLabel(entry.type)}
                          {entry.score !== undefined && entry.score !== null && (
                            <span className="ml-2 opacity-60">SCORE {entry.score}</span>
                          )}
                        </span>
                        <span className="row-val text-[10px] opacity-50">{timeAgo(entry.timestamp)}</span>
                      </div>
                      <p className="text-xs opacity-60 leading-relaxed mt-1">{entry.message}</p>
                      {entry.tx_hash && (
                        <span className="font-mono text-[10px] opacity-30 mt-1">TX {entry.tx_hash.slice(0, 12)}...</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* SOUL EVOLUTION */}
            <div className="col-header">SOUL EVOLUTION</div>
            <div className="mb-6">
              {(() => {
                const sv = (entity as EntityStatus & { soul_version?: number })?.soul_version || 0
                if (sv > 0) {
                  // Find evolution events for this entity from activity
                  const evolutionEvents = activity.filter(a => a.type === "evolution")
                  return (
                    <>
                      <div className="data-row">
                        <span className="row-key" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                          SOUL VERSION
                        </span>
                        <span className="row-val" style={{ fontWeight: 700, fontSize: 16 }}>
                          v{sv}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="row-key">TIMES REWRITTEN</span>
                        <span className="row-val">{sv}</span>
                      </div>
                      <div className="data-row">
                        <span className="row-key">TRIGGER</span>
                        <span className="row-val">Every 100 experiments</span>
                      </div>

                      {/* Evolution timeline */}
                      {evolutionEvents.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: 8 }}>
                            EVOLUTION TIMELINE
                          </div>
                          {evolutionEvents.map((ev, idx) => (
                            <div key={idx} className="data-row">
                              <span className="row-key" style={{ fontSize: 11 }}>
                                <span style={{ color: "#22c55e", marginRight: 6 }}>&#x2191;</span>
                                {ev.message}
                              </span>
                              <span className="row-val" style={{ fontSize: 10 }}>
                                {formatLogTime(ev.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Current evolved soul text */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: 8 }}>
                          CURRENT EVOLVED SOUL (v{sv})
                        </div>
                        <div style={{
                          padding: "12px 14px",
                          background: "rgba(0,0,0,0.04)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          borderLeft: "3px solid #22c55e",
                          fontSize: 11,
                          lineHeight: 1.6,
                          maxHeight: 200,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}>
                          {soul || "Soul text unavailable"}
                        </div>
                        <div style={{ fontSize: 9, opacity: 0.3, marginTop: 4, fontStyle: "italic" }}>
                          This soul was autonomously rewritten by the entity based on {experiments} experiments and {discoveries} discoveries.
                        </div>
                      </div>
                    </>
                  )
                }
                return (
                  <div className="py-4 text-center">
                    <span className="sys-label">
                      {experiments > 0
                        ? `NEXT EVOLUTION AT ${Math.ceil((experiments + 1) / 100) * 100} EXPERIMENTS (${100 - (experiments % 100)} remaining)`
                        : "SOUL EVOLUTION BEGINS AT 100 EXPERIMENTS"}
                    </span>
                  </div>
                )
              })()}
            </div>
          </>
        )}

      </div>

      {/* List For Sale Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowListModal(false)}>
          <div className="bg-[var(--bg)] border border-[var(--fg)] p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="col-header">LIST ENTITY FOR SALE</div>
            <p className="text-xs opacity-50 mb-4">
              Set a price in $HEART for <span className="font-bold">{name}</span>.
            </p>
            <label className="sys-label mb-1.5 block">PRICE ($HEART)</label>
            <input
              type="number"
              min="1"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full px-4 py-2.5 text-sm font-mono border border-[var(--fg)] bg-transparent mb-4 focus:outline-none"
              autoFocus
            />
            {txError && (
              <div className="data-row text-[10px] mb-3" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
                <span className="row-key text-[#ef4444]">ERROR</span>
                <span className="row-val text-[#ef4444]">{txError}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowListModal(false); setTxError("") }}
                className="flex-1 px-4 py-2.5 text-[10px] tracking-wider font-mono border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleList}
                disabled={txBusy}
                className="btn-primary flex-1 px-4 py-2.5 text-[10px] tracking-wider disabled:opacity-40"
              >
                {txBusy ? "SIGNING..." : "CONFIRM LIST"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
