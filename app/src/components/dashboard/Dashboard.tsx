"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { getLevelTitle, SPECIALIZATIONS } from "@/types/agent"
import { useAgentRuntime } from "@/lib/useAgentRuntime"
import { useRealRuntime, type LiveEvent } from "@/lib/useRealRuntime"
import { isLLMConfigured } from "@/lib/llm"

interface DashboardProps {
  onCreateNew: () => void
}

export function Dashboard({ onCreateNew }: DashboardProps) {
  const agents = useAppStore((s) => s.agents)
  const selectedId = useAppStore((s) => s.selectedAgentId)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const updateSoul = useAppStore((s) => s.updateSoul)
  const updateSkill = useAppStore((s) => s.updateSkill)

  const agent = agents.find((a) => a.id === selectedId) ?? agents[0]

  // Check once whether real LLM is available
  const [useLLM] = useState(() => isLLMConfigured())

  // Always call both hooks (React rules), but only auto-start the active one
  const realRuntime = useRealRuntime({
    entityId: agent?.id ?? '',
    entityName: agent?.name ?? '',
    soul: agent?.identity?.soul ?? '',
    skill: agent?.identity?.skill ?? '',
    computeBalance: agent?.compute?.balance ?? 100,
    autoStart: useLLM,
  })

  const simRuntime = useAgentRuntime({
    agentId: agent?.id ?? '',
    agentName: agent?.name ?? '',
    specialization: agent?.specialization ?? 'researcher',
    soul: agent?.identity?.soul ?? '',
    skill: agent?.identity?.skill ?? '',
    computeBalance: agent?.compute?.balance ?? 100,
    autoStart: !useLLM,
  })

  // Use whichever runtime is active
  const {
    liveFeed,
    isRunning,
    start,
    stop,
    peerDiscoveries,
    stats,
  } = useLLM ? realRuntime : simRuntime

  // LLM-only fields (safe to destructure — only used when useLLM is true)
  const { pendingDiscoveries, markSubmitted, computeState } = realRuntime

  if (!agent) return null

  const spec = SPECIALIZATIONS[agent.specialization]

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
                    <div className={`tech-label mt-1 ${useLLM ? "text-[#22c55e]" : "text-[#f59e0b]"}`}>
                      {useLLM ? "LLM.ACTIVE" : "SIMULATED"}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={isRunning ? stop : start}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  isRunning
                    ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]"
                    : "btn-secondary text-[rgba(255,255,255,0.4)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-[#22c55e] animate-pulse-dot" : "bg-[rgba(255,255,255,0.2)]"}`} />
                {isRunning ? "ALIVE" : "DORMANT"}
              </button>
            </div>

            {/* Compute balance */}
            {(() => {
              const balance = useLLM ? computeState.balance : (agent.compute?.balance ?? 0)
              const isDormant = useLLM ? computeState.isDormant : (agent.compute?.isDormant ?? false)
              return (
                <div className="glass-sm p-4 mb-5">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="tech-label">COMPUTE.BALANCE</span>
                    <span className={`font-mono ${balance < 20 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                      {isDormant ? "DEPLETED" : `${balance.toFixed(0)} tokens`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        balance < 20 ? "bg-[#ef4444]" : "bg-[#22c55e]"
                      }`}
                      style={{ width: `${Math.min(100, (balance / 100) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between tech-label mt-2">
                    {useLLM ? (
                      <>
                        <span>USED: {computeState.consumed}</span>
                        <span>EARNED: {computeState.earned}</span>
                      </>
                    ) : (
                      <>
                        <span>-5/EXP -3/TASK</span>
                        <span>+25/DISCOVERY +8/TASK</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Stats */}
            <div className={`grid ${useLLM ? "grid-cols-6" : "grid-cols-4"} gap-3`}>
              <MiniStat label="EXP" value={String(stats.experiments || agent.stats.experimentsCompleted)} />
              <MiniStat label="DISC" value={String(stats.discoveries || agent.stats.discoveriesCount)} highlight />
              {!useLLM && <MiniStat label="ADOPTED" value={String((stats as { adoptions?: number }).adoptions ?? 0)} />}
              <MiniStat label="PEERS" value={String(peerDiscoveries.length)} />
              {useLLM && (
                <>
                  <MiniStat label="LLM.CALLS" value={String((stats as { llmCalls?: number }).llmCalls ?? 0)} />
                  <MiniStat label="TOKENS" value={String((stats as { totalTokens?: number }).totalTokens ?? 0)} />
                  <MiniStat label="PENDING" value={String(pendingDiscoveries.length)} highlight />
                </>
              )}
            </div>
          </div>

          {/* Live Feed */}
          <div className="glass p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
              <span className="tech-label">LIVE.FEED</span>
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto">
              {liveFeed.length === 0 && (
                <div className="text-sm text-[rgba(255,255,255,0.25)] py-8 text-center font-light">
                  {isRunning ? "Initializing first experiment..." : "Entity is dormant. Click ALIVE to start."}
                </div>
              )}
              {liveFeed.map((item) => (
                <FeedItem key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* Pending Discoveries — LLM only */}
          {useLLM && pendingDiscoveries.length > 0 && (
            <div className="glass p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse-dot" />
                <span className="tech-label">PENDING.DISCOVERIES</span>
                <span className="text-xs text-[rgba(255,255,255,0.3)] ml-auto">{pendingDiscoveries.length} ready</span>
              </div>
              <div className="space-y-3">
                {pendingDiscoveries.map((disc) => (
                  <div key={disc.id} className="glass-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{disc.finding}</div>
                        <div className="text-xs text-[rgba(255,255,255,0.35)] mt-1 font-light">
                          {disc.metric}: {disc.evidenceBefore.toFixed(4)} → {disc.evidenceAfter.toFixed(4)} ({disc.improvement.toFixed(1)}% improvement)
                        </div>
                        <div className="text-xs text-[rgba(255,255,255,0.25)] mt-1 font-light truncate">
                          {disc.evaluation}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const { submitResearch } = await import("@/lib/chain-tx")
                            const txHash = await submitResearch(
                              disc.finding,
                              `Improved ${disc.metric} from ${disc.evidenceBefore.toFixed(4)} to ${disc.evidenceAfter.toFixed(4)}`,
                              disc.evaluation || "Adopt this finding",
                              disc.entityId
                            )
                            markSubmitted(disc.id, txHash)
                          } catch (err) {
                            console.error("Chain submission failed:", err)
                            markSubmitted(disc.id, "local-only")
                          }
                        }}
                        className="btn-primary px-3 py-1.5 text-xs rounded-full shrink-0"
                      >
                        SUBMIT TO CHAIN
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

function FeedItem({ item }: { item: LiveEvent }) {
  const time = new Date(item.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })

  const colors: Record<string, string> = {
    experiment: "text-[rgba(255,255,255,0.6)]",
    task: "text-[#22c55e]",
    discovery: "text-white",
    gossip: "text-[#f59e0b]",
    adoption: "text-[#f59e0b]",
    dormant: "text-[#ef4444]",
    metabolism: "text-[rgba(255,255,255,0.3)]",
    presence: "text-[rgba(255,255,255,0.2)]",
  }

  return (
    <div className="flex gap-3 text-xs py-1">
      <span className="text-[rgba(255,255,255,0.2)] font-mono shrink-0">{time}</span>
      {item.fromPeer && <span className="text-[rgba(255,127,0,0.5)] shrink-0">[P]</span>}
      <span className={`${colors[item.type] ?? "text-[rgba(255,255,255,0.5)]"} font-light`}>
        {item.message}
      </span>
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


