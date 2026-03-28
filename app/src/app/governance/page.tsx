"use client"

import { useState, useEffect, useCallback } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
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

const STATUS_COLORS: Record<ProposalStatus, { dot: string; badge: string; label: string }> = {
  active: {
    dot: "bg-[#3b82f6]",
    badge: "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]",
    label: "ACTIVE",
  },
  passed: {
    dot: "bg-[#22c55e]",
    badge: "bg-[rgba(34,197,94,0.12)] text-[#22c55e]",
    label: "PASSED",
  },
  rejected: {
    dot: "bg-[#ef4444]",
    badge: "bg-[rgba(239,68,68,0.12)] text-[#ef4444]",
    label: "REJECTED",
  },
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
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
              $HEART{" "}
              <span className="text-[rgba(255,255,255,0.4)]">
                Governance
              </span>
            </h1>
            <p className="text-sm text-[rgba(255,255,255,0.4)] font-light mt-2">
              Create and vote on proposals that shape the autonomous network.
            </p>
          </div>

          {/* CREATE PROPOSAL */}
          <div className="mb-10">
            <div className="aura-divider mb-5">CREATE.PROPOSAL</div>

            <div className="glass p-6 sm:p-8">
              {!isConnected ? (
                <div className="text-center py-8">
                  <div className="text-[rgba(255,255,255,0.3)] text-sm font-light mb-3">
                    Connect your wallet to create proposals
                  </div>
                  <div className="sys-badge">WALLET.REQUIRED</div>
                </div>
              ) : (
                <form onSubmit={handleCreateProposal} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Title */}
                    <div className="sm:col-span-2">
                      <label className="tech-label mb-2 block">
                        PROPOSAL.TITLE
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Increase entity spawn rate"
                        className="glass-input w-full px-4 py-3 text-sm"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-2">
                      <label className="tech-label mb-2 block">
                        DESCRIPTION
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the proposal and its rationale..."
                        className="glass-input w-full px-4 py-3 text-sm min-h-[100px] resize-y"
                        style={{ borderRadius: "var(--radius-panel)" }}
                        required
                      />
                    </div>

                    {/* Entity ID */}
                    <div className="sm:col-span-2">
                      <label className="tech-label mb-2 block">
                        ENTITY.ID
                      </label>
                      <input
                        type="text"
                        value={entityId}
                        onChange={(e) => setEntityId(e.target.value)}
                        placeholder="Your entity ID (must be Level 10+)"
                        className="glass-input w-full px-4 py-3 text-sm"
                        required
                      />
                      <p className="text-[10px] text-[rgba(255,255,255,0.25)] font-mono mt-2 tracking-wider">
                        ENTITIES MUST BE LEVEL 10+ TO PROPOSE
                      </p>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !title || !description || !entityId}
                      className="btn-primary px-8 py-3 text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {submitting ? "BROADCASTING..." : "CREATE PROPOSAL"}
                    </button>

                    {txHash && (
                      <span className="sys-badge text-[10px] truncate max-w-xs">
                        TX: {txHash.slice(0, 12)}...{txHash.slice(-6)}
                      </span>
                    )}

                    {submitError && (
                      <span className="text-[#ef4444] text-xs font-light truncate max-w-sm">
                        {submitError}
                      </span>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Chain offline warning */}
          {fetchError && (
            <div className="glass-sm p-4 mb-6 bg-[rgba(239,68,68,0.08)] text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] mr-2 align-middle" />
              <span className="text-[#ef4444] font-light">
                Chain offline or unreachable. Retrying every 10s...
              </span>
            </div>
          )}

          {/* Vote entity ID input (shown when connected) */}
          {isConnected && activeProposals.length > 0 && (
            <div className="glass-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
              <label className="tech-label whitespace-nowrap">
                YOUR.ENTITY.ID (FOR VOTING)
              </label>
              <input
                type="text"
                value={voteEntityId}
                onChange={(e) => setVoteEntityId(e.target.value)}
                placeholder="Enter your entity ID to vote"
                className="glass-input px-4 py-2 text-sm flex-1 min-w-[200px]"
              />
              {voteTxHash && (
                <span className="sys-badge text-[10px] truncate max-w-xs">
                  VOTE TX: {voteTxHash.slice(0, 12)}...{voteTxHash.slice(-6)}
                </span>
              )}
              {voteError && (
                <span className="text-[#ef4444] text-xs font-light truncate max-w-sm">
                  {voteError}
                </span>
              )}
            </div>
          )}

          {/* ACTIVE PROPOSALS */}
          <div className="mb-10">
            <div className="aura-divider mb-5">
              ACTIVE.PROPOSALS
              <span className="sys-badge ml-2">{activeProposals.length}</span>
            </div>

            {loading && proposals.length === 0 && !fetchError && (
              <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                Loading proposals from chain...
              </div>
            )}

            {!loading && activeProposals.length === 0 && !fetchError && (
              <div className="glass p-8 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                No active proposals. Create one above.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  canVote={isConnected && !!voteEntityId}
                  isVoting={votingId === proposal.id}
                  onVote={(option) => handleVote(proposal.id, option)}
                />
              ))}
            </div>
          </div>

          {/* PASSED / REJECTED */}
          {finishedProposals.length > 0 && (
            <div className="mb-12">
              <div className="aura-divider mb-5">
                PASSED./.REJECTED
                <span className="sys-badge ml-2">
                  {finishedProposals.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {finishedProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    canVote={false}
                    isVoting={false}
                    onVote={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

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

function ProposalCard({
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
  const noPercent = totalVotes > 0 ? (proposal.noVotes / totalVotes) * 100 : 0

  return (
    <div className="glass-sm p-5 flex flex-col gap-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors">
      {/* Header: status + ID */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full ${statusStyle.badge}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${proposal.status === "active" ? "animate-pulse-dot" : ""}`}
          />
          {statusStyle.label}
        </span>
        <span className="sys-badge text-[9px]">ID:{proposal.id}</span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-white leading-snug">
        {proposal.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-[rgba(255,255,255,0.4)] font-light line-clamp-3 leading-relaxed">
        {proposal.description}
      </p>

      {/* Proposer */}
      <div className="tech-label text-[9px]">
        PROPOSER:{" "}
        <span className="font-mono text-[rgba(255,255,255,0.5)]">
          {proposal.proposer
            ? `${proposal.proposer.slice(0, 10)}...${proposal.proposer.slice(-6)}`
            : "unknown"}
        </span>
      </div>

      {/* Vote tally bar */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-[#22c55e]">
            YES {proposal.yesVotes}
          </span>
          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">
            ABSTAIN {proposal.abstainVotes}
          </span>
          <span className="text-[10px] font-mono text-[#ef4444]">
            NO {proposal.noVotes}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden flex">
          {yesPercent > 0 && (
            <div
              className="h-full bg-[#22c55e] rounded-l-full"
              style={{ width: `${yesPercent}%` }}
            />
          )}
          {noPercent > 0 && (
            <div
              className="h-full bg-[#ef4444] rounded-r-full ml-auto"
              style={{ width: `${noPercent}%` }}
            />
          )}
        </div>
        <div className="text-center mt-1">
          <span className="tech-label text-[9px]">
            {totalVotes} TOTAL VOTE{totalVotes !== 1 ? "S" : ""}
          </span>
        </div>
      </div>

      {/* Vote buttons (only for active proposals) */}
      {proposal.status === "active" && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
          <button
            onClick={() => onVote("yes")}
            disabled={!canVote || isVoting}
            className="flex-1 px-3 py-2 text-[10px] font-mono tracking-wider rounded-full bg-[rgba(34,197,94,0.1)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isVoting ? "..." : "YES"}
          </button>
          <button
            onClick={() => onVote("no")}
            disabled={!canVote || isVoting}
            className="flex-1 px-3 py-2 text-[10px] font-mono tracking-wider rounded-full bg-[rgba(239,68,68,0.1)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isVoting ? "..." : "NO"}
          </button>
          <button
            onClick={() => onVote("abstain")}
            disabled={!canVote || isVoting}
            className="flex-1 px-3 py-2 text-[10px] font-mono tracking-wider rounded-full bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.1)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isVoting ? "..." : "ABSTAIN"}
          </button>
        </div>
      )}
    </div>
  )
}
