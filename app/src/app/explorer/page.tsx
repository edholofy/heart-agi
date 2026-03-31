"use client"

import { useState, useEffect, useCallback } from "react"
import { proxyFetch } from "@/lib/proxy"

const REFRESH_INTERVAL = 5000

interface ChainStatus { chainId: string; latestHeight: number; latestTime: string; catchingUp: boolean }
interface BlockInfo { height: number; hash: string; time: string; numTxs: number; proposer: string }
interface ValidatorInfo { moniker: string; votingPower: number; commission: string; operatorAddress: string }
interface StakingPool { bondedTokens: string; notBondedTokens: string }

function truncHash(h: string): string { return h.length <= 14 ? h : `${h.slice(0, 10)}...${h.slice(-6)}` }
function formatTokens(raw: string): string {
  const a = parseInt(raw, 10) / 1_000_000
  if (a >= 1e9) return `${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${(a / 1e3).toFixed(1)}K`
  return a.toFixed(0)
}
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function ExplorerPage() {
  const [status, setStatus] = useState<ChainStatus | null>(null)
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [validators, setValidators] = useState<ValidatorInfo[]>([])
  const [pool, setPool] = useState<StakingPool | null>(null)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      const data = await res.json()
      const si = data.result.sync_info
      setStatus({
        chainId: data.result.node_info.network,
        latestHeight: parseInt(si.latest_block_height, 10),
        latestTime: si.latest_block_time,
        catchingUp: si.catching_up,
      })
      setError(false)
      return parseInt(si.latest_block_height, 10)
    } catch { setError(true); return null }
  }, [])

  const fetchBlocks = useCallback(async (h: number) => {
    try {
      const res = await proxyFetch(`/blockchain?minHeight=${Math.max(1, h - 19)}&maxHeight=${h}`, "rpc")
      const data = await res.json()
      const metas = data.result.block_metas || []
      const parsed: BlockInfo[] = metas.map((m: { header: { height: string; time: string; proposer_address: string }; block_id: { hash: string }; num_txs: string }) => ({
        height: parseInt(m.header.height, 10), hash: m.block_id.hash, time: m.header.time,
        numTxs: parseInt(m.num_txs, 10), proposer: m.header.proposer_address,
      }))
      parsed.sort((a: BlockInfo, b: BlockInfo) => b.height - a.height)
      setBlocks(parsed)
    } catch { /* keep */ }
  }, [])

  const fetchValidators = useCallback(async () => {
    try {
      const res = await proxyFetch("/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED", "rest")
      const data = await res.json()
      const parsed: ValidatorInfo[] = (data.validators || []).map((v: { description: { moniker: string }; tokens: string; commission: { commission_rates: { rate: string } }; operator_address: string }) => ({
        moniker: v.description.moniker, votingPower: parseInt(v.tokens, 10) / 1e6,
        commission: (parseFloat(v.commission.commission_rates.rate) * 100).toFixed(0) + "%",
        operatorAddress: v.operator_address,
      }))
      parsed.sort((a: ValidatorInfo, b: ValidatorInfo) => b.votingPower - a.votingPower)
      setValidators(parsed)
    } catch { /* keep */ }
  }, [])

  const fetchPool = useCallback(async () => {
    try {
      const res = await proxyFetch("/cosmos/staking/v1beta1/pool", "rest")
      const data = await res.json()
      setPool({ bondedTokens: data.pool.bonded_tokens, notBondedTokens: data.pool.not_bonded_tokens })
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    async function init() { const h = await fetchStatus(); if (h) fetchBlocks(h) }
    init(); fetchValidators(); fetchPool()
  }, [fetchStatus, fetchBlocks, fetchValidators, fetchPool])

  useEffect(() => {
    const i = setInterval(async () => { const h = await fetchStatus(); if (h) fetchBlocks(h) }, REFRESH_INTERVAL)
    return () => clearInterval(i)
  }, [fetchStatus, fetchBlocks])

  useEffect(() => {
    const i = setInterval(() => { fetchValidators(); fetchPool() }, 30000)
    return () => clearInterval(i)
  }, [fetchValidators, fetchPool])

  function handleSearch() {
    const q = searchQuery.trim()
    if (!q) return
    if (/^\d+$/.test(q)) {
      const h = parseInt(q, 10)
      const b = blocks.find((b) => b.height === h)
      setSearchResult(b ? `Block #${h} — hash: ${truncHash(b.hash)} — ${b.numTxs} txs — ${timeAgo(b.time)}` : status && h <= status.latestHeight ? `Block #${h} exists on chain` : `Block #${h} not found`)
    } else if (q.startsWith("heart1")) {
      setSearchResult(`Address: ${q}`)
    } else {
      setSearchResult("Enter a block height or heart1... address")
    }
  }

  const totalPower = validators.reduce((s, v) => s + v.votingPower, 0)

  return (
    <main style={{ background: "#fff", minHeight: "100vh", color: "#121212" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ borderBottom: "2px solid #121212", paddingBottom: 20, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
                Explorer
              </h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
                {status ? `${status.chainId} · block #${status.latestHeight.toLocaleString()} · ${timeAgo(status.latestTime)}` : "Connecting..."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: error ? "rgba(0,0,0,0.15)" : "#121212" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)" }}>
                {error ? "OFFLINE" : status?.catchingUp ? "SYNCING" : "LIVE"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderBottom: "1px solid #121212" }}>
          {[
            { label: "Block Height", value: status ? `#${status.latestHeight.toLocaleString()}` : "—" },
            { label: "Validators", value: validators.length > 0 ? String(validators.length) : "—" },
            { label: "Bonded", value: pool ? `${formatTokens(pool.bondedTokens)} HEART` : "—" },
            { label: "Unbonded", value: pool ? `${formatTokens(pool.notBondedTokens)} HEART` : "—" },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "20px 0", borderRight: i < 3 ? "1px solid rgba(0,0,0,0.1)" : "none", paddingLeft: i > 0 ? 20 : 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #121212" }}>
          <input
            type="text" value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchResult(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
            placeholder="Search block height, tx hash, address..."
            style={{ flex: 1, padding: "14px 0", fontFamily: "var(--font-mono)", fontSize: 12, border: "none", background: "transparent", outline: "none" }}
          />
          <button onClick={handleSearch} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 16px", color: "rgba(0,0,0,0.55)" }}>
            Search
          </button>
        </div>
        {searchResult && (
          <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.1)", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "space-between" }}>
            <span>{searchResult}</span>
            <button onClick={() => setSearchResult(null)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)" }}>×</button>
          </div>
        )}

        {/* Two columns: Blocks + Validators */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0 }}>

          {/* Blocks */}
          <div style={{ borderRight: "1px solid #121212", paddingRight: 32 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212" }}>
              Latest Blocks ({blocks.length})
            </div>

            {blocks.length === 0 && !error && (
              <div style={{ padding: "32px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Loading blocks...</div>
            )}

            {blocks.map((block) => (
              <div key={block.height} style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "grid", gridTemplateColumns: "80px 1fr 60px 60px", gap: 12, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>
                  #{block.height.toLocaleString()}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {truncHash(block.hash)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.4)", textAlign: "right" }}>
                  {block.numTxs} tx{block.numTxs !== 1 ? "s" : ""}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textAlign: "right" }}>
                  {timeAgo(block.time)}
                </span>
              </div>
            ))}
          </div>

          {/* Right: Validators + Chain Info */}
          <div style={{ paddingLeft: 32 }}>
            {/* Validators */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212" }}>
              Validators ({validators.length})
            </div>

            {validators.map((val) => {
              const pct = totalPower > 0 ? (val.votingPower / totalPower) * 100 : 0
              return (
                <div key={val.operatorAddress} style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{val.moniker}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)" }}>{val.commission}</span>
                  </div>
                  {/* Power bar */}
                  <div style={{ height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#121212", borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)" }}>
                    <span>{val.votingPower >= 1e6 ? `${(val.votingPower / 1e6).toFixed(1)}M` : val.votingPower >= 1e3 ? `${(val.votingPower / 1e3).toFixed(1)}K` : val.votingPower.toFixed(0)} HEART</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}

            {/* Chain details */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212", marginTop: 8 }}>
              Chain
            </div>
            {[
              { label: "Chain ID", value: status?.chainId || "—" },
              { label: "Consensus", value: "CometBFT" },
              { label: "SDK", value: "Cosmos SDK v0.50" },
              { label: "Block Time", value: "~6s" },
              { label: "Modules", value: "identity, compute, existence" },
              { label: "Denom", value: "uheart" },
              { label: "RPC", value: "5.161.47.118:26657" },
              { label: "REST", value: "5.161.47.118:1317" },
              { label: "P2P", value: "5.161.47.118:26656" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", fontSize: 12 }}>
                <span style={{ color: "rgba(0,0,0,0.55)" }}>{r.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.7)" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
