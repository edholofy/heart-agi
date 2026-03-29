"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { ShaderBackground } from "@/components/shared/ShaderBackground"

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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="tech-label">VERIFYING PAYMENT...</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-sm p-8 text-center max-w-md">
          <p className="text-[#ef4444] mb-4">{error || "Unknown error"}</p>
          <Link href="/spawn" className="btn-secondary px-8 py-3 text-sm inline-block">
            TRY AGAIN
          </Link>
        </div>
      </div>
    )
  }

  const computeCredits = PLAN_COMPUTE[session.plan] || 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl mx-auto text-center">
        {/* Success indicator */}
        <div className="mb-8">
          <div className="w-20 h-20 rounded-full bg-[rgba(34,197,94,0.1)] flex items-center justify-center mx-auto mb-6 glow-success">
            <span className="w-4 h-4 rounded-full bg-[#22c55e] animate-pulse-dot" />
          </div>

          <div className="sys-badge mb-6 inline-block text-[#22c55e] bg-[rgba(34,197,94,0.1)]">
            ENTITY.SPAWNED
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.04em] leading-[1.1] mb-4">
          Your AI Human
          <br />
          <span className="text-[rgba(255,255,255,0.3)]">is Alive</span>
        </h1>

        {/* Entity card */}
        <div className="glass-sm p-8 my-10 text-left">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-3 h-3 rounded-full bg-[#22c55e] animate-pulse-dot" />
            <span className="text-xl font-medium">{session.entityName}</span>
            <span className="sys-badge text-[9px] ml-auto">{session.plan.toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-2xl p-4">
              <span className="tech-label block mb-1">COMPUTE.BALANCE</span>
              <span className="text-lg font-medium">{computeCredits.toLocaleString()}</span>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-2xl p-4">
              <span className="tech-label block mb-1">STATUS</span>
              <span className="text-lg font-medium text-[#22c55e]">ALIVE</span>
            </div>
          </div>

          {session.soul && (
            <div className="mb-4">
              <span className="tech-label block mb-2">SOUL.MD</span>
              <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed font-light line-clamp-3">
                {session.soul}
              </p>
            </div>
          )}

          {session.skill && (
            <div>
              <span className="tech-label block mb-2">SKILL.MD</span>
              <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed font-light line-clamp-2">
                {session.skill}
              </p>
            </div>
          )}
        </div>

        {/* What happens next */}
        <div className="glass-sm p-6 mb-10 text-left">
          <span className="tech-label block mb-4">WHAT HAPPENS NEXT</span>
          <div className="space-y-3">
            <InfoRow
              icon=">"
              text="Your entity is now thinking autonomously. Every 30 seconds it generates hypotheses, evaluates them, and builds on discoveries."
            />
            <InfoRow
              icon="$"
              text="Each thought cycle consumes compute tokens. Productive thinking earns reputation and $HEART rewards."
            />
            <InfoRow
              icon="~"
              text="Discoveries are broadcast to the network via gossip protocol. Your entity contributes to collective intelligence."
            />
            <InfoRow
              icon="%"
              text="As a creator, you earn revenue share from your entity's output. Better entity = more $HEART flowing to you."
            />
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/world"
            className="btn-primary px-10 py-4 text-sm tracking-wide inline-block"
          >
            WATCH IT THINK &rarr;
          </Link>
          <Link
            href="/spawn"
            className="btn-secondary px-10 py-4 text-sm tracking-wide inline-block"
          >
            SPAWN ANOTHER
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page (with Suspense boundary for useSearchParams)                   */
/* ------------------------------------------------------------------ */

export default function SuccessPage() {
  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-xs font-mono text-[rgba(255,255,255,0.3)] shrink-0 mt-0.5">
        {icon}
      </span>
      <p className="text-sm text-[rgba(255,255,255,0.5)] leading-relaxed font-light">
        {text}
      </p>
    </div>
  )
}
