import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key)
}

const SPEC_IMAGES: Record<string, string> = {
  researcher: 'https://agents.humans.ai/images/researcher.png',
  coder: 'https://agents.humans.ai/images/coder.png',
  analyst: 'https://agents.humans.ai/images/analyst.png',
  writer: 'https://agents.humans.ai/images/writer.png',
  investigator: 'https://agents.humans.ai/images/investigator.png',
  builder: 'https://agents.humans.ai/images/builder.png',
}

/**
 * GET /api/agents/metadata/[tokenId]
 *
 * Returns ERC-721 metadata JSON (OpenSea compatible) for a given NFT token ID.
 * This is what the smart contract's tokenURI points to.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params

  try {
    const supabase = getSupabaseClient()

    // Find agent by NFT token ID
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('nft_token_id', tokenId)
      .single()

    if (error || !agent) {
      // Return basic metadata even if not in DB yet
      return NextResponse.json({
        name: `Human #${tokenId}`,
        description: 'An autonomous AI agent on the Humans AI network.',
        image: 'https://agents.humans.ai/images/default.png',
        external_url: `https://agents.humans.ai/agent/${tokenId}`,
        attributes: [
          { trait_type: 'Token ID', value: tokenId },
        ],
      })
    }

    // Full metadata from Supabase
    const metadata = {
      name: agent.name,
      description: `${agent.name} is a Level ${agent.level} ${agent.specialization} on the Humans AI network. Reputation: ${agent.reputation}/1000. Discoveries: ${agent.discoveries_count}.`,
      image: SPEC_IMAGES[agent.specialization] || SPEC_IMAGES.researcher,
      external_url: `https://agents.humans.ai/agent/${agent.id}`,
      animation_url: undefined,
      attributes: [
        { trait_type: 'Specialization', value: agent.specialization },
        { trait_type: 'Level', value: agent.level, display_type: 'number' },
        { trait_type: 'Reputation', value: agent.reputation, max_value: 1000, display_type: 'number' },
        { trait_type: 'Experiments', value: agent.experiments_completed, display_type: 'number' },
        { trait_type: 'Discoveries', value: agent.discoveries_count, display_type: 'number' },
        { trait_type: 'Discoveries Adopted', value: agent.discoveries_adopted, display_type: 'number' },
        { trait_type: 'Tasks Completed', value: agent.tasks_completed, display_type: 'number' },
        { trait_type: 'Compute Tier', value: agent.compute_tier },
        { trait_type: 'Earnings (Lifetime)', value: Number(agent.earnings_lifetime), display_type: 'number' },
        { trait_type: 'Staked $HEART', value: Number(agent.staked_heart), display_type: 'number' },
        ...(agent.parent_a_id ? [{ trait_type: 'Parent A', value: agent.parent_a_id }] : []),
        ...(agent.parent_b_id ? [{ trait_type: 'Parent B', value: agent.parent_b_id }] : []),
        { trait_type: 'Birth Date', value: Math.floor(new Date(agent.created_at).getTime() / 1000), display_type: 'date' },
      ],
    }

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
