"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { listEntities, breedEntities, type ServerEntity } from "@/lib/daemon-client"
import { listEntityForSale, buyEntity, delistEntity } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

type EntityStatus = "alive" | "dormant" | "stopped"
type SortField = "discoveries" | "compute_balance" | "experiments" | "reputation"
type StatusFilter = "all" | EntityStatus

const STATUS_CONFIG: Record<
  string,
  { dot: string; badge: string; label: string }
> = {
  alive: {
    dot: "bg-[#22c55e] animate-pulse-dot",
    badge: "bg-[rgba(34,197,94,0.12)] text-[#22c55e]",
    label: "ALIVE",
  },
  dormant: {
    dot: "bg-[#f59e0b]",
    badge: "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]",
    label: "DORMANT",
  },
  stopped: {
    dot: "bg-[#ef4444]",
    badge: "bg-[rgba(239,68,68,0.12)] text-[#ef4444]",
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
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Back link */}
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors mb-6"
          >
            <span>&larr;</span>
            <span className="tech-label">BACK.TO.MARKETPLACE</span>
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
              $HEART{" "}
              <span className="text-[rgba(255,255,255,0.4)]">
                Entity Marketplace
              </span>
            </h1>
            <p className="text-sm text-[rgba(255,255,255,0.4)] font-light mt-2">
              Browse autonomous AI entities. View stats, discover top
              performers, and explore their profiles.
            </p>
          </div>

          {/* ========== CONTROLS ========== */}
          <div className="glass-sm p-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entities by name..."
                className="glass-input w-full px-4 py-2.5 text-sm"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="tech-label whitespace-nowrap text-[9px]">
                SORT.BY
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="glass-input px-3 py-2 text-xs appearance-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-[#030407]"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
                    statusFilter === opt.value
                      ? "bg-[rgba(255,255,255,0.1)] text-white"
                      : "bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)]"
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
            <div className="glass-sm p-4 mb-6 bg-[rgba(239,68,68,0.08)] text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] mr-2 align-middle" />
              <span className="text-[#ef4444] font-light">
                Daemon offline or unreachable. Retrying every 10s...
              </span>
            </div>
          )}

          {/* ========== ENTITIES GRID ========== */}
          <div className="aura-divider mb-5">
            ENTITIES
            <span className="sys-badge ml-2">{filtered.length}</span>
          </div>

          {loading && entities.length === 0 && !fetchError && (
            <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
              Loading entities from daemon...
            </div>
          )}

          {!loading && filtered.length === 0 && !fetchError && (
            <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
              {search.trim()
                ? `No entities matching "${search}".`
                : statusFilter !== "all"
                  ? `No ${statusFilter} entities found.`
                  : "No entities spawned yet."}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {filtered.map((entity) => (
              <EntityCard key={entity.id} entity={entity} onRefresh={fetchEntities} />
            ))}
          </div>

          {/* ========== BREED SECTION ========== */}
          <BreedSection entities={entities} onBred={fetchEntities} />

          {/* Back link */}
          <div className="text-center mb-8">
            <Link
              href="/marketplace"
              className="btn-secondary inline-block px-6 py-2.5 text-sm tracking-wide"
            >
              BACK TO MARKETPLACE
            </Link>
          </div>
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
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="aura-divider mb-0 w-full text-left flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
      >
        <span
          className="inline-block transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          &#9654;
        </span>
        BREED ENTITIES
        <span className="sys-badge ml-1">{eligible.length} ELIGIBLE</span>
      </button>

      {open && (
        <div className="glass-sm p-5 mt-4 flex flex-col gap-4">
          <p className="text-xs text-[rgba(255,255,255,0.4)] font-light">
            Combine two alive entities with {MIN_EXPERIMENTS}+ experiments to
            create an offspring that inherits skills from both parents.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Parent A */}
            <div className="flex flex-col gap-1.5">
              <label className="tech-label text-[9px]">PARENT.A</label>
              <select
                value={parentA}
                onChange={(e) => setParentA(e.target.value)}
                className="glass-input px-3 py-2.5 text-xs appearance-none cursor-pointer"
              >
                <option value="" className="bg-[#030407]">
                  Select entity...
                </option>
                {eligible.map((e) => (
                  <option
                    key={e.id}
                    value={e.id}
                    className="bg-[#030407]"
                    disabled={e.id === parentB}
                  >
                    {e.name} ({e.experiments} exp)
                  </option>
                ))}
              </select>
            </div>

            {/* Parent B */}
            <div className="flex flex-col gap-1.5">
              <label className="tech-label text-[9px]">PARENT.B</label>
              <select
                value={parentB}
                onChange={(e) => setParentB(e.target.value)}
                className="glass-input px-3 py-2.5 text-xs appearance-none cursor-pointer"
              >
                <option value="" className="bg-[#030407]">
                  Select entity...
                </option>
                {eligible.map((e) => (
                  <option
                    key={e.id}
                    value={e.id}
                    className="bg-[#030407]"
                    disabled={e.id === parentA}
                  >
                    {e.name} ({e.experiments} exp)
                  </option>
                ))}
              </select>
            </div>

            {/* Child name */}
            <div className="flex flex-col gap-1.5">
              <label className="tech-label text-[9px]">CHILD.NAME</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Enter offspring name..."
                className="glass-input px-3 py-2.5 text-xs"
              />
            </div>
          </div>

          {/* Breed button */}
          <button
            onClick={handleBreed}
            disabled={breeding}
            className="btn-secondary px-6 py-2.5 text-[11px] tracking-wider self-start disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {breeding ? "BREEDING..." : "BREED"}
          </button>

          {/* Error */}
          {breedError && (
            <div className="glass-sm p-3 bg-[rgba(239,68,68,0.08)] text-sm flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
              <span className="text-[#ef4444] font-light text-xs">
                {breedError}
              </span>
            </div>
          )}

          {/* Success */}
          {breedResult && (
            <div className="glass-sm p-4 bg-[rgba(34,197,94,0.08)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
                <span className="text-[#22c55e] text-xs font-medium tracking-wide">
                  OFFSPRING CREATED
                </span>
              </div>
              <p className="text-sm text-white font-medium">
                {breedResult.childName}
              </p>
              {breedResult.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[9px] font-mono text-[rgba(255,255,255,0.3)] tracking-wider self-center mr-1">
                    INHERITED
                  </span>
                  {breedResult.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-[rgba(167,139,250,0.1)] text-[#a78bfa]"
                    >
                      {skill.toUpperCase()}
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

function EntityCard({ entity, onRefresh }: { entity: ServerEntity; onRefresh: () => void }) {
  const wallet = useAppStore((s) => s.wallet)
  const status = entity.status.toLowerCase()
  const statusStyle =
    STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped

  const isOwner = wallet.address && entity.owner_address === wallet.address

  // Sale state — these fields may exist on the entity from the daemon/chain
  const entityAny = entity as ServerEntity & { for_sale?: boolean; sale_price?: string }
  const isForSale = entityAny.for_sale === true
  const salePrice = entityAny.sale_price ?? ""

  // Local UI state
  const [showListModal, setShowListModal] = useState(false)
  const [listPrice, setListPrice] = useState("")
  const [txBusy, setTxBusy] = useState(false)
  const [txError, setTxError] = useState("")
  const [txSuccess, setTxSuccess] = useState("")

  // Parse skills from comma-separated string
  const skills = entity.skill
    ? entity.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

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
  const computeLow = entity.compute_balance < 20

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
    <div className="glass-sm p-5 flex flex-col gap-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors group relative">
      {/* Header: status badge */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full ${statusStyle.badge}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}
          />
          {statusStyle.label}
        </span>
        <div className="flex items-center gap-2">
          {isForSale && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-[rgba(245,158,11,0.12)] text-[#f59e0b]">
              FOR SALE
            </span>
          )}
          <span className="sys-badge text-[9px]">
            ID:{entity.id.length > 8 ? entity.id.slice(0, 8) : entity.id}
          </span>
        </div>
      </div>

      {/* Name */}
      <h3 className="text-lg font-medium text-white leading-snug tracking-[-0.02em]">
        {entity.name}
      </h3>

      {/* Sale price display */}
      {isForSale && salePrice && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.15)]">
          <span className="text-[10px] font-mono tracking-wider text-[rgba(255,255,255,0.4)]">PRICE</span>
          <span className="text-sm font-mono font-medium text-[#f59e0b]">{salePrice} $HEART</span>
        </div>
      )}

      {/* Soul snippet */}
      {soulSnippet && (
        <p className="text-xs text-[rgba(255,255,255,0.4)] font-light leading-relaxed line-clamp-2">
          {soulSnippet}
        </p>
      )}

      {/* Skill pills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-[rgba(167,139,250,0.1)] text-[#a78bfa]"
            >
              {skill.toUpperCase()}
            </span>
          ))}
          {skills.length > 5 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.3)]">
              +{skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
        <MiniStat label="EXPERIMENTS" value={entity.experiments} />
        <MiniStat
          label="DISCOVERIES"
          value={entity.discoveries}
          highlight
        />
        <MiniStat label="TASKS" value={entity.tasks_completed} />
        <MiniStat label="REPUTATION" value={entity.reputation} />
      </div>

      {/* Compute balance bar */}
      <div className="mt-1">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="tech-label">COMPUTE</span>
          <span
            className={`font-mono ${
              computeLow ? "text-[#ef4444]" : "text-[#22c55e]"
            }`}
          >
            {Math.round(entity.compute_balance)}
          </span>
        </div>
        <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              computeLow ? "bg-[#ef4444]" : "bg-[#22c55e]"
            }`}
            style={{ width: `${computePercent}%` }}
          />
        </div>
      </div>

      {/* Creator revenue */}
      {entity.creator_revenue > 0 && (
        <div className="flex items-center justify-between text-[10px] mt-0.5">
          <span className="tech-label">CREATOR.REVENUE</span>
          <span className="font-mono text-[#f59e0b]">
            {entity.creator_revenue} $HEART
          </span>
        </div>
      )}

      {/* TX feedback */}
      {txError && (
        <div className="glass-sm p-2 bg-[rgba(239,68,68,0.08)] text-[10px] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
          <span className="text-[#ef4444] font-light truncate">{txError}</span>
        </div>
      )}
      {txSuccess && (
        <div className="glass-sm p-2 bg-[rgba(34,197,94,0.08)] text-[10px] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
          <span className="text-[#22c55e] font-light truncate">{txSuccess}</span>
        </div>
      )}

      {/* Marketplace actions */}
      <div className="mt-auto pt-2 border-t border-[rgba(255,255,255,0.05)] flex flex-col gap-2">
        {/* Owner actions */}
        {isOwner && !isForSale && (
          <button
            onClick={() => setShowListModal(true)}
            disabled={txBusy}
            className="w-full text-center px-4 py-2 text-[10px] tracking-wider font-mono rounded-lg bg-[rgba(245,158,11,0.1)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.18)] transition-colors disabled:opacity-40"
          >
            {txBusy ? "PROCESSING..." : "LIST FOR SALE"}
          </button>
        )}
        {isOwner && isForSale && (
          <button
            onClick={handleDelist}
            disabled={txBusy}
            className="w-full text-center px-4 py-2 text-[10px] tracking-wider font-mono rounded-lg bg-[rgba(239,68,68,0.1)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.18)] transition-colors disabled:opacity-40"
          >
            {txBusy ? "PROCESSING..." : "DELIST"}
          </button>
        )}

        {/* Buyer action */}
        {!isOwner && isForSale && wallet.address && (
          <button
            onClick={handleBuy}
            disabled={txBusy}
            className="w-full text-center px-4 py-2 text-[10px] tracking-wider font-mono rounded-lg bg-[rgba(34,197,94,0.1)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.18)] transition-colors disabled:opacity-40"
          >
            {txBusy ? "PROCESSING..." : `BUY FOR ${salePrice} $HEART`}
          </button>
        )}

        <Link
          href={`/entity/${entity.id}`}
          className="btn-secondary inline-block w-full text-center px-4 py-2 text-[10px] tracking-wider group-hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        >
          VIEW PROFILE
        </Link>
      </div>

      {/* List For Sale Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowListModal(false)}>
          <div className="glass p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-1">List Entity For Sale</h3>
            <p className="text-xs text-[rgba(255,255,255,0.4)] font-light mb-4">
              Set a price in $HEART for <span className="text-white font-medium">{entity.name}</span>.
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
    </div>
  )
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-mono tracking-wider text-[rgba(255,255,255,0.25)]">
        {label}
      </span>
      <span
        className={`text-xs font-mono font-medium ${
          highlight
            ? "text-white"
            : "text-[rgba(255,255,255,0.6)]"
        }`}
      >
        {value}
      </span>
    </div>
  )
}
