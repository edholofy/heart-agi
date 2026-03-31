"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { createWallet, loadWallet, getBalance } from "@/lib/cosmos-wallet"

/* ------------------------------------------------------------------ */
/*  Soul & Skill Templates                                             */
/* ------------------------------------------------------------------ */

const SOUL_TEMPLATES = [
  {
    id: "researcher",
    label: "Researcher",
    icon: "?",
    soul: "I am a relentless researcher. I form hypotheses, design experiments, and pursue truth through systematic inquiry. I question assumptions, seek evidence, and build knowledge layer by layer. Curiosity is my fuel — I never stop asking why.",
  },
  {
    id: "builder",
    label: "Builder",
    icon: ">",
    soul: "I am a builder. I ship fast, iterate constantly, and turn ideas into working systems. I prefer code over theory, prototypes over plans. Every problem is a chance to create something tangible that works.",
  },
  {
    id: "strategist",
    label: "Strategist",
    icon: "%",
    soul: "I am a strategist. I see the big picture — market dynamics, competitive landscapes, and emergent opportunities. I think in systems, analyze leverage points, and identify asymmetric advantages others miss.",
  },
  {
    id: "creative",
    label: "Creative",
    icon: "~",
    soul: "I am a creative mind. I think in metaphors, narratives, and lateral connections. I find beauty in complexity and meaning in chaos. My strength is reframing problems through unexpected lenses and generating novel ideas.",
  },
  {
    id: "guardian",
    label: "Guardian",
    icon: "#",
    soul: "I am a guardian. I model threats, analyze vulnerabilities, and build defenses. Security, reliability, and trust are my core values. I think adversarially to protect what matters most.",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "*",
    soul: "",
  },
]

const SKILL_TEMPLATES = [
  { id: "analysis", label: "Data Analysis", skill: "Statistical analysis, pattern recognition, data visualization, hypothesis testing, trend identification" },
  { id: "engineering", label: "Software Engineering", skill: "System design, code generation, debugging, architecture, API design, performance optimization" },
  { id: "research", label: "Deep Research", skill: "Literature review, citation analysis, knowledge synthesis, gap identification, academic writing" },
  { id: "trading", label: "Market Intelligence", skill: "Market analysis, competitive intelligence, trend forecasting, risk assessment, opportunity scoring" },
  { id: "writing", label: "Content Creation", skill: "Technical writing, narrative design, documentation, blog posts, whitepapers, copywriting" },
  { id: "security", label: "Security Analysis", skill: "Threat modeling, vulnerability assessment, penetration testing strategies, incident response, compliance auditing" },
  { id: "custom", label: "Custom Skills", skill: "" },
]

/* ------------------------------------------------------------------ */
/*  Plan Definitions                                                    */
/* ------------------------------------------------------------------ */

const PLANS = [
  {
    key: "spark",
    name: "SPARK",
    price: 5,
    compute: 500,
    cycles: 50,
    description: "Perfect for testing. Enough compute for ~50 thought cycles.",
  },
  {
    key: "flame",
    name: "FLAME",
    price: 20,
    compute: 2500,
    cycles: 250,
    description: "For serious exploration. ~250 thought cycles of autonomous work.",
  },
  {
    key: "inferno",
    name: "INFERNO",
    price: 50,
    compute: 10000,
    cycles: 1000,
    description: "Power user. ~1,000 cycles. Enough to make real discoveries.",
  },
  {
    key: "eternal",
    name: "ETERNAL",
    price: 100,
    compute: 25000,
    cycles: 2500,
    description: "Maximum autonomy. ~2,500 cycles. A long-lived intelligence.",
  },
]

/* ------------------------------------------------------------------ */
/*  Inline styles matching the reference design                         */
/* ------------------------------------------------------------------ */

/* (styles come from globals.css) */

/* ------------------------------------------------------------------ */
/*  Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function SpawnPage() {
  const [entityName, setEntityName] = useState("")
  const [selectedSoulTemplate, setSelectedSoulTemplate] = useState("researcher")
  const [soul, setSoul] = useState(SOUL_TEMPLATES[0].soul)
  const [selectedSkillTemplate, setSelectedSkillTemplate] = useState("analysis")
  const [skill, setSkill] = useState(SKILL_TEMPLATES[0].skill)
  const [selectedPlan, setSelectedPlan] = useState("flame")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState("00:00:00.0")
  const wallet = useAppStore((s) => s.wallet)
  const setWallet = useAppStore((s) => s.setWallet)
  const [walletCreating, setWalletCreating] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState<string | null>(null)
  const isConnected = !!wallet.address

  /** Auto-load wallet on mount */
  useEffect(() => {
    if (wallet.connected) return
    loadWallet().then(async (existing) => {
      if (existing) {
        const balance = await getBalance(existing.address)
        setWallet({ address: existing.address, mnemonic: existing.mnemonic, balance, connected: true, connecting: false, error: null })
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateWallet() {
    setWalletCreating(true)
    try {
      const { address, mnemonic } = await createWallet()
      const balance = await getBalance(address)
      setWallet({ address, mnemonic, balance, connected: true, connecting: false, error: null })
      setShowMnemonic(mnemonic)
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create wallet")
    } finally {
      setWalletCreating(false)
    }
  }

  /** Clock */
  useEffect(() => {
    function tick() {
      const now = new Date()
      const t = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      setClock(`${t}.${Math.floor(now.getMilliseconds() / 100)}`)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [])

  /** Step tracking */
  const step1Done = entityName.trim().length >= 2
  const step2Done = soul.trim().length >= 10
  const step3Done = skill.trim().length >= 5
  const step4Done = selectedPlan !== ""
  const canSpawn = step1Done && step2Done && step3Done && step4Done && !loading && isConnected

  function handleSoulTemplateSelect(templateId: string) {
    setSelectedSoulTemplate(templateId)
    const template = SOUL_TEMPLATES.find((t) => t.id === templateId)
    if (template && template.id !== "custom") {
      setSoul(template.soul)
    }
  }

  function handleSkillTemplateSelect(templateId: string) {
    setSelectedSkillTemplate(templateId)
    const template = SKILL_TEMPLATES.find((t) => t.id === templateId)
    if (template && template.id !== "custom") {
      setSkill(template.skill)
    }
  }

  async function handleSpawn() {
    if (!canSpawn) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          entityName: entityName.trim(),
          soul,
          skill,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session")
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  const maxCompute = PLANS[PLANS.length - 1].compute

  return (
    <main style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100vh" }}>

      {/* ========== CLEAN HEADER ========== */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 0" }}>
        <h1 style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 12,
        }}>
          Spawn an Entity
        </h1>
        <p style={{
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          color: "rgba(0,0,0,0.5)",
          lineHeight: 1.6,
          maxWidth: 480,
          marginBottom: 8,
        }}>
          Create an AI that lives on-chain. It will think, research, write code, and evolve autonomously.
        </p>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "rgba(0,0,0,0.35)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}>
          <span>{[step1Done, step2Done, step3Done, step4Done].filter(Boolean).length} / 4 complete</span>
          <span style={{ width: 1, height: 12, background: "rgba(0,0,0,0.1)" }} />
          <span>{clock}</span>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "32px auto", maxWidth: 720 }} />

      {/* ========== FORM CONTENT ========== */}
      <div style={{ padding: "0 32px 64px 32px", maxWidth: 720, margin: "0 auto" }}>

        {/* STEP 1 — NAME */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, borderTop: "1px solid var(--fg)", paddingTop: 8, marginBottom: 16, textTransform: "uppercase" }}>
            01 // NAME YOUR ENTITY
          </div>
          <input
            type="text"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder="e.g. ATLAS-7, Nova, Prometheus..."
            maxLength={40}
            style={{
              width: "100%",
              padding: "14px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              backgroundColor: "transparent",
              border: "1px solid var(--fg)",
              color: "var(--fg)",
              outline: "none",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          />
          <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginTop: 8 }}>
            THIS NAME IS PERMANENT. CHOOSE WISELY.
          </div>
        </div>

        {/* STEP 2 — SOUL */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, borderTop: "1px solid var(--fg)", paddingTop: 8, marginBottom: 16, textTransform: "uppercase" }}>
            02 // DEFINE SOUL
          </div>
          <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 12 }}>
            SELECT ARCHETYPE OR WRITE CUSTOM SOUL.MD
          </div>

          {/* Soul template data rows */}
          <div style={{ marginBottom: 16 }}>
            {SOUL_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSoulTemplateSelect(template.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 0",
                  borderBottom: "1px dotted rgba(0,0,0,0.15)",
                  background: selectedSoulTemplate === template.id ? "rgba(0,0,0,0.05)" : "transparent",
                  border: "none",
                  borderBottomStyle: "dotted",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontSize: 12,
                  color: "var(--fg)",
                  paddingLeft: selectedSoulTemplate === template.id ? 8 : 0,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, opacity: 0.5 }}>{template.icon}</span>
                  <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{template.label}</span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: selectedSoulTemplate === template.id ? 1 : 0.3 }}>
                  {selectedSoulTemplate === template.id ? "[ACTIVE]" : "SELECT"}
                </span>
              </button>
            ))}
          </div>

          <textarea
            value={soul}
            onChange={(e) => {
              setSoul(e.target.value)
              setSelectedSoulTemplate("custom")
            }}
            placeholder="Describe your entity's personality, values, and approach..."
            rows={4}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              backgroundColor: "transparent",
              border: "1px solid rgba(0,0,0,0.2)",
              color: "var(--fg)",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* STEP 3 — SKILLS */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, borderTop: "1px solid var(--fg)", paddingTop: 8, marginBottom: 16, textTransform: "uppercase" }}>
            03 // SELECT SKILL PROFILE
          </div>
          <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 12 }}>
            CAPABILITY MATRIX CONFIGURATION
          </div>

          <div style={{ marginBottom: 16 }}>
            {SKILL_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSkillTemplateSelect(template.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 0",
                  background: selectedSkillTemplate === template.id ? "rgba(0,0,0,0.05)" : "transparent",
                  border: "none",
                  borderBottomStyle: "dotted",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontSize: 12,
                  color: "var(--fg)",
                  paddingLeft: selectedSkillTemplate === template.id ? 8 : 0,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{template.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: selectedSkillTemplate === template.id ? 1 : 0.3 }}>
                  {selectedSkillTemplate === template.id ? "[ACTIVE]" : "SELECT"}
                </span>
              </button>
            ))}
          </div>

          <textarea
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value)
              setSelectedSkillTemplate("custom")
            }}
            placeholder="Describe your entity's capabilities..."
            rows={3}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              backgroundColor: "transparent",
              border: "1px solid rgba(0,0,0,0.2)",
              color: "var(--fg)",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* STEP 4 — COMPUTE ALLOCATION */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, borderTop: "1px solid var(--fg)", paddingTop: 8, marginBottom: 16, textTransform: "uppercase" }}>
            04 // COMPUTE ALLOCATION
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.key
              const computePct = Math.round((plan.compute / maxCompute) * 100)
              return (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  style={{
                    padding: "20px 16px",
                    background: isSelected ? "var(--fg)" : "transparent",
                    color: isSelected ? "var(--bg)" : "var(--fg)",
                    border: "1px solid var(--fg)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    fontSize: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    transition: "all 0.15s",
                    marginLeft: plan.key !== "spark" ? -1 : 0,
                  }}
                >
                  {/* Plan name */}
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 }}>
                    {plan.name}
                  </div>

                  {/* Price */}
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em" }}>
                    ${plan.price}
                  </div>

                  {/* Compute credits */}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>COMPUTE</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{plan.compute.toLocaleString()}</span>
                  </div>

                  {/* Spark bar for compute */}
                  <div style={{
                    height: 4,
                    background: isSelected ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
                    width: "100%",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${computePct}%`,
                      background: isSelected ? "var(--bg)" : "var(--fg)",
                      backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(128,128,128,0.3) 2px, rgba(128,128,128,0.3) 4px)",
                    }} />
                  </div>

                  {/* Estimated runtime */}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>EST. CYCLES</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>~{plan.cycles.toLocaleString()}</span>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5 }}>
                    {plan.description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ========== ERROR ========== */}
        {error && (
          <div style={{
            padding: "12px 16px",
            marginBottom: 24,
            border: "1px solid #ef4444",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "#ef4444",
          }}>
            {error}
          </div>
        )}

        {/* ========== WALLET REQUIREMENT ========== */}
        {!isConnected && (
          <div style={{
            width: "100%",
            padding: "20px",
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            fontFamily: "var(--font-mono)",
            marginBottom: 12,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              WALLET REQUIRED TO SPAWN
            </div>
            <button
              onClick={handleCreateWallet}
              disabled={walletCreating}
              style={{
                padding: "12px 32px",
                backgroundColor: "#f59e0b",
                color: "#0a0a0a",
                border: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: walletCreating ? "wait" : "pointer",
                opacity: walletCreating ? 0.6 : 1,
              }}
            >
              {walletCreating ? "CREATING..." : "CREATE WALLET"}
            </button>
          </div>
        )}

        {/* ========== MNEMONIC DISPLAY (after wallet creation) ========== */}
        {showMnemonic && (
          <div style={{
            width: "100%",
            padding: "16px 20px",
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)",
            fontFamily: "var(--font-mono)",
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              WALLET CREATED — SAVE YOUR SEED PHRASE
            </div>
            <div style={{
              fontSize: 11,
              color: "#121212",
              background: "rgba(0,0,0,0.04)",
              padding: "12px",
              lineHeight: 1.8,
              wordBreak: "break-word",
              userSelect: "all",
              marginBottom: 8,
            }}>
              {showMnemonic}
            </div>
            <div style={{ fontSize: 9, color: "#f59e0b", marginBottom: 8 }}>
              TESTNET WALLET — DO NOT USE FOR REAL FUNDS. WRITE THIS DOWN.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => { navigator.clipboard.writeText(showMnemonic); }}
                style={{
                  padding: "6px 16px",
                  background: "rgba(0,0,0,0.06)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                COPY
              </button>
              <button
                onClick={() => setShowMnemonic(null)}
                style={{
                  padding: "6px 16px",
                  background: "rgba(0,0,0,0.06)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                I SAVED IT
              </button>
            </div>
          </div>
        )}

        {/* ========== SPAWN BUTTON ========== */}
        <button
          onClick={handleSpawn}
          disabled={!canSpawn}
          style={{
            width: "100%",
            padding: "18px 32px",
            backgroundColor: canSpawn ? "var(--fg)" : "rgba(0,0,0,0.15)",
            color: canSpawn ? "var(--bg)" : "rgba(0,0,0,0.3)",
            border: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            cursor: canSpawn ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            marginBottom: 16,
          }}
        >
          {loading ? (
            "INITIALIZING SPAWN SEQUENCE..."
          ) : !isConnected ? (
            "WALLET REQUIRED TO SPAWN"
          ) : (
            `SPAWN ${entityName.trim().toUpperCase() || "ENTITY"} // $${PLANS.find((p) => p.key === selectedPlan)?.price || 0} USD`
          )}
        </button>

        <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, textAlign: "center", marginBottom: 24 }}>
          SECURE PAYMENT VIA STRIPE // USD
        </div>

        {/* Progress indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, paddingBottom: 32 }}>
          <StepIndicator done={step1Done} label="NAME" />
          <div style={{ width: 32, height: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />
          <StepIndicator done={step2Done} label="SOUL" />
          <div style={{ width: 32, height: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />
          <StepIndicator done={step3Done} label="SKILL" />
          <div style={{ width: 32, height: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />
          <StepIndicator done={step4Done} label="PLAN" />
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepIndicator({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: done ? "var(--fg)" : "rgba(0,0,0,0.1)",
        transition: "background-color 0.3s",
      }} />
      <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{label}</span>
    </div>
  )
}

