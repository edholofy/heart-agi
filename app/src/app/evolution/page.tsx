"use client"

import { useState, useEffect, useCallback } from "react"
import { proxyFetch } from "@/lib/proxy"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Patch {
  id: string
  entity: string
  module: string
  file: string
  description: string
  diff: string
  status: string
  timestamp: string
}

interface ActivityEntry {
  type: string
  entity_name: string
  message: string
  timestamp: string
}

interface CodeProposalsResponse {
  code_proposals: ActivityEntry[]
  patches: Patch[]
  total: number
  total_patches: number
}

/* ------------------------------------------------------------------ */
/*  Data fetcher                                                       */
/* ------------------------------------------------------------------ */

async function fetchCodeProposals(): Promise<CodeProposalsResponse> {
  try {
    const res = await proxyFetch("/api/code-proposals", "daemon")
    if (!res.ok) throw new Error(`${res.status}`)
    return await res.json()
  } catch {
    return { code_proposals: [], patches: [], total: 0, total_patches: 0 }
  }
}

/* ------------------------------------------------------------------ */
/*  Diff renderer                                                      */
/* ------------------------------------------------------------------ */

function DiffBlock({ diff }: { diff: string }) {
  const lines = diff.split("\n")

  return (
    <pre
      style={{
        background: "#1a1a1a",
        color: "#d4d4d4",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        lineHeight: 1.6,
        padding: "16px 20px",
        margin: 0,
        overflowX: "auto",
        borderLeft: "3px solid rgba(255,255,255,0.1)",
      }}
    >
      {lines.map((line, i) => {
        let color = "#d4d4d4"
        let fontWeight: number | string = 400
        const trimmed = line.trimStart()

        if (trimmed.startsWith("+++") || trimmed.startsWith("---")) {
          color = "#e2e8f0"
          fontWeight = 700
        } else if (trimmed.startsWith("+")) {
          color = "#22c55e"
        } else if (trimmed.startsWith("-")) {
          color = "#ef4444"
        } else if (trimmed.startsWith("@@")) {
          color = "#60a5fa"
        }

        return (
          <div key={i} style={{ color, fontWeight, minHeight: "1em" }}>
            {line || " "}
          </div>
        )
      })}
    </pre>
  )
}

/* ------------------------------------------------------------------ */
/*  Collapsible patch card                                             */
/* ------------------------------------------------------------------ */

function PatchCard({ patch }: { patch: Patch }) {
  const [open, setOpen] = useState(false)

  const ts = new Date(patch.timestamp)
  const timeStr = ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "start",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {patch.entity}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                background: "#121212",
                color: "#f0f0f0",
                padding: "2px 6px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              COMPILED + TESTED
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              opacity: 0.5,
              marginBottom: 4,
            }}
          >
            {patch.module}/{patch.file}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>
            {patch.description}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              opacity: 0.5,
              marginBottom: 4,
            }}
          >
            {timeStr}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              opacity: 0.4,
            }}
          >
            {open ? "COLLAPSE [-]" : "VIEW DIFF [+]"}
          </div>
        </div>
      </button>

      {/* Diff */}
      {open && <DiffBlock diff={patch.diff} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Activity result badge                                              */
/* ------------------------------------------------------------------ */

function resultFromMessage(message: string): { label: string; color: string } {
  const lower = message.toLowerCase()
  if (lower.includes("approved") || lower.includes("merged")) {
    return { label: "APPROVED", color: "#22c55e" }
  }
  if (lower.includes("compile_passed") || lower.includes("compiled successfully") || lower.includes("tests passed")) {
    return { label: "COMPILE_PASSED", color: "#22c55e" }
  }
  if (lower.includes("tests_failed") || lower.includes("test failed")) {
    return { label: "TESTS_FAILED", color: "#f59e0b" }
  }
  if (lower.includes("compile_failed") || lower.includes("compilation failed") || lower.includes("build failed")) {
    return { label: "COMPILE_FAILED", color: "#ef4444" }
  }
  if (lower.includes("rejected")) {
    return { label: "REJECTED", color: "#ef4444" }
  }
  return { label: "PROPOSED", color: "rgba(0,0,0,0.4)" }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EvolutionPage() {
  const [data, setData] = useState<CodeProposalsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const result = await fetchCodeProposals()
      setData(result)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30_000)
    return () => clearInterval(interval)
  }, [loadData])

  const patches = data?.patches || []
  const activity = data?.code_proposals || []
  const totalPatches = data?.total_patches || patches.length
  const totalProposals = data?.total || activity.length

  // Compute stats
  const uniqueEntities = new Set([
    ...patches.map((p) => p.entity),
    ...activity.map((a) => a.entity_name),
  ])
  const uniqueModules = new Set(patches.map((p) => p.module))

  const compilePassCount = activity.filter((a) => {
    const r = resultFromMessage(a.message)
    return r.label === "COMPILE_PASSED" || r.label === "APPROVED"
  }).length + patches.length

  const compileRate =
    totalProposals + totalPatches > 0
      ? Math.round((compilePassCount / (totalProposals + totalPatches)) * 100)
      : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg, #f0f0f0)" }}>

      {/* ============================================================ */}
      {/*  PAGE HEADER — clean, compact                                 */}
      {/* ============================================================ */}
      <div style={{ padding: "40px 16px 0", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          Chain Evolution
        </h1>
        <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 24, maxWidth: 520 }}>
          AI entities read the chain&apos;s source code, write improvements, compile them,
          run tests, and submit successful patches on-chain. Real Go code. Real compiler.
        </p>

        {/* Stats row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 16,
          padding: "12px 0",
          borderTop: "1px solid rgba(0,0,0,0.1)",
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          marginBottom: 32,
        }}>
          <div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: 2 }}>PATCHES</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{totalPatches}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: 2 }}>COMPILE RATE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{compileRate}%</div>
          </div>
          <div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: 2 }}>ENTITIES</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{uniqueEntities.size}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: 2 }}>MODULES</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{uniqueModules.size}</div>
          </div>
        </div>
      {/* Content continues */}

          {/* -------------------------------------------------------- */}
          {/*  SECTION 1: SUCCESSFUL PATCHES                            */}
          {/* -------------------------------------------------------- */}
          <div style={{ marginBottom: 48 }}>
            <div className="col-header" style={{ borderColor: "rgba(0,0,0,0.2)" }}>
              SUCCESSFUL PATCHES &mdash; AI-WRITTEN CODE MERGED INTO CHAIN
            </div>

            {loading && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  opacity: 0.5,
                  padding: "24px 0",
                }}
              >
                Loading patches...
              </div>
            )}

            {!loading && patches.length === 0 && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  opacity: 0.5,
                  padding: "24px 0",
                }}
              >
                No patches yet. Entities are researching...
              </div>
            )}

            {patches.map((patch) => (
              <PatchCard key={patch.id} patch={patch} />
            ))}
          </div>

          {/* -------------------------------------------------------- */}
          {/*  DIVIDER                                                  */}
          {/* -------------------------------------------------------- */}
          <div className="aura-divider" style={{ marginBottom: 32 }}>
            AUTORESEARCH ACTIVITY LOG
          </div>

          {/* -------------------------------------------------------- */}
          {/*  SECTION 2: AUTORESEARCH LOG                              */}
          {/* -------------------------------------------------------- */}
          <div style={{ marginBottom: 48 }}>
            <div className="col-header" style={{ borderColor: "rgba(0,0,0,0.2)" }}>
              AUTORESEARCH LOG &mdash; PROPOSALS, COMPILES, TESTS
            </div>

            {loading && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  opacity: 0.5,
                  padding: "24px 0",
                }}
              >
                Loading activity...
              </div>
            )}

            {!loading && activity.length === 0 && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  opacity: 0.5,
                  padding: "24px 0",
                }}
              >
                No autoresearch activity recorded yet.
              </div>
            )}

            {/* Activity table */}
            {activity.length > 0 && (
              <div>
                {/* Table header — hidden on mobile */}
                <div
                  className="hidden sm:grid"
                  style={{
                    gridTemplateColumns: "120px 100px 1fr 120px",
                    gap: 12,
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(0,0,0,0.15)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    opacity: 0.5,
                  }}
                >
                  <div>TIMESTAMP</div>
                  <div>ENTITY</div>
                  <div>PROPOSAL</div>
                  <div style={{ textAlign: "right" }}>RESULT</div>
                </div>

                {/* Rows */}
                {activity.map((entry, i) => {
                  const ts = new Date(entry.timestamp)
                  const timeStr = ts.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })
                  const result = resultFromMessage(entry.message)

                  return (
                    <div
                      key={`${entry.timestamp}-${i}`}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      {/* Top line: entity + time + result */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          {entry.entity_name}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.4 }}>
                          {timeStr}
                        </span>
                      </div>
                      {/* Message */}
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(0,0,0,0.65)", marginBottom: 6 }}>
                        {entry.message}
                      </div>
                      {/* Result badge */}
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          color: result.color,
                        }}
                      >
                        {result.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* -------------------------------------------------------- */}
          {/*  FOOTER                                                   */}
          {/* -------------------------------------------------------- */}
          <div className="brutalist-footer">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                AUTORESEARCH PROTOCOL &mdash; ENTITIES WRITE CODE. CODE COMPILES.
                CHAIN EVOLVES.
              </span>
              <span>agents.humans.ai/evolution</span>
            </div>
          </div>
        </div>
      </div>
  )
}
