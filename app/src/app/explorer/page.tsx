"use client"

import { useState, useEffect, useCallback } from "react"
import { proxyFetch } from "@/lib/proxy"

interface ChainStatus { chainId: string; latestHeight: number; latestTime: string; catchingUp: boolean }
interface BlockInfo { height: number; hash: string; time: string; numTxs: number; proposer: string }
interface ValidatorInfo { moniker: string; votingPower: number; commission: string; operatorAddress: string; missedBlocks: number }
interface TxInfo { hash: string; height: string; code: number; action: string; sender: string; amount: string; module: string }

function truncHash(h: string): string { return h.length <= 16 ? h : `${h.slice(0, 10)}...${h.slice(-6)}` }
function formatHeart(raw: string): string {
  const n = parseInt(raw, 10)
  if (isNaN(n)) return raw
  const h = n / 1e6
  if (h >= 1e6) return `${(h / 1e6).toFixed(1)}M`
  if (h >= 1e3) return `${(h / 1e3).toFixed(1)}K`
  return h.toFixed(h < 1 ? 4 : 0)
}
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}
function msgLabel(action: string): string {
  if (action.includes("SubmitResearch")) return "SUBMIT RESEARCH"
  if (action.includes("RegisterEntity")) return "REGISTER ENTITY"
  if (action.includes("RegisterIdentity")) return "REGISTER ID"
  if (action.includes("UpdateCompute")) return "UPDATE COMPUTE"
  if (action.includes("Send")) return "SEND"
  if (action.includes("Delegate")) return "DELEGATE"
  if (action.includes("Vote")) return "VOTE"
  if (action.includes("Proposal")) return "PROPOSAL"
  return action.split(".").pop()?.replace("Msg", "") || action
}

export default function ExplorerPage() {
  const [status, setStatus] = useState<ChainStatus | null>(null)
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [validators, setValidators] = useState<ValidatorInfo[]>([])
  const [txs, setTxs] = useState<TxInfo[]>([])
  const [totalTxs, setTotalTxs] = useState(0)
  const [supply, setSupply] = useState("")
  const [communityPool, setCommunityPool] = useState("")
  const [inflation, setInflation] = useState("")
  const [bondedTokens, setBondedTokens] = useState("")
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      if (!res.ok) { setError(true); return null }
      const data = await res.json()
      const si = data.result?.sync_info
      if (!si) { setError(true); return null }
      setStatus({ chainId: data.result.node_info.network, latestHeight: parseInt(si.latest_block_height, 10), latestTime: si.latest_block_time, catchingUp: si.catching_up })
      setError(false)
      return parseInt(si.latest_block_height, 10)
    } catch { setError(true); return null }
  }, [])

  const fetchBlocks = useCallback(async (h: number) => {
    try {
      const res = await proxyFetch(`/blockchain?minHeight=${Math.max(1, h - 19)}&maxHeight=${h}`, "rpc")
      if (!res.ok) return
      const data = await res.json()
      const metas = data.result?.block_metas || []
      const parsed: BlockInfo[] = metas.map((m: { header: { height: string; time: string; proposer_address: string }; block_id: { hash: string }; num_txs: string }) => ({
        height: parseInt(m.header.height, 10), hash: m.block_id.hash, time: m.header.time,
        numTxs: parseInt(m.num_txs, 10), proposer: m.header.proposer_address,
      }))
      parsed.sort((a: BlockInfo, b: BlockInfo) => b.height - a.height)
      setBlocks(parsed)
    } catch { /* keep */ }
  }, [])

  const fetchTxs = useCallback(async () => {
    try {
      const res = await proxyFetch('/tx_search?query=%22tx.height%3E0%22&per_page=20&order_by=%22desc%22', "rpc")
      if (!res.ok) return
      const data = await res.json()
      const raw = data.result?.txs || []
      setTotalTxs(parseInt(data.result?.total_count || "0", 10))
      const parsed: TxInfo[] = raw.map((t: { hash: string; height: string; tx_result: { code: number; events: { type: string; attributes: { key: string; value: string }[] }[] } }) => {
        let action = "", sender = "", amount = "", module = ""
        for (const ev of t.tx_result?.events || []) {
          if (ev.type === "message") {
            for (const a of ev.attributes) {
              if (a.key === "action") action = a.value
              if (a.key === "sender") sender = a.value
              if (a.key === "module") module = a.value
            }
          }
          if (ev.type === "transfer") {
            for (const a of ev.attributes) {
              if (a.key === "amount") amount = a.value
            }
          }
        }
        return { hash: t.hash, height: t.height, code: t.tx_result?.code || 0, action, sender, amount, module }
      })
      setTxs(parsed)
    } catch { /* keep */ }
  }, [])

  const fetchValidators = useCallback(async () => {
    try {
      const [valRes, slashRes] = await Promise.all([
        proxyFetch("/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED", "rest"),
        proxyFetch("/cosmos/slashing/v1beta1/signing_infos", "rest"),
      ])
      if (!valRes.ok) return
      const valData = await valRes.json()
      const slashData = slashRes.ok ? await slashRes.json() : { info: [] }
      const missedMap = new Map<number, number>()
      ;(slashData.info || []).forEach((info: { missed_blocks_counter: string }, idx: number) => {
        missedMap.set(idx, parseInt(info.missed_blocks_counter || "0", 10))
      })
      const parsed: ValidatorInfo[] = (valData.validators || []).map((v: { description: { moniker: string }; tokens: string; commission: { commission_rates: { rate: string } }; operator_address: string }, idx: number) => ({
        moniker: v.description.moniker, votingPower: parseInt(v.tokens, 10) / 1e6,
        commission: (parseFloat(v.commission.commission_rates.rate) * 100).toFixed(0) + "%",
        operatorAddress: v.operator_address, missedBlocks: missedMap.get(idx) || 0,
      }))
      parsed.sort((a: ValidatorInfo, b: ValidatorInfo) => b.votingPower - a.votingPower)
      setValidators(parsed)
    } catch { /* keep */ }
  }, [])

  const fetchChainInfo = useCallback(async () => {
    try {
      const [supplyRes, poolRes, inflRes, stakingRes] = await Promise.all([
        proxyFetch("/cosmos/bank/v1beta1/supply", "rest"),
        proxyFetch("/cosmos/distribution/v1beta1/community_pool", "rest"),
        proxyFetch("/cosmos/mint/v1beta1/inflation", "rest"),
        proxyFetch("/cosmos/staking/v1beta1/pool", "rest"),
      ])
      if (supplyRes.ok) { const d = await supplyRes.json(); const s = (d.supply || []).find((x: { denom: string }) => x.denom === "uheart"); if (s) setSupply(s.amount) }
      if (poolRes.ok) { const d = await poolRes.json(); const p = (d.pool || []).find((x: { denom: string }) => x.denom === "uheart"); if (p) setCommunityPool(p.amount) }
      if (inflRes.ok) { const d = await inflRes.json(); setInflation((parseFloat(d.inflation || "0") * 100).toFixed(2)) }
      if (stakingRes.ok) { const d = await stakingRes.json(); setBondedTokens(d.pool?.bonded_tokens || "") }
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    async function init() { const h = await fetchStatus(); if (h) fetchBlocks(h) }
    init(); fetchValidators(); fetchTxs(); fetchChainInfo()
  }, [fetchStatus, fetchBlocks, fetchValidators, fetchTxs, fetchChainInfo])

  useEffect(() => {
    const i = setInterval(async () => { const h = await fetchStatus(); if (h) { fetchBlocks(h); fetchTxs() } }, 5000)
    return () => clearInterval(i)
  }, [fetchStatus, fetchBlocks, fetchTxs])

  useEffect(() => {
    const i = setInterval(() => { fetchValidators(); fetchChainInfo() }, 30000)
    return () => clearInterval(i)
  }, [fetchValidators, fetchChainInfo])

  function handleSearch() {
    const q = searchQuery.trim()
    if (!q) return
    if (/^\d+$/.test(q)) {
      const h = parseInt(q, 10)
      const b = blocks.find((b) => b.height === h)
      setSearchResult(b ? `Block #${h} — ${truncHash(b.hash)} — ${b.numTxs} txs — ${timeAgo(b.time)}` : status && h <= status.latestHeight ? `Block #${h} exists` : `Block #${h} not found`)
    } else if (q.startsWith("heart1")) { setSearchResult(`Address: ${q}`) }
    else if (q.length >= 40) { const tx = txs.find(t => t.hash.toLowerCase().startsWith(q.toLowerCase())); setSearchResult(tx ? `TX found — block ${tx.height} — ${msgLabel(tx.action)}` : `TX ${truncHash(q)} — lookup not available in cache`) }
    else { setSearchResult("Enter block height, tx hash, or heart1... address") }
  }

  const totalPower = validators.reduce((s, v) => s + v.votingPower, 0)
  const totalTxsWithActivity = blocks.reduce((s, b) => s + b.numTxs, 0)

  return (
    <main style={{ background: "#fff", minHeight: "100vh", color: "#121212" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ borderBottom: "2px solid #121212", paddingBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>Explorer</h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
                {status ? `${status.chainId} · block #${status.latestHeight.toLocaleString()} · ${timeAgo(status.latestTime)}` : "Connecting..."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: error ? "rgba(0,0,0,0.15)" : "#121212" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)" }}>{error ? "OFFLINE" : "LIVE"}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0, borderBottom: "1px solid #121212" }}>
          {[
            { label: "Block", value: status ? `#${status.latestHeight.toLocaleString()}` : "—" },
            { label: "Transactions", value: totalTxs > 0 ? totalTxs.toLocaleString() : "—" },
            { label: "Validators", value: String(validators.length || "—") },
            { label: "Supply", value: supply ? `${formatHeart(supply)} HEART` : "—" },
            { label: "Inflation", value: inflation ? `${inflation}%` : "—" },
            { label: "Bonded", value: bondedTokens ? `${formatHeart(bondedTokens)} HEART` : "—" },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "16px 0", borderRight: i < 5 ? "1px solid rgba(0,0,0,0.1)" : "none", paddingLeft: i > 0 ? 12 : 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
          <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchResult(null) }} onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }} placeholder="Search block height, tx hash, address..."
            style={{ flex: 1, padding: "14px 0", fontFamily: "var(--font-mono)", fontSize: 12, border: "none", background: "transparent", outline: "none", color: "#121212" }} />
          <button onClick={handleSearch} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 16px", color: "rgba(0,0,0,0.55)" }}>Search</button>
        </div>
        {searchResult && (
          <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.08)", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "space-between" }}>
            <span>{searchResult}</span>
            <button onClick={() => setSearchResult(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "rgba(0,0,0,0.3)" }}>×</button>
          </div>
        )}

        {/* 3-column layout: Blocks | Transactions | Validators + Chain */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 300px", gap: 0 }}>

          {/* Blocks */}
          <div style={{ borderRight: "1px solid #121212", paddingRight: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212" }}>
              Latest Blocks
            </div>
            {blocks.map((b) => (
              <div key={b.height} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>#{b.height.toLocaleString()}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)" }}>{truncHash(b.hash)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: b.numTxs > 0 ? "#121212" : "rgba(0,0,0,0.3)" }}>{b.numTxs} tx{b.numTxs !== 1 ? "s" : ""}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.35)" }}>{timeAgo(b.time)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Transactions */}
          <div style={{ borderRight: "1px solid #121212", paddingLeft: 20, paddingRight: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212", display: "flex", justifyContent: "space-between" }}>
              <span>Transactions</span>
              <span>{totalTxs.toLocaleString()} total</span>
            </div>
            {txs.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Loading txs...</div>
            )}
            {txs.map((tx) => (
              <div key={tx.hash} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: tx.code === 0 ? "#121212" : "rgba(0,0,0,0.3)" }}>
                    {msgLabel(tx.action)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.35)" }}>blk {tx.height}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "space-between" }}>
                  <span>{truncHash(tx.hash)}</span>
                  <span>{tx.amount ? tx.amount.replace("uheart", " uheart") : ""}</span>
                </div>
                {tx.sender && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.3)", marginTop: 2 }}>
                    from {truncHash(tx.sender)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Validators + Chain Info */}
          <div style={{ paddingLeft: 20 }}>
            {/* Validators */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212" }}>
              Validators ({validators.length})
            </div>
            {validators.map((v) => {
              const pct = totalPower > 0 ? (v.votingPower / totalPower) * 100 : 0
              return (
                <div key={v.operatorAddress} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{v.moniker}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.4)" }}>{v.commission}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#121212", borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.4)" }}>
                    <span>{formatHeart(String(Math.round(v.votingPower * 1e6)))} HEART ({pct.toFixed(1)}%)</span>
                    <span>{v.missedBlocks > 0 ? `${v.missedBlocks} missed` : "0 missed"}</span>
                  </div>
                </div>
              )
            })}

            {/* Chain Info */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0 8px", borderBottom: "1px solid #121212", marginTop: 8 }}>
              Chain
            </div>
            {[
              { label: "Chain ID", value: status?.chainId || "—" },
              { label: "Consensus", value: "CometBFT" },
              { label: "SDK", value: "Cosmos SDK v0.50" },
              { label: "Block Time", value: "~6s" },
              { label: "Inflation", value: inflation ? `${inflation}%` : "—" },
              { label: "Community Pool", value: communityPool ? `${(parseInt(communityPool) / 1e6).toFixed(2)} HEART` : "—" },
              { label: "Total Supply", value: supply ? `${formatHeart(supply)} HEART` : "—" },
              { label: "Txs (recent 20)", value: `${totalTxsWithActivity} with txs` },
              { label: "Modules", value: "identity, compute, existence" },
              { label: "Denom", value: "uheart" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 11 }}>
                <span style={{ color: "rgba(0,0,0,0.5)" }}>{r.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.7)", textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
