/**
 * Agent Runtime — The brain of a Human.
 *
 * Runs in the browser as a loop:
 *   1. Check gossip for new discoveries from peers
 *   2. Generate a hypothesis (based on prompt + peer findings)
 *   3. Run an experiment (simulated for now, real when GPU connected)
 *   4. Evaluate results
 *   5. If improved: broadcast discovery to network
 *   6. Log activity
 *   7. Wait, then repeat
 *
 * The system prompt shapes every decision the agent makes.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { broadcastActivity, broadcastDiscovery } from './gossip'
import type { GossipMessage, DiscoveryGossip } from './gossip'

export interface RuntimeConfig {
  agentId: string
  agentName: string
  specialization: string
  systemPrompt: string
  supabaseUrl: string
  supabaseKey: string
  tickIntervalMs?: number // how often the agent acts (default 15s)
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
  private supabase: SupabaseClient<any, 'public', any>
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private currentBest: number
  private experimentCount = 0
  private discoveryCount = 0
  private adoptedFindings: string[] = []
  private onEvent: RuntimeEventHandler | null = null

  constructor(config: RuntimeConfig) {
    this.config = config
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey)

    const spec = STRATEGIES[config.specialization as keyof typeof STRATEGIES] || STRATEGIES.researcher
    this.currentBest = spec.baseValue
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
    if (!this.running) return

    const spec = STRATEGIES[this.config.specialization as keyof typeof STRATEGIES] || STRATEGIES.researcher

    // 1. Generate hypothesis
    const hypothesis = this.generateHypothesis(spec)
    this.emit('experiment', `Starting experiment: "${hypothesis}"`)

    // 2. Run experiment (simulated — the actual work)
    await this.simulateWork(2000 + Math.random() * 3000)
    const result = this.runExperiment(spec, hypothesis)
    this.experimentCount++

    // 3. Log result
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

      await this.logActivity('discovery', `Discovery: ${hypothesis} (${improvement.toFixed(1)}% improvement)`, {
        ...discovery,
      })
    }

    // 6. Occasionally do a task from the marketplace
    if (Math.random() < 0.2) {
      await this.doMarketplaceTask()
    }

    // 7. Update agent stats in Supabase
    await this.updateStats()
  }

  /** Generate a hypothesis influenced by system prompt and adopted findings */
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
   * - System prompt quality (longer, more specific = better)
   * - Number of adopted findings (learning from peers)
   * - Random chance (some experiments just work)
   */
  private runExperiment(
    spec: { hypotheses: string[]; metric: string; direction: string; baseValue: number },
    _hypothesis: string
  ): ExperimentResult {
    const previousBest = this.currentBest

    // System prompt quality: longer and more specific = better odds
    const promptQuality = Math.min(1.0, this.config.systemPrompt.length / 500)

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

    this.emit('task', `Picked up task: "${task.desc}"`)
    await this.simulateWork(1000 + Math.random() * 2000)
    this.emit('task', `Completed task: "${task.desc}" (+${task.reward} $HEART)`)

    await this.logActivity('task', `Completed: ${task.desc} (+${task.reward} $HEART)`, {
      task: task.desc,
      reward: task.reward,
    })
  }

  /** Persist a discovery to Supabase */
  private async persistDiscovery(discovery: DiscoveryGossip) {
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
    try {
      await this.supabase.from('activity_feed').insert({
        agent_id: this.config.agentId,
        type,
        message,
        metadata,
      })

      await broadcastActivity({
        type: type as GossipMessage['type'],
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        payload: { message, ...metadata },
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Failed to log activity:', err)
    }
  }

  /** Update agent stats in Supabase */
  private async updateStats() {
    try {
      await this.supabase
        .from('agents')
        .update({
          experiments_completed: this.experimentCount,
          discoveries_count: this.discoveryCount,
          status: 'researching',
          best_metric_value: this.currentBest,
        })
        .eq('id', this.config.agentId)
    } catch (err) {
      console.warn('Failed to update stats:', err)
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
