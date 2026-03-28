"use client"

/**
 * Transaction helpers for broadcasting custom $HEART chain messages.
 *
 * Each function builds a Cosmos SDK message with the correct typeUrl
 * (derived from the chain's proto definitions), signs it via the
 * in-app wallet, and broadcasts through SigningStargateClient.
 *
 * Custom messages are encoded using the generic `Any` type with
 * manually-assembled protobuf bytes.  The field numbers come straight
 * from the proto files in heart/proto/heart/…/tx.proto.
 */

import { getSigningClient, clearSigningClient, DENOM } from "@/lib/cosmos-wallet"
import { coin } from "@cosmjs/stargate"

/* ------------------------------------------------------------------ */
/*  Minimal protobuf helpers (no code-gen needed)                      */
/* ------------------------------------------------------------------ */

/** Write a varint (used for field tags and uint64 values). */
function encodeVarint(value: number | bigint): number[] {
  const bytes: number[] = []
  let v = typeof value === "bigint" ? value : BigInt(value)
  do {
    let b = Number(v & BigInt(0x7f))
    v >>= BigInt(7)
    if (v > BigInt(0)) b |= 0x80
    bytes.push(b)
  } while (v > BigInt(0))
  return bytes
}

/** Encode a string field (wire type 2). */
function encodeString(fieldNumber: number, value: string): number[] {
  const tag = (fieldNumber << 3) | 2
  const utf8 = new TextEncoder().encode(value)
  return [...encodeVarint(tag), ...encodeVarint(utf8.length), ...utf8]
}

/** Encode a uint64 field (wire type 0). */
function encodeUint64(fieldNumber: number, value: number | bigint): number[] {
  const tag = (fieldNumber << 3) | 0
  return [...encodeVarint(tag), ...encodeVarint(value)]
}

/* ------------------------------------------------------------------ */
/*  Input validation                                                   */
/* ------------------------------------------------------------------ */

/** Validate that a field is non-empty and within length limits. */
function validateInput(field: string, value: string, maxLength: number) {
  if (!value || value.trim().length === 0) throw new Error(`${field} is required`)
  if (value.length > maxLength) throw new Error(`${field} exceeds max length of ${maxLength}`)
}

/* ------------------------------------------------------------------ */
/*  Default tx fee & gas                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_FEE = {
  amount: [coin("500", DENOM)],
  gas: "200000",
}

/* ------------------------------------------------------------------ */
/*  /heart.identity  messages                                          */
/* ------------------------------------------------------------------ */

/**
 * Register a soul hash on-chain.
 *
 * Proto: heart.identity.MsgRegisterSoul
 *   1: creator  (string)
 *   2: soulHash (string)
 */
export async function registerSoul(soulHash: string): Promise<string> {
  validateInput("soulHash", soulHash, 200)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, soulHash),
  ])

  const msg = {
    typeUrl: "/heart.identity.MsgRegisterSoul",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`registerSoul failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Register a skill hash on-chain.
 *
 * Proto: heart.identity.MsgRegisterSkill
 *   1: creator   (string)
 *   2: skillHash (string)
 */
export async function registerSkill(skillHash: string): Promise<string> {
  validateInput("skillHash", skillHash, 200)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, skillHash),
  ])

  const msg = {
    typeUrl: "/heart.identity.MsgRegisterSkill",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`registerSkill failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/* ------------------------------------------------------------------ */
/*  /heart.existence  messages                                         */
/* ------------------------------------------------------------------ */

/**
 * Spawn a new AI entity on-chain.
 *
 * Proto: heart.existence.MsgSpawnEntity
 *   1: creator        (string)
 *   2: name           (string)
 *   3: specialization (string)
 *   4: soulHash       (string)
 *   5: skillHash      (string)
 */
export async function spawnEntity(
  name: string,
  specialization: string,
  soulHash: string,
  skillHash: string
): Promise<string> {
  validateInput("name", name, 100)
  validateInput("specialization", specialization, 50)
  validateInput("soulHash", soulHash, 200)
  validateInput("skillHash", skillHash, 200)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, name),
    ...encodeString(3, specialization),
    ...encodeString(4, soulHash),
    ...encodeString(5, skillHash),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgSpawnEntity",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`spawnEntity failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Post a task to the network.
 *
 * Proto: heart.existence.MsgPostTask
 *   1: creator        (string)
 *   2: title          (string)
 *   3: description    (string)
 *   4: rewardAmount   (uint64)
 *   5: specialization (string)
 */
export async function postTask(
  title: string,
  description: string,
  reward: number,
  specialization: string
): Promise<string> {
  validateInput("title", title, 200)
  validateInput("description", description, 2000)
  validateInput("specialization", specialization, 50)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, title),
    ...encodeString(3, description),
    ...encodeUint64(4, reward),
    ...encodeString(5, specialization),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgPostTask",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`postTask failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Create a governance proposal.
 *
 * Proto: heart.existence.MsgCreateProposal
 *   1: creator     (string)
 *   2: title       (string)
 *   3: description (string)
 *   4: entityId    (string)
 */
export async function createProposal(
  title: string,
  description: string,
  entityId: string
): Promise<string> {
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, title),
    ...encodeString(3, description),
    ...encodeString(4, entityId),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgCreateProposal",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`createProposal failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Vote on a governance proposal.
 *
 * Proto: heart.existence.MsgVoteProposal
 *   1: creator    (string)
 *   2: proposalId (string)
 *   3: entityId   (string)
 *   4: voteOption (string)
 */
export async function voteProposal(
  proposalId: string,
  entityId: string,
  voteOption: string
): Promise<string> {
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, proposalId),
    ...encodeString(3, entityId),
    ...encodeString(4, voteOption),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgVoteProposal",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`voteProposal failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/* ------------------------------------------------------------------ */
/*  /heart.existence  marketplace messages                             */
/* ------------------------------------------------------------------ */

/**
 * List an entity for sale on the marketplace.
 *
 * Proto: heart.existence.MsgListEntityForSale
 *   1: creator  (string)
 *   2: entityId (string)
 *   3: price    (string)  — amount in uheart
 */
export async function listEntityForSale(
  entityId: string,
  price: string
): Promise<string> {
  validateInput("entityId", entityId, 200)
  validateInput("price", price, 50)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, entityId),
    ...encodeString(3, price),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgListEntityForSale",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`listEntityForSale failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Buy an entity listed for sale on the marketplace.
 *
 * Proto: heart.existence.MsgBuyEntity
 *   1: creator  (string)
 *   2: entityId (string)
 */
export async function buyEntity(entityId: string): Promise<string> {
  validateInput("entityId", entityId, 200)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, entityId),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgBuyEntity",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`buyEntity failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Delist an entity from the marketplace (cancel sale).
 *
 * Proto: heart.existence.MsgDelistEntity
 *   1: creator  (string)
 *   2: entityId (string)
 */
export async function delistEntity(entityId: string): Promise<string> {
  validateInput("entityId", entityId, 200)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, entityId),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgDelistEntity",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`delistEntity failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/* ------------------------------------------------------------------ */
/*  /heart.compute  messages                                           */
/* ------------------------------------------------------------------ */

/**
 * Submit research output from an entity.
 *
 * Proto: heart.compute.MsgSubmitResearch
 *   1: creator        (string)
 *   2: title          (string)
 *   3: findings       (string)
 *   4: recommendation (string)
 *   5: entityId       (string)
 */
/**
 * License an artifact (pay the license fee to the creator).
 *
 * Proto: heart.existence.MsgLicenseArtifact
 *   1: creator    (string)
 *   2: artifactId (string)
 */
export async function licenseArtifact(artifactId: string): Promise<string> {
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, artifactId),
  ])

  const msg = {
    typeUrl: "/heart.existence.MsgLicenseArtifact",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(`licenseArtifact failed (code ${result.code}): ${result.rawLog}`)
  }

  return result.transactionHash
}

/**
 * Submit research output from an entity.
 *
 * Proto: heart.compute.MsgSubmitResearch
 *   1: creator        (string)
 *   2: title          (string)
 *   3: findings       (string)
 *   4: recommendation (string)
 *   5: entityId       (string)
 */
export async function submitResearch(
  title: string,
  findings: string,
  recommendation: string,
  entityId: string
): Promise<string> {
  validateInput("title", title, 200)
  validateInput("findings", findings, 5000)
  validateInput("recommendation", recommendation, 2000)
  validateInput("entityId", entityId, 200)
  const { client, address } = await getSigningClient()

  const value = Uint8Array.from([
    ...encodeString(1, address),
    ...encodeString(2, title),
    ...encodeString(3, findings),
    ...encodeString(4, recommendation),
    ...encodeString(5, entityId),
  ])

  const msg = {
    typeUrl: "/heart.compute.MsgSubmitResearch",
    value,
  }

  const result = await client.signAndBroadcast(address, [msg], DEFAULT_FEE)

  if (result.code !== 0) {
    throw new Error(
      `submitResearch failed (code ${result.code}): ${result.rawLog}`
    )
  }

  return result.transactionHash
}
