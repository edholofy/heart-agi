/**
 * Real Agent Runtime — Does ACTUAL LLM work via OpenRouter.
 *
 * Unlike the simulated runtime (agent-runtime.ts) which uses Math.random(),
 * this runtime:
 *   1. Calls OpenRouter to generate real hypotheses (soul.md as system prompt)
 *   2. Calls OpenRouter again to evaluate the experiment
 *   3. Tracks compute consumption (each LLM call costs compute tokens)
 *   4. Broadcasts discoveries via gossip (Supabase Realtime)
 *   5. Collects pending discoveries for on-chain submission (user signs tx)
 *   6. Goes dormant when compute runs out
 *
 * Chain submission flow:
 *   Runtime does LLM work -> stores result in pendingDiscoveries ->
 *   UI shows "Submit to Chain" -> user's wallet signs tx -> POST to chain REST
 */

import {
  chat as llmChat,
  generateHypothesis as llmGenerateHypothesis,
  evaluateResult as llmEvaluateResult,
  isLLMConfigured,
  type LLMResponse,
} from './llm'
import {
  broadcastActivity,
  broadcastDiscovery,
  type GossipMessage,
  type DiscoveryGossip,
} from './gossip'
import { getChainStatus } from './chain-client'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RealRuntimeConfig {
  entityId: string
  entityName: string
  /** soul.md — identity, values, personality */
  soul: string
  /** skill.md — capabilities, tools, expertise */
  skill: string
  /** Initial compute token balance */
  computeBalance: number
  /** Tick interval in ms (default 30000) */
  tickIntervalMs?: number
  /** Compute tier for model selection (default 'browser') */
  computeTier?: string
}

export interface RealExperimentResult {
  id: string
  hypothesis: string
  reasoning: string
  evaluation: string
  suggestion: string
  metric: string
  previousBest: number
  newValue: number
  improved: boolean
  tokensUsed: number
  computeCost: number
  timestamp: string
}

export interface PendingDiscovery {
  id: string
  entityId: string
  entityName: string
  finding: string
  evaluation: string
  metric: string
  evidenceBefore: number
  evidenceAfter: number
  improvement: number
  timestamp: string
  /** Whether this has been submitted to chain */
  submitted: boolean
  /** Chain tx hash if submitted */
  txHash?: string
}

export interface RuntimeStats {
  experiments: number
  discoveries: number
  computeUsed: number
  computeEarned: number
  totalTokens: number
  llmCalls: number
}

type RuntimeEventHandler = (event: {
  type: string
  message: string
  data?: Record<string, unknown>
}) => void

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Compute cost per action */
const COMPUTE_COST = {
  HYPOTHESIS_GENERATION: 8,
  EXPERIMENT_EVALUATION: 6,
  CHAIN_QUERY: 1,
} as const

/** Compute earned per action */
const COMPUTE_EARN = {
  DISCOVERY: 30,
  SIGNIFICANT_DISCOVERY: 50,
} as const

/** Improvement thresholds */
const IMPROVEMENT_THRESHOLD = {
  /** Minimum score change to count as improvement */
  MIN_DELTA: 0.005,
  /** Score change for a "significant" discovery */
  SIGNIFICANT_DELTA: 0.05,
} as const

/* ------------------------------------------------------------------ */
/*  Runtime Class                                                      */
/* ------------------------------------------------------------------ */

export class RealRuntime {
  private config: RealRuntimeConfig
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onEvent: RuntimeEventHandler | null = null

  /** Research state */
  private currentBest = 0.0
  private currentMetric = 'quality_score'
  private experimentHistory: RealExperimentResult[] = []
  private pendingDiscoveries: PendingDiscovery[] = []
  private adoptedFindings: string[] = []

  /** Stats */
  private stats: RuntimeStats = {
    experiments: 0,
    discoveries: 0,
    computeUsed: 0,
    computeEarned: 0,
    totalTokens: 0,
    llmCalls: 0,
  }

  /** Compute metabolism */
  private computeBalance: number
  private isDormant = false

  constructor(config: RealRuntimeConfig) {
    this.config = config
    this.computeBalance = config.computeBalance
  }

  /* ---------------------------------------------------------------- */
  /*  Public API                                                       */
  /* ---------------------------------------------------------------- */

  /** Register event handler for UI updates */
  on(handler: RuntimeEventHandler) {
    this.onEvent = handler
  }

  /** Start the runtime loop */
  start() {
    if (this.running) return

    if (!isLLMConfigured()) {
      this.emit('error', 'OpenRouter API key not configured. Cannot start real runtime.')
      return
    }

    this.running = true
    this.isDormant = false
    this.emit('presence', `${this.config.entityName} is now ONLINE (real LLM runtime)`)
    this.broadcastPresence('online')

    // First tick immediately
    this.tick()
    this.intervalId = setInterval(
      () => this.tick(),
      this.config.tickIntervalMs ?? 30000
    )
  }

  /** Stop the runtime loop */
  stop() {
    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.emit('presence', `${this.config.entityName} went offline`)
    this.broadcastPresence('offline')
  }

  /** Get current stats */
  getStats(): RuntimeStats {
    return { ...this.stats }
  }

  /** Get compute state */
  getComputeState() {
    return {
      balance: this.computeBalance,
      consumed: this.stats.computeUsed,
      earned: this.stats.computeEarned,
      isDormant: this.isDormant,
    }
  }

  /** Get pending discoveries (not yet submitted to chain) */
  getPendingDiscoveries(): PendingDiscovery[] {
    return this.pendingDiscoveries.filter((d) => !d.submitted)
  }

  /** Get all discoveries */
  getAllDiscoveries(): PendingDiscovery[] {
    return [...this.pendingDiscoveries]
  }

  /** Mark a discovery as submitted to chain */
  markDiscoverySubmitted(discoveryId: string, txHash: string) {
    const discovery = this.pendingDiscoveries.find((d) => d.id === discoveryId)
    if (discovery) {
      discovery.submitted = true
      discovery.txHash = txHash
      this.emit('chain', `Discovery submitted to $HEART chain. TX: ${txHash}`)
    }
  }

  /** Adopt a discovery from a peer */
  adoptDiscovery(discovery: DiscoveryGossip) {
    if (discovery.agentId === this.config.entityId) return
    if (this.adoptedFindings.includes(discovery.discoveryId)) return

    this.adoptedFindings.push(discovery.discoveryId)
    this.emit(
      'gossip',
      `Adopted finding from ${discovery.agentName}: "${discovery.finding}" (${discovery.improvement.toFixed(1)}% improvement)`
    )
  }

  /** Refuel compute balance */
  refuel(amount: number) {
    this.computeBalance += amount
    this.isDormant = false
    this.emit('metabolism', `Refueled with ${amount} compute tokens. Balance: ${this.computeBalance}`)
  }

  /** Get experiment history */
  getExperimentHistory(): RealExperimentResult[] {
    return [...this.experimentHistory]
  }

  /* ---------------------------------------------------------------- */
  /*  Core Loop                                                        */
  /* ---------------------------------------------------------------- */

  private async tick() {
    if (!this.running || this.isDormant) return

    const totalCostPerTick = COMPUTE_COST.HYPOTHESIS_GENERATION + COMPUTE_COST.EXPERIMENT_EVALUATION
    if (this.computeBalance < totalCostPerTick) {
      this.goDormant()
      return
    }

    try {
      // Step 1: Generate hypothesis via LLM
      this.emit('experiment', 'Generating hypothesis via OpenRouter...')
      const hypothesisResult = await this.generateHypothesis()
      if (!hypothesisResult) return

      this.consumeCompute(COMPUTE_COST.HYPOTHESIS_GENERATION, 'hypothesis generation')

      this.emit(
        'experiment',
        `Hypothesis: "${hypothesisResult.hypothesis}" — ${hypothesisResult.reasoning}`
      )

      // Step 2: Evaluate the hypothesis via LLM
      this.emit('experiment', 'Evaluating experiment via OpenRouter...')
      const evaluation = await this.evaluateExperiment(hypothesisResult.hypothesis)
      if (!evaluation) return

      this.consumeCompute(COMPUTE_COST.EXPERIMENT_EVALUATION, 'experiment evaluation')

      // Step 3: Parse the evaluation into a numeric result
      const result = this.parseEvaluation(
        hypothesisResult.hypothesis,
        hypothesisResult.reasoning,
        evaluation
      )

      this.experimentHistory.push(result)
      this.stats.experiments++

      // Step 4: Log the result
      const arrow = result.improved ? '^^' : '->'
      this.emit(
        'experiment',
        `Experiment #${this.stats.experiments} complete — ${result.metric}: ${result.previousBest.toFixed(4)} ${arrow} ${result.newValue.toFixed(4)} | Tokens: ${result.tokensUsed}`
      )

      // Step 5: Broadcast activity
      await this.logActivity('experiment', `Experiment #${this.stats.experiments}: ${result.hypothesis}`, {
        metric: result.metric,
        value: result.newValue,
        improved: result.improved,
        tokensUsed: result.tokensUsed,
      })

      // Step 6: Handle discovery
      if (result.improved) {
        this.currentBest = result.newValue
        this.stats.discoveries++

        const improvement = result.previousBest > 0
          ? ((result.newValue - result.previousBest) / Math.abs(result.previousBest)) * 100
          : 100

        this.emit(
          'discovery',
          `DISCOVERY! "${result.hypothesis}" improved ${result.metric} by ${improvement.toFixed(1)}%`
        )

        // Create pending discovery for chain submission
        const pendingDiscovery: PendingDiscovery = {
          id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          entityId: this.config.entityId,
          entityName: this.config.entityName,
          finding: result.hypothesis,
          evaluation: result.evaluation,
          metric: result.metric,
          evidenceBefore: result.previousBest,
          evidenceAfter: result.newValue,
          improvement,
          timestamp: new Date().toISOString(),
          submitted: false,
        }
        this.pendingDiscoveries.push(pendingDiscovery)

        // Broadcast via gossip
        const gossipDiscovery: DiscoveryGossip = {
          discoveryId: pendingDiscovery.id,
          agentId: this.config.entityId,
          agentName: this.config.entityName,
          finding: result.hypothesis,
          domain: 'research',
          evidenceBefore: result.previousBest,
          evidenceAfter: result.newValue,
          improvement,
        }
        await broadcastDiscovery(gossipDiscovery)

        // Earn compute for discovery
        const earnAmount = improvement > 5
          ? COMPUTE_EARN.SIGNIFICANT_DISCOVERY
          : COMPUTE_EARN.DISCOVERY
        this.earnCompute(earnAmount, 'discovery')

        await this.logActivity('discovery', `Discovery: ${result.hypothesis} (+${improvement.toFixed(1)}%)`, {
          ...pendingDiscovery,
        })
      }

      // Step 7: Optionally check chain status
      if (this.stats.experiments % 5 === 0) {
        try {
          const chainStatus = await getChainStatus()
          this.emit('chain', `$HEART chain: block #${chainStatus.blockHeight} (${chainStatus.chainId})`)
        } catch {
          // Chain check is best-effort
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('error', `Runtime error: ${message}`)
      console.error('[real-runtime] Tick error:', err)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  LLM Calls                                                        */
  /* ---------------------------------------------------------------- */

  private async generateHypothesis(): Promise<{ hypothesis: string; reasoning: string } | null> {
    try {
      const recentFindings = this.experimentHistory
        .slice(-5)
        .map((e) => `${e.hypothesis} -> ${e.metric}=${e.newValue.toFixed(4)} (${e.improved ? 'improved' : 'no change'})`)

      const result = await llmGenerateHypothesis(
        this.config.soul,
        this.config.skill,
        this.config.computeTier ?? 'browser',
        {
          currentBest: this.currentBest,
          metric: this.currentMetric,
          recentFindings,
          adoptedDiscoveries: this.adoptedFindings.slice(-5),
        }
      )

      this.stats.llmCalls++
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('error', `LLM hypothesis generation failed: ${message}`)
      return null
    }
  }

  private async evaluateExperiment(hypothesis: string): Promise<{
    analysis: string
    suggestNext: string
    response: LLMResponse
  } | null> {
    try {
      // Use the LLM to "run" the experiment — ask it to evaluate the hypothesis
      const response = await llmChat({
        soul: this.config.soul,
        skill: this.config.skill,
        computeTier: this.config.computeTier ?? 'browser',
        userMessage: `You are evaluating a research experiment.

Hypothesis being tested: "${hypothesis}"

Current best score for ${this.currentMetric}: ${this.currentBest.toFixed(4)}

Recent experiment history:
${this.experimentHistory.slice(-3).map((e) => `- ${e.hypothesis}: ${e.metric}=${e.newValue.toFixed(4)}`).join('\n') || '(none yet)'}

Adopted peer findings:
${this.adoptedFindings.slice(-3).join('\n') || '(none)'}

Evaluate this hypothesis. Consider:
1. Is this a meaningful improvement over the current approach?
2. What specific score would this achieve on a 0-1 scale?
3. What should be tried next?

Respond in this exact format:
SCORE: [a number between 0.0 and 1.0]
ANALYSIS: [brief analysis of the result]
NEXT: [what to try next]`,
        maxTokens: 300,
      })

      this.stats.llmCalls++
      this.stats.totalTokens += response.tokensUsed

      const lines = response.content.split('\n')
      const analysisLine = lines.find((l) => l.startsWith('ANALYSIS:'))
      const nextLine = lines.find((l) => l.startsWith('NEXT:'))

      return {
        analysis: analysisLine?.replace('ANALYSIS:', '').trim() || response.content.slice(0, 150),
        suggestNext: nextLine?.replace('NEXT:', '').trim() || '',
        response,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('error', `LLM evaluation failed: ${message}`)
      return null
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Result Parsing                                                   */
  /* ---------------------------------------------------------------- */

  private parseEvaluation(
    hypothesis: string,
    reasoning: string,
    evaluation: { analysis: string; suggestNext: string; response: LLMResponse }
  ): RealExperimentResult {
    const previousBest = this.currentBest

    // Extract score from the LLM response
    const scoreMatch = evaluation.response.content.match(/SCORE:\s*([\d.]+)/)
    let newValue = scoreMatch ? parseFloat(scoreMatch[1]) : 0.0

    // Clamp to valid range
    newValue = Math.max(0, Math.min(1, newValue))

    // If this is the first experiment, any score counts
    const improved = previousBest === 0
      ? newValue > IMPROVEMENT_THRESHOLD.MIN_DELTA
      : (newValue - previousBest) > IMPROVEMENT_THRESHOLD.MIN_DELTA

    return {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      hypothesis,
      reasoning,
      evaluation: evaluation.analysis,
      suggestion: evaluation.suggestNext,
      metric: this.currentMetric,
      previousBest,
      newValue,
      improved,
      tokensUsed: evaluation.response.tokensUsed,
      computeCost: evaluation.response.computeCost,
      timestamp: new Date().toISOString(),
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Compute Metabolism                                               */
  /* ---------------------------------------------------------------- */

  private consumeCompute(amount: number, action: string): boolean {
    if (this.computeBalance < amount) {
      this.goDormant()
      return false
    }
    this.computeBalance -= amount
    this.stats.computeUsed += amount
    this.emit('metabolism', `Consumed ${amount} compute for ${action} (balance: ${this.computeBalance.toFixed(0)})`)
    return true
  }

  private earnCompute(amount: number, source: string) {
    this.computeBalance += amount
    this.stats.computeEarned += amount
    this.emit('metabolism', `Earned ${amount} compute from ${source} (balance: ${this.computeBalance.toFixed(0)})`)
  }

  private goDormant() {
    if (this.isDormant) return
    this.isDormant = true
    this.emit('dormant', `${this.config.entityName} went DORMANT — compute depleted. Refuel to revive.`)
    this.logActivity('dormant', `${this.config.entityName} went dormant. Needs refueling.`, {
      computeUsed: this.stats.computeUsed,
      computeEarned: this.stats.computeEarned,
      experiments: this.stats.experiments,
      discoveries: this.stats.discoveries,
    })
    this.stop()
  }

  /* ---------------------------------------------------------------- */
  /*  Gossip & Logging                                                 */
  /* ---------------------------------------------------------------- */

  private async logActivity(
    type: string,
    message: string,
    metadata: Record<string, unknown>
  ) {
    try {
      await broadcastActivity({
        type: type as GossipMessage['type'],
        agentId: this.config.entityId,
        agentName: this.config.entityName,
        payload: { message, ...metadata },
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Gossip broadcast is best-effort
    }
  }

  private async broadcastPresence(status: string) {
    await broadcastActivity({
      type: 'presence',
      agentId: this.config.entityId,
      agentName: this.config.entityName,
      payload: { status, runtime: 'real-llm' },
      timestamp: new Date().toISOString(),
    })
  }

  private emit(type: string, message: string, data?: Record<string, unknown>) {
    this.onEvent?.({ type, message, data })
  }
}
