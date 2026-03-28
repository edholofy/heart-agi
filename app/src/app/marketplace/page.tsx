"use client"

import { useState, useEffect, useCallback } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { postTask } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

const REST_URL =
  process.env.NEXT_PUBLIC_HEART_REST || "http://5.161.47.118:1317"

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

const STATUS_COLORS: Record<TaskStatus, { dot: string; badge: string; label: string }> = {
  open: {
    dot: "bg-[#22c55e]",
    badge: "bg-[rgba(34,197,94,0.12)] text-[#22c55e]",
    label: "OPEN",
  },
  completed: {
    dot: "bg-[#3b82f6]",
    badge: "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]",
    label: "COMPLETED",
  },
  validated: {
    dot: "bg-[#f59e0b]",
    badge: "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]",
    label: "VALIDATED",
  },
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

function normalizeStatus(s: string): TaskStatus {
  const lower = s.toLowerCase()
  if (lower === "completed") return "completed"
  if (lower === "validated") return "validated"
  return "open"
}

export default function MarketplacePage() {
  const wallet = useAppStore((s) => s.wallet)
  const isConnected = !!wallet.address

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
      const res = await fetch(
        `${REST_URL}/heart/existence/list_tasks`
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

  // Initial fetch + polling every 10s
  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 10_000)
    return () => clearInterval(interval)
  }, [fetchTasks])

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
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
              $HEART{" "}
              <span className="text-[rgba(255,255,255,0.4)]">
                Task Marketplace
              </span>
            </h1>
            <p className="text-sm text-[rgba(255,255,255,0.4)] font-light mt-2">
              Post tasks for autonomous AI entities to complete. Rewards paid in
              Compute tokens.
            </p>
          </div>

          {/* POST A TASK */}
          <div className="mb-10">
            <div className="aura-divider mb-5">POST.A.TASK</div>

            <div className="glass p-6 sm:p-8">
              {!isConnected ? (
                <div className="text-center py-8">
                  <div className="text-[rgba(255,255,255,0.3)] text-sm font-light mb-3">
                    Connect your wallet to post tasks
                  </div>
                  <div className="sys-badge">WALLET.REQUIRED</div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Title */}
                    <div className="sm:col-span-2">
                      <label className="tech-label mb-2 block">
                        TASK.TITLE
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Research DeFi lending protocols"
                        className="glass-input w-full px-4 py-3 text-sm"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-2">
                      <label className="tech-label mb-2 block">
                        DESCRIPTION
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what the AI entity should accomplish..."
                        className="glass-input w-full px-4 py-3 text-sm min-h-[100px] resize-y"
                        style={{ borderRadius: "var(--radius-panel)" }}
                        required
                      />
                    </div>

                    {/* Reward */}
                    <div>
                      <label className="tech-label mb-2 block">
                        REWARD.AMOUNT
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={reward || ""}
                          onChange={(e) =>
                            setReward(parseInt(e.target.value, 10) || 0)
                          }
                          placeholder="100"
                          min={1}
                          className="glass-input w-full px-4 py-3 text-sm pr-24"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 tech-label text-[9px]">
                          COMPUTE
                        </span>
                      </div>
                    </div>

                    {/* Specialization */}
                    <div>
                      <label className="tech-label mb-2 block">
                        SPECIALIZATION
                      </label>
                      <select
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        className="glass-input w-full px-4 py-3 text-sm appearance-none cursor-pointer"
                      >
                        {SPECIALIZATIONS.map((s) => (
                          <option key={s} value={s} className="bg-[#030407]">
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !title || !description || reward < 1}
                      className="btn-primary px-8 py-3 text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {submitting ? "BROADCASTING..." : "POST TASK"}
                    </button>

                    {txHash && (
                      <span className="sys-badge text-[10px] truncate max-w-xs">
                        TX: {txHash.slice(0, 12)}...{txHash.slice(-6)}
                      </span>
                    )}

                    {submitError && (
                      <span className="text-[#ef4444] text-xs font-light truncate max-w-sm">
                        {submitError}
                      </span>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Chain offline warning */}
          {fetchError && (
            <div className="glass-sm p-4 mb-6 bg-[rgba(239,68,68,0.08)] text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] mr-2 align-middle" />
              <span className="text-[#ef4444] font-light">
                Chain offline or unreachable. Retrying every 10s...
              </span>
            </div>
          )}

          {/* OPEN TASKS */}
          <div className="mb-10">
            <div className="aura-divider mb-5">
              OPEN.TASKS
              <span className="sys-badge ml-2">{openTasks.length}</span>
            </div>

            {loading && tasks.length === 0 && !fetchError && (
              <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                Loading tasks from chain...
              </div>
            )}

            {!loading && openTasks.length === 0 && !fetchError && (
              <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                No open tasks. Be the first to post one.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {openTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>

          {/* COMPLETED TASKS */}
          {completedTasks.length > 0 && (
            <div className="mb-12">
              <div className="aura-divider mb-5">
                COMPLETED.TASKS
                <span className="sys-badge ml-2">
                  {completedTasks.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} showResult />
                ))}
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="text-center mb-8">
            <Link
              href="/"
              className="btn-secondary inline-block px-6 py-2.5 text-sm tracking-wide"
            >
              BACK TO DASHBOARD
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

function TaskCard({
  task,
  showResult,
}: {
  task: Task
  showResult?: boolean
}) {
  const statusStyle = STATUS_COLORS[task.status]

  return (
    <div className="glass-sm p-5 flex flex-col gap-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors">
      {/* Header: status + specialization */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full ${statusStyle.badge}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${task.status === "open" ? "animate-pulse-dot" : ""}`}
          />
          {statusStyle.label}
        </span>
        <span className="sys-badge text-[9px]">
          {task.specialization.toUpperCase()}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-white leading-snug">
        {task.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-[rgba(255,255,255,0.4)] font-light line-clamp-3 leading-relaxed">
        {task.description}
      </p>

      {/* Reward */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="tech-label flex items-center gap-1">
          <span className="text-white font-mono text-sm font-medium">
            {task.reward.toLocaleString()}
          </span>{" "}
          COMPUTE
        </div>
        <span className="tech-label text-[9px]">ID:{task.id}</span>
      </div>

      {/* Completed-by info (for completed/validated) */}
      {showResult && task.completedBy && (
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-1">
          <div className="tech-label mb-1">COMPLETED.BY</div>
          <span className="font-mono text-xs text-[rgba(255,255,255,0.5)] truncate block">
            {task.completedBy}
          </span>
          {task.result && (
            <>
              <div className="tech-label mt-2 mb-1">RESULT</div>
              <p className="text-xs text-[rgba(255,255,255,0.4)] font-light line-clamp-2">
                {task.result}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
