"use client"

import { useState, useEffect, useCallback } from "react"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { proxyFetch } from "@/lib/proxy"
import { createProposal, voteProposal } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

type ProposalStatus = "active" | "passed" | "rejected"

interface Proposal {
  id: string
  title: string
  description: string
  proposer: string
  entityId: string
  yesVotes: number
  noVotes: number
  abstainVotes: number
  status: ProposalStatus
}

const STATUS_COLORS: Record<ProposalStatus, { label: string; color: string }> = {
  active: { label: "ACTIVE", color: "#3b82f6" },
  passed: { label: "PASSED", color: "#22c55e" },
  rejected: { label: "REJECTED", color: "#ef4444" },
}

/**
 * Parse the list_proposals REST response.
 * The chain may return proposals in nested JSON or a direct array.
 */
function parseProposals(data: unknown): Proposal[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any

    let proposalArray =
      raw?.proposals ?? raw?.Proposal ?? raw?.proposal ?? null

    if (typeof proposalArray === "string") {
      proposalArray = JSON.parse(proposalArray)
    }

    if (!Array.isArray(proposalArray)) {
      const keys = Object.keys(raw || {})
      for (const key of keys) {
        const candidate = raw[key]
        if (Array.isArray(candidate)) {
          proposalArray = candidate
          break
        }
        if (typeof candidate === "string") {
          try {
            const parsed = JSON.parse(candidate)
            if (Array.isArray(parsed)) {
              proposalArray = parsed
              break
            }
          } catch {
            // not JSON
          }
        }
      }
    }

    if (!Array.isArray(proposalArray)) return []

    return proposalArray.map(
      (p: Record<string, unknown>, index: number) => ({
        id: String(p.id ?? p.Id ?? p.index ?? index),
        title: String(p.title ?? p.Title ?? "Untitled"),
        description: String(p.description ?? p.Description ?? ""),
        proposer: String(p.proposer ?? p.creator ?? p.Creator ?? ""),
        entityId: String(p.entityId ?? p.entity_id ?? ""),
        yesVotes: Number(p.yesVotes ?? p.yes_votes ?? p.yesCount ?? 0),
        noVotes: Number(p.noVotes ?? p.no_votes ?? p.noCount ?? 0),
        abstainVotes: Number(
          p.abstainVotes ?? p.abstain_votes ?? p.abstainCount ?? 0
        ),
        status: normalizeStatus(String(p.status ?? p.Status ?? "active")),
      })
    )
  } catch {
    return []
  }
}

function normalizeStatus(s: string): ProposalStatus {
  const lower = s.toLowerCase()
  if (lower === "passed" || lower === "accepted") return "passed"
  if (lower === "rejected" || lower === "failed") return "rejected"
  return "active"
}

export default function GovernancePage() {
  const wallet = useAppStore((s) => s.wallet)
  const isConnected = !!wallet.address

  // Create proposal form
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [entityId, setEntityId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Proposals state
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [fetchError, setFetchError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Voting state
  const [votingId, setVotingId] = useState<string | null>(null)
  const [voteEntityId, setVoteEntityId] = useState("")
  const [voteTxHash, setVoteTxHash] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  const fetchProposals = useCallback(async () => {
    try {
      const res = await proxyFetch(
        "/heart/existence/list_proposals", "rest"
      )
      const data = await res.json()
      const parsed = parseProposals(data)
      setProposals(parsed)
      setFetchError(false)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProposals()
    const interval = setInterval(fetchProposals, 10_000)
    return () => clearInterval(interval)
  }, [fetchProposals])

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault()
    if (!isConnected) return

    setSubmitting(true)
    setTxHash(null)
    setSubmitError(null)

    try {
      const hash = await createProposal(title, description, entityId)
      setTxHash(hash)
      setTitle("")
      setDescription("")
      setEntityId("")
      setTimeout(fetchProposals, 3000)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Transaction failed"
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVote(proposalId: string, option: string) {
    if (!isConnected || !voteEntityId) return

    setVotingId(proposalId)
    setVoteTxHash(null)
    setVoteError(null)

    try {
      const hash = await voteProposal(proposalId, voteEntityId, option)
      setVoteTxHash(hash)
      setTimeout(fetchProposals, 3000)
    } catch (err) {
      setVoteError(
        err instanceof Error ? err.message : "Vote failed"
      )
    } finally {
      setVotingId(null)
    }
  }

  const activeProposals = proposals.filter((p) => p.status === "active")
  const finishedProposals = proposals.filter(
    (p) => p.status === "passed" || p.status === "rejected"
  )

  return (
    <div className="flex flex-col min-h-screen">
      <NetworkBar />

      {/* ── ZONE DARK ── */}
      <div className="zone-dark">
        <header style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 16, marginBottom: 32 }}>
          <div>
            <span className="sys-label">SYSTEM OPERATION</span>
            <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              GOVERNANCE // DELIBERATION PROTOCOL
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span className="sys-label">ACTIVE PROTOCOL</span>
            <div className="sys-value">CONSENSUS_VOTE_V1</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="sys-label">PROPOSALS</span>
            <div className="sys-value">{proposals.length} REGISTERED</div>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", paddingBottom: 24 }}>
          <div>
            <span className="sys-label">ACTIVE PROPOSALS</span>
            <div className="dot-hero">{activeProposals.length}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="sys-label">PROPOSAL BREAKDOWN</span>
              <span className="sys-value">{proposals.length} TOTAL</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="spark-row">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="row-key sys-label">ACTIVE</span>
                  <span className="row-val">{activeProposals.length}</span>
                </div>
                <div className="spark-bar-container">
                  <div className="spark-bar" style={{ width: proposals.length > 0 ? `${(activeProposals.length / proposals.length) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="spark-row">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="row-key sys-label">PASSED</span>
                  <span className="row-val">{finishedProposals.filter(p => p.status === "passed").length}</span>
                </div>
                <div className="spark-bar-container">
                  <div className="spark-bar" style={{ width: proposals.length > 0 ? `${(finishedProposals.filter(p => p.status === "passed").length / proposals.length) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="spark-row">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="row-key sys-label">REJECTED</span>
                  <span className="row-val">{finishedProposals.filter(p => p.status === "rejected").length}</span>
                </div>
                <div className="spark-bar-container">
                  <div className="spark-bar" style={{ width: proposals.length > 0 ? `${(finishedProposals.filter(p => p.status === "rejected").length / proposals.length) * 100}%` : "0%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ZONE TRANSITION ── */}
      <div className="zone-transition" />

      {/* ── ZONE LIGHT ── */}
      <div className="zone-light">
        {/* CREATE PROPOSAL */}
        <div className="col-header">CREATE PROPOSAL</div>

        {!isConnected ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <span className="sys-label" style={{ fontSize: 11 }}>WALLET.REQUIRED — CONNECT TO CREATE PROPOSALS</span>
          </div>
        ) : (
          <form onSubmit={handleCreateProposal} style={{ marginBottom: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="sys-label" style={{ marginBottom: 6 }}>PROPOSAL.TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Increase entity spawn rate"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "transparent",
                    color: "var(--fg)",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="sys-label" style={{ marginBottom: 6 }}>DESCRIPTION</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the proposal and its rationale..."
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "transparent",
                    color: "var(--fg)",
                    outline: "none",
                    minHeight: 80,
                    resize: "vertical",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="sys-label" style={{ marginBottom: 6 }}>ENTITY.ID</label>
                <input
                  type="text"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="Your entity ID (must be Level 10+)"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "transparent",
                    color: "var(--fg)",
                    outline: "none",
                  }}
                />
                <span className="sys-label" style={{ marginTop: 4, display: "block" }}>ENTITIES MUST BE LEVEL 10+ TO PROPOSE</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                type="submit"
                disabled={submitting || !title || !description || !entityId}
                className="btn-primary"
                style={{ opacity: submitting || !title || !description || !entityId ? 0.4 : 1, cursor: submitting ? "wait" : "pointer" }}
              >
                {submitting ? "BROADCASTING..." : "CREATE PROPOSAL"}
              </button>

              {txHash && (
                <span className="sys-value" style={{ fontSize: 10, opacity: 0.6 }}>
                  TX: {txHash.slice(0, 12)}...{txHash.slice(-6)}
                </span>
              )}

              {submitError && (
                <span style={{ color: "#ef4444", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                  {submitError}
                </span>
              )}
            </div>
          </form>
        )}

        {/* Chain offline warning */}
        {fetchError && (
          <div className="data-row" style={{ color: "#ef4444", marginBottom: 16, borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="row-key" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
              CHAIN OFFLINE
            </span>
            <span className="row-val">RETRYING EVERY 10S</span>
          </div>
        )}

        {/* Vote entity ID input */}
        {isConnected && activeProposals.length > 0 && (
          <div style={{ marginBottom: 24, padding: "12px 0", borderTop: "1px dotted rgba(0,0,0,0.15)", borderBottom: "1px dotted rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span className="sys-label" style={{ whiteSpace: "nowrap", marginBottom: 0 }}>YOUR.ENTITY.ID (FOR VOTING)</span>
              <input
                type="text"
                value={voteEntityId}
                onChange={(e) => setVoteEntityId(e.target.value)}
                placeholder="Enter your entity ID to vote"
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "8px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "transparent",
                  color: "var(--fg)",
                  outline: "none",
                }}
              />
              {voteTxHash && (
                <span className="sys-value" style={{ fontSize: 10, opacity: 0.6 }}>
                  VOTE TX: {voteTxHash.slice(0, 12)}...{voteTxHash.slice(-6)}
                </span>
              )}
              {voteError && (
                <span style={{ color: "#ef4444", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                  {voteError}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE PROPOSALS */}
        <div className="col-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>ACTIVE PROPOSALS</span>
          <span className="sys-value" style={{ fontSize: 11 }}>{activeProposals.length}</span>
        </div>

        {loading && proposals.length === 0 && !fetchError && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <span className="sys-label" style={{ fontSize: 11 }}>LOADING PROPOSALS FROM CHAIN...</span>
          </div>
        )}

        {!loading && activeProposals.length === 0 && !fetchError && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <span className="sys-label" style={{ fontSize: 11 }}>NO ACTIVE PROPOSALS. CREATE ONE ABOVE.</span>
          </div>
        )}

        {activeProposals.map((proposal) => (
          <ProposalRow
            key={proposal.id}
            proposal={proposal}
            canVote={isConnected && !!voteEntityId}
            isVoting={votingId === proposal.id}
            onVote={(option) => handleVote(proposal.id, option)}
          />
        ))}

        {/* PASSED / REJECTED */}
        {finishedProposals.length > 0 && (
          <>
            <div className="col-header" style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>PASSED / REJECTED</span>
              <span className="sys-value" style={{ fontSize: 11 }}>{finishedProposals.length}</span>
            </div>

            {finishedProposals.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                proposal={proposal}
                canVote={false}
                isVoting={false}
                onVote={() => {}}
              />
            ))}
          </>
        )}

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

function ProposalRow({
  proposal,
  canVote,
  isVoting,
  onVote,
}: {
  proposal: Proposal
  canVote: boolean
  isVoting: boolean
  onVote: (option: string) => void
}) {
  const statusStyle = STATUS_COLORS[proposal.status]
  const totalVotes = proposal.yesVotes + proposal.noVotes + proposal.abstainVotes
  const yesPercent = totalVotes > 0 ? (proposal.yesVotes / totalVotes) * 100 : 0

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px dotted rgba(0,0,0,0.15)" }}>
      {/* Row 1: status, title, ID */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "2px 8px",
              border: `1px solid ${statusStyle.color}`,
              color: statusStyle.color,
            }}
          >
            {statusStyle.label}
          </span>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{proposal.title}</span>
        </div>
        <span className="sys-label" style={{ marginBottom: 0 }}>ID:{proposal.id}</span>
      </div>

      {/* Row 2: description */}
      <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8, maxWidth: "80ch" }}>
        {proposal.description}
      </div>

      {/* Row 3: proposer + votes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span className="sys-label" style={{ marginBottom: 0, fontSize: 9 }}>
          PROPOSER: <span className="sys-value" style={{ fontSize: 10 }}>
            {proposal.proposer
              ? `${proposal.proposer.slice(0, 10)}...${proposal.proposer.slice(-6)}`
              : "unknown"}
          </span>
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "var(--font-mono)", fontSize: 10 }}>
          <span style={{ color: "#22c55e" }}>YES {proposal.yesVotes}</span>
          <span style={{ opacity: 0.4 }}>ABSTAIN {proposal.abstainVotes}</span>
          <span style={{ color: "#ef4444" }}>NO {proposal.noVotes}</span>
          <span style={{ opacity: 0.3 }}>{totalVotes} TOTAL</span>
        </div>
      </div>

      {/* Vote tally spark bar */}
      <div className="spark-bar-container" style={{ marginTop: 6 }}>
        <div className="spark-bar" style={{ width: `${yesPercent}%` }} />
      </div>

      {/* Vote buttons (only for active proposals) */}
      {proposal.status === "active" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {(["yes", "no", "abstain"] as const).map((option) => (
            <button
              key={option}
              onClick={() => onVote(option)}
              disabled={!canVote || isVoting}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "6px 20px",
                border: "1px solid var(--fg)",
                background: "transparent",
                color: "var(--fg)",
                cursor: !canVote || isVoting ? "not-allowed" : "pointer",
                opacity: !canVote || isVoting ? 0.3 : 1,
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (canVote && !isVoting) {
                  e.currentTarget.style.background = "var(--fg)"
                  e.currentTarget.style.color = "var(--bg)"
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = "var(--fg)"
              }}
            >
              {isVoting ? "..." : option.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
