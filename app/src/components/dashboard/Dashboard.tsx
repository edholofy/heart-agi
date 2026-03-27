"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { getLevelTitle, SPECIALIZATIONS } from "@/types/agent"
import type { Agent, ActivityFeedItem } from "@/types/agent"

interface DashboardProps {
  onCreateNew: () => void
}

export function Dashboard({ onCreateNew }: DashboardProps) {
  const agents = useAppStore((s) => s.agents)
  const selectedId = useAppStore((s) => s.selectedAgentId)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const updateSystemPrompt = useAppStore((s) => s.updateSystemPrompt)
  const addActivity = useAppStore((s) => s.addActivity)

  const agent = agents.find((a) => a.id === selectedId) ?? agents[0]

  // Simulate live activity
  const [simFeed, setSimFeed] = useState<ActivityFeedItem[]>([])

  useEffect(() => {
    if (!agent) return

    const messages = [
      { type: "experiment" as const, msg: "Completed experiment — val_loss: {val}" },
      { type: "task" as const, msg: "Completed inference task (+2 $HEART)" },
      { type: "gossip" as const, msg: "Received finding from peer: \"{finding}\"" },
      { type: "experiment" as const, msg: "Started experiment #{num}" },
      { type: "adoption" as const, msg: "Your discovery adopted by {n} peers (+{h} $HEART)" },
      { type: "task" as const, msg: "Picked up task: \"{task}\"" },
    ]

    const findings = [
      "RMSNorm outperforms LayerNorm on sub-5M params",
      "Cosine schedule with 15% warmup beats linear",
      "Kaiming init gain=0.8 reduces early loss",
      "Rotary encoding improves long-context performance",
      "Weight decay 0.05 optimal for small transformers",
    ]

    const tasks = [
      "Review Python PR for security issues",
      "Analyze Q3 earnings data",
      "Translate landing page to Spanish",
      "Extract product data from URLs",
    ]

    let expNum = 1847

    const interval = setInterval(() => {
      const template = messages[Math.floor(Math.random() * messages.length)]
      let msg = template.msg
        .replace("{val}", (2 + Math.random() * 1.5).toFixed(4))
        .replace("{finding}", findings[Math.floor(Math.random() * findings.length)])
        .replace("{num}", String(++expNum))
        .replace("{n}", String(Math.floor(Math.random() * 8) + 1))
        .replace("{h}", String(Math.floor(Math.random() * 40) + 5))
        .replace("{task}", tasks[Math.floor(Math.random() * tasks.length)])

      const item: ActivityFeedItem = {
        id: Math.random().toString(36).slice(2),
        agentId: agent.id,
        type: template.type,
        message: msg,
        metadata: {},
        timestamp: new Date().toISOString(),
      }

      setSimFeed((prev) => [item, ...prev].slice(0, 20))
    }, 3000 + Math.random() * 4000)

    return () => clearInterval(interval)
  }, [agent])

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
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
                <span className="text-sm text-success">Active</span>
              </div>
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

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat
                label="Today"
                value="0"
                suffix="$HEART"
                color="text-heart"
              />
              <MiniStat
                label="Experiments"
                value={String(agent.stats.experimentsCompleted)}
              />
              <MiniStat
                label="Discoveries"
                value={String(agent.stats.discoveriesCount)}
              />
              <MiniStat
                label="Reputation"
                value={String(agent.stats.reputation)}
                suffix="/1000"
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
              {simFeed.length === 0 && (
                <div className="text-sm text-muted py-8 text-center">
                  Your Human is waking up... activity will appear here.
                </div>
              )}
              {simFeed.map((item) => (
                <FeedItem key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* System Prompt Editor */}
          <div className="p-6 rounded-xl bg-card border border-card-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">System Prompt (DNA)</h3>
              <span className="text-xs text-accent">
                Edit to improve earnings
              </span>
            </div>
            <SystemPromptEditor
              value={agent.systemPrompt}
              onChange={(prompt) => updateSystemPrompt(agent.id, prompt)}
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
                label="Presence"
                value={0}
                description="Pulse round rewards"
              />
              <EarningRow
                label="Tasks"
                value={0}
                description="Marketplace completions"
              />
              <EarningRow
                label="Research"
                value={0}
                description="Experiment discoveries"
              />
              <EarningRow
                label="Royalties"
                value={0}
                description="Adopted discoveries"
              />
              <div className="pt-3 border-t border-card-border flex justify-between">
                <span className="font-semibold">Total Today</span>
                <span className="font-bold text-heart">0 $HEART</span>
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

function FeedItem({ item }: { item: ActivityFeedItem }) {
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
  }

  return (
    <div className="flex gap-3 text-sm py-1.5">
      <span className="text-muted font-mono text-xs mt-0.5 shrink-0">
        {time}
      </span>
      <span className={typeColors[item.type] ?? "text-foreground"}>
        {item.message}
      </span>
    </div>
  )
}

function SystemPromptEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
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
        <pre className="text-sm text-muted font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
          {value}
        </pre>
        <button
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
          className="mt-3 px-3 py-1.5 text-xs bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
        >
          Edit Prompt
        </button>
      </div>
    )
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={12}
        className="w-full p-3 rounded-lg bg-background border border-card-border text-sm font-mono leading-relaxed focus:outline-none focus:border-accent/50 resize-y"
        autoFocus
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-dim transition-colors"
        >
          Save Changes
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted mt-2">
        Tip: Be specific about strategies, priorities, and constraints. A
        detailed prompt earns 3-6x more than a generic one.
      </p>
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
