"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { AgentRuntime, type RuntimeConfig } from './agent-runtime'
import {
  subscribeToDiscoveries,
  subscribeToActivityFeed,
  type DiscoveryGossip,
} from './gossip'

export interface LiveEvent {
  id: string
  type: string
  message: string
  timestamp: string
  fromPeer?: boolean
  agentName?: string
}

interface UseAgentRuntimeOptions {
  agentId: string
  agentName: string
  specialization: string
  /** soul.md — identity */
  soul: string
  /** skill.md — capabilities */
  skill: string
  /** Initial compute token balance */
  computeBalance: number
  autoStart?: boolean
}

/**
 * React hook that manages an agent's runtime + gossip subscriptions.
 *
 * Returns:
 * - liveFeed: real-time activity events
 * - isRunning: whether the agent is active
 * - start/stop: control the runtime
 * - discoveries: discoveries received from peers
 * - stats: experiment count, discovery count
 */
export function useAgentRuntime(options: UseAgentRuntimeOptions) {
  const runtimeRef = useRef<AgentRuntime | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [liveFeed, setLiveFeed] = useState<LiveEvent[]>([])
  const [peerDiscoveries, setPeerDiscoveries] = useState<DiscoveryGossip[]>([])
  const [stats, setStats] = useState({
    experiments: 0,
    discoveries: 0,
    adoptions: 0,
  })

  const addEvent = useCallback((event: Omit<LiveEvent, 'id' | 'timestamp'>) => {
    setLiveFeed((prev) => [
      {
        ...event,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 50))
  }, [])

  // Initialize runtime
  useEffect(() => {
    if (!options.agentId) return

    const config: RuntimeConfig = {
      agentId: options.agentId,
      agentName: options.agentName,
      specialization: options.specialization,
      soul: options.soul,
      skill: options.skill,
      computeBalance: options.computeBalance,
      tickIntervalMs: 12000 + Math.random() * 8000,
    }

    const runtime = new AgentRuntime(config)

    runtime.on((event) => {
      addEvent({
        type: event.type,
        message: event.message,
        agentName: options.agentName,
      })

      // Update local stats
      if (event.type === 'experiment') {
        setStats((s) => ({ ...s, experiments: s.experiments + 1 }))
      }
      if (event.type === 'discovery') {
        setStats((s) => ({ ...s, discoveries: s.discoveries + 1 }))
      }
    })

    runtimeRef.current = runtime

    if (options.autoStart) {
      runtime.start()
      setIsRunning(true)
    }

    return () => {
      runtime.stop()
      runtimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.agentId])

  // Subscribe to peer discoveries via gossip
  useEffect(() => {
    const unsubDiscoveries = subscribeToDiscoveries((discovery) => {
      // Skip own discoveries
      if (discovery.agentId === options.agentId) return

      setPeerDiscoveries((prev) => [discovery, ...prev].slice(0, 20))

      addEvent({
        type: 'gossip',
        message: `[${discovery.agentName}] discovered: "${discovery.finding}" (${discovery.improvement.toFixed(1)}% improvement)`,
        fromPeer: true,
        agentName: discovery.agentName,
      })

      // Have the runtime adopt the discovery
      runtimeRef.current?.adoptDiscovery(discovery)
      setStats((s) => ({ ...s, adoptions: s.adoptions + 1 }))
    })

    return () => {
      unsubDiscoveries()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.agentId])

  // Subscribe to database activity feed (catches events from other sources)
  useEffect(() => {
    const unsubFeed = subscribeToActivityFeed((record) => {
      // Only show events from other agents
      if (record.agent_id === options.agentId) return

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
  }, [options.agentId])

  const start = useCallback(() => {
    runtimeRef.current?.start()
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    runtimeRef.current?.stop()
    setIsRunning(false)
  }, [])

  return {
    liveFeed,
    isRunning,
    start,
    stop,
    peerDiscoveries,
    stats,
  }
}
