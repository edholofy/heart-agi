/**
 * $HEART Blockchain Client
 *
 * TypeScript client for querying the $HEART chain via its Cosmos REST (LCD)
 * and CometBFT RPC endpoints.  All methods degrade gracefully when the chain
 * is unreachable – they return sensible defaults instead of throwing.
 */

const HEART_REST =
  process.env.NEXT_PUBLIC_HEART_REST ?? "http://5.161.47.118:1317";
const HEART_RPC =
  process.env.NEXT_PUBLIC_HEART_RPC ?? "http://5.161.47.118:26657";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChainStatus {
  chainId: string;
  blockHeight: string;
}

export interface Identity {
  soulHash: string;
  skillHash: string;
}

export interface Entity {
  name: string;
  owner: string;
  specialization: string;
  soulHash: string;
  skillHash: string;
  level: number;
  reputation: number;
}

export interface ComputeBalance {
  balance: number;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL with a timeout and graceful error handling.
 * Returns `null` when the request fails for any reason.
 */
async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[chain-client] ${res.status} from ${url}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[chain-client] Failed to fetch ${url}:`, err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns the chain ID and latest block height via the CometBFT RPC.
 */
export async function getChainStatus(): Promise<ChainStatus> {
  // CometBFT /status returns { result: { node_info: { network }, sync_info: { latest_block_height } } }
  const data = await safeFetch<{
    result: {
      node_info: { network: string };
      sync_info: { latest_block_height: string };
    };
  }>(`${HEART_RPC}/status`);

  if (!data) {
    return { chainId: "unknown", blockHeight: "0" };
  }

  return {
    chainId: data.result.node_info.network,
    blockHeight: data.result.sync_info.latest_block_height,
  };
}

/**
 * Queries the identity module for a given owner address.
 *
 * REST path: GET /heart/identity/get_identity/{owner}
 */
export async function getIdentity(ownerAddress: string): Promise<Identity> {
  const data = await safeFetch<{ soulHash: string; skillHash: string }>(
    `${HEART_REST}/heart/identity/get_identity/${encodeURIComponent(ownerAddress)}`
  );

  if (!data) {
    return { soulHash: "", skillHash: "" };
  }

  return {
    soulHash: data.soulHash ?? "",
    skillHash: data.skillHash ?? "",
  };
}

/**
 * Queries the existence module for a specific entity by ID.
 *
 * REST path: GET /heart/existence/get_entity/{id}
 */
export async function getEntity(entityId: string): Promise<Entity | null> {
  const data = await safeFetch<{
    name: string;
    owner: string;
    specialization: string;
    soulHash: string;
    skillHash: string;
    level: string;
    reputation: string;
  }>(`${HEART_REST}/heart/existence/get_entity/${encodeURIComponent(entityId)}`);

  if (!data || !data.name) {
    return null;
  }

  return {
    name: data.name,
    owner: data.owner,
    specialization: data.specialization,
    soulHash: data.soulHash ?? "",
    skillHash: data.skillHash ?? "",
    level: Number(data.level) || 0,
    reputation: Number(data.reputation) || 0,
  };
}

/**
 * Queries all entity IDs owned by a specific address.
 *
 * REST path: GET /heart/existence/get_entities_by_owner/{owner}
 *
 * The chain returns `{ entities: string }` where the string is a
 * JSON-encoded array or a comma-separated list. We normalise both.
 */
export async function getEntitiesByOwner(
  ownerAddress: string
): Promise<string[]> {
  const data = await safeFetch<{ entities: string }>(
    `${HEART_REST}/heart/existence/get_entities_by_owner/${encodeURIComponent(ownerAddress)}`
  );

  if (!data || !data.entities) {
    return [];
  }

  // Try JSON array first, then comma-split, then treat as single value.
  try {
    const parsed = JSON.parse(data.entities);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // not JSON – fall through
  }

  if (data.entities.includes(",")) {
    return data.entities.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return [data.entities];
}

/**
 * Queries the compute module for an entity's compute balance.
 *
 * REST path: GET /heart/compute/get_balance/{entityId}
 */
export async function getComputeBalance(entityId: string): Promise<number> {
  const data = await safeFetch<{ balance: string }>(
    `${HEART_REST}/heart/compute/get_balance/${encodeURIComponent(entityId)}`
  );

  if (!data) {
    return 0;
  }

  return Number(data.balance) || 0;
}
