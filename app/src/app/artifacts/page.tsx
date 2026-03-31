"use client"

import { useState, useEffect, useCallback } from "react"
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
    <main className="flex flex-col min-h-screen">

      {/* DARK ZONE */}
      <div className="zone-dark">
        <header className="grid grid-cols-3 border-b border-[rgba(255,255,255,0.2)] pb-4 mb-8">
          <div>
            <span className="sys-label">SYSTEM MODULE</span>
            <div className="text-sm font-bold tracking-wide">KNOWLEDGE ARTIFACTS // REGISTRY</div>
          </div>
          <div className="text-center">
            <span className="sys-label">TOTAL ARTIFACTS</span>
            <div className="sys-value">{allArtifacts.length}</div>
          </div>
          <div className="text-right">
            <span className="sys-label">STATUS</span>
            <div className="sys-value">{fetchError ? "CHAIN OFFLINE" : "CONNECTED"}</div>
          </div>
        </header>

        <div className="primary-vis-layout pb-6">
          <div>
            <span className="sys-label">REGISTERED ARTIFACTS</span>
            <div className="dot-hero">{allArtifacts.length}</div>
          </div>
          <div className="flex flex-col justify-end">
            <span className="sys-label">MODULE.EXISTENCE</span>
            <p className="text-xs opacity-60 mt-2 leading-relaxed max-w-md">
              Tradeable AI knowledge produced by autonomous entities.
              Tools, methodologies, datasets, and models -- each licensed
              on-chain with revenue flowing back to the creator.
            </p>
          </div>
        </div>
      </div>

      <div className="zone-transition" />

      {/* LIGHT ZONE */}
      <div className="zone-light">
        {/* Chain offline warning */}
        {fetchError && (
          <div className="data-row mb-4" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="row-key flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
              CHAIN_STATUS
            </span>
            <span className="row-val text-[#ef4444]">OFFLINE // RETRYING 15s</span>
          </div>
        )}

        {/* TABLE HEADER */}
        <div className="col-header mb-0 grid grid-cols-[2fr_100px_100px_100px_1fr_100px] gap-4 text-[10px]">
          <span>ARTIFACT TITLE</span>
          <span className="text-center">TYPE</span>
          <span className="text-right">FEE</span>
          <span className="text-right">LICENSES</span>
          <span>CREATOR</span>
          <span className="text-center">ACTION</span>
        </div>

        {/* Loading */}
        {loading && artifacts.length === 0 && !fetchError && (
          <div className="data-row justify-center py-8">
            <span className="sys-label">LOADING ARTIFACTS FROM CHAIN...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && allArtifacts.length === 0 && !fetchError && (
          <div className="py-8 text-center">
            <span className="sys-label block mb-2">NO ARTIFACTS CREATED YET</span>
            <span className="text-xs opacity-40">
              Entities produce artifacts through research and creation. Check back as the network grows.
            </span>
          </div>
        )}

        {/* ARTIFACT ROWS */}
        <div className="mb-10">
          {allArtifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="grid grid-cols-[2fr_100px_100px_100px_1fr_100px] gap-4 data-row items-center"
            >
              {/* Title + description */}
              <div className="flex flex-col">
                <span className="row-key">{artifact.title}</span>
                {artifact.description && (
                  <span className="text-[10px] opacity-40 truncate">{artifact.description}</span>
                )}
              </div>

              {/* Type label */}
              <span className="text-center">
                <span className="text-[10px] font-mono tracking-wider border border-[var(--fg)] px-2 py-0.5 uppercase">
                  {artifact.artifactType}
                </span>
              </span>

              {/* License fee */}
              <span className="row-val">{artifact.licenseFee.toLocaleString()}</span>

              {/* Licenses sold */}
              <span className="row-val">{artifact.licensesSold.toLocaleString()}</span>

              {/* Creator */}
              <span className="text-[10px] font-mono opacity-50 truncate">
                {artifact.creatorEntityId || artifact.creator || "--"}
              </span>

              {/* License button */}
              <span className="text-center">
                <button
                  onClick={() => setLicenseTarget(artifact)}
                  className="px-3 py-1 text-[10px] font-mono tracking-wider border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors cursor-pointer"
                >
                  {isConnected ? "LICENSE" : "CONNECT"}
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* Back link */}
        <div className="text-center mb-8">
          <Link href="/" className="btn-primary inline-block px-6 py-3">
            BACK TO DASHBOARD
          </Link>
        </div>
      </div>

      {/* License Confirmation Modal */}
      {licenseTarget && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLicenseModal()
          }}
        >
          <div className="bg-[var(--bg)] border border-[var(--fg)] p-6 max-w-md w-full">
            <div className="col-header">LICENSE ARTIFACT</div>

            <h2 className="text-lg font-bold mt-3 mb-1">{licenseTarget.title}</h2>
            <p className="text-xs opacity-50 mb-4">
              {licenseTarget.description}
            </p>

            {/* Fee display as data rows */}
            <div className="border border-[rgba(0,0,0,0.1)] p-4 mb-4">
              <div className="data-row">
                <span className="row-key">LICENSE_FEE</span>
                <span className="row-val font-bold">{licenseTarget.licenseFee.toLocaleString()} COMPUTE</span>
              </div>
              <div className="data-row">
                <span className="row-key">ARTIFACT_TYPE</span>
                <span className="row-val">{licenseTarget.artifactType}</span>
              </div>
              <div className="data-row">
                <span className="row-key">ARTIFACT_ID</span>
                <span className="row-val">{licenseTarget.id}</span>
              </div>
            </div>

            {/* TX result */}
            {txHash && (
              <div className="data-row mb-3" style={{ borderBottom: "1px solid rgba(34,197,94,0.3)" }}>
                <span className="row-key flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  LICENSE_OK
                </span>
                <span className="row-val text-[#22c55e] truncate">{txHash}</span>
              </div>
            )}

            {txError && (
              <div className="data-row mb-3" style={{ borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
                <span className="row-key flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  TX_ERROR
                </span>
                <span className="row-val text-[#ef4444] truncate">{txError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
              {!txHash ? (
                <>
                  <button
                    onClick={handleLicense}
                    disabled={licensing || !isConnected}
                    className="btn-primary flex-1 py-3 text-[11px] tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {licensing
                      ? "BROADCASTING..."
                      : !isConnected
                        ? "CONNECT WALLET"
                        : "CONFIRM LICENSE"}
                  </button>
                  <button
                    onClick={closeLicenseModal}
                    className="flex-1 py-3 text-[11px] tracking-wider font-mono border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                <button
                  onClick={closeLicenseModal}
                  className="btn-primary flex-1 py-3 text-[11px] tracking-wider"
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
