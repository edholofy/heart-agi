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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* ============================================================ */}
      {/*  DARK ZONE — Header                                          */}
      {/* ============================================================ */}
      <div className="zone-dark" style={{ paddingBottom: 24 }}>
        <div className="max-w-[1600px] mx-auto">
          {/* Title row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 24,
              marginBottom: 16,
            }}
          >
            <div>
              <span className="sys-label" style={{ color: "var(--bg)" }}>
                SYSTEM OPERATION
              </span>
              <span className="sys-value" style={{ color: "var(--bg)" }}>
                CHAIN SELF-MODIFICATION
              </span>
            </div>
            <div>
              <span className="sys-label" style={{ color: "var(--bg)" }}>
                PROTOCOL
              </span>
              <span className="sys-value" style={{ color: "var(--bg)" }}>
                AUTORESEARCH v1.0
              </span>
            </div>
            <div>
              <span className="sys-label" style={{ color: "var(--bg)" }}>
                STATUS
              </span>
              <span
                className="sys-value"
                style={{
                  color: patches.length > 0 ? "#22c55e" : "var(--bg)",
                }}
              >
                {loading ? "LOADING..." : patches.length > 0 ? "ACTIVE" : "MONITORING"}
              </span>
            </div>
          </div>

          {/* Hero title */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--bg)",
              opacity: 0.6,
              marginBottom: 4,
            }}
          >
            CHAIN EVOLUTION // AUTORESEARCH PROTOCOL
          </div>

          {/* Giant dot-hero */}
          <div className="dot-hero">{totalPatches}</div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--bg)",
              opacity: 0.5,
              marginTop: 4,
            }}
          >
            TOTAL PATCHES MERGED INTO CHAIN
          </div>
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
        <div className="max-w-[1600px] mx-auto">
          {/* -------------------------------------------------------- */}
          {/*  STATS BAR                                                */}
          {/* -------------------------------------------------------- */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 32,
              padding: "24px 0",
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              marginBottom: 32,
            }}
          >
            <div>
              <span className="sys-label">PATCHES SUBMITTED</span>
              <span className="sys-value" style={{ fontSize: 20, fontWeight: 700 }}>
                {totalPatches}
              </span>
            </div>
            <div>
              <span className="sys-label">COMPILE SUCCESS RATE</span>
              <span className="sys-value" style={{ fontSize: 20, fontWeight: 700 }}>
                {compileRate}%
              </span>
            </div>
            <div>
              <span className="sys-label">ENTITIES CONTRIBUTING</span>
              <span className="sys-value" style={{ fontSize: 20, fontWeight: 700 }}>
                {uniqueEntities.size}
              </span>
            </div>
            <div>
              <span className="sys-label">MODULES MODIFIED</span>
              <span className="sys-value" style={{ fontSize: 20, fontWeight: 700 }}>
                {uniqueModules.size}
              </span>
            </div>
          </div>

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
                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 120px 1fr 140px",
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
                      className="data-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 120px 1fr 140px",
                        gap: 12,
                        alignItems: "start",
                        padding: "6px 0",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          opacity: 0.5,
                        }}
                      >
                        {timeStr}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {entry.entity_name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          lineHeight: 1.4,
                          opacity: 0.8,
                        }}
                      >
                        {entry.message}
                      </div>
                      <div style={{ textAlign: "right" }}>
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
    </div>
  )
}
