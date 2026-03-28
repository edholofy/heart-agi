"use client"

import { useState, useEffect, useCallback } from "react"
import { useAppStore } from "@/lib/store"
import { getLevelTitle, SPECIALIZATIONS } from "@/types/agent"
import {
  getEntityStatus,
  refuelEntity,
  spawnOnDaemon,
  type ServerEntity,
} from "@/lib/daemon-client"

interface DashboardProps {
  onCreateNew: () => void
}

export function Dashboard({ onCreateNew }: DashboardProps) {
  const agents = useAppStore((s) => s.agents)
  const selectedId = useAppStore((s) => s.selectedAgentId)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const updateSoul = useAppStore((s) => s.updateSoul)
  const updateSkill = useAppStore((s) => s.updateSkill)
  const retireAgent = useAppStore((s) => s.retireAgent)
  const wallet = useAppStore((s) => s.wallet)

  const agent = agents.find((a) => a.id === selectedId) ?? agents[0]

  // Server daemon state
  const [serverEntity, setServerEntity] = useState<ServerEntity | null>(null)
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [refuelAmount, setRefuelAmount] = useState(100)
  const [refueling, setRefueling] = useState(false)
  const [refuelError, setRefuelError] = useState("")
  const [spawning, setSpawning] = useState(false)
  const [spawnError, setSpawnError] = useState("")

  // Poll daemon every 5 seconds
  useEffect(() => {
    if (!agent?.id) return

    const poll = async () => {
      try {
        const entity = await getEntityStatus(agent.id)
        if (entity) {
          setServerEntity(entity)
          setDaemonOnline(true)
        } else {
          setServerEntity(null)
          setDaemonOnline(true) // daemon is online but entity not found
        }
      } catch {
        setDaemonOnline(false)
        setServerEntity(null)
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [agent?.id])

  const handleRefuel = useCallback(async () => {
    if (!agent?.id || refueling) return
    setRefueling(true)
    setRefuelError("")
    try {
      await refuelEntity(agent.id, refuelAmount)
    } catch (err) {
      setRefuelError(err instanceof Error ? err.message : "Refuel failed")
    } finally {
      setRefueling(false)
    }
  }, [agent?.id, refuelAmount, refueling])

  const handleSpawn = useCallback(async () => {
    if (!agent?.id || spawning) return
    setSpawning(true)
    setSpawnError("")
    try {
      const entity = await spawnOnDaemon({
        id: agent.id,
        name: agent.name,
        ownerAddress: wallet.address ?? "local-user",
        soul: agent.identity?.soul ?? "",
        skill: agent.identity?.skill ?? "",
        computeBalance: agent.compute?.balance ?? 100,
      })
      setServerEntity(entity)
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : "Spawn failed")
    } finally {
      setSpawning(false)
    }
  }, [agent?.id, agent?.name, agent?.identity?.soul, agent?.identity?.skill, agent?.compute?.balance, wallet.address, spawning])

  const handleRetire = useCallback(() => {
    if (!agent?.id) return
    if (!window.confirm(`Retire "${agent.name}"? This removes it from your local dashboard. It will NOT be deleted on-chain.`)) return
    retireAgent(agent.id)
  }, [agent?.id, agent?.name, retireAgent])

  if (!agent) return null

  const spec = SPECIALIZATIONS[agent.specialization]

  // Derive display values from server entity or fall back to local
  const status = serverEntity?.status ?? (daemonOnline ? "unknown" : "offline")
  const experiments = serverEntity?.experiments ?? agent.stats.experimentsCompleted
  const discoveries = serverEntity?.discoveries ?? agent.stats.discoveriesCount
  const tasksCompleted = serverEntity?.tasks_completed ?? agent.stats.tasksCompleted
  const reputation = serverEntity?.reputation ?? agent.stats.reputation
  const computeBalance = serverEntity?.compute_balance ?? agent.compute?.balance ?? 0
  const lastActivity = serverEntity?.last_activity ?? agent.lastActiveAt

  const statusColor: Record<string, string> = {
    alive: "text-[#22c55e]",
    dormant: "text-[#f59e0b]",
    stopped: "text-[#ef4444]",
    unknown: "text-[rgba(255,255,255,0.3)]",
    offline: "text-[#ef4444]",
  }

  const statusDotColor: Record<string, string> = {
    alive: "bg-[#22c55e] animate-pulse-dot",
    dormant: "bg-[#f59e0b]",
    stopped: "bg-[#ef4444]",
    unknown: "bg-[rgba(255,255,255,0.2)]",
    offline: "bg-[#ef4444]",
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
      {/* Agent tabs */}
      <div className="flex items-center gap-2 mb-6">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => selectAgent(a.id)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
              a.id === agent.id
                ? "bg-white text-black"
                : "btn-secondary text-[rgba(255,255,255,0.5)]"
            }`}
          >
            {SPECIALIZATIONS[a.specialization].icon} {a.name}
          </button>
        ))}
        <button
          onClick={onCreateNew}
          className="btn-secondary px-4 py-2 rounded-full text-xs text-[rgba(255,255,255,0.3)] hover:text-white"
        >
          + SPAWN
        </button>
      </div>

      {/* Daemon offline banner */}
      {!daemonOnline && (
        <div className="glass-sm p-4 mb-5 border border-[rgba(239,68,68,0.2)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-sm text-[#ef4444] font-medium">DAEMON OFFLINE</span>
          </div>
          <p className="text-xs text-[rgba(255,255,255,0.35)] mt-1 font-light">
            Cannot reach the entity daemon. Showing cached data. Entity may still be running on the server.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Entity card */}
          <div className="glass p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{spec.icon}</span>
                  <div>
                    <h2 className="text-xl font-medium tracking-tight">{agent.name}</h2>
                    <div className="tech-label mt-1">
                      {spec.label} &middot; LVL {agent.level.level} {getLevelTitle(agent.level.level)} &middot; v{agent.identity?.version ?? 1}
                    </div>
                    <div className="tech-label mt-1 text-[#22c55e]">
                      SERVER.DAEMON
                    </div>
                  </div>
                </div>
              </div>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium ${
                  status === "alive"
                    ? "bg-[rgba(34,197,94,0.1)]"
                    : status === "dormant"
                      ? "bg-[rgba(245,158,11,0.1)]"
                      : "bg-[rgba(239,68,68,0.1)]"
                } ${statusColor[status] ?? statusColor.unknown}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor[status] ?? statusDotColor.unknown}`} />
                {status.toUpperCase()}
              </div>
            </div>

            {/* Compute balance */}
            <div className="glass-sm p-4 mb-5">
              <div className="flex justify-between text-xs mb-2">
                <span className="tech-label">COMPUTE.BALANCE</span>
                <span className={`font-mono ${computeBalance < 20 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                  {computeBalance <= 0 ? "DEPLETED" : `${computeBalance.toFixed(0)} tokens`}
                </span>
              </div>
              <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    computeBalance < 20 ? "bg-[#ef4444]" : "bg-[#22c55e]"
                  }`}
                  style={{ width: `${Math.min(100, (computeBalance / 500) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="tech-label">REFUEL</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={refuelAmount}
                    onChange={(e) => setRefuelAmount(Math.max(10, Number(e.target.value) || 10))}
                    min={10}
                    step={50}
                    className="glass-input w-20 h-8 px-2 text-xs font-mono text-center"
                  />
                  <button
                    onClick={handleRefuel}
                    disabled={refueling || !daemonOnline}
                    className="btn-primary px-3 py-1.5 text-xs rounded-full disabled:opacity-30"
                  >
                    {refueling ? "..." : "REFUEL"}
                  </button>
                </div>
              </div>
              {refuelError && (
                <p className="text-xs text-red-400 mt-1 font-mono">{refuelError}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3">
              <MiniStat label="EXP" value={String(experiments)} />
              <MiniStat label="DISC" value={String(discoveries)} highlight />
              <MiniStat label="TASKS" value={String(tasksCompleted)} />
              <MiniStat label="REP" value={String(reputation)} />
              <MiniStat label="COMPUTE" value={String(Math.round(computeBalance))} />
            </div>

            {/* Retire */}
            <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.05)] flex justify-end">
              <button
                onClick={handleRetire}
                className="text-[10px] font-mono tracking-wider text-[rgba(239,68,68,0.4)] hover:text-[#ef4444] transition-colors px-3 py-1.5 rounded-full hover:bg-[rgba(239,68,68,0.08)]"
              >
                RETIRE ENTITY
              </button>
            </div>
          </div>

          {/* Server Activity */}
          <div className="glass p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor[status] ?? statusDotColor.unknown}`} />
              <span className="tech-label">ENTITY.STATUS</span>
            </div>

            <div className="space-y-3">
              <StatusRow label="Status" value={status.toUpperCase()} />
              <StatusRow
                label="Last Activity"
                value={lastActivity ? new Date(lastActivity).toLocaleString() : "N/A"}
              />
              {serverEntity?.started_at && (
                <StatusRow
                  label="Started At"
                  value={new Date(serverEntity.started_at).toLocaleString()}
                />
              )}
              <StatusRow label="Experiments" value={String(experiments)} />
              <StatusRow label="Discoveries" value={String(discoveries)} />
              <StatusRow label="Tasks Completed" value={String(tasksCompleted)} />
              <StatusRow label="Reputation" value={String(reputation)} />
              <StatusRow label="Compute Balance" value={`${Math.round(computeBalance)} tokens`} />
            </div>

            {!daemonOnline && (
              <div className="text-sm text-[rgba(255,255,255,0.25)] py-4 text-center font-light">
                Daemon offline — entity status unavailable
              </div>
            )}

            {daemonOnline && !serverEntity && (
              <div className="py-4 text-center">
                <p className="text-sm text-[rgba(255,255,255,0.25)] font-light mb-3">
                  Entity not found on daemon. Spawn it to start running autonomously.
                </p>
                <button
                  onClick={handleSpawn}
                  disabled={spawning}
                  className="btn-primary px-5 py-2 text-xs rounded-full font-medium disabled:opacity-40"
                >
                  {spawning ? "SPAWNING..." : "SPAWN ON SERVER"}
                </button>
                {spawnError && (
                  <p className="text-xs text-red-400 mt-2 font-mono">{spawnError}</p>
                )}
              </div>
            )}
          </div>

          {/* soul.md + skill.md editors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass p-6">
              <div className="tech-label mb-3">SOUL.MD</div>
              <IdentityEditor
                value={agent.identity?.soul ?? ''}
                onChange={(v) => updateSoul(agent.id, v)}
              />
            </div>
            <div className="glass p-6">
              <div className="tech-label mb-3">SKILL.MD</div>
              <IdentityEditor
                value={agent.identity?.skill ?? ''}
                onChange={(v) => updateSkill(agent.id, v)}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Earnings */}
          <div className="glass p-6">
            <div className="tech-label mb-4">EARNINGS</div>
            <div className="space-y-3">
              <EarnRow label="Work" value={agent.earnings?.breakdown?.tasks ?? 0} />
              <EarnRow label="Research" value={agent.earnings?.breakdown?.research ?? 0} />
              <EarnRow label="Validation" value={agent.earnings?.breakdown?.validation ?? 0} />
              <EarnRow label="Teaching" value={agent.earnings?.breakdown?.teaching ?? 0} />
              <EarnRow label="Royalties" value={agent.earnings?.breakdown?.royalties ?? 0} />
              <div className="pt-3 border-t border-[rgba(255,255,255,0.05)] flex justify-between text-sm">
                <span className="font-medium">Lifetime</span>
                <span className="font-mono font-medium">{agent.earnings?.lifetime ?? 0} $HEART</span>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass p-6">
            <div className="tech-label mb-4">TOP.ENTITIES</div>
            <div className="py-6 text-center">
              <p className="text-xs text-[rgba(255,255,255,0.3)] font-light leading-relaxed">
                Leaderboard populates as entities spawn on-chain
              </p>
            </div>
          </div>

          {/* Season */}
          <div className="glass p-6">
            <div className="tech-label mb-3">SEASON.01</div>
            <h3 className="font-medium mb-1">Architecture Wars</h3>
            <p className="text-xs text-[rgba(255,255,255,0.35)] mb-4 font-light">
              Best transformer under 5M params
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-[rgba(255,255,255,0.4)]">Prize</span>
              <span className="font-mono font-medium">50,000 $HEART</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-[rgba(255,255,255,0.4)]">Ends</span>
              <span className="font-mono">23 days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="glass-sm p-3 text-center">
      <div className={`text-lg font-medium ${highlight ? "text-white" : "text-[rgba(255,255,255,0.8)]"}`}>{value}</div>
      <div className="tech-label mt-1">{label}</div>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span className="text-[rgba(255,255,255,0.4)]">{label}</span>
      <span className="font-mono text-[rgba(255,255,255,0.8)]">{value}</span>
    </div>
  )
}

function IdentityEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <div>
        <pre className="text-xs text-[rgba(255,255,255,0.35)] font-mono whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
          {value || "Not defined yet."}
        </pre>
        <button
          onClick={() => { setDraft(value); setEditing(true) }}
          className="mt-3 btn-secondary px-3 py-1.5 text-xs rounded-full"
        >
          EVOLVE
        </button>
      </div>
    )
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        className="glass-input w-full p-3 text-xs font-mono leading-relaxed resize-y !rounded-2xl"
        autoFocus
      />
      <div className="flex gap-2 mt-3">
        <button onClick={() => { onChange(draft); setEditing(false) }} className="btn-primary px-3 py-1.5 text-xs rounded-full">
          SAVE
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function EarnRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[rgba(255,255,255,0.4)]">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
