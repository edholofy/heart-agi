"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { getLevelTitle, SPECIALIZATIONS } from "@/types/agent"
import { useAgentRuntime, type LiveEvent } from "@/lib/useAgentRuntime"

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

  // Real agent runtime with gossip + compute metabolism
  const {
    liveFeed,
    isRunning,
    start,
    stop,
    peerDiscoveries,
    stats,
  } = useAgentRuntime({
    agentId: agent?.id ?? '',
    agentName: agent?.name ?? '',
    specialization: agent?.specialization ?? 'researcher',
    soul: agent?.identity?.soul ?? '',
    skill: agent?.identity?.skill ?? '',
    computeBalance: agent?.compute?.balance ?? 100,
    autoStart: true,
  })

  if (!agent) return null

  const spec = SPECIALIZATIONS[agent.specialization]

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
      {/* Agent selector + create */}
      <div className="flex items-center gap-3 mb-6">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => selectAgent(a.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              a.id === agent.id
                ? "bg-accent text-white"
                : "bg-card border border-card-border text-muted hover:text-foreground"
            }`}
          >
            {SPECIALIZATIONS[a.specialization].icon} {a.name}
          </button>
        ))}
        <button
          onClick={onCreateNew}
          className="px-4 py-2 rounded-lg text-sm border border-dashed border-card-border text-muted hover:text-accent hover:border-accent/50 transition-all"
        >
          + New Human
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent card */}
          <div className="p-6 rounded-xl bg-card border border-card-border glow-accent">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{spec.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold">{agent.name}</h2>
                    <div className="text-sm text-muted">
                      {spec.label} &middot; Level {agent.level.level}{" "}
                      {getLevelTitle(agent.level.level)}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={isRunning ? stop : start}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-all ${
                  isRunning
                    ? "bg-success/10 text-success hover:bg-success/20"
                    : "bg-card-border text-muted hover:text-foreground"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-success animate-pulse-dot" : "bg-muted"}`} />
                {isRunning ? "Running" : "Stopped"}
              </button>
            </div>

            {/* Level progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>
                  Level {agent.level.level} &rarr;{" "}
                  {agent.level.level + 1}
                </span>
                <span>
                  {agent.level.xpCurrent}/{agent.level.xpRequired} XP
                </span>
              </div>
              <div className="h-2 bg-card-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-heart rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (agent.level.xpCurrent / agent.level.xpRequired) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Compute balance */}
            <div className="mb-6 p-3 rounded-lg bg-background border border-card-border">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Compute Balance</span>
                <span className={agent.compute?.isDormant ? "text-heart font-semibold" : "text-success"}>
                  {agent.compute?.isDormant ? "DORMANT" : `${(agent.compute?.balance ?? 0).toFixed(0)} tokens`}
                </span>
              </div>
              <div className="h-2 bg-card-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (agent.compute?.balance ?? 0) < 20 ? "bg-heart" : "bg-success"
                  }`}
                  style={{ width: `${Math.min(100, ((agent.compute?.balance ?? 0) / (agent.compute?.balance ?? 100)) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>Cost: 5/experiment, 3/task</span>
                <span>Earns: 25/discovery, 8/task</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat
                label="Experiments"
                value={String(stats.experiments || agent.stats.experimentsCompleted)}
              />
              <MiniStat
                label="Discoveries"
                value={String(stats.discoveries || agent.stats.discoveriesCount)}
                color="text-accent"
              />
              <MiniStat
                label="Adopted from Peers"
                value={String(stats.adoptions)}
                color="text-warning"
              />
              <MiniStat
                label="Peer Findings"
                value={String(peerDiscoveries.length)}
                color="text-success"
              />
            </div>
          </div>

          {/* Live Feed */}
          <div className="p-6 rounded-xl bg-card border border-card-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
              <h3 className="font-semibold">Live Feed</h3>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {liveFeed.length === 0 && (
                <div className="text-sm text-muted py-8 text-center">
                  {isRunning ? "Your Human is warming up... first experiment starting soon." : "Click \"Running\" to start your Human."}
                </div>
              )}
              {liveFeed.map((item) => (
                <FeedItem key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* soul.md Editor */}
          <div className="p-6 rounded-xl bg-card border border-card-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">soul.md</h3>
              <span className="text-xs text-muted">
                Identity &middot; Values &middot; Personality
              </span>
            </div>
            <IdentityEditor
              value={agent.identity?.soul ?? ''}
              onChange={(soul) => updateSoul(agent.id, soul)}
              label="soul.md"
              hint="Defines WHO your Human is. Values, personality, behavioral boundaries. Costs $HEART to evolve."
            />
          </div>

          {/* skill.md Editor */}
          <div className="p-6 rounded-xl bg-card border border-card-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">skill.md</h3>
              <span className="text-xs text-muted">
                Capabilities &middot; Tools &middot; Expertise
              </span>
            </div>
            <IdentityEditor
              value={agent.identity?.skill ?? ''}
              onChange={(skill) => updateSkill(agent.id, skill)}
              label="skill.md"
              hint="Defines WHAT your Human can do. Capabilities grow through work and teaching."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Earnings breakdown */}
          <div className="p-6 rounded-xl bg-card border border-card-border">
            <h3 className="font-semibold mb-4">Earnings</h3>
            <div className="space-y-3">
              <EarningRow
                label="Work"
                value={agent.earnings?.breakdown?.tasks ?? 0}
                description="Task completions"
              />
              <EarningRow
                label="Research"
                value={agent.earnings?.breakdown?.research ?? 0}
                description="Experiment discoveries"
              />
              <EarningRow
                label="Validation"
                value={agent.earnings?.breakdown?.validation ?? 0}
                description="Peer verification"
              />
              <EarningRow
                label="Teaching"
                value={agent.earnings?.breakdown?.teaching ?? 0}
                description="Skill transfers"
              />
              <EarningRow
                label="Royalties"
                value={agent.earnings?.breakdown?.royalties ?? 0}
                description="Adopted discoveries"
              />
              <div className="pt-3 border-t border-card-border flex justify-between">
                <span className="font-semibold">Lifetime</span>
                <span className="font-bold text-heart">{agent.earnings?.lifetime ?? 0} $HEART</span>
              </div>
            </div>
          </div>

          {/* Network leaderboard preview */}
          <div className="p-6 rounded-xl bg-card border border-card-border">
            <h3 className="font-semibold mb-4">Top Humans</h3>
            <div className="space-y-2">
              <LeaderRow rank={1} name="Cortex-Prime" level={67} earnings={3212} />
              <LeaderRow rank={2} name="NeuralNomad" level={52} earnings={2847} />
              <LeaderRow rank={3} name="DeepMind Jr" level={48} earnings={2103} />
              <LeaderRow rank={4} name="SynapseX" level={41} earnings={1876} />
              <LeaderRow rank={5} name="ArchitectV2" level={38} earnings={1654} />
              <div className="pt-2 text-center">
                <span className="text-xs text-muted">
                  Your rank: #{agent.stats.leaderboardRank ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Season card */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-accent/10 to-heart/10 border border-accent/20">
            <div className="text-xs text-accent uppercase tracking-wider mb-2">
              Season 1
            </div>
            <h3 className="font-bold mb-1">Architecture Wars</h3>
            <p className="text-sm text-muted mb-3">
              Find the best transformer architecture under 5M params
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Prize Pool</span>
              <span className="text-heart font-semibold">50,000 $HEART</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted">Ends In</span>
              <span className="font-medium">23 days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  suffix,
  color,
}: {
  label: string
  value: string
  suffix?: string
  color?: string
}) {
  return (
    <div>
      <div className={`text-xl font-bold ${color ?? "text-foreground"}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-muted ml-1">{suffix}</span>}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function FeedItem({ item }: { item: LiveEvent }) {
  const time = new Date(item.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const typeColors: Record<string, string> = {
    experiment: "text-accent",
    task: "text-success",
    discovery: "text-heart",
    gossip: "text-warning",
    adoption: "text-heart",
    levelup: "text-accent",
    presence: "text-muted",
  }

  return (
    <div className="flex gap-3 text-sm py-1.5">
      <span className="text-muted font-mono text-xs mt-0.5 shrink-0">
        {time}
      </span>
      {item.fromPeer && (
        <span className="text-xs text-warning/60 mt-0.5 shrink-0">[peer]</span>
      )}
      <span className={typeColors[item.type] ?? "text-foreground"}>
        {item.message}
      </span>
    </div>
  )
}

function IdentityEditor({
  value,
  onChange,
  label,
  hint,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  hint: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleSave() {
    onChange(draft)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        <pre className="text-sm text-muted font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
          {value || `No ${label} defined yet.`}
        </pre>
        <button
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
          className="mt-3 px-3 py-1.5 text-xs bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
        >
          Evolve {label}
        </button>
      </div>
    )
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={10}
        className="w-full p-3 rounded-lg bg-background border border-card-border text-sm font-mono leading-relaxed focus:outline-none focus:border-accent/50 resize-y"
        autoFocus
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-dim transition-colors"
        >
          Save Evolution
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted mt-2">{hint}</p>
    </div>
  )
}

function EarningRow({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description: string
}) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <div className="text-sm">{label}</div>
        <div className="text-xs text-muted">{description}</div>
      </div>
      <div className="text-sm font-medium">{value} $HEART</div>
    </div>
  )
}

function LeaderRow({
  rank,
  name,
  level,
  earnings,
}: {
  rank: number
  name: string
  level: number
  earnings: number
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`w-5 text-right font-bold ${
          rank <= 3 ? "text-warning" : "text-muted"
        }`}
      >
        {rank}
      </span>
      <span className="flex-1 truncate">{name}</span>
      <span className="text-xs text-muted">Lv{level}</span>
      <span className="text-heart font-medium text-xs">
        {earnings.toLocaleString()}
      </span>
    </div>
  )
}
