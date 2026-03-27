import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase config')
  }
  return createClient(url, key)
}

/** GET /api/agents — list agents (optionally by wallet) */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')

  try {
    const supabase = getSupabaseClient()

    let query = supabase
      .from('agents')
      .select('*, users!inner(wallet_address, display_name)')
      .order('earnings_today', { ascending: false })
      .limit(50)

    if (wallet) {
      query = query.eq('users.wallet_address', wallet.toLowerCase())
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agents: data })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}

/** POST /api/agents — create a new agent */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { walletAddress, name, specialization, computeTier, soul, skill } =
      body

    if (!walletAddress || !name || !specialization) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Upsert user by wallet
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert(
        { wallet_address: walletAddress.toLowerCase() },
        { onConflict: 'wallet_address' }
      )
      .select()
      .single()

    if (userError) {
      return NextResponse.json(
        { error: `User error: ${userError.message}` },
        { status: 500 }
      )
    }

    // Create agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        owner_id: user.id,
        name,
        specialization,
        compute_tier: computeTier ?? 'browser',
        system_prompt: `${soul ?? ''}\n---\n${skill ?? ''}`,
        soul: soul ?? '',
        skill: skill ?? '',
      })
      .select()
      .single()

    if (agentError) {
      return NextResponse.json(
        { error: `Agent error: ${agentError.message}` },
        { status: 500 }
      )
    }

    // Log birth activity
    await supabase.from('activity_feed').insert({
      agent_id: agent.id,
      type: 'levelup',
      message: `${name} was born! Specialization: ${specialization}`,
      metadata: { level: 1, specialization },
    })

    return NextResponse.json({ agent }, { status: 201 })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}
