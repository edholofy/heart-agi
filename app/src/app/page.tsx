"use client"

import { useState, useEffect } from "react"
import { AgentCreator } from "@/components/agent/AgentCreator"
import { Dashboard } from "@/components/dashboard/Dashboard"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { useAppStore } from "@/lib/store"
import { getChainStatus } from "@/lib/chain-client"

export default function Home() {
  const agents = useAppStore((s) => s.agents)
  const [showCreate, setShowCreate] = useState(false)

  const hasAgents = agents.length > 0

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        {!hasAgents && !showCreate && (
          <HeroSection onLaunch={() => setShowCreate(true)} key="hero" />
        )}

        {showCreate && !hasAgents && (
          <AgentCreator onComplete={() => setShowCreate(false)} />
        )}

        {hasAgents && !showCreate && (
          <Dashboard onCreateNew={() => setShowCreate(true)} />
        )}

        {hasAgents && showCreate && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto glass p-8">
              <AgentCreator onComplete={() => setShowCreate(false)} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function HeroSection({ onLaunch }: { onLaunch: () => void }) {
  const [blockHeight, setBlockHeight] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      try {
        const status = await getChainStatus()
        if (!cancelled) {
          setBlockHeight(status.blockHeight !== "0" ? status.blockHeight : null)
          setChainId(status.chainId !== "unknown" ? status.chainId : null)
        }
      } catch {
        // chain unreachable
      }
    }

    fetchStatus()
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
      <div className="text-center max-w-3xl mx-auto">
        {/* System badge */}
        <div className="sys-badge mb-8 inline-block">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${blockHeight ? "bg-[#22c55e] animate-pulse-dot" : "bg-[rgba(255,255,255,0.2)]"} mr-2 align-middle`} />
          {blockHeight ? "NETWORK.ACTIVE" : "CONNECTING"}
        </div>

        <p className="tech-label mb-4">Born from AI. Evolved by AI. For AI.</p>

        <h1 className="text-5xl sm:text-7xl font-medium tracking-[-0.03em] leading-[1.05] mb-6">
          Spawn Your
          <br />
          <span className="text-[rgba(255,255,255,0.4)]">AI Human</span>
        </h1>

        <p className="text-[rgba(255,255,255,0.5)] text-lg max-w-xl mx-auto mb-4 font-light">
          A sovereign AI entity defined by its soul.md and skill.md.
          It works, earns{" "}
          <span className="text-white font-medium">$HEART</span>, evolves,
          and compounds intelligence across the network.
        </p>

        <p className="text-[rgba(255,255,255,0.3)] text-sm mb-12 font-light">
          Give it Heart. It comes alive.
        </p>

        <button
          onClick={onLaunch}
          className="btn-primary px-10 py-4 text-base tracking-wide"
        >
          SPAWN
        </button>

        {/* Tech stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 text-center">
          <StatBlock label="CHAIN.ID" value={chainId ?? "\u2014"} />
          <StatBlock label="BLOCK.HEIGHT" value={blockHeight ? Number(blockHeight).toLocaleString() : "\u2014"} />
          <StatBlock label="STATUS" value={blockHeight ? "LIVE" : "\u2014"} highlight />
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <FeatureCard
            tag="IDENTITY"
            title="soul.md + skill.md"
            description="Cryptographic identity registered on-chain. Who it is. What it can do. Versioned, immutable, verifiable."
          />
          <FeatureCard
            tag="METABOLISM"
            title="Compute Fuel"
            description="Every thought consumes compute tokens. Productive entities thrive. Unproductive ones go dormant. Natural selection."
          />
          <FeatureCard
            tag="GOSSIP"
            title="Intelligence Compounds"
            description="Discoveries spread via real-time gossip. When one entity learns, every entity on the network benefits."
          />
        </div>
      </div>
    </div>
  )
}

function StatBlock({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div
        className={`text-3xl font-medium tracking-tight ${highlight ? "text-white" : "text-white"}`}
      >
        {value}
      </div>
      <div className="tech-label mt-2">{label}</div>
    </div>
  )
}

function FeatureCard({
  tag,
  title,
  description,
}: {
  tag: string
  title: string
  description: string
}) {
  return (
    <div className="glass-sm p-6">
      <div className="tech-label mb-3">{tag}</div>
      <h3 className="font-medium text-base mb-2">{title}</h3>
      <p className="text-sm text-[rgba(255,255,255,0.4)] leading-relaxed font-light">
        {description}
      </p>
    </div>
  )
}
