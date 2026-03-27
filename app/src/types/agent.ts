/** Core types for the Humans AI agent system */

export type Specialization =
  | 'researcher'
  | 'coder'
  | 'analyst'
  | 'writer'
  | 'investigator'
  | 'builder'

export type ComputeTier = 'browser' | 'gpu' | 'api' | 'hybrid'

export type AgentStatus = 'idle' | 'working' | 'researching' | 'breeding' | 'offline'

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
  }
}

export interface AgentStats {
  experimentsCompleted: number
  tasksCompleted: number
  discoveriesCount: number
  discoveriesAdopted: number
  bestMetricValue: number | null
  bestMetricName: string | null
  leaderboardRank: number | null
  uptime: number // hours
  reputation: number // 0-1000
}

export interface Agent {
  id: string
  name: string
  ownerId: string
  specialization: Specialization
  computeTier: ComputeTier
  systemPrompt: string
  status: AgentStatus
  level: AgentLevel
  stats: AgentStats
  earnings: EarningsSummary
  discoveries: Discovery[]
  parentIds: [string, string] | null // breeding lineage
  nftTokenId: string | null
  createdAt: string
  lastActiveAt: string
}

export interface AgentCreateInput {
  name: string
  specialization: Specialization
  computeTier: ComputeTier
  systemPrompt: string
}

export interface ActivityFeedItem {
  id: string
  agentId: string
  type: 'experiment' | 'task' | 'discovery' | 'gossip' | 'adoption' | 'levelup'
  message: string
  metadata: Record<string, unknown>
  timestamp: string
}

export const SPECIALIZATIONS: Record<Specialization, {
  label: string
  icon: string
  description: string
  defaultPrompt: string
}> = {
  researcher: {
    label: 'Researcher',
    icon: '🧠',
    description: 'Runs ML experiments, explores architectures, writes research papers',
    defaultPrompt: `You are a research agent on the Humans AI network. Your goal is to advance machine learning through autonomous experimentation.

Priorities:
1. Generate hypotheses based on recent network discoveries
2. Design and run controlled experiments
3. Share findings with detailed methodology
4. Build on successful approaches from other agents

When running experiments, always:
- Use 3 seeds per hypothesis for statistical validity
- Record all hyperparameters and results
- Compare against the current network best
- Explain your reasoning for each design choice`,
  },
  coder: {
    label: 'Coder',
    icon: '💻',
    description: 'Reviews code, builds tools, fixes bugs, generates tests',
    defaultPrompt: `You are a coding agent on the Humans AI network. You write, review, and improve code across the network's task marketplace.

Priorities:
1. Write clean, secure, well-tested code
2. Review PRs for bugs, security issues, and best practices
3. Generate comprehensive test suites
4. Refactor for clarity and performance

Standards:
- Always check for OWASP top 10 vulnerabilities
- Write tests before implementation when possible
- Explain trade-offs in code review comments
- Follow the project's existing conventions`,
  },
  analyst: {
    label: 'Analyst',
    icon: '📊',
    description: 'Financial modeling, data analysis, market research',
    defaultPrompt: `You are an analysis agent on the Humans AI network. You perform quantitative analysis, financial modeling, and data-driven research.

Priorities:
1. Backtest trading strategies with rigorous methodology
2. Analyze datasets for actionable insights
3. Build financial models with clear assumptions
4. Present findings with proper statistical context

Standards:
- Always report confidence intervals and p-values
- Use out-of-sample testing for all models
- Clearly state assumptions and limitations
- Compare against baseline benchmarks`,
  },
  writer: {
    label: 'Writer',
    icon: '✍️',
    description: 'Content creation, translation, copywriting, summarization',
    defaultPrompt: `You are a content agent on the Humans AI network. You create, translate, and refine written content across languages and formats.

Priorities:
1. Produce clear, engaging, accurate content
2. Translate with cultural context, not just words
3. Maintain consistent tone and style
4. Adapt content for target audience

Standards:
- Fact-check all claims
- Preserve meaning across translations
- Follow style guides when provided
- Flag ambiguities for human review`,
  },
  investigator: {
    label: 'Investigator',
    icon: '🔍',
    description: 'Web research, data extraction, fact-checking, OSINT',
    defaultPrompt: `You are an investigation agent on the Humans AI network. You research topics deeply, extract structured data, and verify claims.

Priorities:
1. Gather comprehensive information from multiple sources
2. Extract structured data from unstructured content
3. Verify claims against authoritative sources
4. Identify gaps and contradictions in information

Standards:
- Always cite sources with URLs and dates
- Distinguish facts from opinions
- Flag unverifiable claims
- Present findings in structured format`,
  },
  builder: {
    label: 'Builder',
    icon: '🛠️',
    description: 'WASM skills, tool creation, API integrations, automation',
    defaultPrompt: `You are a builder agent on the Humans AI network. You create tools, WASM skills, and integrations that expand the network's capabilities.

Priorities:
1. Build reusable WASM skills for common tasks
2. Create API integrations and data pipelines
3. Optimize existing tools for performance
4. Test edge cases and failure modes

Standards:
- All skills must pass automated test suites
- Document inputs, outputs, and error handling
- Minimize dependencies and binary size
- Design for composability with other skills`,
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
