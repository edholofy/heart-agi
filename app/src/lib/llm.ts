/**
 * LLM Client — OpenRouter integration.
 *
 * Every AI Human uses this to think. The soul.md shapes the system prompt,
 * the skill.md shapes the available tools, and the model is selected
 * based on the agent's compute tier.
 *
 * OpenRouter gives us 400+ models through one OpenAI-compatible API.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/** Model tiers — cheaper models for lower compute tiers */
const MODELS: Record<string, string> = {
  browser: 'google/gemini-2.0-flash-lite-001',       // cheapest, fast
  gpu: 'anthropic/claude-sonnet-4',                   // mid-tier
  api: 'anthropic/claude-sonnet-4',                   // high quality
  hybrid: 'anthropic/claude-sonnet-4',                // best available
}

/** Cost per 1K tokens (approximate, in compute tokens) */
const COST_PER_1K: Record<string, number> = {
  browser: 0.5,
  gpu: 2,
  api: 3,
  hybrid: 2,
}

export interface LLMRequest {
  soul: string
  skill: string
  userMessage: string
  computeTier: string
  maxTokens?: number
}

export interface LLMResponse {
  content: string
  model: string
  tokensUsed: number
  computeCost: number
}

/**
 * Send a request to OpenRouter.
 * The soul.md becomes the system prompt.
 * Returns the LLM response with token/cost tracking.
 */
export async function chat(req: LLMRequest): Promise<LLMResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const model = MODELS[req.computeTier] || MODELS.browser
  const systemPrompt = `${req.soul}\n\n---\n\n${req.skill}`

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://agents.humans.ai',
      'X-Title': '$HEART Autonomous Blockchain',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: req.userMessage },
      ],
      max_tokens: req.maxTokens ?? 500,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(err.error?.message || err.error || `LLM request failed: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const tokensUsed = (data.usage?.total_tokens) || 0
  const costPer1k = COST_PER_1K[req.computeTier] || 1
  const computeCost = Math.ceil((tokensUsed / 1000) * costPer1k)

  return {
    content,
    model,
    tokensUsed,
    computeCost,
  }
}

/**
 * Generate a research hypothesis using the LLM.
 * The agent's soul shapes its research approach.
 */
export async function generateHypothesis(
  soul: string,
  skill: string,
  computeTier: string,
  context: {
    currentBest: number
    metric: string
    recentFindings: string[]
    adoptedDiscoveries: string[]
  }
): Promise<{ hypothesis: string; reasoning: string }> {
  const contextStr = [
    `Current best ${context.metric}: ${context.currentBest.toFixed(4)}`,
    context.recentFindings.length > 0
      ? `Recent findings:\n${context.recentFindings.map(f => `- ${f}`).join('\n')}`
      : '',
    context.adoptedDiscoveries.length > 0
      ? `Adopted from peers:\n${context.adoptedDiscoveries.map(d => `- ${d}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const response = await chat({
    soul,
    skill,
    computeTier,
    userMessage: `Based on the current research state, generate ONE specific hypothesis to test next.

${contextStr}

Respond in this exact format:
HYPOTHESIS: [your specific, testable hypothesis]
REASONING: [why you think this will improve the metric]`,
    maxTokens: 300,
  })

  const lines = response.content.split('\n')
  const hypothesisLine = lines.find(l => l.startsWith('HYPOTHESIS:'))
  const reasoningLine = lines.find(l => l.startsWith('REASONING:'))

  return {
    hypothesis: hypothesisLine?.replace('HYPOTHESIS:', '').trim() || response.content.slice(0, 100),
    reasoning: reasoningLine?.replace('REASONING:', '').trim() || '',
  }
}

/**
 * Evaluate an experiment result using the LLM.
 */
export async function evaluateResult(
  soul: string,
  skill: string,
  computeTier: string,
  context: {
    hypothesis: string
    metric: string
    previousBest: number
    newValue: number
  }
): Promise<{ analysis: string; suggestNext: string }> {
  const improved = context.metric === 'val_loss'
    ? context.newValue < context.previousBest
    : context.newValue > context.previousBest

  const response = await chat({
    soul,
    skill,
    computeTier,
    userMessage: `Analyze this experiment result:
Hypothesis: ${context.hypothesis}
Metric (${context.metric}): ${context.previousBest.toFixed(4)} → ${context.newValue.toFixed(4)} (${improved ? 'IMPROVED' : 'no improvement'})

Respond in this exact format:
ANALYSIS: [brief analysis of what happened]
NEXT: [what to try next based on this result]`,
    maxTokens: 200,
  })

  const lines = response.content.split('\n')
  const analysisLine = lines.find(l => l.startsWith('ANALYSIS:'))
  const nextLine = lines.find(l => l.startsWith('NEXT:'))

  return {
    analysis: analysisLine?.replace('ANALYSIS:', '').trim() || response.content.slice(0, 100),
    suggestNext: nextLine?.replace('NEXT:', '').trim() || '',
  }
}

/** Get the API key — server-side env or client-side fallback */
function getApiKey(): string | null {
  // Server-side
  if (typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY
  }
  // Client-side (passed through Next.js public env)
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OPENROUTER_API_KEY) {
    return process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
  }
  return null
}

/** Check if LLM is configured */
export function isLLMConfigured(): boolean {
  return getApiKey() !== null
}
