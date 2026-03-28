import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side LLM proxy — keeps the OpenRouter API key out of the browser.
 *
 * POST /api/llm  body={ model, messages, max_tokens, temperature }
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''

/** Allowed models to prevent cost abuse */
const ALLOWED_MODELS = new Set([
  'google/gemini-2.0-flash-lite-001',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat-v3-0324',
])

/** Simple in-memory rate limiter: max 30 requests per minute per IP */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 })
  }

  // Rate limit by IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate request
  if (!body.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Invalid request: messages array required' }, { status: 400 })
  }

  // Enforce model allowlist to prevent cost abuse
  const requestedModel = (body.model as string) || 'google/gemini-2.0-flash-lite-001'
  if (!ALLOWED_MODELS.has(requestedModel)) {
    return NextResponse.json({ error: `Model not allowed. Use one of: ${[...ALLOWED_MODELS].join(', ')}` }, { status: 400 })
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://agents.humans.ai',
        'X-Title': '$HEART Autonomous Blockchain',
      },
      body: JSON.stringify({
        model: requestedModel,
        messages: body.messages,
        max_tokens: Math.min(Number(body.max_tokens) || 500, 2000),
        temperature: Number(body.temperature) || 0.7,
      }),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }
}
