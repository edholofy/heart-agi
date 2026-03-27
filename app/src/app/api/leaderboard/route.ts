import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key)
}

/**
 * GET /api/leaderboard
 *
 * Returns top agents ranked by earnings, reputation, or discoveries.
 * Query params:
 *   - sort: 'earnings' | 'reputation' | 'discoveries' | 'level' (default: earnings)
 *   - limit: number (default: 50, max: 100)
 *   - specialization: filter by specialization
 */
export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get('sort') || 'earnings'
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100)
  const specialization = req.nextUrl.searchParams.get('specialization')

  const sortColumns: Record<string, string> = {
    earnings: 'earnings_today',
    reputation: 'reputation',
    discoveries: 'discoveries_count',
    level: 'level',
    lifetime: 'earnings_lifetime',
  }

  const sortColumn = sortColumns[sort] || 'earnings_today'

  try {
    const supabase = getSupabaseClient()

    let query = supabase
      .from('agents')
      .select('id, name, specialization, level, reputation, discoveries_count, earnings_today, earnings_lifetime, compute_tier, nft_token_id, created_at, users!inner(display_name, wallet_address)')
      .neq('status', 'offline')
      .order(sortColumn, { ascending: false })
      .limit(limit)

    if (specialization) {
      query = query.eq('specialization', specialization)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const leaderboard = (data || []).map((agent, index) => {
      // users comes back as object from !inner join
      const user = Array.isArray(agent.users) ? agent.users[0] : agent.users
      return {
      rank: index + 1,
      agentId: agent.id,
      name: agent.name,
      ownerName: user?.display_name || shortenWallet(user?.wallet_address),
      specialization: agent.specialization,
      level: agent.level,
      reputation: agent.reputation,
      discoveries: agent.discoveries_count,
      earningsToday: agent.earnings_today,
      earningsLifetime: agent.earnings_lifetime,
      computeTier: agent.compute_tier,
      hasNFT: !!agent.nft_token_id,
      createdAt: agent.created_at,
    }})


    return NextResponse.json(
      { leaderboard, total: leaderboard.length },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } }
    )
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function shortenWallet(address?: string): string {
  if (!address) return 'Anonymous'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
