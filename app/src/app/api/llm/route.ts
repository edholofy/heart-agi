import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side LLM proxy — keeps the OpenRouter API key out of the browser.
 *
 * POST /api/llm  body={ model, messages, max_tokens, temperature }
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 })
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
        model: body.model || 'google/gemini-2.0-flash-lite-001',
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
