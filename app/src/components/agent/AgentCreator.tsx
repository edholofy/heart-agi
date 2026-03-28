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

type Step = "define" | "fund" | "spawn"

const STEP_LABELS: Record<Step, string> = {
  define: "DEFINE",
  fund: "FUND",
  spawn: "SPAWN",
}

export function AgentCreator({ onComplete }: AgentCreatorProps) {
  const createAgent = useAppStore((s) => s.createAgent)
  const wallet = useAppStore((s) => s.wallet)

  const [step, setStep] = useState<Step>("define")
  const [name, setName] = useState("")
  const [specialization, setSpecialization] = useState<Specialization>("researcher")
  const [computeDeposit, setComputeDeposit] = useState(500)
  const [soul, setSoul] = useState("")
  const [skill, setSkill] = useState("")
  const [templateSelected, setTemplateSelected] = useState(false)
  const [spawning, setSpawning] = useState(false)
  const [spawnStatus, setSpawnStatus] = useState("")
  const [error, setError] = useState("")

  const spec = SPECIALIZATIONS[specialization]

  function handleTemplateSelect(s: Specialization) {
    setSpecialization(s)
    setSoul(SPECIALIZATIONS[s].defaultSoul)
    setSkill(SPECIALIZATIONS[s].defaultSkill)
    setTemplateSelected(true)
  }

  async function handleSpawn() {
    if (!name.trim()) return
    setError("")
    setSpawnStatus("")

    if (!wallet.connected) {
      setError("Create a wallet first to spawn on-chain")
      return
    }

    setSpawning(true)

    const input = { name: name.trim(), specialization, computeTier: "api" as const, soul, skill, computeDeposit }

    try {
      // 1. Hash the soul and skill
      setSpawnStatus("Hashing identity...")
      const soulHash = await hashIdentityFile(soul)
      const skillHash = await hashIdentityFile(skill)

      // 2. Register soul on-chain
      setSpawnStatus("Registering soul.md on-chain...")
      await registerSoul(`sha256:${soulHash}`)

      // 3. Register skill on-chain
      setSpawnStatus("Registering skill.md on-chain...")
      await registerSkill(`sha256:${skillHash}`)

      // 4. Spawn entity on-chain (requires 100 HEART stake)
      setSpawnStatus("Staking 100 HEART...")
      const spawnTx = await spawnEntity(
        name.trim(),
        specialization,
        `sha256:${soulHash}`,
        `sha256:${skillHash}`
      )

      // 5. Also create locally for the dashboard
      const localAgent = createAgent(input)

      // 6. Spawn on the server daemon (entity runs autonomously)
      setSpawnStatus("Starting autonomous process...")
      try {
        await spawnOnDaemon({
          id: localAgent.id,
          name: name.trim(),
          ownerAddress: wallet.address ?? "local-user",
          soul,
          skill,
          computeBalance: computeDeposit,
        })
        setSpawnStatus("Entity is ALIVE")
      } catch (daemonErr) {
        console.error("Daemon spawn failed:", daemonErr)
        setSpawnStatus(`On-chain OK (TX: ${spawnTx.slice(0, 12)}...) — daemon offline, will start when available`)
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
      setSpawning(false)
    }
  }

  const steps: Step[] = ["define", "fund", "spawn"]

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Progress pills */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => {
          const active = step === s
          const done = steps.indexOf(step) > i
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
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
                <span className={`text-xs font-mono tracking-wider ${
                  active ? "text-white" : done ? "text-[rgba(255,255,255,0.5)]" : "text-[rgba(255,255,255,0.2)]"
                }`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < 2 && <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: DEFINE — Template + soul.md + skill.md */}
      {step === "define" && (
        <div>
          <div className="sys-badge mb-4">DEFINE</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Define Identity
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-6 font-light">
            soul.md = who it is. skill.md = what it can do. Both are hashed and registered on-chain.
          </p>

          {/* Template selection */}
          <div className="mb-6">
            <label className="tech-label block mb-3">CHOOSE A TEMPLATE TO START WITH, OR WRITE FROM SCRATCH</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(SPECIALIZATIONS) as [Specialization, typeof spec][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => handleTemplateSelect(key)}
                  className={`glass-sm p-3 text-left transition-all hover:bg-[rgba(255,255,255,0.06)] group ${
                    templateSelected && specialization === key ? "ring-1 ring-white/20 bg-[rgba(255,255,255,0.04)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{val.icon}</span>
                    <div>
                      <div className="font-medium text-xs group-hover:text-white transition-colors">
                        {val.label}
                      </div>
                      <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5 font-light leading-tight">
                        {val.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* soul.md editor */}
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

          <div className="mt-6">
            <button
              onClick={() => setStep("fund")}
              disabled={!soul.trim() || !skill.trim()}
              className="w-full btn-secondary py-3 text-sm font-medium disabled:opacity-30"
            >
              Continue to Fund
            </button>
          </div>
        </div>
      )}

      {/* Step 2: FUND — Name + Compute Deposit */}
      {step === "fund" && (
        <div>
          <div className="sys-badge mb-4">FUND</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Name &amp; Fund Your Entity
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            Choose a name and deposit compute tokens to fuel autonomous operation.
          </p>

          {/* Entity name */}
          <div className="mb-6">
            <label className="tech-label block mb-2">ENTITY NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cortex-7, NeuralNomad..."
              className="glass-input w-full h-14 px-6 text-base"
              autoFocus
            />
          </div>

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

          {/* Cost Summary */}
          <div className="glass-sm p-4 mb-6">
            <div className="tech-label mb-3">COST SUMMARY</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[rgba(255,255,255,0.4)]">Genesis stake</span>
                <span className="font-mono">100 HEART</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgba(255,255,255,0.4)]">Compute deposit</span>
                <span className="font-mono">{computeDeposit} tokens</span>
              </div>
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-2 mt-2 flex justify-between font-medium">
                <span className="text-[rgba(255,255,255,0.6)]">Total</span>
                <span className="font-mono">100 HEART + {computeDeposit} Compute</span>
              </div>
            </div>
          </div>

          {/* Wallet Balance */}
          {wallet.connected && (
            <div className="glass-sm p-3 mb-6 flex items-center justify-between text-xs">
              <span className="text-[rgba(255,255,255,0.4)]">Wallet balance</span>
              <span className="font-mono text-[rgba(255,255,255,0.7)]">
                {wallet.balance ? `${wallet.balance} HEART` : "0 HEART"}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("define")} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
              &larr; Back
            </button>
            <button
              onClick={() => setStep("spawn")}
              disabled={!name.trim()}
              className="flex-1 btn-secondary py-3 text-sm font-medium disabled:opacity-30"
            >
              Continue to Spawn
            </button>
          </div>
        </div>
      )}

      {/* Step 3: SPAWN — Summary + Execute */}
      {step === "spawn" && (
        <div>
          <div className="sys-badge mb-4">SPAWN</div>
          <h2 className="text-2xl font-medium tracking-tight mb-2">
            Release Your Entity
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm mb-8 font-light">
            Review and spawn. This identity will be registered on the $HEART chain and begin autonomous operation.
          </p>

          {/* Summary */}
          <div className="glass-sm p-5 mb-6">
            <div className="tech-label mb-3">SPAWN SUMMARY</div>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Entity name" value={name} />
              <SummaryRow label="Template" value={`${spec.icon} ${spec.label}`} />
              <SummaryRow label="soul.md" value={`${soul.length} chars`} />
              <SummaryRow label="skill.md" value={`${skill.length} chars`} />
              <SummaryRow label="Genesis stake" value="100 HEART" />
              <SummaryRow label="Compute deposit" value={`${computeDeposit} tokens`} />
              <SummaryRow label="Runtime" value="Server Daemon (autonomous)" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("fund")} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
              &larr; Back
            </button>
            <button
              onClick={handleSpawn}
              disabled={!name.trim() || spawning}
              className="flex-1 btn-primary py-4 text-base tracking-wide disabled:opacity-30"
            >
              {spawning ? "SPAWNING..." : "SPAWN"}
            </button>
          </div>

          {spawnStatus && (
            <div className="mt-4 glass-sm p-3">
              <p className={`text-xs font-mono ${spawnStatus === "Entity is ALIVE" ? "text-[#22c55e]" : "text-[rgba(255,255,255,0.6)]"}`}>
                {spawnStatus === "Entity is ALIVE" ? "✓ " : "⟳ "}{spawnStatus}
              </p>
            </div>
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
