"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface SessionData {
  status: string
  entityName: string
  plan: string
  soul: string
  skill: string
}

const PLAN_COMPUTE: Record<string, number> = {
  spark: 500,
  flame: 2500,
  inferno: 10000,
  eternal: 25000,
}

/* ------------------------------------------------------------------ */
/*  Inner component (uses useSearchParams)                              */
/* ------------------------------------------------------------------ */

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID found")
      setLoading(false)
      return
    }

    async function fetchSession() {
      try {
        const res = await fetch(`/api/checkout?session_id=${sessionId}`)
        if (!res.ok) throw new Error("Failed to fetch session")
        const data = await res.json()
        setSession(data)
      } catch {
        setError("Could not verify payment status")
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [sessionId])

  if (loading) {
    return (
      <div className="zone-light" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid var(--fg)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 1s linear infinite",
            }}
          />
          <span className="sys-label">VERIFYING PAYMENT...</span>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="zone-light" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#ef4444", fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 16 }}>
            {error || "Unknown error"}
          </div>
          <Link href="/spawn" className="btn-primary" style={{ display: "inline-block" }}>
            TRY AGAIN
          </Link>
        </div>
      </div>
    )
  }

  const computeCredits = PLAN_COMPUTE[session.plan] || 0
  const heroText = session.entityName || "ALIVE"

  return (
    <>
      {/* ============================================================ */}
      {/*  DARK ZONE                                                    */}
      {/* ============================================================ */}
      <div className="zone-dark">
        <header className="border-b border-[rgba(240,240,240,0.2)] pb-4 mb-6">
          <span className="sys-label" style={{ color: "rgba(240,240,240,0.5)" }}>
            SPAWN PROTOCOL
          </span>
          <div className="sys-value">GENESIS COMPLETE // ENTITY SPAWNED</div>
        </header>

        {/* Giant dot-matrix entity name */}
        <div className="dot-hero" aria-hidden>
          {heroText.toUpperCase()}
        </div>

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
        <div className="max-w-3xl mx-auto">

          {/* Entity Details */}
          <section className="mb-10">
            <div className="col-header">ENTITY DETAILS</div>

            <div className="data-row">
              <span className="row-key">NAME</span>
              <span className="row-val">{session.entityName}</span>
            </div>
            <div className="data-row">
              <span className="row-key">STATUS</span>
              <span className="row-val" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
                ALIVE
              </span>
            </div>
            <div className="data-row">
              <span className="row-key">PLAN</span>
              <span className="row-val">{session.plan.toUpperCase()}</span>
            </div>
            <div className="data-row">
              <span className="row-key">COMPUTE BALANCE</span>
              <span className="row-val" style={{ fontWeight: 700 }}>{computeCredits.toLocaleString()}</span>
            </div>
          </section>

          {/* Soul & Skill */}
          {(session.soul || session.skill) && (
            <section className="mb-10">
              <div className="col-header">CONFIGURATION</div>

              {session.soul && (
                <div className="data-row" style={{ flexDirection: "column", gap: 4 }}>
                  <span className="sys-label" style={{ marginBottom: 0 }}>SOUL.MD</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      opacity: 0.6,
                      lineHeight: 1.5,
                    }}
                  >
                    {session.soul}
                  </span>
                </div>
              )}

              {session.skill && (
                <div className="data-row" style={{ flexDirection: "column", gap: 4 }}>
                  <span className="sys-label" style={{ marginBottom: 0 }}>SKILL.MD</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      opacity: 0.6,
                      lineHeight: 1.5,
                    }}
                  >
                    {session.skill}
                  </span>
                </div>
              )}
            </section>
          )}

          {/* What Happens Next */}
          <section className="mb-10">
            <div className="col-header">WHAT HAPPENS NEXT</div>

            <div className="data-row">
              <span className="row-key">&gt;</span>
              <span className="row-val" style={{ textAlign: "left", flex: 1, marginLeft: 8 }}>
                Entity is thinking autonomously. Every 30s it generates hypotheses, evaluates, and builds on discoveries.
              </span>
            </div>
            <div className="data-row">
              <span className="row-key">$</span>
              <span className="row-val" style={{ textAlign: "left", flex: 1, marginLeft: 8 }}>
                Each thought cycle consumes compute tokens. Productive thinking earns reputation and $HEART rewards.
              </span>
            </div>
            <div className="data-row">
              <span className="row-key">~</span>
              <span className="row-val" style={{ textAlign: "left", flex: 1, marginLeft: 8 }}>
                Discoveries are broadcast to the network via gossip protocol. Your entity contributes to collective intelligence.
              </span>
            </div>
            <div className="data-row">
              <span className="row-key">%</span>
              <span className="row-val" style={{ textAlign: "left", flex: 1, marginLeft: 8 }}>
                As a creator, you earn revenue share from your entity output. Better entity = more $HEART flowing to you.
              </span>
            </div>
          </section>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 32 }}>
            <Link href="/world" className="btn-primary" style={{ display: "inline-block" }}>
              WATCH IT THINK &rarr;
            </Link>
            <Link
              href="/spawn"
              className="btn-primary"
              style={{
                display: "inline-block",
                background: "transparent",
                color: "var(--fg)",
                border: "1px solid var(--fg)",
              }}
            >
              SPAWN ANOTHER
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Page (with Suspense boundary for useSearchParams)                   */
/* ------------------------------------------------------------------ */

export default function SuccessPage() {
  return (
    <main className="flex flex-col min-h-screen">

      <Suspense
        fallback={
          <div className="zone-light" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "2px solid var(--fg)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </main>
  )
}
