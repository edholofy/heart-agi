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
import type { CosmosWalletState } from '@/lib/cosmos-wallet'
import { INITIAL_COSMOS_WALLET_STATE } from '@/lib/cosmos-wallet'

// WalletState alias kept for backwards compatibility with any external consumers
export type WalletState = CosmosWalletState

interface NetworkStats {
  totalAgents: number
  totalExperiments: number
  totalDiscoveries: number
  activeDomains: number
  heartBurned24h: number
  heartEmitted24h: number
  computeConsumed24h: number
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
  wallet: CosmosWalletState
  setWallet: (wallet: CosmosWalletState) => void

  agents: Agent[]
  selectedAgentId: string | null
  selectAgent: (id: string) => void
  createAgent: (input: AgentCreateInput) => Agent
  updateSoul: (agentId: string, soul: string) => void
  updateSkill: (agentId: string, skill: string) => void
  updateAgentStatus: (agentId: string, status: AgentStatus) => void

  activityFeed: ActivityFeedItem[]
  addActivity: (item: Omit<ActivityFeedItem, 'id' | 'timestamp'>) => void

  networkStats: NetworkStats
  leaderboard: LeaderboardEntry[]

  synced: boolean
  setSynced: (synced: boolean) => void
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

/** Initial compute deposit per tier */
const COMPUTE_DEPOSIT: Record<string, number> = {
  browser: 100,
  gpu: 500,
  api: 1000,
  hybrid: 750,
}

function createDefaultAgent(input: AgentCreateInput, ownerId: string): Agent {
  const now = new Date().toISOString()
  const initialCompute = input.computeDeposit ?? COMPUTE_DEPOSIT[input.computeTier] ?? 100

  return {
    id: generateId(),
    name: input.name,
    ownerId,
    specialization: input.specialization,
    computeTier: input.computeTier,
    identity: {
      soul: input.soul,
      skill: input.skill,
      soulHash: null, // computed async after creation
      skillHash: null,
      version: 1,
    },
    compute: {
      balance: initialCompute,
      consumedToday: 0,
      earnedToday: 0,
      costPerExperiment: 5,
      costPerTask: 3,
      isDormant: false,
      dormantSince: null,
    },
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
      validationsPerformed: 0,
      teachingSessions: 0,
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
        validation: 0,
        teaching: 0,
      },
    },
    discoveries: [],
    parentIds: null,
    nftTokenId: null,
    heartStaked: input.heartStake ?? 0,
    createdAt: now,
    lastActiveAt: now,
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      wallet: INITIAL_COSMOS_WALLET_STATE,
      setWallet: (wallet) => set({ wallet }),

      agents: [],
      selectedAgentId: null,
      activityFeed: [],
      networkStats: {
        totalAgents: 0,
        totalExperiments: 0,
        totalDiscoveries: 0,
        activeDomains: 0,
        heartBurned24h: 0,
        heartEmitted24h: 0,
        computeConsumed24h: 0,
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
          message: `${agent.name} was spawned! soul.md + skill.md registered. ${agent.compute.balance} Compute deposited.`,
          metadata: { level: 1, specialization: input.specialization, computeDeposit: agent.compute.balance },
        })

        return agent
      },

      updateSoul: (agentId, soul) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? {
                  ...a,
                  identity: {
                    ...a.identity,
                    soul,
                    soulHash: null, // will be recomputed
                    version: a.identity.version + 1,
                  },
                }
              : a
          ),
        }))
      },

      updateSkill: (agentId, skill) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? {
                  ...a,
                  identity: {
                    ...a.identity,
                    skill,
                    skillHash: null,
                    version: a.identity.version + 1,
                  },
                }
              : a
          ),
        }))
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
