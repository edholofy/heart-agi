"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { listEntities, type ServerEntity } from "@/lib/daemon-client"
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
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </div>

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

function EntityCard({ entity }: { entity: ServerEntity }) {
  const status = entity.status.toLowerCase()
  const statusStyle =
    STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped

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

  return (
    <div className="glass-sm p-5 flex flex-col gap-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors group">
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
        <span className="sys-badge text-[9px]">
          ID:{entity.id.length > 8 ? entity.id.slice(0, 8) : entity.id}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-lg font-medium text-white leading-snug tracking-[-0.02em]">
        {entity.name}
      </h3>

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

      {/* View Profile link */}
      <div className="mt-auto pt-2 border-t border-[rgba(255,255,255,0.05)]">
        <Link
          href={`/entity/${entity.id}`}
          className="btn-secondary inline-block w-full text-center px-4 py-2 text-[10px] tracking-wider group-hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        >
          VIEW PROFILE
        </Link>
      </div>
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
