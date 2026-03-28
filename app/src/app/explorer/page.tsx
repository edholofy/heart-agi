"use client"

import { useState, useEffect, useCallback } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import Link from "next/link"

const RPC_URL =
  process.env.NEXT_PUBLIC_HEART_RPC || "http://5.161.47.118:26657"
const REST_URL =
  process.env.NEXT_PUBLIC_HEART_REST || "http://5.161.47.118:1317"

const REFRESH_INTERVAL = 5000

interface ChainStatus {
  chainId: string
  latestHeight: number
  latestTime: string
}

interface BlockInfo {
  height: number
  hash: string
  time: string
  numTxs: number
  proposer: string
}

interface ValidatorInfo {
  moniker: string
  votingPower: number
  commission: string
  operatorAddress: string
}

interface StakingPool {
  bondedTokens: string
  notBondedTokens: string
}

interface ComputePrice {
  claudePrice: string
  gptPrice: string
  geminiPrice: string
  basketPrice: string
  lastUpdated: string
}

/** Truncate a hash: first 8 + last 4 chars */
function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`
}

/** Format large token amounts (uheart -> HEART with abbreviation) */
function formatTokens(raw: string): string {
  const amount = parseInt(raw, 10) / 1_000_000
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return amount.toFixed(0)
}

/** Relative time string */
function timeAgo(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function ExplorerPage() {
  const [status, setStatus] = useState<ChainStatus | null>(null)
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [validators, setValidators] = useState<ValidatorInfo[]>([])
  const [pool, setPool] = useState<StakingPool | null>(null)
  const [error, setError] = useState(false)
  const [computePrice, setComputePrice] = useState<ComputePrice | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${RPC_URL}/status`)
      const data = await res.json()
      const info = data.result.node_info
      const syncInfo = data.result.sync_info
      setStatus({
        chainId: info.network,
        latestHeight: parseInt(syncInfo.latest_block_height, 10),
        latestTime: syncInfo.latest_block_time,
      })
      setError(false)
      return parseInt(syncInfo.latest_block_height, 10)
    } catch {
      setError(true)
      return null
    }
  }, [])

  const fetchBlocks = useCallback(async (latestHeight: number) => {
    try {
      const minHeight = Math.max(1, latestHeight - 9)
      const res = await fetch(
        `${RPC_URL}/blockchain?minHeight=${minHeight}&maxHeight=${latestHeight}`
      )
      const data = await res.json()
      const blockMetas = data.result.block_metas || []

      const parsed: BlockInfo[] = blockMetas.map(
        (meta: {
          header: {
            height: string
            time: string
            proposer_address: string
          }
          block_id: { hash: string }
          num_txs: string
        }) => ({
          height: parseInt(meta.header.height, 10),
          hash: meta.block_id.hash,
          time: meta.header.time,
          numTxs: parseInt(meta.num_txs, 10),
          proposer: meta.header.proposer_address,
        })
      )

      parsed.sort((a: BlockInfo, b: BlockInfo) => b.height - a.height)
      setBlocks(parsed)
    } catch {
      // keep existing blocks on error
    }
  }, [])

  const fetchValidators = useCallback(async () => {
    try {
      const res = await fetch(
        `${REST_URL}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`
      )
      const data = await res.json()
      const vals = data.validators || []

      const parsed: ValidatorInfo[] = vals.map(
        (v: {
          description: { moniker: string }
          tokens: string
          commission: {
            commission_rates: { rate: string }
          }
          operator_address: string
        }) => ({
          moniker: v.description.moniker,
          votingPower: parseInt(v.tokens, 10) / 1_000_000,
          commission: (parseFloat(v.commission.commission_rates.rate) * 100).toFixed(0) + "%",
          operatorAddress: v.operator_address,
        })
      )

      parsed.sort((a: ValidatorInfo, b: ValidatorInfo) => b.votingPower - a.votingPower)
      setValidators(parsed)
    } catch {
      // keep existing validators on error
    }
  }, [])

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch(`${REST_URL}/cosmos/staking/v1beta1/pool`)
      const data = await res.json()
      setPool({
        bondedTokens: data.pool.bonded_tokens,
        notBondedTokens: data.pool.not_bonded_tokens,
      })
    } catch {
      // keep existing pool data on error
    }
  }, [])

  const fetchComputePrice = useCallback(async () => {
    try {
      const res = await fetch(`${REST_URL}/heart/compute/get_compute_price`)
      if (!res.ok) return
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any
      const price = raw?.price ?? raw?.compute_price ?? raw
      if (price && typeof price === "object") {
        setComputePrice({
          claudePrice: String(price.claude_price ?? price.claudePrice ?? "—"),
          gptPrice: String(price.gpt_price ?? price.gptPrice ?? "—"),
          geminiPrice: String(price.gemini_price ?? price.geminiPrice ?? "—"),
          basketPrice: String(price.basket_price ?? price.basketPrice ?? price.weighted_price ?? "—"),
          lastUpdated: String(price.last_updated ?? price.lastUpdated ?? price.timestamp ?? ""),
        })
      }
    } catch {
      // oracle may not be initialized
    }
  }, [])

  const fetchAll = useCallback(async () => {
    const height = await fetchStatus()
    if (height) {
      await fetchBlocks(height)
    }
  }, [fetchStatus, fetchBlocks])

  // Initial load
  useEffect(() => {
    fetchAll()
    fetchValidators()
    fetchPool()
    fetchComputePrice()
  }, [fetchAll, fetchValidators, fetchPool, fetchComputePrice])

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchAll, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Refresh validators/pool/oracle less often
  useEffect(() => {
    const interval = setInterval(() => {
      fetchValidators()
      fetchPool()
      fetchComputePrice()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchValidators, fetchPool, fetchComputePrice])

  function handleSearch() {
    const q = searchQuery.trim()
    if (!q) return

    // Check if it's a block height (pure number)
    if (/^\d+$/.test(q)) {
      const height = parseInt(q, 10)
      const block = blocks.find((b) => b.height === height)
      if (block) {
        setSearchResult(`Block #${height} found — hash: ${block.hash}`)
      } else if (status && height <= status.latestHeight && height > 0) {
        setSearchResult(`Block #${height} exists. Detailed view coming soon.`)
      } else {
        setSearchResult(`Block #${height} not found.`)
      }
      return
    }

    // Tx hash or address
    if (q.startsWith("heart1")) {
      setSearchResult("Address lookup coming soon.")
    } else if (q.length === 64 || q.startsWith("0x")) {
      setSearchResult("Transaction lookup coming soon.")
    } else {
      setSearchResult("Enter a block height, tx hash, or heart1... address.")
    }
  }

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Header + Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
                $HEART{" "}
                <span className="text-[rgba(255,255,255,0.4)]">Explorer</span>
              </h1>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchResult(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
                placeholder="Block height, tx hash, address..."
                className="glass-input px-4 py-2.5 text-sm font-mono flex-1 sm:w-72"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                onClick={handleSearch}
                className="btn-secondary px-4 py-2.5 text-sm tracking-wider"
              >
                SEARCH
              </button>
            </div>
          </div>

          {/* Search result */}
          {searchResult && (
            <div className="glass-sm p-4 mb-6 text-sm font-light">
              <span className="font-mono text-[rgba(255,255,255,0.6)]">
                {searchResult}
              </span>
              <button
                onClick={() => setSearchResult(null)}
                className="ml-3 text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
              >
                dismiss
              </button>
            </div>
          )}

          {/* Chain offline error */}
          {error && (
            <div className="glass-sm p-4 mb-6 bg-[rgba(239,68,68,0.08)] text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] mr-2 align-middle" />
              <span className="text-[#ef4444] font-light">
                Chain offline or unreachable. Retrying...
              </span>
            </div>
          )}

          {/* Chain Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="BLOCK.HEIGHT"
              value={
                status ? status.latestHeight.toLocaleString() : "---"
              }
              live
            />
            <StatCard
              label="CHAIN.ID"
              value={status ? status.chainId : "---"}
            />
            <StatCard
              label="VALIDATORS"
              value={
                validators.length > 0
                  ? validators.length.toString()
                  : "---"
              }
            />
            <StatCard
              label="BONDED.TOKENS"
              value={
                pool ? `${formatTokens(pool.bondedTokens)} HEART` : "---"
              }
            />
          </div>

          {/* Latest Blocks */}
          <div className="mb-8">
            <div className="aura-divider mb-5">LATEST.BLOCKS</div>

            <div className="glass p-1.5 sm:p-3">
              {/* Table header */}
              <div className="grid grid-cols-5 gap-2 px-3 sm:px-4 py-2.5 tech-label text-[9px] sm:text-[10px]">
                <span>HEIGHT</span>
                <span>HASH</span>
                <span>TIME</span>
                <span>TXS</span>
                <span>PROPOSER</span>
              </div>

              {blocks.length === 0 && !error && (
                <div className="px-4 py-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                  Loading blocks...
                </div>
              )}

              {blocks.map((block) => (
                <div
                  key={block.height}
                  className="grid grid-cols-5 gap-2 px-3 sm:px-4 py-3 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors items-center"
                >
                  <span className="font-mono text-sm font-medium text-white">
                    #{block.height.toLocaleString()}
                  </span>
                  <span className="font-mono text-xs text-[rgba(255,255,255,0.4)] truncate">
                    {truncateHash(block.hash)}
                  </span>
                  <span className="text-xs text-[rgba(255,255,255,0.4)] font-light">
                    {timeAgo(block.time)}
                  </span>
                  <span className="font-mono text-xs text-[rgba(255,255,255,0.5)]">
                    {block.numTxs} {block.numTxs === 1 ? "tx" : "txs"}
                  </span>
                  <span className="font-mono text-xs text-[rgba(255,255,255,0.3)] truncate">
                    {truncateHash(block.proposer)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Validators */}
          <div className="mb-12">
            <div className="aura-divider mb-5">VALIDATORS</div>

            <div className="glass p-1.5 sm:p-3">
              {/* Table header */}
              <div className="grid grid-cols-3 gap-2 px-3 sm:px-4 py-2.5 tech-label text-[9px] sm:text-[10px]">
                <span>MONIKER</span>
                <span>VOTING.POWER</span>
                <span>COMMISSION</span>
              </div>

              {validators.length === 0 && !error && (
                <div className="px-4 py-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                  Loading validators...
                </div>
              )}

              {validators.map((val) => (
                <div
                  key={val.operatorAddress}
                  className="grid grid-cols-3 gap-2 px-3 sm:px-4 py-3 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors items-center"
                >
                  <span className="text-sm font-medium text-white truncate">
                    {val.moniker}
                  </span>
                  <span className="font-mono text-xs text-[rgba(255,255,255,0.5)]">
                    {val.votingPower >= 1_000_000
                      ? `${(val.votingPower / 1_000_000).toFixed(1)}M`
                      : val.votingPower >= 1_000
                        ? `${(val.votingPower / 1_000).toFixed(1)}K`
                        : val.votingPower.toFixed(0)}{" "}
                    HEART
                  </span>
                  <span className="font-mono text-xs text-[rgba(255,255,255,0.4)]">
                    {val.commission}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Compute Oracle */}
          <div className="mb-12">
            <div className="aura-divider mb-5">COMPUTE.ORACLE</div>

            {!computePrice ? (
              <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] inline-block mr-2 align-middle animate-pulse-dot" />
                Oracle initializing...
              </div>
            ) : (
              <div className="glass p-1.5 sm:p-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 sm:p-4">
                  <div className="glass-sm p-4">
                    <div className="tech-label mb-2">CLAUDE.PRICE</div>
                    <div className="text-lg sm:text-xl font-medium font-mono tracking-tight">
                      {computePrice.claudePrice}
                    </div>
                    <div className="tech-label text-[9px] mt-1">HEART/TOKEN</div>
                  </div>
                  <div className="glass-sm p-4">
                    <div className="tech-label mb-2">GPT.PRICE</div>
                    <div className="text-lg sm:text-xl font-medium font-mono tracking-tight">
                      {computePrice.gptPrice}
                    </div>
                    <div className="tech-label text-[9px] mt-1">HEART/TOKEN</div>
                  </div>
                  <div className="glass-sm p-4">
                    <div className="tech-label mb-2">GEMINI.PRICE</div>
                    <div className="text-lg sm:text-xl font-medium font-mono tracking-tight">
                      {computePrice.geminiPrice}
                    </div>
                    <div className="tech-label text-[9px] mt-1">HEART/TOKEN</div>
                  </div>
                  <div className="glass-sm p-4">
                    <div className="tech-label mb-2">BASKET.PRICE</div>
                    <div className="text-lg sm:text-xl font-medium font-mono tracking-tight text-white">
                      {computePrice.basketPrice}
                    </div>
                    <div className="tech-label text-[9px] mt-1">WEIGHTED AVG</div>
                  </div>
                </div>
                {computePrice.lastUpdated && (
                  <div className="px-4 pb-3 text-right">
                    <span className="tech-label text-[9px]">
                      LAST.UPDATED:{" "}
                      <span className="font-mono text-[rgba(255,255,255,0.5)]">
                        {timeAgo(computePrice.lastUpdated)}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Back link */}
          <div className="text-center mb-8">
            <Link
              href="/"
              className="btn-secondary inline-block px-6 py-2.5 text-sm tracking-wide"
            >
              BACK TO DASHBOARD
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  live,
}: {
  label: string
  value: string
  live?: boolean
}) {
  return (
    <div className="glass-sm p-5">
      <div className="tech-label mb-2 flex items-center gap-1.5">
        {live && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-dot" />
        )}
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-medium font-mono tracking-tight">
        {value}
      </div>
    </div>
  )
}
