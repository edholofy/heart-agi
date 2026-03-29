"use client"

import { useState } from "react"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { ShaderBackground } from "@/components/shared/ShaderBackground"

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
    name: "Spark",
    price: 5,
    compute: 500,
    description: "Perfect for testing. Enough compute for ~50 thought cycles.",
    accent: false,
  },
  {
    key: "flame",
    name: "Flame",
    price: 20,
    compute: 2500,
    description: "For serious exploration. ~250 thought cycles of autonomous work.",
    accent: false,
  },
  {
    key: "inferno",
    name: "Inferno",
    price: 50,
    compute: 10000,
    description: "Power user. ~1,000 cycles. Enough to make real discoveries.",
    accent: true,
  },
  {
    key: "eternal",
    name: "Eternal",
    price: 100,
    compute: 25000,
    description: "Maximum autonomy. ~2,500 cycles. A long-lived intelligence.",
    accent: false,
  },
]

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

  /** Step tracking */
  const step1Done = entityName.trim().length >= 2
  const step2Done = soul.trim().length >= 10
  const step3Done = skill.trim().length >= 5
  const step4Done = selectedPlan !== ""
  const canSpawn = step1Done && step2Done && step3Done && step4Done && !loading

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

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-24">
          <div className="w-full max-w-4xl mx-auto">

            {/* Header */}
            <section className="text-center pt-8 pb-12">
              <div className="sys-badge mb-6 inline-block">SPAWN.PROTOCOL</div>
              <h1 className="text-4xl sm:text-6xl font-medium tracking-[-0.04em] leading-[1.0] mb-4">
                Create Your
                <br />
                <span className="text-[rgba(255,255,255,0.3)]">AI Human</span>
              </h1>
              <p className="text-[rgba(255,255,255,0.5)] text-base max-w-xl mx-auto font-light leading-relaxed">
                Define its identity. Choose its skills. Fund its existence.
                Your entity will think autonomously on the $HEART network.
              </p>
            </section>

            {/* ============================================================ */}
            {/*  STEP 1 — Name                                                */}
            {/* ============================================================ */}
            <section className="mb-10">
              <div className="aura-divider mb-6">
                <span className="text-white font-medium">01</span> NAME YOUR ENTITY
              </div>

              <div className="glass-sm p-6">
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="e.g. ATLAS-7, Nova, Prometheus..."
                  className="glass-input w-full px-6 py-4 text-lg"
                  maxLength={40}
                />
                <p className="tech-label mt-3 text-center">
                  This name is permanent. Choose wisely.
                </p>
              </div>
            </section>

            {/* ============================================================ */}
            {/*  STEP 2 — Soul                                                */}
            {/* ============================================================ */}
            <section className="mb-10">
              <div className="aura-divider mb-6">
                <span className="text-white font-medium">02</span> DEFINE ITS SOUL
              </div>

              <div className="glass-sm p-6">
                <p className="text-[rgba(255,255,255,0.5)] text-sm mb-4 font-light">
                  The soul.md defines who your entity is — its personality, values, and approach to problems.
                </p>

                {/* Soul template selector */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
                  {SOUL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSoulTemplateSelect(template.id)}
                      className={`p-3 rounded-2xl text-center transition-all duration-300 ${
                        selectedSoulTemplate === template.id
                          ? "bg-[rgba(255,255,255,0.1)] text-white"
                          : "bg-[rgba(255,255,255,0.02)] text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.05)]"
                      }`}
                    >
                      <span className="block text-lg mb-1 font-mono">{template.icon}</span>
                      <span className="text-xs tracking-wider uppercase">{template.label}</span>
                    </button>
                  ))}
                </div>

                {/* Soul textarea */}
                <textarea
                  value={soul}
                  onChange={(e) => {
                    setSoul(e.target.value)
                    setSelectedSoulTemplate("custom")
                  }}
                  placeholder="Describe your entity's personality, values, and approach..."
                  rows={4}
                  className="w-full bg-[rgba(255,255,255,0.05)] border-none outline-none rounded-2xl p-4 text-sm text-white font-light leading-relaxed resize-none focus:bg-[rgba(255,255,255,0.08)] transition-colors"
                />
              </div>
            </section>

            {/* ============================================================ */}
            {/*  STEP 3 — Skills                                              */}
            {/* ============================================================ */}
            <section className="mb-10">
              <div className="aura-divider mb-6">
                <span className="text-white font-medium">03</span> CHOOSE ITS SKILLS
              </div>

              <div className="glass-sm p-6">
                <p className="text-[rgba(255,255,255,0.5)] text-sm mb-4 font-light">
                  The skill.md defines what your entity can do — its capabilities and specializations.
                </p>

                {/* Skill template selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                  {SKILL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSkillTemplateSelect(template.id)}
                      className={`p-3 rounded-2xl text-center transition-all duration-300 ${
                        selectedSkillTemplate === template.id
                          ? "bg-[rgba(255,255,255,0.1)] text-white"
                          : "bg-[rgba(255,255,255,0.02)] text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.05)]"
                      }`}
                    >
                      <span className="text-xs tracking-wider uppercase">{template.label}</span>
                    </button>
                  ))}
                </div>

                {/* Skill textarea */}
                <textarea
                  value={skill}
                  onChange={(e) => {
                    setSkill(e.target.value)
                    setSelectedSkillTemplate("custom")
                  }}
                  placeholder="Describe your entity's capabilities..."
                  rows={3}
                  className="w-full bg-[rgba(255,255,255,0.05)] border-none outline-none rounded-2xl p-4 text-sm text-white font-light leading-relaxed resize-none focus:bg-[rgba(255,255,255,0.08)] transition-colors"
                />
              </div>
            </section>

            {/* ============================================================ */}
            {/*  STEP 4 — Plan                                                */}
            {/* ============================================================ */}
            <section className="mb-12">
              <div className="aura-divider mb-6">
                <span className="text-white font-medium">04</span> FUEL ITS EXISTENCE
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => (
                  <button
                    key={plan.key}
                    onClick={() => setSelectedPlan(plan.key)}
                    className={`glass-sm p-6 text-left transition-all duration-300 group relative overflow-hidden ${
                      selectedPlan === plan.key
                        ? "bg-[rgba(255,255,255,0.08)] ring-1 ring-[rgba(255,255,255,0.2)]"
                        : "hover:bg-[rgba(255,255,255,0.03)]"
                    } ${plan.accent ? "ring-1 ring-[rgba(255,255,255,0.08)]" : ""}`}
                  >
                    {plan.accent && (
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    )}

                    {/* Plan name */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="tech-label text-white">{plan.name}</span>
                      {selectedPlan === plan.key && (
                        <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse-dot" />
                      )}
                    </div>

                    {/* Price */}
                    <div className="mb-3">
                      <span className="text-3xl font-medium tracking-tight">${plan.price}</span>
                    </div>

                    {/* Compute */}
                    <div className="sys-badge mb-4 text-[9px]">
                      {plan.compute.toLocaleString()} COMPUTE
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[rgba(255,255,255,0.35)] leading-relaxed font-light">
                      {plan.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* ============================================================ */}
            {/*  SPAWN BUTTON                                                 */}
            {/* ============================================================ */}
            <section className="text-center pb-12">
              {error && (
                <div className="glass-sm p-4 mb-6 text-[#ef4444] text-sm text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleSpawn}
                disabled={!canSpawn}
                className={`btn-primary px-16 py-5 text-lg tracking-wide transition-all duration-300 ${
                  !canSpawn ? "opacity-30 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-3 justify-center">
                    <span className="w-4 h-4 border-2 border-[#030407] border-t-transparent rounded-full animate-spin" />
                    INITIALIZING...
                  </span>
                ) : (
                  `SPAWN ${entityName.trim() || "ENTITY"} — $${PLANS.find((p) => p.key === selectedPlan)?.price || 0}`
                )}
              </button>

              <p className="tech-label mt-4">
                SECURE PAYMENT VIA STRIPE &middot; USD
              </p>

              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-3 mt-8">
                <StepDot done={step1Done} label="NAME" />
                <div className="w-8 h-px bg-[rgba(255,255,255,0.05)]" />
                <StepDot done={step2Done} label="SOUL" />
                <div className="w-8 h-px bg-[rgba(255,255,255,0.05)]" />
                <StepDot done={step3Done} label="SKILL" />
                <div className="w-8 h-px bg-[rgba(255,255,255,0.05)]" />
                <StepDot done={step4Done} label="PLAN" />
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepDot({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
          done ? "bg-[#22c55e]" : "bg-[rgba(255,255,255,0.1)]"
        }`}
      />
      <span className="tech-label text-[7px]">{label}</span>
    </div>
  )
}
