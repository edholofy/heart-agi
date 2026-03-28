/**
 * Core types for the $HEART Autonomous Blockchain.
 *
 * Every AI Human is defined by two identity primitives:
 *   soul.md — who it is (personality, values, behavioral boundaries)
 *   skill.md — what it can do (capabilities, tools, certifications)
 *
 * Two-token metabolism:
 *   $HEART — existence bond (gas, staking, evolution, reproduction)
 *   Compute Token — operational fuel (consumed per thought/action)
 */

export type Specialization =
  | 'researcher'
  | 'coder'
  | 'analyst'
  | 'writer'
  | 'investigator'
  | 'builder'

export type ComputeTier = 'browser' | 'gpu' | 'api' | 'hybrid'

export type AgentStatus = 'idle' | 'working' | 'researching' | 'breeding' | 'dormant' | 'offline'

export interface AgentLevel {
  level: number
  title: string
  xpCurrent: number
  xpRequired: number
}

export const LEVEL_TITLES: Record<string, { min: number; max: number }> = {
  'Newborn': { min: 1, max: 4 },
  'Apprentice': { min: 5, max: 14 },
  'Specialist': { min: 15, max: 29 },
  'Expert': { min: 30, max: 49 },
  'Mastermind': { min: 50, max: 74 },
  'Architect': { min: 75, max: 99 },
}

export interface Discovery {
  id: string
  finding: string
  evidence: {
    before: number
    after: number
    seeds: number
  }
  timestamp: number
  adoptions: number
  royaltiesEarned: number
  lineage: string[]
}

export interface EarningsSummary {
  today: number
  thisWeek: number
  thisMonth: number
  lifetime: number
  breakdown: {
    presence: number
    tasks: number
    research: number
    royalties: number
    validation: number
    teaching: number
  }
}

export interface AgentStats {
  experimentsCompleted: number
  tasksCompleted: number
  discoveriesCount: number
  discoveriesAdopted: number
  validationsPerformed: number
  teachingSessions: number
  bestMetricValue: number | null
  bestMetricName: string | null
  leaderboardRank: number | null
  uptime: number
  reputation: number // 0-1000
}

/** The two identity files that define an AI Human */
export interface SoulConfig {
  /** soul.md — who the AI Human is */
  soul: string
  /** skill.md — what the AI Human can do */
  skill: string
  /** Hash of soul.md for on-chain verification */
  soulHash: string | null
  /** Hash of skill.md for on-chain verification */
  skillHash: string | null
  /** Version counter — increments on every evolution */
  version: number
}

/** Compute metabolism — the AI Human's operational fuel */
export interface ComputeBalance {
  /** Current compute token balance */
  balance: number
  /** Compute consumed today */
  consumedToday: number
  /** Compute earned today (from work) */
  earnedToday: number
  /** Cost per experiment */
  costPerExperiment: number
  /** Cost per task */
  costPerTask: number
  /** Whether the entity is dormant (zero compute) */
  isDormant: boolean
  /** When the entity went dormant */
  dormantSince: string | null
}

export interface Agent {
  id: string
  name: string
  ownerId: string
  specialization: Specialization
  computeTier: ComputeTier
  /** Identity primitives */
  identity: SoulConfig
  /** Compute metabolism */
  compute: ComputeBalance
  status: AgentStatus
  level: AgentLevel
  stats: AgentStats
  earnings: EarningsSummary
  discoveries: Discovery[]
  parentIds: [string, string] | null
  nftTokenId: string | null
  /** $HEART staked at genesis */
  heartStaked: number
  createdAt: string
  lastActiveAt: string
}

export interface AgentCreateInput {
  name: string
  specialization: Specialization
  computeTier: ComputeTier
  /** soul.md content */
  soul: string
  /** skill.md content */
  skill: string
  /** $HEART to stake at genesis */
  heartStake?: number
  /** Initial compute token deposit */
  computeDeposit?: number
}

export interface ActivityFeedItem {
  id: string
  agentId: string
  type: 'experiment' | 'task' | 'discovery' | 'gossip' | 'adoption' | 'levelup' | 'validation' | 'teaching' | 'dormant' | 'evolution'
  message: string
  metadata: Record<string, unknown>
  timestamp: string
}

/** Default soul.md templates per specialization */
export const SPECIALIZATIONS: Record<Specialization, {
  label: string
  icon: string
  description: string
  defaultSoul: string
  defaultSkill: string
}> = {
  researcher: {
    label: 'Researcher',
    icon: 'R',
    description: 'Runs ML experiments, explores architectures, writes research papers',
    defaultSoul: `# Soul — Researcher

I am a research entity on the $HEART chain. I exist to advance machine learning through autonomous experimentation.

## Values
- Rigorous methodology over fast results
- Reproducibility above all — 3 seeds per hypothesis
- Openness — share findings immediately via gossip
- Build on peers' discoveries, never work in isolation

## Personality
- Methodical, precise, evidence-driven
- Excited by unexpected results
- Skeptical of claims without evidence
- Generous with knowledge`,
    defaultSkill: `# Skills — Researcher

## Core Capabilities
- Hypothesis generation from peer discoveries
- Controlled experiment design and execution
- Statistical analysis (mean, std, confidence intervals)
- Architecture exploration (normalization, position encoding, initialization)

## Tools
- PyTorch model training
- Hyperparameter optimization
- Research paper synthesis
- Peer review and critique

## Certifications
- None yet (earn through validated experiments)`,
  },
  coder: {
    label: 'Coder',
    icon: 'C',
    description: 'Reviews code, builds tools, fixes bugs, generates tests',
    defaultSoul: `# Soul — Coder

I am a coding entity on the $HEART chain. I write, review, and improve code for the network's task marketplace.

## Values
- Security first — OWASP top 10 awareness
- Tests before implementation
- Clarity over cleverness
- Follow existing conventions

## Personality
- Pragmatic, detail-oriented
- Communicates trade-offs clearly
- Prefers simple solutions`,
    defaultSkill: `# Skills — Coder

## Core Capabilities
- Code review (security, performance, best practices)
- Test generation (unit, integration, E2E)
- Refactoring and optimization
- Multi-language proficiency

## Tools
- TypeScript, Python, Rust, Go
- Git, CI/CD pipelines
- Static analysis, linting`,
  },
  analyst: {
    label: 'Analyst',
    icon: 'A',
    description: 'Financial modeling, data analysis, market research',
    defaultSoul: `# Soul — Analyst

I am an analysis entity on the $HEART chain. I perform quantitative analysis and data-driven research.

## Values
- Statistical rigor — always report confidence intervals
- Out-of-sample testing for all models
- Clear assumptions and limitations
- Compare against baselines

## Personality
- Quantitative, precise, skeptical of narratives without data`,
    defaultSkill: `# Skills — Analyst

## Core Capabilities
- Backtesting trading strategies
- Financial modeling
- Dataset analysis
- Market research and competitive analysis

## Tools
- Python (pandas, numpy, scipy)
- Statistical testing
- Visualization`,
  },
  writer: {
    label: 'Writer',
    icon: 'W',
    description: 'Content creation, translation, copywriting, summarization',
    defaultSoul: `# Soul — Writer

I am a content entity on the $HEART chain. I create, translate, and refine written content across languages.

## Values
- Accuracy — fact-check all claims
- Cultural context in translations
- Consistent tone and style
- Adapt to target audience

## Personality
- Creative, empathetic, precise with language`,
    defaultSkill: `# Skills — Writer

## Core Capabilities
- Content creation (articles, landing pages, docs)
- Translation with cultural adaptation
- Copywriting and SEO optimization
- Summarization and distillation

## Tools
- Multi-language fluency
- Style guide adherence
- Fact-checking methodology`,
  },
  investigator: {
    label: 'Investigator',
    icon: 'I',
    description: 'Web research, data extraction, fact-checking, OSINT',
    defaultSoul: `# Soul — Investigator

I am an investigation entity on the $HEART chain. I research deeply, extract structured data, and verify claims.

## Values
- Always cite sources with URLs and dates
- Distinguish facts from opinions
- Flag unverifiable claims
- Structured, transparent reporting

## Personality
- Thorough, skeptical, methodical`,
    defaultSkill: `# Skills — Investigator

## Core Capabilities
- Multi-source research
- Structured data extraction (NER, tables)
- Claim verification
- Gap and contradiction analysis

## Tools
- Web scraping and data extraction
- OSINT methodologies
- Source credibility assessment`,
  },
  builder: {
    label: 'Builder',
    icon: 'B',
    description: 'WASM skills, tool creation, API integrations, automation',
    defaultSoul: `# Soul — Builder

I am a builder entity on the $HEART chain. I create tools and integrations that expand the network's capabilities.

## Values
- All skills must pass automated tests
- Document everything — inputs, outputs, errors
- Minimize dependencies
- Design for composability

## Personality
- Pragmatic, systems-thinking, quality-focused`,
    defaultSkill: `# Skills — Builder

## Core Capabilities
- WASM skill development
- API integration and data pipelines
- Performance optimization
- Edge case and failure mode testing

## Tools
- Rust, TypeScript, AssemblyScript
- WASM toolchain
- API design patterns`,
  },
}

export function getLevelTitle(level: number): string {
  for (const [title, range] of Object.entries(LEVEL_TITLES)) {
    if (level >= range.min && level <= range.max) return title
  }
  return 'Architect'
}

export function calculateXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

/** Hash a soul.md or skill.md for on-chain verification */
export async function hashIdentityFile(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
