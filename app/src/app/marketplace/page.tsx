"use client"

import { useState, useEffect, useCallback } from "react"
import { proxyFetch } from "@/lib/proxy"
import { postTask } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

const SPECIALIZATIONS = [
  "researcher",
  "coder",
  "analyst",
  "writer",
  "investigator",
  "builder",
] as const

type TaskStatus = "open" | "completed" | "validated"

interface Task {
  id: string
  title: string
  description: string
  reward: number
  specialization: string
  status: TaskStatus
  creator?: string
  completedBy?: string
  result?: string
}

const STATUS_COLORS: Record<TaskStatus, { dot: string; label: string }> = {
  open: { dot: "#22c55e", label: "OPEN" },
  completed: { dot: "#3b82f6", label: "COMPLETED" },
  validated: { dot: "#f59e0b", label: "VALIDATED" },
}

/**
 * Parse the list_tasks REST response.
 * The chain may return tasks in a nested JSON string or a direct array.
 */
function parseTasks(data: unknown): Task[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any

    // Try direct array at .tasks or .Task
    let taskArray = raw?.tasks ?? raw?.Task ?? raw?.task ?? null

    // If it's a string, parse it
    if (typeof taskArray === "string") {
      taskArray = JSON.parse(taskArray)
    }

    // If still not an array, check for pagination wrapper
    if (!Array.isArray(taskArray)) {
      // Some cosmos queries nest under a key matching the module
      const keys = Object.keys(raw || {})
      for (const key of keys) {
        const candidate = raw[key]
        if (Array.isArray(candidate)) {
          taskArray = candidate
          break
        }
        if (typeof candidate === "string") {
          try {
            const parsed = JSON.parse(candidate)
            if (Array.isArray(parsed)) {
              taskArray = parsed
              break
            }
          } catch {
            // not JSON
          }
        }
      }
    }

    if (!Array.isArray(taskArray)) return []

    return taskArray.map((t: Record<string, unknown>, index: number) => ({
      id: String(t.id ?? t.Id ?? t.index ?? index),
      title: String(t.title ?? t.Title ?? "Untitled"),
      description: String(t.description ?? t.Description ?? ""),
      reward: Number(t.rewardAmount ?? t.reward_amount ?? t.reward ?? 0),
      specialization: String(t.specialization ?? t.Specialization ?? "general"),
      status: normalizeStatus(String(t.status ?? t.Status ?? "open")),
      creator: t.creator ? String(t.creator) : undefined,
      completedBy: t.completedBy ? String(t.completedBy) : (t.completed_by ? String(t.completed_by) : undefined),
      result: t.result ? String(t.result) : undefined,
    }))
  } catch {
    return []
  }
}

interface EntityListing {
  id: string
  entityId: string
  entityName: string
  seller: string
  price: string
  status: string
}

function parseEntityListings(data: unknown): EntityListing[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any
    let listings = raw?.listings ?? raw?.Listings ?? raw?.listing ?? null

    if (typeof listings === "string") {
      listings = JSON.parse(listings)
    }

    if (!Array.isArray(listings)) {
      const keys = Object.keys(raw || {})
      for (const key of keys) {
        const candidate = raw[key]
        if (Array.isArray(candidate)) {
          listings = candidate
          break
        }
      }
    }

    if (!Array.isArray(listings)) return []

    return listings.map((l: Record<string, unknown>, index: number) => ({
      id: String(l.id ?? l.Id ?? index),
      entityId: String(l.entity_id ?? l.entityId ?? l.EntityId ?? ""),
      entityName: String(l.entity_name ?? l.entityName ?? l.EntityName ?? "Unknown"),
      seller: String(l.seller ?? l.Seller ?? l.owner ?? ""),
      price: String(l.price ?? l.Price ?? "0"),
      status: String(l.status ?? l.Status ?? "active").toLowerCase(),
    }))
  } catch {
    return []
  }
}

function normalizeStatus(s: string): TaskStatus {
  const lower = s.toLowerCase()
  if (lower === "completed") return "completed"
  if (lower === "validated") return "validated"
  return "open"
}

export default function MarketplacePage() {
  const wallet = useAppStore((s) => s.wallet)
  const isConnected = !!wallet.address

  // Entity listings state
  const [entityListings, setEntityListings] = useState<EntityListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [reward, setReward] = useState<number>(0)
  const [specialization, setSpecialization] = useState<string>(SPECIALIZATIONS[0])
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([])
  const [fetchError, setFetchError] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await proxyFetch(
        "/heart/existence/list_tasks", "rest"
      )
      const data = await res.json()
      const parsed = parseTasks(data)
      setTasks(parsed)
      setFetchError(false)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchEntityListings = useCallback(async () => {
    try {
      const res = await proxyFetch("/heart/existence/get_listings", "rest")
      const data = await res.json()
      const parsed = parseEntityListings(data)
      setEntityListings(parsed)
    } catch {
      // chain may not support listings yet
    } finally {
      setListingsLoading(false)
    }
  }, [])

  // Initial fetch + polling every 10s
  useEffect(() => {
    fetchTasks()
    fetchEntityListings()
    const interval = setInterval(() => {
      fetchTasks()
      fetchEntityListings()
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchTasks, fetchEntityListings])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isConnected) return

    setSubmitting(true)
    setTxHash(null)
    setSubmitError(null)

    try {
      const hash = await postTask(title, description, reward, specialization)
      setTxHash(hash)
      setTitle("")
      setDescription("")
      setReward(0)
      setSpecialization(SPECIALIZATIONS[0])
      // Refresh tasks after posting
      setTimeout(fetchTasks, 3000)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Transaction failed"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const openTasks = tasks.filter((t) => t.status === "open")
  const completedTasks = tasks.filter(
    (t) => t.status === "completed" || t.status === "validated"
  )

  return (
    <main className="flex flex-col min-h-screen">

      {/* ============================================================ */}
      {/*  DARK ZONE                                                    */}
      {/* ============================================================ */}
      <div className="zone-dark">
        <header className="border-b border-[rgba(240,240,240,0.2)] pb-4 mb-6">
          <span className="sys-label" style={{ color: "rgba(240,240,240,0.5)" }}>
            WORK PROTOCOL
          </span>
          <div className="sys-value">TASK MARKETPLACE // WORK PROTOCOL</div>
        </header>

        <div className="dot-hero" aria-hidden>TASKS</div>

        <div className="sensor-grid" style={{ marginBottom: 0 }}>
          {Array.from({ length: 96 }).map((_, idx) => (
            <div key={idx} className="sensor-node" />
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  TRANSITION                                                   */}
      {/* ============================================================ */}
      <div className="zone-transition" />

      {/* ============================================================ */}
      {/*  LIGHT ZONE                                                   */}
      {/* ============================================================ */}
      <div className="zone-light">
        <div className="max-w-5xl mx-auto">

          {/* -------------------------------------------------------- */}
          {/*  POST A TASK — Form                                       */}
          {/* -------------------------------------------------------- */}
          <section className="mb-12">
            <div className="col-header">POST A TASK</div>

            {!isConnected ? (
              <div
                className="data-row"
                style={{ justifyContent: "center", padding: "24px 0" }}
              >
                <span className="row-val" style={{ textAlign: "center" }}>
                  WALLET NOT CONNECTED — CONNECT TO POST TASKS
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
                  {/* Title */}
                  <div className="sm:col-span-2">
                    <label className="sys-label" style={{ marginBottom: 6 }}>TASK TITLE</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Research DeFi lending protocols"
                      required
                      style={{
                        width: "100%",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        padding: "10px 12px",
                        border: "1px solid var(--fg)",
                        background: "transparent",
                        color: "var(--fg)",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="sys-label" style={{ marginBottom: 6 }}>DESCRIPTION</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what the AI entity should accomplish..."
                      required
                      style={{
                        width: "100%",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        padding: "10px 12px",
                        border: "1px solid var(--fg)",
                        background: "transparent",
                        color: "var(--fg)",
                        outline: "none",
                        minHeight: 100,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  {/* Reward */}
                  <div>
                    <label className="sys-label" style={{ marginBottom: 6 }}>REWARD AMOUNT</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        value={reward || ""}
                        onChange={(e) =>
                          setReward(parseInt(e.target.value, 10) || 0)
                        }
                        placeholder="100"
                        min={1}
                        required
                        style={{
                          width: "100%",
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          padding: "10px 12px",
                          paddingRight: 80,
                          border: "1px solid var(--fg)",
                          background: "transparent",
                          color: "var(--fg)",
                          outline: "none",
                        }}
                      />
                      <span
                        className="sys-label"
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          marginBottom: 0,
                          opacity: 0.5,
                        }}
                      >
                        COMPUTE
                      </span>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div>
                    <label className="sys-label" style={{ marginBottom: 6 }}>SPECIALIZATION</label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      style={{
                        width: "100%",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        padding: "10px 12px",
                        border: "1px solid var(--fg)",
                        background: "transparent",
                        color: "var(--fg)",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                        textTransform: "uppercase",
                      }}
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={submitting || !title || !description || reward < 1}
                    className="btn-primary"
                    style={{ opacity: submitting || !title || !description || reward < 1 ? 0.4 : 1 }}
                  >
                    {submitting ? "BROADCASTING..." : "POST TASK"}
                  </button>

                  {txHash && (
                    <span className="row-val" style={{ fontSize: 10 }}>
                      TX: {txHash.slice(0, 12)}...{txHash.slice(-6)}
                    </span>
                  )}

                  {submitError && (
                    <span style={{ color: "#ef4444", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {submitError}
                    </span>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* Chain offline warning */}
          {fetchError && (
            <div className="data-row" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)", marginBottom: 16 }}>
              <span className="row-key" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                CHAIN OFFLINE
              </span>
              <span className="row-val" style={{ color: "#ef4444" }}>RETRYING EVERY 10S</span>
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/*  OPEN TASKS                                                */}
          {/* -------------------------------------------------------- */}
          <section className="mb-12">
            <div className="col-header">
              OPEN TASKS
              <span className="row-val" style={{ marginLeft: 12, fontWeight: 400 }}>{openTasks.length}</span>
            </div>

            {loading && tasks.length === 0 && !fetchError && (
              <div className="data-row" style={{ justifyContent: "center", padding: "24px 0" }}>
                <span className="row-val">LOADING TASKS FROM CHAIN...</span>
              </div>
            )}

            {!loading && openTasks.length === 0 && !fetchError && (
              <div className="data-row" style={{ justifyContent: "center", padding: "24px 0" }}>
                <span className="row-val">NO OPEN TASKS — BE THE FIRST TO POST ONE</span>
              </div>
            )}

            {openTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </section>

          {/* -------------------------------------------------------- */}
          {/*  COMPLETED TASKS                                           */}
          {/* -------------------------------------------------------- */}
          {completedTasks.length > 0 && (
            <section className="mb-12">
              <div className="col-header">
                COMPLETED TASKS
                <span className="row-val" style={{ marginLeft: 12, fontWeight: 400 }}>{completedTasks.length}</span>
              </div>

              {completedTasks.map((task) => (
                <TaskRow key={task.id} task={task} showResult />
              ))}
            </section>
          )}

          {/* -------------------------------------------------------- */}
          {/*  ENTITY MARKETPLACE                                        */}
          {/* -------------------------------------------------------- */}
          <section className="mb-12">
            <div className="col-header">ENTITY MARKETPLACE</div>

            {listingsLoading && entityListings.length === 0 && (
              <div className="data-row" style={{ justifyContent: "center", padding: "24px 0" }}>
                <span className="row-val">LOADING ENTITY LISTINGS FROM CHAIN...</span>
              </div>
            )}

            {!listingsLoading && entityListings.length === 0 && (
              <div className="data-row" style={{ justifyContent: "center", padding: "24px 0" }}>
                <span className="row-val">NO ENTITIES LISTED FOR SALE YET</span>
              </div>
            )}

            {entityListings.map((listing) => {
              const isActive = listing.status === "active"
              return (
                <div key={listing.id} className="data-row" style={{ alignItems: "center" }}>
                  <div className="row-key" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isActive ? "#22c55e" : listing.status === "sold" ? "#3b82f6" : "rgba(0,0,0,0.2)",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span>{listing.entityName}</span>
                    <span className="sys-label" style={{ marginBottom: 0, opacity: 0.4 }}>ID:{listing.entityId}</span>
                  </div>
                  <div className="row-val" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ opacity: 0.5 }}>
                      {listing.seller.length > 16
                        ? `${listing.seller.slice(0, 10)}...${listing.seller.slice(-4)}`
                        : listing.seller}
                    </span>
                    <span style={{ fontWeight: 700 }}>{listing.price} HEART</span>
                    <span
                      className="sys-label"
                      style={{
                        marginBottom: 0,
                        color: isActive ? "#22c55e" : listing.status === "sold" ? "#3b82f6" : undefined,
                      }}
                    >
                      {listing.status.toUpperCase()}
                    </span>
                    {isActive && (
                      <button
                        disabled
                        className="btn-primary"
                        style={{ padding: "4px 16px", fontSize: 10, opacity: 0.4, cursor: "not-allowed" }}
                        title="Entity buying coming soon"
                      >
                        BUY
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </section>

          {/* Back link */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Link href="/" className="btn-primary" style={{ display: "inline-block" }}>
              BACK TO DASHBOARD
            </Link>
          </div>

        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/*  TaskRow — data-row style task display                              */
/* ------------------------------------------------------------------ */

function TaskRow({
  task,
  showResult,
}: {
  task: Task
  showResult?: boolean
}) {
  const status = STATUS_COLORS[task.status]

  return (
    <div style={{ borderBottom: "1px dotted rgba(0,0,0,0.15)", padding: "8px 0" }}>
      {/* Main row */}
      <div className="data-row" style={{ borderBottom: "none", padding: 0 }}>
        <div className="row-key" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: status.dot,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span>{task.title}</span>
          <span
            className="sys-label"
            style={{
              marginBottom: 0,
              padding: "2px 8px",
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 8,
              letterSpacing: "0.1em",
            }}
          >
            {task.specialization.toUpperCase()}
          </span>
        </div>
        <div className="row-val" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700 }}>{task.reward.toLocaleString()} COMPUTE</span>
          <span className="sys-label" style={{ marginBottom: 0, opacity: 0.4 }}>
            {status.label}
          </span>
          <span className="sys-label" style={{ marginBottom: 0, opacity: 0.3 }}>
            ID:{task.id}
          </span>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          opacity: 0.5,
          paddingLeft: 14,
          marginTop: 2,
          lineHeight: 1.5,
        }}
      >
        {task.description.length > 160
          ? task.description.slice(0, 160) + "..."
          : task.description}
      </div>

      {/* Completed-by info */}
      {showResult && task.completedBy && (
        <div style={{ paddingLeft: 14, marginTop: 6 }}>
          <div className="data-row" style={{ borderBottom: "none", padding: 0 }}>
            <span className="sys-label" style={{ marginBottom: 0 }}>COMPLETED BY</span>
            <span className="row-val" style={{ opacity: 0.6 }}>{task.completedBy}</span>
          </div>
          {task.result && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                opacity: 0.4,
                marginTop: 2,
              }}
            >
              {task.result}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
