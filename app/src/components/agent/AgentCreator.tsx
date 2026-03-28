"use client"

import { useState } from "react"
import {
  SPECIALIZATIONS,
  type Specialization,
  hashIdentityFile,
} from "@/types/agent"
import { useAppStore } from "@/lib/store"
import { registerSoul, registerSkill, spawnEntity } from "@/lib/chain-tx"
import { spawnOnDaemon } from "@/lib/daemon-client"

interface AgentCreatorProps {
  onComplete: () => void
}

type Step = "specialization" | "soul" | "confirm"

export function AgentCreator({ onComplete }: AgentCreatorProps) {
  const createAgent = useAppStore((s) => s.createAgent)
  const wallet = useAppStore((s) => s.wallet)

  const [step, setStep] = useState<Step>("specialization")
  const [name, setName] = useState("")
  const [specialization, setSpecialization] = useState<Specialization>("researcher")
  const [computeDeposit, setComputeDeposit] = useState(500)
  const [soul, setSoul] = useState("")
  const [skill, setSkill] = useState("")
  const [launching, setLaunching] = useState(false)
  const [launchStatus, setLaunchStatus] = useState("")
  const [error, setError] = useState("")

  const spec = SPECIALIZATIONS[specialization]

  function handleSpecSelect(s: Specialization) {
    setSpecialization(s)
    setSoul(SPECIALIZATIONS[s].defaultSoul)
    setSkill(SPECIALIZATIONS[s].defaultSkill)
    setStep("soul")
  }

  async function handleLaunch() {
    if (!name.trim()) return
    setError("")
    setLaunchStatus("")

    if (!wallet.connected) {
      setError("Create a wallet first to spawn on-chain")
      return
    }

    setLaunching(true)

    const input = { name: name.trim(), specialization, computeTier: "api" as const, soul, skill, computeDeposit }

    try {
      // 1. Hash the soul and skill
      const soulHash = await hashIdentityFile(soul)
      const skillHash = await hashIdentityFile(skill)

      // 2. Register soul on-chain
      setLaunchStatus("Registering soul.md on-chain...")
      await registerSoul(`sha256:${soulHash}`)

      // 3. Register skill on-chain
      setLaunchStatus("Registering skill.md on-chain...")
      await registerSkill(`sha256:${skillHash}`)

      // 4. Spawn entity on-chain (requires 100 HEART stake)
      setLaunchStatus("Spawning entity on-chain (staking 100 HEART)...")
      const spawnTx = await spawnEntity(
        name.trim(),
        specialization,
        `sha256:${soulHash}`,
        `sha256:${skillHash}`
      )

      // 5. Also create locally for the dashboard
      const localAgent = createAgent(input)

      // 6. Spawn on the server daemon (entity runs autonomously)
      setLaunchStatus("Starting entity on server daemon...")
      try {
        await spawnOnDaemon({
          id: localAgent.id,
          name: name.trim(),
          ownerAddress: wallet.address ?? "local-user",
          soul,
          skill,
          computeBalance: computeDeposit,
        })
        setLaunchStatus(`Entity spawned and running! TX: ${spawnTx.slice(0, 12)}...`)
      } catch (daemonErr) {
        console.error("Daemon spawn failed:", daemonErr)
        setLaunchStatus(`On-chain OK (TX: ${spawnTx.slice(0, 12)}...) — daemon offline, will start when available`)
      }

      setTimeout(() => onComplete(), 2000)
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message)
      // If chain fails, still create locally so the UI works
      const localAgent = createAgent(input)

      // Try daemon spawn even if chain failed
      try {
        await spawnOnDaemon({
          id: localAgent.id,
          name: name.trim(),
          ownerAddress: wallet.address ?? "local-user",
          soul,
          skill,
          computeBalance: computeDeposit,
        })
      } catch {
        // Daemon also offline — entity will be local-only for now
      }

      onComplete()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Progress pills */}
      <div className="flex items-center gap-2 mb-10">
        {(["specialization", "soul", "confirm"] as Step[]).map((s, i) => {
          const steps: Step[] = ["specialization", "soul", "confirm"]
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
              {i < 2 && <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Specialization */}
      {step === "specialization" && (
        <div>
          <div className="sys-badge mb-4">STEP.01</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Choose a Template
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            Pick a starting template for soul.md + skill.md. You can edit freely in the next step.
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

      {/* Step 2: soul.md + skill.md */}
      {step === "soul" && (
        <div>
          <div className="sys-badge mb-4">STEP.02</div>
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
            <button onClick={() => setStep("specialization")} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
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

      {/* Step 3: Name + Fund + Confirm */}
      {step === "confirm" && (
        <div>
          <div className="sys-badge mb-4">STEP.03</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Name &amp; Fund Your Entity
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            This identity will be registered on the $HEART chain and run autonomously on the server.
          </p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cortex-7, NeuralNomad..."
            className="glass-input w-full h-14 px-6 text-base mb-4"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleLaunch()}
          />

          {/* Compute Deposit */}
          <div className="glass-sm p-4 mb-6">
            <label className="tech-label block mb-2">COMPUTE DEPOSIT</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={computeDeposit}
                onChange={(e) => setComputeDeposit(Math.max(100, Number(e.target.value) || 100))}
                min={100}
                step={100}
                className="glass-input w-32 h-10 px-4 text-sm font-mono text-center"
              />
              <span className="text-xs text-[rgba(255,255,255,0.4)]">tokens (min. 100)</span>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.25)] mt-2 font-light">
              Compute fuels every thought and action. More compute = longer autonomous runtime before refueling.
            </p>
          </div>

          {/* Summary */}
          <div className="glass-sm p-5 mb-6">
            <div className="tech-label mb-3">SPAWN.SUMMARY</div>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Template" value={`${spec.icon} ${spec.label}`} />
              <SummaryRow label="Runtime" value="Server Daemon (autonomous)" />
              <SummaryRow label="soul.md" value={`${soul.length} chars`} />
              <SummaryRow label="skill.md" value={`${skill.length} chars`} />
              <SummaryRow label="Compute Deposit" value={`${computeDeposit} tokens`} />
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

          {launchStatus && (
            <p className="text-xs text-[#22c55e] mt-2 font-mono">{launchStatus}</p>
          )}

          {error && (
            <p className="text-xs text-red-400 mt-2 font-mono">{error}</p>
          )}

          {!wallet.connected && (
            <p className="text-xs text-[rgba(255,255,255,0.25)] mt-3 text-center font-mono">
              Create a wallet to spawn on-chain
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
