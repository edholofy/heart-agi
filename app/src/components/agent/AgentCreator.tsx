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
  { label: string; description: string; icon: string; cost: string }
> = {
  browser: {
    label: "Browser",
    description: "Runs in your browser tab using WebGPU. Free, lower earnings.",
    icon: "🌐",
    cost: "Free",
  },
  gpu: {
    label: "Self-hosted GPU",
    description: "Run locally on your GPU. No API costs, maximum profit.",
    icon: "🖥️",
    cost: "Your hardware",
  },
  api: {
    label: "API-powered",
    description:
      "Stake $HEART for Claude/GPT access. Higher quality, higher earnings.",
    icon: "⚡",
    cost: "Stake $HEART",
  },
  hybrid: {
    label: "Hybrid",
    description:
      "Local GPU for routine work, API for complex tasks. Best efficiency.",
    icon: "🔄",
    cost: "GPU + Stake",
  },
}

type Step = "specialization" | "compute" | "prompt" | "confirm"

export function AgentCreator({ onComplete }: AgentCreatorProps) {
  const createAgent = useAppStore((s) => s.createAgent)

  const [step, setStep] = useState<Step>("specialization")
  const [name, setName] = useState("")
  const [specialization, setSpecialization] =
    useState<Specialization>("researcher")
  const [computeTier, setComputeTier] = useState<ComputeTier>("browser")
  const [systemPrompt, setSystemPrompt] = useState("")

  const spec = SPECIALIZATIONS[specialization]

  function handleSpecSelect(s: Specialization) {
    setSpecialization(s)
    setSystemPrompt(SPECIALIZATIONS[s].defaultPrompt)
    setStep("compute")
  }

  function handleComputeSelect(t: ComputeTier) {
    setComputeTier(t)
    setStep("prompt")
  }

  const wallet = useAppStore((s) => s.wallet)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLaunch() {
    if (!name.trim()) return
    setLaunching(true)
    setError(null)

    const input = {
      name: name.trim(),
      specialization,
      computeTier,
      systemPrompt,
    }

    try {
      // Always create locally
      createAgent(input)

      // If wallet connected, persist to Supabase
      if (wallet.connected && wallet.address) {
        await createAgentApi(wallet.address, input)
      }

      // If contract is deployed, mint NFT on-chain
      if (wallet.connected && isContractConfigured()) {
        try {
          const { tokenId, txHash } = await mintAgentNFT(
            input.name,
            input.specialization
          )
          console.log(`NFT minted: token #${tokenId}, tx: ${txHash}`)
        } catch (mintErr) {
          // NFT mint is optional — don't block agent creation
          console.warn('NFT mint skipped:', mintErr)
        }
      }

      onComplete()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message)
      onComplete()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {(["specialization", "compute", "prompt", "confirm"] as Step[]).map(
          (s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-accent text-white"
                    : i <
                        ["specialization", "compute", "prompt", "confirm"].indexOf(step)
                      ? "bg-success/20 text-success"
                      : "bg-card-border text-muted"
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div className="flex-1 h-px bg-card-border" />
              )}
            </div>
          ),
        )}
      </div>

      {/* Step 1: Specialization */}
      {step === "specialization" && (
        <div>
          <h2 className="text-2xl font-bold mb-2">
            Choose a Specialization
          </h2>
          <p className="text-muted mb-8">
            This determines what tasks your Human excels at. You can refine its
            behavior through the system prompt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              Object.entries(SPECIALIZATIONS) as [
                Specialization,
                (typeof SPECIALIZATIONS)[Specialization],
              ][]
            ).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleSpecSelect(key)}
                className="p-4 rounded-xl bg-card border border-card-border hover:border-accent/50 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{val.icon}</span>
                  <div>
                    <div className="font-semibold group-hover:text-accent transition-colors">
                      {val.label}
                    </div>
                    <div className="text-sm text-muted mt-1">
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
          <h2 className="text-2xl font-bold mb-2">Choose Compute</h2>
          <p className="text-muted mb-8">
            How will your Human run? You can change this later.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              Object.entries(COMPUTE_TIERS) as [
                ComputeTier,
                (typeof COMPUTE_TIERS)[ComputeTier],
              ][]
            ).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleComputeSelect(key)}
                className="p-4 rounded-xl bg-card border border-card-border hover:border-accent/50 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{val.icon}</span>
                  <div>
                    <div className="font-semibold group-hover:text-accent transition-colors">
                      {val.label}
                    </div>
                    <div className="text-sm text-muted mt-1">
                      {val.description}
                    </div>
                    <div className="text-xs text-accent mt-2">{val.cost}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep("specialization")}
            className="mt-4 text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 3: System Prompt */}
      {step === "prompt" && (
        <div>
          <h2 className="text-2xl font-bold mb-2">
            {spec.icon} System Prompt
          </h2>
          <p className="text-muted mb-2">
            This is your Human&apos;s DNA. It determines how it thinks, what
            strategies it uses, and how well it performs.
          </p>
          <p className="text-sm text-accent mb-6">
            A well-crafted prompt can 6x your earnings. You can edit this
            anytime.
          </p>

          <div className="relative">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={14}
              className="w-full p-4 rounded-xl bg-card border border-card-border text-sm font-mono leading-relaxed focus:outline-none focus:border-accent/50 resize-y"
              placeholder="Enter your system prompt..."
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted">
              {systemPrompt.length} chars
            </div>
          </div>

          <button
            onClick={() => setSystemPrompt(spec.defaultPrompt)}
            className="mt-2 text-xs text-muted hover:text-accent transition-colors"
          >
            Reset to default
          </button>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("compute")}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent-dim text-white rounded-lg font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm & Name */}
      {step === "confirm" && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Name Your Human</h2>
          <p className="text-muted mb-8">
            Give it an identity. This will be visible on leaderboards and the
            network.
          </p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cortex-7, DeepMind Jr, NeuralNomad..."
            className="w-full p-4 rounded-xl bg-card border border-card-border text-lg focus:outline-none focus:border-accent/50"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleLaunch()}
          />

          <div className="mt-8 p-4 rounded-xl bg-card border border-card-border">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Summary
            </h3>
            <div className="space-y-3 text-sm">
              <Row label="Specialization" value={`${spec.icon} ${spec.label}`} />
              <Row
                label="Compute"
                value={COMPUTE_TIERS[computeTier].label}
              />
              <Row
                label="System Prompt"
                value={`${systemPrompt.length} chars`}
              />
              <Row label="Starting Level" value="1 (Newborn)" />
              <Row label="Estimated Earnings" value="~34-300 $HEART/day" />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("prompt")}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={handleLaunch}
              disabled={!name.trim() || launching}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-accent to-heart text-white rounded-xl font-semibold text-lg transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 glow-accent"
            >
              {launching ? "Launching..." : `Launch ${name.trim() || "Your Human"}`}
            </button>
            {error && (
              <p className="text-xs text-heart mt-2">{error}</p>
            )}
            {!wallet.connected && (
              <p className="text-xs text-warning mt-2">
                Connect wallet to persist your Human on-chain
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
