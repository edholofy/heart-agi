/**
 * Client for the server-side entity daemon.
 *
 * The daemon runs at NEXT_PUBLIC_DAEMON_URL and manages autonomous
 * entities that live forever (not tied to a browser tab).
 */

const DAEMON_URL =
  process.env.NEXT_PUBLIC_DAEMON_URL || "http://5.161.47.118:4600"

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
  const res = await fetch(`${DAEMON_URL}/entities`, {
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

  return res.json()
}

/** List all running entities */
export async function listEntities(): Promise<ServerEntity[]> {
  const res = await fetch(`${DAEMON_URL}/entities`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })

  if (!res.ok) {
    throw new Error(`Daemon list failed (${res.status})`)
  }

  return res.json()
}

/** Get single entity status */
export async function getEntityStatus(
  id: string
): Promise<ServerEntity | null> {
  const res = await fetch(`${DAEMON_URL}/entities/${id}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })

  if (res.status === 404) return null

  if (!res.ok) {
    throw new Error(`Daemon status failed (${res.status})`)
  }

  return res.json()
}

/** Refuel an entity's compute balance */
export async function refuelEntity(
  id: string,
  amount: number
): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/entities/${id}/refuel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Daemon refuel failed (${res.status}): ${text}`)
  }
}

/** Stop an entity */
export async function stopEntity(id: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/entities/${id}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Daemon stop failed (${res.status}): ${text}`)
  }
}
