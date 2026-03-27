import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Agent,
  AgentCreateInput,
  AgentStatus,
  ActivityFeedItem,
  Specialization,
} from '@/types/agent'
import { calculateXpForLevel, getLevelTitle } from '@/types/agent'
import type { WalletState } from '@/lib/wallet'
import { INITIAL_WALLET_STATE } from '@/lib/wallet'

interface NetworkStats {
  totalAgents: number
  totalExperiments: number
  totalDiscoveries: number
  activeDomains: number
  heartBurned24h: number
  heartEmitted24h: number
}

interface LeaderboardEntry {
  agentId: string
  agentName: string
  ownerName: string
  specialization: Specialization
  level: number
  metricValue: number
  metricName: string
  rank: number
  earningsToday: number
}

interface AppStore {
  // Wallet
  wallet: WalletState
  setWallet: (wallet: WalletState) => void

  // Agents
  agents: Agent[]
  selectedAgentId: string | null
  selectAgent: (id: string) => void
  createAgent: (input: AgentCreateInput) => Agent
  updateSystemPrompt: (agentId: string, prompt: string) => void
  updateAgentStatus: (agentId: string, status: AgentStatus) => void

  // Activity feed
  activityFeed: ActivityFeedItem[]
  addActivity: (item: Omit<ActivityFeedItem, 'id' | 'timestamp'>) => void

  // Network
  networkStats: NetworkStats

  // Leaderboard
  leaderboard: LeaderboardEntry[]

  // Supabase sync status
  synced: boolean
  setSynced: (synced: boolean) => void
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function createDefaultAgent(input: AgentCreateInput, ownerId: string): Agent {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: input.name,
    ownerId,
    specialization: input.specialization,
    computeTier: input.computeTier,
    systemPrompt: input.systemPrompt,
    status: 'idle',
    level: {
      level: 1,
      title: getLevelTitle(1),
      xpCurrent: 0,
      xpRequired: calculateXpForLevel(1),
    },
    stats: {
      experimentsCompleted: 0,
      tasksCompleted: 0,
      discoveriesCount: 0,
      discoveriesAdopted: 0,
      bestMetricValue: null,
      bestMetricName: null,
      leaderboardRank: null,
      uptime: 0,
      reputation: 100,
    },
    earnings: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      lifetime: 0,
      breakdown: {
        presence: 0,
        tasks: 0,
        research: 0,
        royalties: 0,
      },
    },
    discoveries: [],
    parentIds: null,
    nftTokenId: null,
    createdAt: now,
    lastActiveAt: now,
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Wallet
      wallet: INITIAL_WALLET_STATE,
      setWallet: (wallet) => set({ wallet }),

      // Agents
      agents: [],
      selectedAgentId: null,
      activityFeed: [],
      networkStats: {
        totalAgents: 1247,
        totalExperiments: 48392,
        totalDiscoveries: 834,
        activeDomains: 5,
        heartBurned24h: 125000,
        heartEmitted24h: 1500000,
      },
      leaderboard: [],
      synced: false,
      setSynced: (synced) => set({ synced }),

      selectAgent: (id) => set({ selectedAgentId: id }),

      createAgent: (input) => {
        const { wallet } = get()
        const ownerId = wallet.address ?? 'local-user'
        const agent = createDefaultAgent(input, ownerId)

        set((state) => ({
          agents: [...state.agents, agent],
          selectedAgentId: agent.id,
        }))

        get().addActivity({
          agentId: agent.id,
          type: 'levelup',
          message: `${agent.name} was born! Specialization: ${input.specialization}`,
          metadata: { level: 1, specialization: input.specialization },
        })

        // TODO: Sync to Supabase when connected
        // syncAgentToSupabase(agent)

        return agent
      },

      updateSystemPrompt: (agentId, prompt) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, systemPrompt: prompt } : a
          ),
        }))
        // TODO: Sync prompt update to Supabase
      },

      updateAgentStatus: (agentId, status) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, status, lastActiveAt: new Date().toISOString() }
              : a
          ),
        })),

      addActivity: (item) =>
        set((state) => ({
          activityFeed: [
            {
              ...item,
              id: generateId(),
              timestamp: new Date().toISOString(),
            },
            ...state.activityFeed,
          ].slice(0, 100),
        })),
    }),
    {
      name: 'humans-ai-store',
      partialize: (state) => ({
        wallet: state.wallet,
        agents: state.agents,
        selectedAgentId: state.selectedAgentId,
      }),
    }
  )
)
