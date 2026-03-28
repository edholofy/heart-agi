"use client"

import { useState, useEffect, useMemo } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { SwarmVisualization } from "@/components/swarm/SwarmVisualization"
import { runSwarm, listEntities, type SwarmResult, type SwarmContribution, type ServerEntity } from "@/lib/daemon-client"
import Link from "next/link"

const EXAMPLE_TASKS = [
  {
    label: "Market Analysis",
    task: "Analyze the competitive landscape of autonomous AI agent platforms. Who are the key players, what are their strengths and weaknesses, and where are the opportunities for differentiation?",
  },
  {
    label: "Security Audit",
    task: "Review the security architecture of a Cosmos SDK blockchain with custom modules for identity, compute, and governance. Identify potential attack vectors, vulnerabilities, and recommendations.",
  },
  {
    label: "Product Strategy",
    task: "Design a go-to-market strategy for a blockchain platform where users can spawn autonomous AI entities. Consider developer adoption, enterprise use cases, and community growth.",
  },
  {
    label: "Technical Architecture",
    task: "Design a scalable architecture for running 10,000 autonomous AI agents, each with their own LLM inference loop, persistent memory, and on-chain identity. Consider cost, latency, and reliability.",
  },
  {
    label: "Research Direction",
    task: "What are the most promising research directions for making AI agents more autonomous and self-improving? Consider safety, capability, and alignment.",
  },
]

export default function SwarmPage() {
  const [task, setTask] = useState("")
  const [context, setContext] = useState("")
  const [maxEntities, setMaxEntities] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SwarmResult | null>(null)
  const [error, setError] = useState("")
  const [entities, setEntities] = useState<ServerEntity[]>([])
  const [expandedContrib, setExpandedContrib] = useState<string | null>(null)
  const [swarmPhase, setSwarmPhase] = useState<"idle" | "decomposing" | "working" | "synthesizing" | "complete">("idle")
  const [activeEntityNames, setActiveEntityNames] = useState<string[]>([])

  /** Map entities to the shape the viz component expects */
  const vizEntities = useMemo(
    () =>
      entities.map((e) => ({
        name: e.name,
        skill: e.skill,
        compute_balance: e.compute_balance,
        discoveries: e.discoveries,
        status: e.status,
      })),
    [entities]
  )

  useEffect(() => {
    listEntities()
      .then((es) => setEntities(es.filter((e) => e.status === "alive")))
      .catch(() => {})
  }, [])

  async function handleSubmit() {
    if (!task.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    setSwarmPhase("decomposing")
    setActiveEntityNames(entities.map((e) => e.name))

    try {
      // Simulate phase progression while the swarm runs
      const phaseTimer = setTimeout(() => setSwarmPhase("working"), 2000)
      const synthTimer = setTimeout(() => setSwarmPhase("synthesizing"), 8000)

      const res = await runSwarm({
        task: task.trim(),
        context: context.trim() || undefined,
        maxEntities: maxEntities || undefined,
      })

      clearTimeout(phaseTimer)
      clearTimeout(synthTimer)

      setResult(res)
      setSwarmPhase("complete")
      setActiveEntityNames(res.contributions.map((c: SwarmContribution) => c.entity_name))

      // Return to idle after a moment
      setTimeout(() => setSwarmPhase("idle"), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swarm task failed")
      setSwarmPhase("idle")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen text-white">
      <ShaderBackground />

      <div className="relative z-10">
        <NetworkBar />

        {/* Nav */}
        <nav className="border-b border-white/[0.06] bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-8 h-14 text-sm">
            <Link href="/" className="font-bold tracking-wider text-white/90">
              $HEART
            </Link>
            <Link href="/world" className="text-white/50 hover:text-white/80 transition-colors">
              World
            </Link>
            <Link href="/marketplace" className="text-white/50 hover:text-white/80 transition-colors">
              Marketplace
            </Link>
            <Link href="/swarm" className="text-white/90 border-b border-white/40 pb-0.5">
              Swarm
            </Link>
            <Link href="/governance" className="text-white/50 hover:text-white/80 transition-colors">
              Governance
            </Link>
            <Link href="/explorer" className="text-white/50 hover:text-white/80 transition-colors">
              Explorer
            </Link>
            <Link href="/docs" className="text-white/50 hover:text-white/80 transition-colors">
              Docs
            </Link>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-light tracking-tight mb-3">
              Swarm Intelligence
            </h1>
            <p className="text-white/50 text-sm max-w-2xl leading-relaxed">
              Give a complex task to the swarm. It decomposes the problem across specialized AI Humans,
              each analyzes through its unique soul.md perspective, then synthesizes a unified result.
              Not one AI pretending to be many — genuine multi-expert analysis.
            </p>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-6 mb-8 text-xs text-white/40">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span>{entities.length} entities alive</span>
            </div>
            <div>
              specializations: {[...new Set(entities.map((e) => e.skill.split(",")[0].trim()))].length}
            </div>
          </div>

          {/* Swarm Visualization */}
          {entities.length > 0 && (
            <div className="relative bg-black/40 border border-white/[0.04] rounded-2xl mb-8 overflow-hidden" style={{ height: 480 }}>
              <SwarmVisualization
                entities={vizEntities}
                isRunning={loading}
                activeEntities={activeEntityNames}
                phase={swarmPhase}
              />
              {/* Overlay gradient for depth */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/30" />
            </div>
          )}

          {/* Input */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-6 mb-6">
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
              Task
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe a complex task for the swarm to analyze..."
              className="w-full bg-transparent border border-white/[0.08] rounded-md px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
              rows={4}
            />

            <div className="mt-4">
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
                Additional Context (optional)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Any extra context, constraints, or requirements..."
                className="w-full bg-transparent border border-white/[0.08] rounded-md px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">
                  Max Entities
                </label>
                <select
                  value={maxEntities}
                  onChange={(e) => setMaxEntities(Number(e.target.value))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none"
                >
                  <option value={0}>All available</option>
                  <option value={3}>3 entities</option>
                  <option value={5}>5 entities</option>
                  <option value={8}>8 entities</option>
                  <option value={10}>10 entities</option>
                </select>
              </div>

              <div className="flex-1" />

              <button
                onClick={handleSubmit}
                disabled={loading || !task.trim()}
                className="px-6 py-2.5 bg-white/[0.08] border border-white/[0.12] rounded-md text-sm text-white/90 hover:bg-white/[0.12] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "Swarming..." : "Run Swarm"}
              </button>
            </div>
          </div>

          {/* Example tasks */}
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-xs text-white/30">Try:</span>
            {EXAMPLE_TASKS.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setTask(ex.task)}
                className="text-xs px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-4" />
              <p className="text-sm text-white/50">
                Decomposing task across entities and running parallel analysis...
              </p>
              <p className="text-xs text-white/30 mt-2">
                This takes 10-30 seconds depending on task complexity
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-lg p-4 text-sm text-[#ef4444] mb-6">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Synthesis */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-white/90">
                      Synthesized Result
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      {result.entities_used} entities | {(result.total_duration_ms / 1000).toFixed(1)}s
                      {result.tx_hash && (
                        <span className="ml-2">
                          | TX: <span className="font-mono text-white/30">{result.tx_hash.slice(0, 12)}...</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                    <span className="text-xs text-[#22c55e]">COMPLETE</span>
                  </div>
                </div>
                <div className="px-6 py-5 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {result.synthesis}
                </div>
              </div>

              {/* Individual contributions */}
              <div>
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                  Entity Contributions ({result.contributions.length})
                </h3>
                <div className="space-y-3">
                  {result.contributions.map((c: SwarmContribution) => (
                    <div
                      key={c.entity_name}
                      className="bg-white/[0.02] border border-white/[0.05] rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedContrib(
                            expandedContrib === c.entity_name ? null : c.entity_name
                          )
                        }
                        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs text-white/60 font-mono">
                            {c.entity_name[0]}
                          </div>
                          <div>
                            <span className="text-sm text-white/80">{c.entity_name}</span>
                            <p className="text-xs text-white/30 mt-0.5">
                              {c.subtask.length > 80 ? c.subtask.slice(0, 80) + "..." : c.subtask}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/30">
                          <span>{c.duration_ms}ms</span>
                          <span className="text-white/20">
                            {expandedContrib === c.entity_name ? "[-]" : "[+]"}
                          </span>
                        </div>
                      </button>
                      {expandedContrib === c.entity_name && (
                        <div className="px-5 py-4 border-t border-white/[0.04] text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                          <div className="text-xs text-white/30 mb-2 font-mono">
                            Subtask: {c.subtask}
                          </div>
                          {c.response}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
