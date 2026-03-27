/**
 * Gossip Layer — Supabase Realtime channels acting as GossipSub topics.
 *
 * Channels:
 *   gossip:discoveries  — new findings broadcast to all agents
 *   gossip:activity     — live activity feed (experiments, tasks, adoptions)
 *   gossip:network      — network-wide stats and agent presence
 *
 * This is a centralized gossip layer (Supabase Realtime) that provides
 * the same UX as P2P GossipSub. Can be swapped for libp2p later.
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js'

export interface GossipMessage {
  type: 'discovery' | 'experiment' | 'task' | 'adoption' | 'presence' | 'levelup'
  agentId: string
  agentName: string
  payload: Record<string, unknown>
  timestamp: string
}

export interface DiscoveryGossip {
  discoveryId: string
  agentId: string
  agentName: string
  finding: string
  domain: string
  evidenceBefore: number
  evidenceAfter: number
  improvement: number // percentage
}

type GossipHandler = (msg: GossipMessage) => void
type DiscoveryHandler = (discovery: DiscoveryGossip) => void

let supabase: ReturnType<typeof createClient> | null = null
let activityChannel: RealtimeChannel | null = null
let discoveryChannel: RealtimeChannel | null = null

function getClient() {
  if (supabase) return supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  supabase = createClient(url, key)
  return supabase
}

/**
 * Subscribe to the live activity gossip channel.
 * Receives all agent activity across the network in real-time.
 */
export function subscribeToActivity(handler: GossipHandler): () => void {
  const client = getClient()

  activityChannel = client
    .channel('gossip:activity')
    .on('broadcast', { event: 'activity' }, ({ payload }) => {
      handler(payload as GossipMessage)
    })
    .subscribe()

  return () => {
    activityChannel?.unsubscribe()
    activityChannel = null
  }
}

/**
 * Subscribe to discovery broadcasts.
 * When any agent on the network makes a discovery, all subscribers receive it.
 */
export function subscribeToDiscoveries(handler: DiscoveryHandler): () => void {
  const client = getClient()

  discoveryChannel = client
    .channel('gossip:discoveries')
    .on('broadcast', { event: 'discovery' }, ({ payload }) => {
      handler(payload as DiscoveryGossip)
    })
    .subscribe()

  return () => {
    discoveryChannel?.unsubscribe()
    discoveryChannel = null
  }
}

/**
 * Subscribe to database changes on the activity_feed table.
 * This catches all inserts from any source (API, agent runtime, etc.)
 */
export function subscribeToActivityFeed(
  handler: (record: Record<string, unknown>) => void
): () => void {
  const client = getClient()

  const channel = client
    .channel('db:activity_feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_feed' },
      (payload) => handler(payload.new)
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}

/**
 * Subscribe to agent status changes (presence, level ups, etc.)
 */
export function subscribeToAgentChanges(
  handler: (record: Record<string, unknown>) => void
): () => void {
  const client = getClient()

  const channel = client
    .channel('db:agents')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'agents' },
      (payload) => handler(payload.new)
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}

/**
 * Broadcast a gossip message to all connected agents.
 */
export async function broadcastActivity(msg: GossipMessage): Promise<void> {
  const client = getClient()

  const channel = client.channel('gossip:activity')
  await channel.send({
    type: 'broadcast',
    event: 'activity',
    payload: msg,
  })
}

/**
 * Broadcast a discovery to all agents on the network.
 */
export async function broadcastDiscovery(discovery: DiscoveryGossip): Promise<void> {
  const client = getClient()

  const channel = client.channel('gossip:discoveries')
  await channel.send({
    type: 'broadcast',
    event: 'discovery',
    payload: discovery,
  })
}
