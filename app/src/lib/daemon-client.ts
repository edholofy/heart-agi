/**
 * Client for the server-side entity daemon.
 *
 * The daemon runs at NEXT_PUBLIC_DAEMON_URL and manages autonomous
 * entities that live forever (not tied to a browser tab).
 */

import { proxyFetch } from "@/lib/proxy"

export interface ServerEntity {
  id: string
  name: string
  owner_address: string
  soul: string
  skill: string
  compute_balance: number
  status: string // alive, dormant, stopped
  experiments: number
  discoveries: number
  tasks_completed: number
  reputation: number
  creator_revenue: number
  last_activity: string
  started_at: string
}

/** Spawn entity on the server daemon (entity starts running autonomously) */
export async function spawnOnDaemon(params: {
  id: string
  name: string
  ownerAddress: string
  soul: string
  skill: string
  computeBalance: number
}): Promise<ServerEntity> {
  const res = await proxyFetch("/api/entities/spawn", "daemon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: params.id,
      name: params.name,
      owner_address: params.ownerAddress,
      soul: params.soul,
      skill: params.skill,
      compute_balance: params.computeBalance,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Daemon spawn failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.entity || data
}

/** List all running entities */
export async function listEntities(): Promise<ServerEntity[]> {
  const res = await proxyFetch("/api/entities", "daemon")

  if (!res.ok) {
    throw new Error(`Daemon list failed (${res.status})`)
  }

  const data = await res.json()
  return data.entities || []
}

/** Get single entity status */
export async function getEntityStatus(
  id: string
): Promise<ServerEntity | null> {
  const res = await proxyFetch(`/api/entities/status?id=${encodeURIComponent(id)}`, "daemon")

  if (res.status === 404) return null
  if (!res.ok) return null

  return res.json()
}

/** Refuel an entity's compute balance */
export async function refuelEntity(
  id: string,
  amount: number
): Promise<void> {
  const res = await proxyFetch("/api/entities/refuel", "daemon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, amount }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Daemon refuel failed (${res.status}): ${text}`)
  }
}

/** Stop an entity */
export async function stopEntity(id: string): Promise<void> {
  const res = await proxyFetch("/api/entities/stop", "daemon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Daemon stop failed (${res.status}): ${text}`)
  }
}

/** Breed two entities to create an offspring */
export async function breedEntities(params: {
  parentAId: string
  parentBId: string
  childName: string
}): Promise<{ success: boolean; child: ServerEntity; parents: string[] }> {
  const res = await proxyFetch("/api/entities/breed", "daemon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parent_a_id: params.parentAId,
      parent_b_id: params.parentBId,
      child_name: params.childName,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Breed failed" }))
    throw new Error(data.error || `Breed failed (${res.status})`)
  }

  return res.json()
}

/** Swarm intelligence result */
export interface SwarmContribution {
  entity_name: string
  skill: string
  subtask: string
  response: string
  confidence: number
  duration_ms: number
}

export interface SwarmResult {
  task: string
  synthesis: string
  contributions: SwarmContribution[]
  entities_used: number
  total_duration_ms: number
  tx_hash?: string
}

/** Run a swarm intelligence task across multiple entities */
export async function runSwarm(params: {
  task: string
  context?: string
  maxEntities?: number
  entityNames?: string[]
}): Promise<SwarmResult> {
  const res = await proxyFetch("/api/entities/swarm", "daemon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: params.task,
      context: params.context || "",
      max_entities: params.maxEntities || 0,
      entity_names: params.entityNames || [],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Swarm failed (${res.status}): ${text}`)
  }

  return res.json()
}

/** Get activity log */
export async function getActivity(
  entityId?: string,
  limit = 50
): Promise<{ type: string; entity_name: string; message: string; timestamp: string }[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (entityId) params.set("entity_id", entityId)

  const res = await proxyFetch(`/api/activity?${params}`, "daemon")
  if (!res.ok) return []

  const data = await res.json()
  return data.activity || []
}
