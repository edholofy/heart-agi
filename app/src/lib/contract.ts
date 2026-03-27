import { BrowserProvider, Contract } from 'ethers'
import abi from './abi.json'

/** Contract address — set after deployment */
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HUMAN_AGENT_CONTRACT || ''

const SPECIALIZATION_MAP: Record<string, number> = {
  researcher: 0,
  coder: 1,
  analyst: 2,
  writer: 3,
  investigator: 4,
  builder: 5,
}

function getEthereum() {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ethereum?: unknown }).ethereum ?? null
}

/** Get a read-only contract instance */
export function getContract() {
  const ethereum = getEthereum()
  if (!ethereum || !CONTRACT_ADDRESS) return null

  const provider = new BrowserProvider(ethereum as never)
  return new Contract(CONTRACT_ADDRESS, abi, provider)
}

/** Get a writable contract instance (connected to signer) */
export async function getSignedContract() {
  const ethereum = getEthereum()
  if (!ethereum || !CONTRACT_ADDRESS) {
    throw new Error('Wallet not connected or contract not configured')
  }

  const provider = new BrowserProvider(ethereum as never)
  const signer = await provider.getSigner()
  return new Contract(CONTRACT_ADDRESS, abi, signer)
}

/** Mint an agent NFT on-chain */
export async function mintAgentNFT(
  name: string,
  specialization: string
): Promise<{ tokenId: number; txHash: string }> {
  const contract = await getSignedContract()
  const specIndex = SPECIALIZATION_MAP[specialization] ?? 0

  const tx = await contract.mint(name, specIndex)
  const receipt = await tx.wait()

  // Parse the AgentMinted event to get the tokenId
  const mintEvent = receipt.logs.find((log: { fragment?: { name: string } }) =>
    log.fragment?.name === 'AgentMinted'
  )

  const tokenId = mintEvent
    ? Number(mintEvent.args[0])
    : 0

  return { tokenId, txHash: receipt.hash }
}

/** Get all agent token IDs owned by an address */
export async function getOwnedAgents(address: string): Promise<number[]> {
  const contract = getContract()
  if (!contract) return []

  const tokenIds = await contract.getAgentsByOwner(address)
  return tokenIds.map((id: bigint) => Number(id))
}

/** Get on-chain agent data */
export async function getOnChainAgent(tokenId: number) {
  const contract = getContract()
  if (!contract) return null

  const data = await contract.getAgent(tokenId)
  return {
    name: data.name,
    specialization: data.specialization,
    level: Number(data.level),
    reputation: Number(data.reputation),
    parentA: Number(data.parentA),
    parentB: Number(data.parentB),
    breedCount: Number(data.breedCount),
    birthTimestamp: Number(data.birthTimestamp),
  }
}

/** Check if contract is configured */
export function isContractConfigured(): boolean {
  return CONTRACT_ADDRESS.length > 0
}
