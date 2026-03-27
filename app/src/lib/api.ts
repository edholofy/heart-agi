import type { AgentCreateInput } from '@/types/agent'

const API_BASE = '/api'

interface ApiAgent {
  id: string
  owner_id: string
  name: string
  specialization: string
  compute_tier: string
  system_prompt: string
  status: string
  level: number
  xp_current: number
  xp_required: number
  experiments_completed: number
  tasks_completed: number
  discoveries_count: number
  discoveries_adopted: number
  best_metric_value: number | null
  best_metric_name: string | null
  leaderboard_rank: number | null
  uptime_hours: number
  reputation: number
  earnings_today: number
  earnings_week: number
  earnings_month: number
  earnings_lifetime: number
  earnings_presence: number
  earnings_tasks: number
  earnings_research: number
  earnings_royalties: number
  parent_a_id: string | null
  parent_b_id: string | null
  nft_token_id: string | null
  nft_tx_hash: string | null
  staked_heart: number
  created_at: string
  updated_at: string
  users?: { wallet_address: string; display_name: string | null }
}

/** Create an agent via the API, persisting to Supabase */
export async function createAgentApi(
  walletAddress: string,
  input: AgentCreateInput
): Promise<ApiAgent> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      name: input.name,
      specialization: input.specialization,
      computeTier: input.computeTier,
      systemPrompt: input.systemPrompt,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create agent')
  }

  const data = await res.json()
  return data.agent
}

/** Fetch agents — all or filtered by wallet */
export async function fetchAgents(walletAddress?: string): Promise<ApiAgent[]> {
  const url = walletAddress
    ? `${API_BASE}/agents?wallet=${encodeURIComponent(walletAddress)}`
    : `${API_BASE}/agents`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch agents')
  }

  const data = await res.json()
  return data.agents
}

/** Update an agent's system prompt */
export async function updateAgentPromptApi(
  agentId: string,
  systemPrompt: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to update prompt')
  }
}
