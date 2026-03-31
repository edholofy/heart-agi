"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { listEntities, breedEntities, type ServerEntity } from "@/lib/daemon-client"
import { listEntityForSale, buyEntity, delistEntity } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

type EntityStatus = "alive" | "dormant" | "stopped"
type SortField = "discoveries" | "compute_balance" | "experiments" | "reputation"
type StatusFilter = "all" | EntityStatus

const STATUS_CONFIG: Record<
  string,
  { dot: string; label: string }
> = {
  alive: {
    dot: "bg-[#22c55e] animate-pulse-dot",
    label: "ALIVE",
  },
  dormant: {
    dot: "bg-[#f59e0b]",
    label: "DORMANT",
  },
  stopped: {
    dot: "bg-[#ef4444]",
    label: "STOPPED",
  },
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "discoveries", label: "DISCOVERIES" },
  { value: "compute_balance", label: "COMPUTE" },
  { value: "experiments", label: "EXPERIMENTS" },
  { value: "reputation", label: "REPUTATION" },
]

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "alive", label: "ALIVE" },
  { value: "dormant", label: "DORMANT" },
  { value: "stopped", label: "STOPPED" },
]

export default function EntityMarketplacePage() {
  const [entities, setEntities] = useState<ServerEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // Controls
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortField>("discoveries")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const fetchEntities = useCallback(async () => {
    try {
      const data = await listEntities()
      setEntities(data)
      setFetchError(false)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntities()
    const interval = setInterval(fetchEntities, 10_000)
    return () => clearInterval(interval)
  }, [fetchEntities])

  const filtered = useMemo(() => {
    let result = entities

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter(
        (e) => e.status.toLowerCase() === statusFilter
      )
    }

    // Search by name
    if (search.trim()) {
      const query = search.trim().toLowerCase()
      result = result.filter((e) =>
        e.name.toLowerCase().includes(query)
      )
    }

    // Sort
    result = [...result].sort((a, b) => b[sortBy] - a[sortBy])

    return result
  }, [entities, statusFilter, search, sortBy])

  const statusCounts = useMemo(() => {
    const counts = { all: entities.length, alive: 0, dormant: 0, stopped: 0 }
    for (const e of entities) {
      const s = e.status.toLowerCase() as EntityStatus
      if (s in counts) counts[s]++
    }
    return counts
  }, [entities])

  return (
    <main className="flex flex-col min-h-screen">

      {/* DARK ZONE */}
      <div className="zone-dark">
        <header className="grid grid-cols-3 border-b border-[rgba(255,255,255,0.2)] pb-4 mb-8">
          <div>
            <span className="sys-label">SYSTEM REGISTRY</span>
            <div className="text-sm font-bold tracking-wide">ENTITY REGISTRY // MARKETPLACE</div>
          </div>
          <div className="text-center">
            <span className="sys-label">TOTAL ENTITIES</span>
            <div className="sys-value">{entities.length}</div>
          </div>
          <div className="text-right">
            <span className="sys-label">STATUS</span>
            <div className="sys-value">{fetchError ? "OFFLINE" : "CONNECTED"}</div>
          </div>
        </header>

        <div className="primary-vis-layout pb-6">
          <div>
            <span className="sys-label">ACTIVE ENTITIES</span>
            <div className="dot-hero">{statusCounts.alive}</div>
          </div>
          <div className="flex flex-col justify-end">
            <span className="sys-label">STATUS DISTRIBUTION</span>
            <div className="mt-4 space-y-2">
              {(["alive", "dormant", "stopped"] as const).map((s) => (
                <div key={s} className="spark-row">
                  <div className="flex justify-between">
                    <span className="row-key label">{s.toUpperCase()}</span>
                    <span className="row-val">{statusCounts[s]}</span>
                  </div>
                  <div className="spark-bar-container">
                    <div
                      className="spark-bar"
                      style={{ width: `${entities.length > 0 ? (statusCounts[s] / entities.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="zone-transition" />

      {/* LIGHT ZONE */}
      <div className="zone-light">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/marketplace" className="sys-label hover:opacity-100 transition-opacity">
            &larr; BACK.TO.MARKETPLACE
          </Link>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6 pb-4 border-b border-[rgba(0,0,0,0.1)]">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH ENTITIES..."
              className="w-full px-4 py-2.5 text-xs font-mono border border-[var(--fg)] bg-transparent placeholder:text-[rgba(0,0,0,0.3)] focus:outline-none"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="sys-label whitespace-nowrap">SORT.BY</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="px-3 py-2 text-xs font-mono border border-[var(--fg)] bg-transparent appearance-none cursor-pointer focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-[10px] font-mono tracking-wider border transition-colors cursor-pointer ${
                  statusFilter === opt.value
                    ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                    : "bg-transparent text-[var(--fg)] border-[var(--fg)] opacity-50 hover:opacity-100"
                }`}
              >
                {opt.label}
                <span className="ml-1 text-[9px] opacity-60">
                  {statusCounts[opt.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Chain offline warning */}
        {fetchError && (
          <div className="data-row mb-4" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="row-key flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
              DAEMON_STATUS
            </span>
            <span className="row-val text-[#ef4444]">OFFLINE // RETRYING 10s</span>
          </div>
        )}

        {/* ENTITY TABLE HEADER */}
        <div className="col-header mb-0 grid grid-cols-[2fr_80px_80px_80px_1fr_2fr] gap-4 text-[10px]">
          <span>ENTITY NAME</span>
          <span className="text-center">STATUS</span>
          <span className="text-right">DISC.</span>
          <span className="text-right">EXP.</span>
          <span>COMPUTE</span>
          <span>SOUL SNIPPET</span>
        </div>

        {/* Loading */}
        {loading && entities.length === 0 && !fetchError && (
          <div className="data-row justify-center py-8">
            <span className="sys-label">LOADING ENTITIES FROM DAEMON...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && !fetchError && (
          <div className="data-row justify-center py-8">
            <span className="sys-label">
              {search.trim()
                ? `NO ENTITIES MATCHING "${search.toUpperCase()}"`
                : statusFilter !== "all"
                  ? `NO ${statusFilter.toUpperCase()} ENTITIES`
                  : "NO ENTITIES SPAWNED YET"}
            </span>
          </div>
        )}

        {/* ENTITY ROWS */}
        <div className="mb-10">
          {filtered.map((entity) => (
            <EntityRow key={entity.id} entity={entity} onRefresh={fetchEntities} />
          ))}
        </div>

        {/* BREED SECTION */}
        <BreedSection entities={entities} onBred={fetchEntities} />

        {/* Back link */}
        <div className="text-center mb-8">
          <Link
            href="/marketplace"
            className="btn-primary inline-block px-6 py-3"
          >
            BACK TO MARKETPLACE
          </Link>
        </div>
      </div>
    </main>
  )
}

const MIN_EXPERIMENTS = 50

function BreedSection({
  entities,
  onBred,
}: {
  entities: ServerEntity[]
  onBred: () => void
}) {
  const [open, setOpen] = useState(false)
  const [parentA, setParentA] = useState("")
  const [parentB, setParentB] = useState("")
  const [childName, setChildName] = useState("")
  const [breeding, setBreeding] = useState(false)
  const [breedError, setBreedError] = useState("")
  const [breedResult, setBreedResult] = useState<{
    childName: string
    skills: string[]
  } | null>(null)

  /** Only alive entities with 50+ experiments are eligible */
  const eligible = useMemo(
    () =>
      entities.filter(
        (e) =>
          e.status.toLowerCase() === "alive" &&
          e.experiments >= MIN_EXPERIMENTS
      ),
    [entities]
  )

  const handleBreed = async () => {
    setBreedError("")
    setBreedResult(null)

    if (!parentA || !parentB) {
      setBreedError("Select both Parent A and Parent B.")
      return
    }
    if (parentA === parentB) {
      setBreedError("Parents must be different entities.")
      return
    }
    if (!childName.trim()) {
      setBreedError("Enter a name for the child entity.")
      return
    }

    try {
      setBreeding(true)
      const result = await breedEntities({
        parentAId: parentA,
        parentBId: parentB,
        childName: childName.trim(),
      })

      const skills = result.child.skill
        ? result.child.skill.split(",").map((s) => s.trim()).filter(Boolean)
        : []

      setBreedResult({ childName: result.child.name, skills })
      setParentA("")
      setParentB("")
      setChildName("")
      onBred()
    } catch (err) {
      setBreedError(
        err instanceof Error ? err.message : "Breeding failed. Try again."
      )
    } finally {
      setBreeding(false)
    }
  }

  return (
    <div className="mb-10">
      {/* Toggle header */}
      <div className="col-header flex items-center gap-2 cursor-pointer" onClick={() => setOpen((prev) => !prev)}>
        <span
          className="inline-block transition-transform duration-200 text-xs"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          &#9654;
        </span>
        BREED ENTITIES
        <span className="font-mono text-[9px] opacity-60 ml-2">{eligible.length} ELIGIBLE</span>
      </div>

      {open && (
        <div className="border border-[rgba(0,0,0,0.1)] p-5 mt-0 flex flex-col gap-4">
          <p className="sys-label">
            COMBINE TWO ALIVE ENTITIES WITH {MIN_EXPERIMENTS}+ EXPERIMENTS TO CREATE OFFSPRING.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Parent A */}
            <div className="flex flex-col gap-1.5">
              <label className="sys-label">PARENT.A</label>
              <select
                value={parentA}
                onChange={(e) => setParentA(e.target.value)}
                className="px-3 py-2.5 text-xs font-mono border border-[var(--fg)] bg-transparent appearance-none cursor-pointer focus:outline-none"
              >
                <option value="">Select entity...</option>
                {eligible.map((e) => (
                  <option key={e.id} value={e.id} disabled={e.id === parentB}>
                    {e.name} ({e.experiments} exp)
                  </option>
                ))}
              </select>
            </div>

            {/* Parent B */}
            <div className="flex flex-col gap-1.5">
              <label className="sys-label">PARENT.B</label>
              <select
                value={parentB}
                onChange={(e) => setParentB(e.target.value)}
                className="px-3 py-2.5 text-xs font-mono border border-[var(--fg)] bg-transparent appearance-none cursor-pointer focus:outline-none"
              >
                <option value="">Select entity...</option>
                {eligible.map((e) => (
                  <option key={e.id} value={e.id} disabled={e.id === parentA}>
                    {e.name} ({e.experiments} exp)
                  </option>
                ))}
              </select>
            </div>

            {/* Child name */}
            <div className="flex flex-col gap-1.5">
              <label className="sys-label">CHILD.NAME</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Enter offspring name..."
                className="px-3 py-2.5 text-xs font-mono border border-[var(--fg)] bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Breed button */}
          <button
            onClick={handleBreed}
            disabled={breeding}
            className="btn-primary self-start px-6 py-2.5 text-[11px] tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {breeding ? "BREEDING..." : "BREED"}
          </button>

          {/* Error */}
          {breedError && (
            <div className="data-row" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
              <span className="row-key flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                ERROR
              </span>
              <span className="row-val text-[#ef4444]">{breedError}</span>
            </div>
          )}

          {/* Success */}
          {breedResult && (
            <div className="border border-[rgba(0,0,0,0.1)] p-4">
              <div className="data-row" style={{ borderBottom: "1px solid rgba(34,197,94,0.3)" }}>
                <span className="row-key flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
                  OFFSPRING CREATED
                </span>
                <span className="row-val">{breedResult.childName}</span>
              </div>
              {breedResult.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="sys-label mr-1">INHERITED</span>
                  {breedResult.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-0.5 text-[10px] font-mono tracking-wider border border-[var(--fg)] uppercase"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EntityRow({ entity, onRefresh }: { entity: ServerEntity; onRefresh: () => void }) {
  const wallet = useAppStore((s) => s.wallet)
  const status = entity.status.toLowerCase()
  const statusStyle = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped

  const isOwner = wallet.address && entity.owner_address === wallet.address

  // Sale state
  const entityAny = entity as ServerEntity & { for_sale?: boolean; sale_price?: string }
  const isForSale = entityAny.for_sale === true
  const salePrice = entityAny.sale_price ?? ""

  // Local UI state
  const [showListModal, setShowListModal] = useState(false)
  const [listPrice, setListPrice] = useState("")
  const [txBusy, setTxBusy] = useState(false)
  const [txError, setTxError] = useState("")
  const [txSuccess, setTxSuccess] = useState("")

  // Truncate soul to 80 chars
  const soulSnippet = entity.soul
    ? entity.soul.length > 80
      ? entity.soul.slice(0, 80) + "..."
      : entity.soul
    : ""

  // Compute balance percentage (max 500 tokens baseline)
  const computePercent = Math.min(
    100,
    (entity.compute_balance / 500) * 100
  )

  const handleList = async () => {
    if (!listPrice.trim() || isNaN(Number(listPrice)) || Number(listPrice) <= 0) {
      setTxError("Enter a valid price in $HEART.")
      return
    }
    try {
      setTxBusy(true)
      setTxError("")
      setTxSuccess("")
      const txHash = await listEntityForSale(entity.id, listPrice.trim())
      setTxSuccess(`Listed! TX: ${txHash.slice(0, 12)}...`)
      setShowListModal(false)
      setListPrice("")
      onRefresh()
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
      const txHash = await delistEntity(entity.id)
      setTxSuccess(`Delisted! TX: ${txHash.slice(0, 12)}...`)
      onRefresh()
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
      const txHash = await buyEntity(entity.id)
      setTxSuccess(`Purchased! TX: ${txHash.slice(0, 12)}...`)
      onRefresh()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Buy failed")
    } finally {
      setTxBusy(false)
    }
  }

  return (
    <>
      <Link
        href={`/entity/${entity.id}`}
        className="grid grid-cols-[2fr_80px_80px_80px_1fr_2fr] gap-4 data-row items-center group"
      >
        {/* Name + ID */}
        <span className="row-key group-hover:underline flex items-center gap-2">
          {entity.name}
          {isForSale && (
            <span className="text-[9px] font-mono tracking-wider text-[#f59e0b] border border-[#f59e0b] px-1.5 py-0.5">
              FOR SALE {salePrice && `${salePrice} $H`}
            </span>
          )}
        </span>

        {/* Status dot */}
        <span className="flex items-center justify-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
          <span className="text-[10px] font-mono">{statusStyle.label}</span>
        </span>

        {/* Discoveries */}
        <span className="row-val">{entity.discoveries}</span>

        {/* Experiments */}
        <span className="row-val">{entity.experiments}</span>

        {/* Compute spark bar */}
        <span className="flex flex-col gap-1">
          <span className="text-[9px] font-mono text-right">{Math.round(entity.compute_balance)}</span>
          <span className="spark-bar-container">
            <span className="spark-bar" style={{ width: `${computePercent}%` }} />
          </span>
        </span>

        {/* Soul snippet */}
        <span className="text-[10px] font-mono opacity-50 truncate">
          {soulSnippet || "--"}
        </span>
      </Link>

      {/* TX feedback row */}
      {(txError || txSuccess) && (
        <div className="data-row text-[10px]">
          <span className="row-key flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${txError ? "bg-[#ef4444]" : "bg-[#22c55e]"}`} />
            {txError ? "TX_ERROR" : "TX_OK"}
          </span>
          <span className={`row-val ${txError ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
            {txError || txSuccess}
          </span>
        </div>
      )}

      {/* Marketplace actions row */}
      {(isOwner || (isForSale && wallet.address)) && (
        <div className="flex gap-2 py-1 mb-1">
          {isOwner && !isForSale && (
            <button
              onClick={() => setShowListModal(true)}
              disabled={txBusy}
              className="px-3 py-1 text-[10px] font-mono tracking-wider border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {txBusy ? "PROCESSING..." : "LIST FOR SALE"}
            </button>
          )}
          {isOwner && isForSale && (
            <button
              onClick={handleDelist}
              disabled={txBusy}
              className="px-3 py-1 text-[10px] font-mono tracking-wider border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
            >
              {txBusy ? "PROCESSING..." : "DELIST"}
            </button>
          )}
          {!isOwner && isForSale && wallet.address && (
            <button
              onClick={handleBuy}
              disabled={txBusy}
              className="px-3 py-1 text-[10px] font-mono tracking-wider border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
            >
              {txBusy ? "PROCESSING..." : `BUY FOR ${salePrice} $HEART`}
            </button>
          )}
        </div>
      )}

      {/* List For Sale Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowListModal(false)}>
          <div className="bg-[var(--bg)] border border-[var(--fg)] p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="col-header">LIST ENTITY FOR SALE</div>
            <p className="text-xs opacity-50 mb-4">
              Set a price in $HEART for <span className="font-bold">{entity.name}</span>.
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
                <span className="row-key flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  ERROR
                </span>
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
    </>
  )
}
