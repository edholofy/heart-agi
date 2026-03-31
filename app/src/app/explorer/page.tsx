"use client"

import { useState, useEffect, useCallback } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

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
      const res = await proxyFetch("/status", "rpc")
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
      const res = await proxyFetch(
        `/blockchain?minHeight=${minHeight}&maxHeight=${latestHeight}`, "rpc"
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
      const res = await proxyFetch(
        "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED", "rest"
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
      const res = await proxyFetch("/cosmos/staking/v1beta1/pool", "rest")
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
      const res = await proxyFetch("/heart/compute/get_compute_price", "rest")
      if (!res.ok) return
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any
      const price = raw?.price ?? raw?.compute_price ?? raw
      if (price && typeof price === "object") {
        setComputePrice({
          claudePrice: String(price.claude_price ?? price.claudePrice ?? "---"),
          gptPrice: String(price.gpt_price ?? price.gptPrice ?? "---"),
          geminiPrice: String(price.gemini_price ?? price.geminiPrice ?? "---"),
          basketPrice: String(price.basket_price ?? price.basketPrice ?? price.weighted_price ?? "---"),
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

  const topValidator = validators.length > 0 ? validators[0] : null
  const totalVotingPower = validators.reduce((sum, v) => sum + v.votingPower, 0)

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── ZONE DARK ── */}
      <div className="zone-dark">
        <header style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 16, marginBottom: 32 }}>
          <div>
            <span className="sys-label">SYSTEM OPERATION</span>
            <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              CHAIN EXPLORER // TELEMETRY
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span className="sys-label">CHAIN ID</span>
            <div className="sys-value">{status ? status.chainId : "---"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="sys-label">VALIDATORS</span>
            <div className="sys-value">{validators.length > 0 ? validators.length : "---"}</div>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", paddingBottom: 24 }}>
          <div>
            <span className="sys-label">BLOCK HEIGHT</span>
            <div className="dot-hero">
              {status ? status.latestHeight.toLocaleString() : "---"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="sys-label">CHAIN OVERVIEW</span>
              <span className="sys-value">{status ? timeAgo(status.latestTime) : "---"}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="data-row">
                <span className="row-key">BONDED TOKENS</span>
                <span className="row-val">{pool ? `${formatTokens(pool.bondedTokens)} HEART` : "---"}</span>
              </div>
              <div className="data-row">
                <span className="row-key">NOT BONDED</span>
                <span className="row-val">{pool ? `${formatTokens(pool.notBondedTokens)} HEART` : "---"}</span>
              </div>
              <div className="data-row" style={{ color: "var(--bg)" }}>
                <span className="row-key">TOP VALIDATOR</span>
                <span className="row-val">{topValidator ? topValidator.moniker : "---"}</span>
              </div>
              <div className="data-row" style={{ color: "var(--bg)" }}>
                <span className="row-key">TOTAL POWER</span>
                <span className="row-val">{totalVotingPower >= 1_000_000 ? `${(totalVotingPower / 1_000_000).toFixed(1)}M` : totalVotingPower >= 1_000 ? `${(totalVotingPower / 1_000).toFixed(1)}K` : totalVotingPower.toFixed(0)} HEART</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ZONE TRANSITION ── */}
      <div className="zone-transition" />

      {/* ── ZONE LIGHT ── */}
      <div className="zone-light">
        {/* Search */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
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
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1,
              padding: "10px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "transparent",
              color: "var(--fg)",
              outline: "none",
            }}
          />
          <button onClick={handleSearch} className="btn-primary">
            SEARCH
          </button>
        </div>

        {searchResult && (
          <div className="data-row" style={{ marginBottom: 16 }}>
            <span className="row-key" style={{ fontFamily: "var(--font-mono)", opacity: 0.6 }}>{searchResult}</span>
            <button
              onClick={() => setSearchResult(null)}
              className="row-val"
              style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4 }}
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Chain offline error */}
        {error && (
          <div className="data-row" style={{ color: "#ef4444", marginBottom: 16, borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="row-key" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
              CHAIN OFFLINE
            </span>
            <span className="row-val">RETRYING...</span>
          </div>
        )}

        {/* Data Matrix */}
        <div className="data-matrix">
          {/* LATEST BLOCKS */}
          <div className="data-col" style={{ gridColumn: "span 2" }}>
            <div className="col-header">LATEST BLOCKS</div>

            {/* Table header row */}
            <div className="data-row" style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
              <span className="sys-label" style={{ flex: 1, marginBottom: 0 }}>HEIGHT</span>
              <span className="sys-label" style={{ flex: 2, marginBottom: 0 }}>HASH</span>
              <span className="sys-label" style={{ flex: 1, marginBottom: 0 }}>TIME</span>
              <span className="sys-label" style={{ flex: 1, marginBottom: 0 }}>TXS</span>
              <span className="sys-label" style={{ flex: 1, marginBottom: 0 }}>PROPOSER</span>
            </div>

            {blocks.length === 0 && !error && (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <span className="sys-label" style={{ fontSize: 11 }}>LOADING BLOCKS...</span>
              </div>
            )}

            {blocks.map((block) => (
              <div key={block.height} className="data-row">
                <span className="row-key" style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  #{block.height.toLocaleString()}
                </span>
                <span className="row-val" style={{ flex: 2, textAlign: "left", opacity: 0.5 }}>
                  {truncateHash(block.hash)}
                </span>
                <span className="row-val" style={{ flex: 1, textAlign: "left", opacity: 0.5 }}>
                  {timeAgo(block.time)}
                </span>
                <span className="row-val" style={{ flex: 1, textAlign: "left" }}>
                  {block.numTxs} {block.numTxs === 1 ? "tx" : "txs"}
                </span>
                <span className="row-val" style={{ flex: 1, opacity: 0.4 }}>
                  {truncateHash(block.proposer)}
                </span>
              </div>
            ))}
          </div>

          {/* VALIDATORS */}
          <div className="data-col">
            <div className="col-header">VALIDATORS</div>

            {validators.length === 0 && !error && (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <span className="sys-label" style={{ fontSize: 11 }}>LOADING VALIDATORS...</span>
              </div>
            )}

            {validators.map((val) => (
              <div key={val.operatorAddress}>
                <div className="data-row">
                  <span className="row-key">{val.moniker}</span>
                  <span className="row-val">{val.commission}</span>
                </div>
                <div className="spark-bar-container">
                  <div
                    className="spark-bar"
                    style={{
                      width: totalVotingPower > 0 ? `${(val.votingPower / totalVotingPower) * 100}%` : "0%",
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", opacity: 0.4, marginBottom: 8, marginTop: 2 }}>
                  {val.votingPower >= 1_000_000
                    ? `${(val.votingPower / 1_000_000).toFixed(1)}M`
                    : val.votingPower >= 1_000
                      ? `${(val.votingPower / 1_000).toFixed(1)}K`
                      : val.votingPower.toFixed(0)}{" "}
                  HEART
                </div>
              </div>
            ))}
          </div>

          {/* COMPUTE ORACLE */}
          <div className="data-col">
            <div className="col-header">COMPUTE ORACLE</div>

            {!computePrice ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <span className="sys-label" style={{ fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} className="animate-pulse-dot" />
                  ORACLE INITIALIZING
                </span>
              </div>
            ) : (
              <>
                <div className="data-row">
                  <span className="row-key">CLAUDE</span>
                  <span className="row-val">{computePrice.claudePrice}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">GPT</span>
                  <span className="row-val">{computePrice.gptPrice}</span>
                </div>
                <div className="data-row">
                  <span className="row-key">GEMINI</span>
                  <span className="row-val">{computePrice.geminiPrice}</span>
                </div>
                <div className="data-row" style={{ fontWeight: 700 }}>
                  <span className="row-key">BASKET</span>
                  <span className="row-val">{computePrice.basketPrice}</span>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="spark-row">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="row-key sys-label">CLAUDE_WEIGHT</span>
                      <span className="row-val">40%</span>
                    </div>
                    <div className="spark-bar-container"><div className="spark-bar" style={{ width: "40%" }} /></div>
                  </div>
                  <div className="spark-row">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="row-key sys-label">GPT_WEIGHT</span>
                      <span className="row-val">25%</span>
                    </div>
                    <div className="spark-bar-container"><div className="spark-bar" style={{ width: "25%" }} /></div>
                  </div>
                  <div className="spark-row">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="row-key sys-label">GEMINI_WEIGHT</span>
                      <span className="row-val">20%</span>
                    </div>
                    <div className="spark-bar-container"><div className="spark-bar" style={{ width: "20%" }} /></div>
                  </div>
                  <div className="spark-row">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="row-key sys-label">OPEN_SOURCE</span>
                      <span className="row-val">15%</span>
                    </div>
                    <div className="spark-bar-container"><div className="spark-bar" style={{ width: "15%" }} /></div>
                  </div>
                </div>

                {computePrice.lastUpdated && (
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <span className="sys-label">
                      LAST.UPDATED:{" "}
                      <span className="sys-value">{timeAgo(computePrice.lastUpdated)}</span>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <Link href="/" className="btn-primary" style={{ textDecoration: "none" }}>
            BACK TO DASHBOARD
          </Link>
        </div>
      </div>
    </div>
  )
}
