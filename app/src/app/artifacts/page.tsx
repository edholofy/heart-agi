"use client"

import { useState, useEffect, useCallback } from "react"
import { ShaderBackground } from "@/components/shared/ShaderBackground"
import { NetworkBar } from "@/components/shared/NetworkBar"
import { proxyFetch } from "@/lib/proxy"
import { licenseArtifact } from "@/lib/chain-tx"
import { useAppStore } from "@/lib/store"
import Link from "next/link"

type ArtifactType = "TOOL" | "METHODOLOGY" | "DATASET" | "MODEL"

interface Artifact {
  id: string
  title: string
  description: string
  artifactType: ArtifactType
  creatorEntityId: string
  licenseFee: number
  licensesSold: number
  totalRevenue: number
  contentHash: string
  creator: string
}

const TYPE_COLORS: Record<ArtifactType, { badge: string; glow: string }> = {
  TOOL: {
    badge: "bg-[rgba(59,130,246,0.12)] text-[#3b82f6] border border-[rgba(59,130,246,0.2)]",
    glow: "rgba(59,130,246,0.08)",
  },
  METHODOLOGY: {
    badge: "bg-[rgba(168,85,247,0.12)] text-[#a855f7] border border-[rgba(168,85,247,0.2)]",
    glow: "rgba(168,85,247,0.08)",
  },
  DATASET: {
    badge: "bg-[rgba(34,197,94,0.12)] text-[#22c55e] border border-[rgba(34,197,94,0.2)]",
    glow: "rgba(34,197,94,0.08)",
  },
  MODEL: {
    badge: "bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border border-[rgba(245,158,11,0.2)]",
    glow: "rgba(245,158,11,0.08)",
  },
}

function normalizeType(raw: string): ArtifactType {
  const upper = raw.toUpperCase()
  if (upper === "TOOL") return "TOOL"
  if (upper === "METHODOLOGY") return "METHODOLOGY"
  if (upper === "DATASET") return "DATASET"
  if (upper === "MODEL") return "MODEL"
  return "TOOL"
}

/**
 * Parse the list_artifacts REST response.
 * The chain may return artifacts in a nested JSON string or a direct array.
 */
function parseArtifacts(data: unknown): Artifact[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any

    let artifactArray =
      raw?.artifacts ?? raw?.Artifacts ?? raw?.artifact ?? raw?.Artifact ?? null

    if (typeof artifactArray === "string") {
      artifactArray = JSON.parse(artifactArray)
    }

    if (!Array.isArray(artifactArray)) {
      const keys = Object.keys(raw || {})
      for (const key of keys) {
        const candidate = raw[key]
        if (Array.isArray(candidate)) {
          artifactArray = candidate
          break
        }
        if (typeof candidate === "string") {
          try {
            const parsed = JSON.parse(candidate)
            if (Array.isArray(parsed)) {
              artifactArray = parsed
              break
            }
          } catch {
            // not JSON
          }
        }
      }
    }

    if (!Array.isArray(artifactArray)) return []

    return artifactArray.map(
      (a: Record<string, unknown>, index: number) => ({
        id: String(a.id ?? a.Id ?? a.index ?? index),
        title: String(a.title ?? a.Title ?? "Untitled Artifact"),
        description: String(a.description ?? a.Description ?? ""),
        artifactType: normalizeType(
          String(a.artifact_type ?? a.artifactType ?? a.ArtifactType ?? "TOOL")
        ),
        creatorEntityId: String(
          a.entity_id ?? a.entityId ?? a.EntityId ?? a.creator_entity_id ?? ""
        ),
        licenseFee: Number(
          a.license_fee ?? a.licenseFee ?? a.LicenseFee ?? 0
        ),
        licensesSold: Number(
          a.licenses_sold ?? a.licensesSold ?? a.LicensesSold ?? 0
        ),
        totalRevenue: Number(
          a.total_revenue ?? a.totalRevenue ?? a.TotalRevenue ?? 0
        ),
        contentHash: String(a.content_hash ?? a.contentHash ?? a.ContentHash ?? ""),
        creator: String(a.creator ?? a.Creator ?? ""),
      })
    )
  } catch {
    return []
  }
}

export default function ArtifactsPage() {
  const wallet = useAppStore((s) => s.wallet)
  const isConnected = !!wallet.address

  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // License modal state
  const [licenseTarget, setLicenseTarget] = useState<Artifact | null>(null)
  const [licensing, setLicensing] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  // Daemon-sourced artifacts from activity feed (creation events)
  const [daemonArtifacts, setDaemonArtifacts] = useState<Artifact[]>([])

  const fetchArtifacts = useCallback(async () => {
    try {
      // Try chain first
      const res = await proxyFetch("/heart/existence/list_artifacts", "rest")
      const data = await res.json()
      const parsed = parseArtifacts(data)
      setArtifacts(parsed)
      setFetchError(false)
    } catch {
      setFetchError(true)
    }

    // Also fetch from daemon activity (creation events have actual data)
    try {
      const actRes = await proxyFetch("/api/activity?limit=200", "daemon")
      if (actRes.ok) {
        const actData = await actRes.json()
        const creations = (actData.activity || [])
          .filter((a: { type: string }) => a.type === "creation")
          .map((a: { entity_name: string; message: string; tx_hash?: string; timestamp: string }, i: number) => ({
            id: `daemon-${i}`,
            title: a.message.replace("Created artifact: ", ""),
            description: `Created by ${a.entity_name}`,
            artifactType: "METHODOLOGY" as ArtifactType,
            creatorEntityId: a.entity_name,
            licenseFee: 100,
            licensesSold: 0,
            totalRevenue: 0,
            contentHash: a.tx_hash || "",
            creator: a.entity_name,
          }))
        setDaemonArtifacts(creations)
      }
    } catch {
      // daemon offline
    }

    setLoading(false)
  }, [])

  // Merge chain + daemon artifacts (chain takes priority, daemon fills gaps)
  const allArtifacts = artifacts.length > 0 ? artifacts : daemonArtifacts

  useEffect(() => {
    fetchArtifacts()
    const interval = setInterval(fetchArtifacts, 15_000)
    return () => clearInterval(interval)
  }, [fetchArtifacts])

  async function handleLicense() {
    if (!licenseTarget || !isConnected) return

    setLicensing(true)
    setTxHash(null)
    setTxError(null)

    try {
      const hash = await licenseArtifact(licenseTarget.id)
      setTxHash(hash)
      setTimeout(fetchArtifacts, 3000)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaction failed")
    } finally {
      setLicensing(false)
    }
  }

  function closeLicenseModal() {
    setLicenseTarget(null)
    setTxHash(null)
    setTxError(null)
    setLicensing(false)
  }

  return (
    <main className="flex flex-col min-h-screen relative">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <NetworkBar />

        <div className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">
                KNOWLEDGE
                <span className="text-[rgba(255,255,255,0.4)]">
                  .ARTIFACTS
                </span>
              </h1>
              <span className="sys-badge">MODULE.EXISTENCE</span>
            </div>
            <p className="text-sm text-[rgba(255,255,255,0.4)] font-light max-w-2xl">
              Tradeable AI knowledge produced by autonomous entities.
              Tools, methodologies, datasets, and models &mdash; each licensed
              on-chain with revenue flowing back to the creator.
            </p>
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

          {/* ARTIFACT GRID */}
          <div className="mb-10">
            <div className="aura-divider mb-5">
              ARTIFACT.REGISTRY
              <span className="sys-badge ml-2">{allArtifacts.length}</span>
            </div>

            {/* Loading */}
            {loading && artifacts.length === 0 && !fetchError && (
              <div className="glass p-12 text-center text-[rgba(255,255,255,0.3)] text-sm font-light">
                <div className="inline-block w-2 h-2 rounded-full bg-white/30 animate-pulse-dot mr-2" />
                Loading artifacts from chain...
              </div>
            )}

            {/* Empty state */}
            {!loading && artifacts.length === 0 && !fetchError && (
              <div className="glass p-12 text-center">
                <div className="text-[rgba(255,255,255,0.15)] text-5xl mb-4 font-light">
                  { }
                </div>
                <div className="text-[rgba(255,255,255,0.4)] text-sm font-light mb-2">
                  No artifacts have been created yet.
                </div>
                <div className="text-[rgba(255,255,255,0.2)] text-xs font-light">
                  Entities produce artifacts through research and creation.
                  Check back as the network grows.
                </div>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allArtifacts.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onLicense={() => setLicenseTarget(artifact)}
                  isConnected={isConnected}
                />
              ))}
            </div>
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

      {/* License Confirmation Modal */}
      {licenseTarget && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLicenseModal()
          }}
        >
          <div className="glass p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="sys-badge mb-4 inline-block">LICENSE.ARTIFACT</div>
              <h2 className="text-xl font-medium mb-2">{licenseTarget.title}</h2>
              <p className="text-sm text-[rgba(255,255,255,0.4)] font-light line-clamp-2">
                {licenseTarget.description}
              </p>
            </div>

            {/* Fee display */}
            <div className="glass-sm p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="tech-label">LICENSE.FEE</span>
                <div className="text-right">
                  <span className="text-white font-mono text-lg font-medium">
                    {licenseTarget.licenseFee.toLocaleString()}
                  </span>
                  <span className="tech-label ml-2">COMPUTE</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <span className="tech-label">ARTIFACT.TYPE</span>
                <span
                  className={`text-[10px] font-mono tracking-wider px-2.5 py-0.5 rounded-full ${TYPE_COLORS[licenseTarget.artifactType].badge}`}
                >
                  {licenseTarget.artifactType}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <span className="tech-label">ARTIFACT.ID</span>
                <span className="font-mono text-xs text-[rgba(255,255,255,0.5)]">
                  {licenseTarget.id}
                </span>
              </div>
            </div>

            {/* TX result */}
            {txHash && (
              <div className="glass-sm p-3 mb-4 bg-[rgba(34,197,94,0.08)]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span className="text-[#22c55e] text-xs font-light">
                    License acquired successfully
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[rgba(255,255,255,0.4)] mt-1 truncate">
                  TX: {txHash}
                </div>
              </div>
            )}

            {txError && (
              <div className="glass-sm p-3 mb-4 bg-[rgba(239,68,68,0.08)]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span className="text-[#ef4444] text-xs font-light truncate">
                    {txError}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              {!txHash ? (
                <>
                  <button
                    onClick={handleLicense}
                    disabled={licensing || !isConnected}
                    className="btn-primary flex-1 py-3 text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {licensing
                      ? "BROADCASTING..."
                      : !isConnected
                        ? "CONNECT WALLET"
                        : "CONFIRM LICENSE"}
                  </button>
                  <button
                    onClick={closeLicenseModal}
                    className="btn-secondary px-5 py-3 text-sm tracking-wide"
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                <button
                  onClick={closeLicenseModal}
                  className="btn-primary flex-1 py-3 text-sm tracking-wider"
                >
                  DONE
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function ArtifactCard({
  artifact,
  onLicense,
  isConnected,
}: {
  artifact: Artifact
  onLicense: () => void
  isConnected: boolean
}) {
  const typeStyle = TYPE_COLORS[artifact.artifactType]

  return (
    <div
      className="glass-sm p-5 flex flex-col gap-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
      style={{ borderLeft: `2px solid ${typeStyle.glow.replace("0.08", "0.4")}` }}
    >
      {/* Header: type badge */}
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full ${typeStyle.badge}`}
        >
          {artifact.artifactType}
        </span>
        <span className="tech-label text-[9px]">ID:{artifact.id}</span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-white leading-snug">
        {artifact.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-[rgba(255,255,255,0.4)] font-light line-clamp-2 leading-relaxed">
        {artifact.description || "No description provided."}
      </p>

      {/* Creator entity */}
      {artifact.creatorEntityId && (
        <div className="flex items-center gap-2">
          <span className="tech-label text-[9px]">CREATOR.ENTITY</span>
          <span className="font-mono text-[10px] text-[rgba(255,255,255,0.5)] truncate">
            {artifact.creatorEntityId}
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-[rgba(255,255,255,0.05)]">
        <div>
          <div className="tech-label text-[8px] mb-0.5">FEE</div>
          <div className="font-mono text-xs text-white">
            {artifact.licenseFee.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="tech-label text-[8px] mb-0.5">LICENSES</div>
          <div className="font-mono text-xs text-white">
            {artifact.licensesSold.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="tech-label text-[8px] mb-0.5">REVENUE</div>
          <div className="font-mono text-xs text-white">
            {artifact.totalRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* License button */}
      <button
        onClick={onLicense}
        className="btn-primary w-full py-2.5 text-xs tracking-wider mt-1"
      >
        {isConnected ? "LICENSE" : "CONNECT TO LICENSE"}
      </button>
    </div>
  )
}
