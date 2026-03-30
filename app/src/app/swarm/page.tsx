"use client"

import { useState, useEffect, useMemo } from "react"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { SwarmVisualization } from "@/components/swarm/SwarmVisualization"
import { runSwarm, listEntities, type SwarmResult, type SwarmContribution, type ServerEntity } from "@/lib/daemon-client"

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
    <main className="flex flex-col min-h-screen" style={{ background: "var(--fg)" }}>
      <NetworkBar />

      {/* ── Dark zone header ── */}
      <div className="zone-dark" style={{ paddingTop: 32, paddingBottom: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "end",
            paddingBottom: 16,
          }}
        >
          <div>
            <span className="label">SYSTEM OPERATION</span>
            <div
              style={{
                fontFamily: "var(--font-mono-sys)",
                fontSize: 14,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              SWARM INTELLIGENCE // COLLECTIVE PROTOCOL
            </div>
            <div style={{ marginTop: 12, maxWidth: 480 }}>
              <span className="label">DESCRIPTION</span>
              <div
                className="value"
                style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.5 }}
              >
                Give a complex task to the swarm. It decomposes the problem
                across specialized AI Humans, each analyzes through its unique
                soul.md perspective, then synthesizes a unified result.
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="label">SWARM STATUS</span>
              <span className="value" style={{ fontSize: 11 }}>
                {entities.length} ENTITIES / {[...new Set(entities.map((e) => e.skill.split(",")[0].trim()))].length} SPECIALIZATIONS
              </span>
            </div>
            {/* Phase indicator */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                marginTop: 12,
              }}
            >
              {(["idle", "decomposing", "working", "synthesizing"] as const).map(
                (phase) => (
                  <div key={phase}>
                    <div
                      className="label"
                      style={{ fontSize: 8, opacity: swarmPhase === phase ? 1 : 0.3 }}
                    >
                      {phase.toUpperCase()}
                    </div>
                    <div
                      className="spark-bar-container"
                      style={{ background: "rgba(255,255,255,0.1)" }}
                    >
                      <div
                        className="spark-bar"
                        style={{
                          width: swarmPhase === phase ? "100%" : "0%",
                          background: "var(--bg)",
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 2px, var(--fg) 2px, var(--fg) 4px)",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Swarm Visualization (kept as-is in bordered container) ── */}
      {entities.length > 0 && (
        <div
          style={{
            margin: "0 32px",
            border: "1px solid rgba(255,255,255,0.08)",
            height: 480,
            position: "relative",
            overflow: "hidden",
            background: "rgba(0,0,0,0.8)",
          }}
        >
          <SwarmVisualization
            entities={vizEntities}
            isRunning={loading}
            activeEntities={activeEntityNames}
            phase={swarmPhase}
          />
          {/* Overlay gradient for depth */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(to bottom, transparent 0%, transparent 70%, rgba(0,0,0,0.3) 100%)",
            }}
          />
        </div>
      )}

      {/* ── Transition ── */}
      <div className="zone-transition" />

      {/* ── Light zone: input + results ── */}
      <div className="zone-light" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
          }}
        >
          {/* ── Left: Task input ── */}
          <div>
            <div className="col-header">TASK INPUT</div>

            <div style={{ marginBottom: 16 }}>
              <span
                className="label"
                style={{ color: "var(--fg)" }}
              >
                TASK DESCRIPTION
              </span>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe a complex task for the swarm to analyze..."
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid rgba(0,0,0,0.15)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono-sys)",
                  fontSize: 12,
                  color: "var(--fg)",
                  resize: "none",
                  outline: "none",
                }}
                rows={4}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <span
                className="label"
                style={{ color: "var(--fg)" }}
              >
                ADDITIONAL CONTEXT (OPTIONAL)
              </span>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Any extra context, constraints, or requirements..."
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid rgba(0,0,0,0.15)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono-sys)",
                  fontSize: 12,
                  color: "var(--fg)",
                  resize: "none",
                  outline: "none",
                }}
                rows={2}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div>
                <span
                  className="label"
                  style={{ color: "var(--fg)" }}
                >
                  MAX ENTITIES
                </span>
                <select
                  value={maxEntities}
                  onChange={(e) => setMaxEntities(Number(e.target.value))}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(0,0,0,0.15)",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 12,
                    color: "var(--fg)",
                    outline: "none",
                  }}
                >
                  <option value={0}>All available</option>
                  <option value={3}>3 entities</option>
                  <option value={5}>5 entities</option>
                  <option value={8}>8 entities</option>
                  <option value={10}>10 entities</option>
                </select>
              </div>

              <div style={{ flex: 1 }} />

              <button
                onClick={handleSubmit}
                disabled={loading || !task.trim()}
                style={{
                  padding: "8px 24px",
                  background: loading || !task.trim() ? "rgba(0,0,0,0.1)" : "var(--fg)",
                  color: loading || !task.trim() ? "rgba(0,0,0,0.3)" : "var(--bg)",
                  border: "1px solid var(--fg)",
                  fontFamily: "var(--font-mono-sys)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: loading || !task.trim() ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "SWARMING..." : "RUN SWARM"}
              </button>
            </div>

            {/* Example tasks */}
            <div>
              <span className="label" style={{ color: "var(--fg)" }}>
                PRESETS
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {EXAMPLE_TASKS.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => setTask(ex.task)}
                    style={{
                      padding: "4px 10px",
                      background: "transparent",
                      border: "1px solid rgba(0,0,0,0.15)",
                      fontFamily: "var(--font-mono-sys)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--fg)",
                      cursor: "pointer",
                    }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div>
            <div className="col-header">SWARM OUTPUT</div>

            {/* Loading state */}
            {loading && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: "2px solid rgba(0,0,0,0.15)",
                    borderTop: "2px solid var(--fg)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <div
                  style={{
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 11,
                    opacity: 0.5,
                  }}
                >
                  Decomposing task across entities...
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  border: "1px solid rgba(239,68,68,0.3)",
                  fontFamily: "var(--font-mono-sys)",
                  fontSize: 11,
                  color: "#ef4444",
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            {/* No result yet */}
            {!loading && !result && !error && (
              <div
                style={{
                  fontFamily: "var(--font-mono-sys)",
                  fontSize: 11,
                  opacity: 0.4,
                  padding: "24px 0",
                }}
              >
                Submit a task to see swarm output here.
              </div>
            )}

            {/* Results */}
            {result && (
              <div>
                {/* Synthesis header */}
                <div className="data-row" style={{ fontWeight: 700, borderBottom: "1px solid rgba(0,0,0,0.2)" }}>
                  <span className="row-key">SYNTHESIZED RESULT</span>
                  <span className="row-val" style={{ fontSize: 10 }}>
                    {result.entities_used} entities | {(result.total_duration_ms / 1000).toFixed(1)}s
                    {result.tx_hash && ` | TX: ${result.tx_hash.slice(0, 12)}...`}
                  </span>
                </div>

                {/* Synthesis body */}
                <div
                  style={{
                    fontFamily: "var(--font-mono-sys)",
                    fontSize: 12,
                    lineHeight: 1.6,
                    padding: "16px 0",
                    whiteSpace: "pre-wrap",
                    borderBottom: "1px dotted rgba(0,0,0,0.15)",
                    marginBottom: 16,
                  }}
                >
                  {result.synthesis}
                </div>

                {/* Contributions */}
                <span className="label" style={{ color: "var(--fg)", marginBottom: 8 }}>
                  ENTITY CONTRIBUTIONS ({result.contributions.length})
                </span>

                {result.contributions.map((c: SwarmContribution) => (
                  <div key={c.entity_name} style={{ marginBottom: 2 }}>
                    <button
                      onClick={() =>
                        setExpandedContrib(
                          expandedContrib === c.entity_name ? null : c.entity_name
                        )
                      }
                      className="data-row"
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px dotted rgba(0,0,0,0.15)",
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "6px 0",
                      }}
                    >
                      <span className="row-key" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: "1px solid rgba(0,0,0,0.2)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            fontFamily: "var(--font-mono-sys)",
                            flexShrink: 0,
                          }}
                        >
                          {c.entity_name[0]}
                        </span>
                        {c.entity_name}
                      </span>
                      <span className="row-val" style={{ fontSize: 10 }}>
                        {c.duration_ms}ms {expandedContrib === c.entity_name ? "[-]" : "[+]"}
                      </span>
                    </button>
                    {expandedContrib === c.entity_name && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono-sys)",
                          fontSize: 11,
                          lineHeight: 1.6,
                          padding: "12px 0 12px 22px",
                          whiteSpace: "pre-wrap",
                          borderBottom: "1px dotted rgba(0,0,0,0.1)",
                          opacity: 0.7,
                        }}
                      >
                        <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 6 }}>
                          SUBTASK: {c.subtask}
                        </div>
                        {c.response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}
