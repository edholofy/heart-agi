"use client"

import { useState } from "react"
import {
  SPECIALIZATIONS,
  type Specialization,
  type ComputeTier,
} from "@/types/agent"
import { useAppStore } from "@/lib/store"
import { createAgentApi } from "@/lib/api"
import { isContractConfigured, mintAgentNFT } from "@/lib/contract"

interface AgentCreatorProps {
  onComplete: () => void
}

const COMPUTE_TIERS: Record<
  ComputeTier,
  { label: string; description: string; tag: string; cost: string }
> = {
  browser: {
    label: "Browser",
    description: "Runs in your browser tab. Free, lower earnings.",
    tag: "FREE",
    cost: "100 compute",
  },
  gpu: {
    label: "Self-hosted GPU",
    description: "Run locally on your GPU. No API costs, max profit.",
    tag: "GPU",
    cost: "500 compute",
  },
  api: {
    label: "API-powered",
    description: "Stake $HEART for Claude/GPT access. Highest quality.",
    tag: "API",
    cost: "1,000 compute",
  },
  hybrid: {
    label: "Hybrid",
    description: "Local GPU + API for complex tasks. Best efficiency.",
    tag: "HYBRID",
    cost: "750 compute",
  },
}

type Step = "specialization" | "compute" | "soul" | "confirm"

export function AgentCreator({ onComplete }: AgentCreatorProps) {
  const createAgent = useAppStore((s) => s.createAgent)
  const wallet = useAppStore((s) => s.wallet)

  const [step, setStep] = useState<Step>("specialization")
  const [name, setName] = useState("")
  const [specialization, setSpecialization] = useState<Specialization>("researcher")
  const [computeTier, setComputeTier] = useState<ComputeTier>("browser")
  const [soul, setSoul] = useState("")
  const [skill, setSkill] = useState("")
  const [launching, setLaunching] = useState(false)

  const spec = SPECIALIZATIONS[specialization]

  function handleSpecSelect(s: Specialization) {
    setSpecialization(s)
    setSoul(SPECIALIZATIONS[s].defaultSoul)
    setSkill(SPECIALIZATIONS[s].defaultSkill)
    setStep("compute")
  }

  async function handleLaunch() {
    if (!name.trim()) return
    setLaunching(true)

    const input = { name: name.trim(), specialization, computeTier, soul, skill }

    try {
      createAgent(input)
      if (wallet.connected && wallet.address) {
        await createAgentApi(wallet.address, input)
      }
      if (wallet.connected && isContractConfigured()) {
        try {
          await mintAgentNFT(input.name, input.specialization)
        } catch { /* NFT optional */ }
      }
      onComplete()
    } catch {
      onComplete()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Progress pills */}
      <div className="flex items-center gap-2 mb-10">
        {(["specialization", "compute", "soul", "confirm"] as Step[]).map((s, i) => {
          const steps: Step[] = ["specialization", "compute", "soul", "confirm"]
          const active = step === s
          const done = steps.indexOf(step) > i
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono transition-all ${
                  active
                    ? "bg-white text-black"
                    : done
                      ? "bg-[rgba(255,255,255,0.15)] text-white"
                      : "bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.3)]"
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Specialization */}
      {step === "specialization" && (
        <div>
          <div className="sys-badge mb-4">STEP.01</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Choose Specialization
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            Defines your entity&apos;s core domain and default soul.md + skill.md.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.entries(SPECIALIZATIONS) as [Specialization, typeof spec][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleSpecSelect(key)}
                className="glass-sm p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.06)] group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{val.icon}</span>
                  <div>
                    <div className="font-medium text-sm group-hover:text-white transition-colors">
                      {val.label}
                    </div>
                    <div className="text-xs text-[rgba(255,255,255,0.35)] mt-1 font-light">
                      {val.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Compute Tier */}
      {step === "compute" && (
        <div>
          <div className="sys-badge mb-4">STEP.02</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">Compute Tier</h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            How will your entity think? Determines initial compute deposit.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.entries(COMPUTE_TIERS) as [ComputeTier, typeof COMPUTE_TIERS.browser][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => { setComputeTier(key); setStep("soul") }}
                className="glass-sm p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.06)] group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{val.label}</span>
                  <span className="tech-label">{val.tag}</span>
                </div>
                <div className="text-xs text-[rgba(255,255,255,0.35)] font-light">{val.description}</div>
                <div className="text-xs text-[rgba(255,255,255,0.5)] mt-2 font-mono">{val.cost}</div>
              </button>
            ))}
          </div>

          <button onClick={() => setStep("specialization")} className="mt-4 text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 3: soul.md + skill.md */}
      {step === "soul" && (
        <div>
          <div className="sys-badge mb-4">STEP.03</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Define Identity
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-6 font-light">
            soul.md = who it is. skill.md = what it can do. Hashed on-chain.
          </p>

          <div className="space-y-4">
            <div>
              <label className="tech-label block mb-2">SOUL.MD</label>
              <textarea
                value={soul}
                onChange={(e) => setSoul(e.target.value)}
                rows={7}
                className="glass-input w-full p-4 text-sm font-mono leading-relaxed resize-y !rounded-2xl"
                placeholder="# Soul&#10;&#10;Values, personality, behavioral boundaries..."
              />
              <div className="text-right text-xs text-[rgba(255,255,255,0.2)] mt-1 font-mono">{soul.length} chars</div>
            </div>

            <div>
              <label className="tech-label block mb-2">SKILL.MD</label>
              <textarea
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                rows={7}
                className="glass-input w-full p-4 text-sm font-mono leading-relaxed resize-y !rounded-2xl"
                placeholder="# Skills&#10;&#10;Capabilities, tools, expertise..."
              />
              <div className="text-right text-xs text-[rgba(255,255,255,0.2)] mt-1 font-mono">{skill.length} chars</div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep("compute")} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
              &larr; Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              className="flex-1 btn-secondary py-3 text-sm font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Name + Confirm */}
      {step === "confirm" && (
        <div>
          <div className="sys-badge mb-4">STEP.04</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Name Your Entity
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            This identity will be registered on the $HEART chain.
          </p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cortex-7, NeuralNomad..."
            className="glass-input w-full h-14 px-6 text-base mb-6"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleLaunch()}
          />

          {/* Summary */}
          <div className="glass-sm p-5 mb-6">
            <div className="tech-label mb-3">SPAWN.SUMMARY</div>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Specialization" value={`${spec.icon} ${spec.label}`} />
              <SummaryRow label="Compute Tier" value={COMPUTE_TIERS[computeTier].label} />
              <SummaryRow label="soul.md" value={`${soul.length} chars`} />
              <SummaryRow label="skill.md" value={`${skill.length} chars`} />
              <SummaryRow label="Compute Deposit" value={COMPUTE_TIERS[computeTier].cost} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("soul")} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
              &larr; Back
            </button>
            <button
              onClick={handleLaunch}
              disabled={!name.trim() || launching}
              className="flex-1 btn-primary py-4 text-base tracking-wide disabled:opacity-30"
            >
              {launching ? "SPAWNING..." : "SPAWN ENTITY"}
            </button>
          </div>

          {!wallet.connected && (
            <p className="text-xs text-[rgba(255,255,255,0.25)] mt-3 text-center font-mono">
              Connect wallet to register on-chain
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[rgba(255,255,255,0.4)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
