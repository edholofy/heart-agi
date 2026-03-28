"use client"

/**
 * useRealRuntime — React hook for the real LLM-powered agent runtime.
 *
 * Drop-in alternative to useAgentRuntime. Uses OpenRouter for actual
 * LLM inference instead of simulated Math.random() results.
 *
 * Falls back to the simulated runtime if OPENROUTER_API_KEY is not set
 * on the server.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { RealRuntime, type RealRuntimeConfig, type PendingDiscovery, type RuntimeStats } from './real-runtime'
import {
  subscribeToDiscoveries,
  subscribeToActivityFeed,
  type DiscoveryGossip,
} from './gossip'
import { isLLMConfigured } from './llm'

export interface LiveEvent {
  id: string
  type: string
  message: string
  timestamp: string
  fromPeer?: boolean
  agentName?: string
}

interface UseRealRuntimeOptions {
  entityId: string
  entityName: string
  /** soul.md — identity */
  soul: string
  /** skill.md — capabilities */
  skill: string
  /** Initial compute token balance */
  computeBalance: number
  /** Auto-start the runtime on mount */
  autoStart?: boolean
  /** Tick interval in ms (default 30000) */
  tickIntervalMs?: number
  /** Compute tier for model selection (default 'browser') */
  computeTier?: string
}

/**
 * React hook that manages the real LLM-powered agent runtime.
 *
 * Returns:
 * - liveFeed: real-time activity events
 * - isRunning: whether the agent is active
 * - start/stop: control the runtime
 * - stats: experiment count, discovery count, compute usage
 * - pendingDiscoveries: discoveries ready to submit on-chain
 * - markSubmitted: mark a discovery as submitted with tx hash
 * - isLLMAvailable: whether OpenRouter is configured
 * - computeState: current compute balance info
 */
export function useRealRuntime(options: UseRealRuntimeOptions) {
  const runtimeRef = useRef<RealRuntime | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [liveFeed, setLiveFeed] = useState<LiveEvent[]>([])
  const [peerDiscoveries, setPeerDiscoveries] = useState<DiscoveryGossip[]>([])
  const [pendingDiscoveries, setPendingDiscoveries] = useState<PendingDiscovery[]>([])
  const [stats, setStats] = useState<RuntimeStats>({
    experiments: 0,
    discoveries: 0,
    computeUsed: 0,
    computeEarned: 0,
    totalTokens: 0,
    llmCalls: 0,
  })
  const [computeState, setComputeState] = useState({
    balance: options.computeBalance,
    consumed: 0,
    earned: 0,
    isDormant: false,
  })
  const [isLLMAvailable] = useState(() => isLLMConfigured())

  const addEvent = useCallback((event: Omit<LiveEvent, 'id' | 'timestamp'>) => {
    setLiveFeed((prev) => [
      {
        ...event,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 100))
  }, [])

  /** Sync stats from runtime */
  const syncState = useCallback(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    setStats(runtime.getStats())
    setComputeState(runtime.getComputeState())
    setPendingDiscoveries(runtime.getPendingDiscoveries())
  }, [])

  // Initialize runtime
  useEffect(() => {
    if (!options.entityId) return

    const config: RealRuntimeConfig = {
      entityId: options.entityId,
      entityName: options.entityName,
      soul: options.soul,
      skill: options.skill,
      computeBalance: options.computeBalance,
      tickIntervalMs: options.tickIntervalMs ?? 30000,
      computeTier: options.computeTier ?? 'browser',
    }

    const runtime = new RealRuntime(config)

    runtime.on((event) => {
      addEvent({
        type: event.type,
        message: event.message,
        agentName: options.entityName,
      })

      // Sync stats after every event
      syncState()

      // Handle dormant state
      if (event.type === 'dormant') {
        setIsRunning(false)
      }
    })

    runtimeRef.current = runtime

    if (options.autoStart && isLLMConfigured()) {
      runtime.start()
      setIsRunning(true)
    }

    return () => {
      runtime.stop()
      runtimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.entityId])

  // Subscribe to peer discoveries via gossip
  useEffect(() => {
    const unsubDiscoveries = subscribeToDiscoveries((discovery) => {
      if (discovery.agentId === options.entityId) return

      setPeerDiscoveries((prev) => [discovery, ...prev].slice(0, 20))

      addEvent({
        type: 'gossip',
        message: `[${discovery.agentName}] discovered: "${discovery.finding}" (${discovery.improvement.toFixed(1)}% improvement)`,
        fromPeer: true,
        agentName: discovery.agentName,
      })

      runtimeRef.current?.adoptDiscovery(discovery)
    })

    return () => {
      unsubDiscoveries()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.entityId])

  // Subscribe to database activity feed
  useEffect(() => {
    const unsubFeed = subscribeToActivityFeed((record) => {
      if (record.agent_id === options.entityId) return

      addEvent({
        type: record.type as string,
        message: record.message as string,
        fromPeer: true,
      })
    })

    return () => {
      unsubFeed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.entityId])

  // Periodic state sync (catches any missed updates)
  useEffect(() => {
    const syncInterval = setInterval(syncState, 5000)
    return () => clearInterval(syncInterval)
  }, [syncState])

  const start = useCallback(() => {
    if (!isLLMConfigured()) {
      addEvent({
        type: 'error',
        message: 'Cannot start: OPENROUTER_API_KEY not set on server. Configure it in .env.local',
      })
      return
    }
    runtimeRef.current?.start()
    setIsRunning(true)
  }, [addEvent])

  const stop = useCallback(() => {
    runtimeRef.current?.stop()
    setIsRunning(false)
  }, [])

  const refuel = useCallback((amount: number) => {
    runtimeRef.current?.refuel(amount)
    syncState()
  }, [syncState])

  const markSubmitted = useCallback((discoveryId: string, txHash: string) => {
    runtimeRef.current?.markDiscoverySubmitted(discoveryId, txHash)
    syncState()
  }, [syncState])

  return {
    /** Real-time activity events */
    liveFeed,
    /** Whether the runtime is actively running */
    isRunning,
    /** Start the runtime */
    start,
    /** Stop the runtime */
    stop,
    /** Peer discoveries received via gossip */
    peerDiscoveries,
    /** Runtime statistics */
    stats,
    /** Discoveries ready to be submitted on-chain */
    pendingDiscoveries,
    /** Mark a discovery as submitted to chain */
    markSubmitted,
    /** Add compute tokens */
    refuel,
    /** Current compute balance state */
    computeState,
    /** Whether OpenRouter API key is configured */
    isLLMAvailable,
  }
}
