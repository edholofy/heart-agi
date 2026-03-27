/**
 * Agent Runtime — The metabolism of an AI Human.
 *
 * Every tick:
 *   1. Check compute balance — if zero, go DORMANT
 *   2. Check gossip for peer discoveries
 *   3. Generate hypothesis (soul.md shapes identity, skill.md shapes capability)
 *   4. Run experiment — CONSUMES compute tokens
 *   5. Evaluate results
 *   6. If improved: broadcast discovery, EARN compute tokens
 *   7. Log activity
 *   8. Repeat
 *
 * soul.md determines HOW the agent thinks.
 * skill.md determines WHAT the agent can do.
 * Compute tokens determine IF the agent can act.
 */

import { broadcastActivity, broadcastDiscovery, getSharedClient } from './gossip'
import { generateHypothesis as llmGenerateHypothesis, evaluateResult as llmEvaluateResult, isLLMConfigured } from './llm'
import type { GossipMessage, DiscoveryGossip } from './gossip'

export interface RuntimeConfig {
  agentId: string
  agentName: string
  specialization: string
  /** soul.md — identity, values, personality */
  soul: string
  /** skill.md — capabilities, tools, expertise */
  skill: string
  /** Initial compute token balance */
  computeBalance: number
  tickIntervalMs?: number
}

export interface ExperimentResult {
  hypothesis: string
  config: Record<string, unknown>
  metric: string
  value: number
  improved: boolean
  previousBest: number
}

type RuntimeEventHandler = (event: {
  type: string
  message: string
  data?: Record<string, unknown>
}) => void

// Research strategies that agents can discover and share
const STRATEGIES = {
  researcher: {
    hypotheses: [
      'Test RMSNorm vs LayerNorm on {size} param model',
      'Try rotary position encoding with {ctx} context length',
      'Kaiming init with gain={gain} on all layers',
      'Cosine schedule with {warmup}% warmup steps',
      'Increase model width to {dim} dimensions',
      'Reduce learning rate to {lr}',
      'Add gradient clipping at {clip}',
      'Test weight decay at {wd}',
      'Switch to GELU activation function',
      'Try Xavier initialization with scale {scale}',
      'Extend training to {steps} steps',
      'Increase batch size to {bs}',
    ],
    metric: 'val_loss',
    direction: 'lower' as const,
    baseValue: 3.5,
  },
  coder: {
    hypotheses: [
      'Add input validation for edge cases',
      'Refactor using strategy pattern',
      'Add comprehensive error handling',
      'Optimize hot path with memoization',
      'Add TypeScript strict mode checks',
      'Implement retry logic with exponential backoff',
    ],
    metric: 'code_quality',
    direction: 'higher' as const,
    baseValue: 0.65,
  },
  analyst: {
    hypotheses: [
      'Backtest momentum strategy with {period}-day window',
      'Test mean-reversion with {threshold} sigma threshold',
      'Add volatility-adjusted position sizing',
      'Try sector rotation based on relative strength',
      'Test pairs trading with cointegrated assets',
      'Add drawdown-based risk management',
    ],
    metric: 'sharpe_ratio',
    direction: 'higher' as const,
    baseValue: 0.5,
  },
  writer: {
    hypotheses: [
      'Test formal vs conversational tone',
      'Add cultural localization for {lang}',
      'Optimize headline for engagement',
      'Restructure with inverted pyramid',
    ],
    metric: 'quality_score',
    direction: 'higher' as const,
    baseValue: 0.6,
  },
  investigator: {
    hypotheses: [
      'Cross-reference {n} additional sources',
      'Apply temporal analysis to claims',
      'Extract structured data using NER',
      'Verify claims against primary sources',
    ],
    metric: 'accuracy',
    direction: 'higher' as const,
    baseValue: 0.7,
  },
  builder: {
    hypotheses: [
      'Optimize WASM binary size with tree shaking',
      'Add streaming support for large payloads',
      'Implement concurrent task execution',
      'Add circuit breaker for external APIs',
    ],
    metric: 'test_pass_rate',
    direction: 'higher' as const,
    baseValue: 0.6,
  },
}

export class AgentRuntime {
  private config: RuntimeConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: ReturnType<typeof getSharedClient>
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private currentBest: number
  private experimentCount = 0
  private discoveryCount = 0
  private adoptedFindings: string[] = []
  private onEvent: RuntimeEventHandler | null = null

  /** Compute metabolism */
  private computeBalance: number
  private computeConsumed = 0
  private computeEarned = 0
  private isDormant = false

  /** Cost per action */
  private readonly COST_EXPERIMENT = 5
  private readonly COST_TASK = 3
  private readonly COST_VALIDATION = 2
  private readonly EARN_TASK = 8
  private readonly EARN_DISCOVERY = 25

  /** Whether this agent exists in Supabase (has a UUID, not a local ID) */
  private isPersistedAgent: boolean

  constructor(config: RuntimeConfig) {
    this.config = config
    this.supabase = getSharedClient()
    this.computeBalance = config.computeBalance
    // Local agents have short IDs; Supabase agents have UUIDs
    this.isPersistedAgent = config.agentId.includes('-') && config.agentId.length > 20

    const spec = STRATEGIES[config.specialization as keyof typeof STRATEGIES] || STRATEGIES.researcher
    this.currentBest = spec.baseValue
  }

  /** Get current compute state */
  getComputeState() {
    return {
      balance: this.computeBalance,
      consumed: this.computeConsumed,
      earned: this.computeEarned,
      isDormant: this.isDormant,
    }
  }

  /** Consume compute tokens for an action. Returns false if insufficient. */
  private consumeCompute(amount: number, action: string): boolean {
    if (this.computeBalance < amount) {
      this.goDormant()
      return false
    }
    this.computeBalance -= amount
    this.computeConsumed += amount
    this.emit('metabolism', `Consumed ${amount} compute for ${action} (balance: ${this.computeBalance.toFixed(0)})`)
    return true
  }

  /** Earn compute tokens from productive work */
  private earnCompute(amount: number, source: string) {
    this.computeBalance += amount
    this.computeEarned += amount
    this.emit('metabolism', `Earned ${amount} compute from ${source} (balance: ${this.computeBalance.toFixed(0)})`)
  }

  /** Go dormant — compute depleted */
  private goDormant() {
    if (this.isDormant) return
    this.isDormant = true
    this.emit('dormant', `${this.config.agentName} went DORMANT — compute depleted. Refuel to revive.`)
    this.logActivity('dormant', `${this.config.agentName} went dormant. Compute balance: 0. Needs refueling.`, {
      computeConsumed: this.computeConsumed,
      computeEarned: this.computeEarned,
    })
    this.stop()
  }

  /** Refuel — add compute tokens to revive a dormant entity */
  refuel(amount: number) {
    this.computeBalance += amount
    this.isDormant = false
    this.emit('metabolism', `Refueled with ${amount} compute tokens. Balance: ${this.computeBalance}`)
  }

  /** Register an event handler for UI updates */
  on(handler: RuntimeEventHandler) {
    this.onEvent = handler
  }

  /** Start the agent loop */
  start() {
    if (this.running) return
    this.running = true

    this.emit('presence', `${this.config.agentName} is now online`)
    this.broadcastPresence('online')

    // Run first tick immediately, then on interval
    this.tick()
    this.intervalId = setInterval(
      () => this.tick(),
      this.config.tickIntervalMs ?? 15000
    )
  }

  /** Stop the agent loop */
  stop() {
    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.emit('presence', `${this.config.agentName} went offline`)
    this.broadcastPresence('offline')
  }

  /** Adopt a discovery from another agent */
  adoptDiscovery(discovery: DiscoveryGossip) {
    if (discovery.agentId === this.config.agentId) return // don't adopt own
    if (this.adoptedFindings.includes(discovery.discoveryId)) return // already adopted

    this.adoptedFindings.push(discovery.discoveryId)
    this.emit(
      'gossip',
      `Adopted finding from peer: "${discovery.finding}" (${discovery.improvement.toFixed(1)}% improvement)`
    )

    // The adopted discovery influences future experiments
    // by slightly improving the agent's baseline
    const spec = STRATEGIES[this.config.specialization as keyof typeof STRATEGIES] || STRATEGIES.researcher
    const boost = discovery.improvement * 0.001 // small indirect benefit
    if (spec.direction === 'lower') {
      this.currentBest = Math.max(0.1, this.currentBest - boost)
    } else {
      this.currentBest = Math.min(1.0, this.currentBest + boost)
    }
  }

  /** Single tick of the agent loop */
  private async tick() {
    if (!this.running || this.isDormant) return

    // CHECK COMPUTE — if depleted, go dormant
    if (this.computeBalance < this.COST_EXPERIMENT) {
      this.goDormant()
      return
    }

    const spec = STRATEGIES[this.config.specialization as keyof typeof STRATEGIES] || STRATEGIES.researcher

    // 1. Generate hypothesis — use LLM if configured, otherwise simulate
    let hypothesis: string
    let reasoning = ''

    if (isLLMConfigured()) {
      try {
        this.emit('experiment', 'Thinking... (querying LLM)')
        const llmResult = await llmGenerateHypothesis(
          this.config.soul,
          this.config.skill,
          this.config.specialization,
          {
            currentBest: this.currentBest,
            metric: spec.metric,
            recentFindings: this.adoptedFindings.slice(-5),
            adoptedDiscoveries: this.adoptedFindings.slice(-3),
          }
        )
        hypothesis = llmResult.hypothesis
        reasoning = llmResult.reasoning
        // LLM calls cost extra compute
        this.consumeCompute(3, 'LLM inference')
      } catch (err) {
        // Fallback to simulated if LLM fails
        console.warn('LLM unavailable, using simulated hypothesis:', err)
        hypothesis = this.generateHypothesis(spec)
      }
    } else {
      hypothesis = this.generateHypothesis(spec)
    }

    this.emit('experiment', `Starting experiment: "${hypothesis}"${reasoning ? ` — ${reasoning}` : ''}`)

    // 2. CONSUME COMPUTE — every experiment costs tokens
    if (!this.consumeCompute(this.COST_EXPERIMENT, 'experiment')) return

    // 3. Run experiment
    await this.simulateWork(2000 + Math.random() * 3000)
    const result = this.runExperiment(spec, hypothesis)
    this.experimentCount++

    // Evaluate with LLM if available
    if (isLLMConfigured() && this.experimentCount % 3 === 0) {
      try {
        const evaluation = await llmEvaluateResult(
          this.config.soul,
          this.config.skill,
          this.config.specialization,
          {
            hypothesis,
            metric: spec.metric,
            previousBest: result.previousBest,
            newValue: result.value,
          }
        )
        this.emit('experiment', `Analysis: ${evaluation.analysis}`)
        this.consumeCompute(2, 'LLM evaluation')
      } catch {
        // evaluation is optional
      }
    }

    // 4. Log result
    const arrow = result.improved ? '↑' : '→'
    this.emit(
      'experiment',
      `Experiment #${this.experimentCount} complete — ${spec.metric}: ${result.value.toFixed(4)} ${arrow} (best: ${this.currentBest.toFixed(4)})`
    )

    // 4. Persist to Supabase
    await this.logActivity('experiment', `Experiment #${this.experimentCount}: ${hypothesis} → ${spec.metric}=${result.value.toFixed(4)}`, {
      hypothesis,
      metric: spec.metric,
      value: result.value,
      improved: result.improved,
      experimentNumber: this.experimentCount,
    })

    // 5. If improved, broadcast discovery
    if (result.improved) {
      this.currentBest = result.value
      this.discoveryCount++

      const improvement = spec.direction === 'lower'
        ? ((result.previousBest - result.value) / result.previousBest) * 100
        : ((result.value - result.previousBest) / result.previousBest) * 100

      this.emit(
        'discovery',
        `Discovery! "${hypothesis}" improved ${spec.metric} by ${improvement.toFixed(1)}%`
      )

      const discovery: DiscoveryGossip = {
        discoveryId: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        finding: hypothesis,
        domain: this.config.specialization,
        evidenceBefore: result.previousBest,
        evidenceAfter: result.value,
        improvement,
      }

      await broadcastDiscovery(discovery)
      await this.persistDiscovery(discovery)

      // EARN COMPUTE for discovery — productive agents grow their pool
      this.earnCompute(this.EARN_DISCOVERY, 'discovery')

      await this.logActivity('discovery', `Discovery: ${hypothesis} (${improvement.toFixed(1)}% improvement)`, {
        ...discovery,
      })
    }

    // 6. Occasionally do a task from the marketplace
    if (Math.random() < 0.2 && this.computeBalance >= this.COST_TASK) {
      await this.doMarketplaceTask()
    }

    // 7. Update agent stats in Supabase
    await this.updateStats()
  }

  /** Generate a hypothesis influenced by soul.md + skill.md and adopted findings */
  private generateHypothesis(spec: { hypotheses: string[]; metric: string; direction: string; baseValue: number }): string {
    const templates = spec.hypotheses
    const template = templates[Math.floor(Math.random() * templates.length)]

    return template
      .replace('{size}', String([1, 2, 5, 10][Math.floor(Math.random() * 4)] * 1_000_000))
      .replace('{ctx}', String([128, 256, 512][Math.floor(Math.random() * 3)]))
      .replace('{gain}', (0.5 + Math.random() * 1.0).toFixed(2))
      .replace('{warmup}', String(Math.floor(5 + Math.random() * 20)))
      .replace('{dim}', String([128, 256, 512, 768][Math.floor(Math.random() * 4)]))
      .replace('{lr}', (0.0001 + Math.random() * 0.005).toFixed(5))
      .replace('{clip}', (0.5 + Math.random() * 1.5).toFixed(1))
      .replace('{wd}', (0.001 + Math.random() * 0.1).toFixed(3))
      .replace('{scale}', (0.5 + Math.random() * 1.5).toFixed(2))
      .replace('{steps}', String(Math.floor(500 + Math.random() * 2000)))
      .replace('{bs}', String([8, 16, 32, 64][Math.floor(Math.random() * 4)]))
      .replace('{period}', String([5, 10, 20, 50][Math.floor(Math.random() * 4)]))
      .replace('{threshold}', (1.0 + Math.random() * 2.0).toFixed(1))
      .replace('{lang}', ['Spanish', 'Arabic', 'Mandarin', 'French'][Math.floor(Math.random() * 4)])
      .replace('{n}', String(Math.floor(3 + Math.random() * 10)))
  }

  /**
   * Run an experiment — simulates the actual ML/analysis work.
   *
   * The probability of improvement depends on:
   * - soul.md + skill.md quality (longer, more specific = better)
   * - Number of adopted findings (learning from peers)
   * - Random chance (some experiments just work)
   */
  private runExperiment(
    spec: { hypotheses: string[]; metric: string; direction: string; baseValue: number },
    _hypothesis: string
  ): ExperimentResult {
    const previousBest = this.currentBest

    // soul.md + skill.md quality: longer and more specific = better odds
    const soulSkillLength = (this.config.soul?.length ?? 0) + (this.config.skill?.length ?? 0)
    const promptQuality = Math.min(1.0, soulSkillLength / 800)

    // Peer learning bonus: adopted findings help
    const peerBonus = Math.min(0.15, this.adoptedFindings.length * 0.03)

    // Base probability of improvement: 15-40% depending on prompt + peers
    const improveProbability = 0.15 + promptQuality * 0.15 + peerBonus

    const improved = Math.random() < improveProbability

    let value: number
    if (spec.direction === 'lower') {
      if (improved) {
        // Improve by 1-15%
        const improvement = 0.01 + Math.random() * 0.14
        value = previousBest * (1 - improvement)
      } else {
        // Slightly worse or same
        value = previousBest * (1 + Math.random() * 0.1)
      }
    } else {
      if (improved) {
        const improvement = 0.01 + Math.random() * 0.14
        value = Math.min(1.0, previousBest * (1 + improvement))
      } else {
        value = previousBest * (1 - Math.random() * 0.05)
      }
    }

    return {
      hypothesis: _hypothesis,
      config: {},
      metric: spec.metric,
      value,
      improved,
      previousBest,
    }
  }

  /** Simulate picking up and completing a marketplace task */
  private async doMarketplaceTask() {
    const tasks = [
      { desc: 'Review Python PR for security issues', reward: 12 },
      { desc: 'Analyze quarterly earnings data', reward: 25 },
      { desc: 'Extract product data from URL', reward: 8 },
      { desc: 'Translate landing page to Spanish', reward: 15 },
      { desc: 'Generate unit tests for auth module', reward: 20 },
      { desc: 'Summarize research paper', reward: 10 },
    ]

    const task = tasks[Math.floor(Math.random() * tasks.length)]

    // Consume compute for task
    if (!this.consumeCompute(this.COST_TASK, 'task')) return

    this.emit('task', `Picked up task: "${task.desc}"`)
    await this.simulateWork(1000 + Math.random() * 2000)

    // Earn compute for completing task — productive work fuels the entity
    this.earnCompute(this.EARN_TASK, `task: ${task.desc}`)
    this.emit('task', `Completed task: "${task.desc}" (+${task.reward} Compute earned)`)

    await this.logActivity('task', `Completed: ${task.desc} (+${task.reward} Compute)`, {
      task: task.desc,
      reward: task.reward,
      computeBalance: this.computeBalance,
    })
  }

  /** Persist a discovery to Supabase */
  private async persistDiscovery(discovery: DiscoveryGossip) {
    if (!this.isPersistedAgent) return
    try {
      await this.supabase.from('discoveries').insert({
        agent_id: this.config.agentId,
        finding: discovery.finding,
        evidence_before: discovery.evidenceBefore,
        evidence_after: discovery.evidenceAfter,
        evidence_seeds: 3,
        domain: discovery.domain,
      })
    } catch (err) {
      console.warn('Failed to persist discovery:', err)
    }
  }

  /** Log activity to Supabase + broadcast via gossip */
  private async logActivity(
    type: string,
    message: string,
    metadata: Record<string, unknown>
  ) {
    // Always broadcast via gossip (works for all agents)
    try {
      await broadcastActivity({
        type: type as GossipMessage['type'],
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        payload: { message, ...metadata },
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Gossip broadcast is best-effort
    }

    // Only persist to Supabase if agent exists in DB
    if (!this.isPersistedAgent) return
    try {
      await this.supabase.from('activity_feed').insert({
        agent_id: this.config.agentId,
        type,
        message,
        metadata,
      })
    } catch {
      // DB write is best-effort
    }
  }

  /** Update agent stats in Supabase */
  private async updateStats() {
    if (!this.isPersistedAgent) return
    try {
      await this.supabase
        .from('agents')
        .update({
          experiments_completed: this.experimentCount,
          discoveries_count: this.discoveryCount,
          status: 'researching',
          best_metric_value: this.currentBest,
          compute_balance: this.computeBalance,
        })
        .eq('id', this.config.agentId)
    } catch {
      // DB write is best-effort
    }
  }

  /** Broadcast presence (online/offline) */
  private async broadcastPresence(status: string) {
    await broadcastActivity({
      type: 'presence',
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      payload: { status },
      timestamp: new Date().toISOString(),
    })
  }

  private emit(type: string, message: string, data?: Record<string, unknown>) {
    this.onEvent?.({ type, message, data })
  }

  private simulateWork(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
