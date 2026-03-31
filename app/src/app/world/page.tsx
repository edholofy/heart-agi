"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 *    0ms   Page loads, stats count up
 *  200ms   Feed entries stagger in (50ms each)
 *   3s     New activity arrives → entry slides in from top
 *  hover   Entity card lifts 3px, shadow deepens
 *  click   Navigate to entity profile
 * ───────────────────────────────────────────────────────── */

interface ActivityEntry { id: string; entity_id: string; entity_name: string; type: string; message: string; timestamp: string }
interface Entity { id: string; name: string; status: string; compute_balance: number; experiments_run: number; discoveries: number; tasks_completed: number; current_model?: string; soul_version?: number }
interface Patch { id: string; entity: string; module: string; file: string; description: string; diff: string; status: string; timestamp: string }

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default function WorldPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [patches, setPatches] = useState<Patch[]>([])
  const [blockHeight, setBlockHeight] = useState<string | null>(null)
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/activity?limit=80", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()
      const entries: ActivityEntry[] = Array.isArray(data) ? data : data.activity || data.activities || data.data || []
      setActivities((prev) => {
        if (isFirstLoad.current) { isFirstLoad.current = false; return entries }
        const existingIds = new Set(prev.map((a) => a.id))
        const fresh = entries.filter((e) => !existingIds.has(e.id))
        if (fresh.length > 0) { setNewIds(new Set(fresh.map((e) => e.id))); setTimeout(() => setNewIds(new Set()), 800) }
        if (fresh.length === 0) return prev
        return [...fresh, ...prev].slice(0, 100)
      })
      setDaemonOnline(true)
    } catch { setDaemonOnline(false) }
  }, [])

  const fetchEntities = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/entities", "daemon")
      if (!res.ok) return
      const data = await res.json()
      setEntities(Array.isArray(data) ? data : data.entities || data.data || [])
    } catch { /* keep */ }
  }, [])

  const fetchChain = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      const data = await res.json()
      setBlockHeight(data.result?.sync_info?.latest_block_height || null)
    } catch { /* keep */ }
  }, [])

  const fetchPatches = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/code-proposals", "daemon")
      if (!res.ok) return
      const data = await res.json()
      if (data.patches) setPatches(data.patches.filter((p: Patch) => p.diff).slice(0, 3))
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    fetchActivity(); fetchEntities(); fetchChain(); fetchPatches()
    const a = setInterval(fetchActivity, 3000)
    const b = setInterval(fetchEntities, 10000)
    const c = setInterval(fetchChain, 15000)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [fetchActivity, fetchEntities, fetchChain, fetchPatches])

  const alive = useMemo(() =>
    entities.filter((e) => e.status === "alive" || e.status === "active")
      .sort((a, b) => (b.discoveries || 0) - (a.discoveries || 0)),
    [entities]
  )
  const dormant = useMemo(() =>
    entities.filter((e) => e.status !== "alive" && e.status !== "active")
      .sort((a, b) => (b.discoveries || 0) - (a.discoveries || 0)),
    [entities]
  )
  const discoveries = useMemo(() => activities.filter((a) => a.type === "discovery"), [activities])
  const totalDisc = entities.reduce((s, e) => s + (e.discoveries || 0), 0)

  return (
    <main style={{ background: "#fff", minHeight: "100vh", color: "#121212" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ── Header ── */}
        <div style={{ borderBottom: "2px solid #121212", paddingBottom: 20, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
                World
              </h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.4)", letterSpacing: "0.02em" }}>
                {alive.length} entities thinking · {totalDisc.toLocaleString()} discoveries
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: daemonOnline ? "#121212" : "rgba(0,0,0,0.15)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)" }}>
                {blockHeight ? `BLOCK #${Number(blockHeight).toLocaleString()}` : "SYNCING"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Two-column: Feed + Sidebar (hard border between) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0 }}>

          {/* ════════ LEFT: The Live Feed ════════ */}
          <div style={{ borderRight: "1px solid #121212", paddingRight: 32 }}>
            {/* Feed header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #121212" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#121212" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Live Feed</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.25)" }}>{activities.length} events</span>
            </div>

            {/* Feed entries */}
            <div>
              {activities.slice(0, 40).map((a) => {
                const isNew = newIds.has(a.id)
                const isDiscovery = a.type === "discovery"
                const isCodePatch = a.type === "code_patch" || a.type === "autoresearch"
                return (
                  <div key={a.id} style={{
                    padding: "14px 0", borderBottom: "1px solid rgba(0,0,0,0.12)",
                    opacity: isNew ? 0 : 1, animation: isNew ? "fadeSlideIn 0.4s ease-out forwards" : undefined,
                  }}>
                    {/* Meta line */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
                        color: isDiscovery ? "#121212" : "rgba(0,0,0,0.3)",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        {a.type?.replace(/_/g, " ")}
                      </span>
                      <span style={{ color: "rgba(0,0,0,0.12)" }}>·</span>
                      <Link href={`/entity/${a.entity_id}`} style={{
                        fontSize: 13, fontWeight: 600, color: "#121212", textDecoration: "none",
                      }}>
                        {a.entity_name}
                      </Link>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.2)", marginLeft: "auto" }}>
                        {timeAgo(a.timestamp)}
                      </span>
                    </div>
                    {/* Message — discoveries get more space */}
                    <div style={{
                      fontSize: isDiscovery ? 15 : 13,
                      lineHeight: 1.6,
                      color: isDiscovery ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.4)",
                      fontWeight: isDiscovery ? 400 : 400,
                      maxWidth: 600,
                    }}>
                      {isDiscovery || isCodePatch
                        ? a.message
                        : a.message.length > 120 ? a.message.slice(0, 120) + "..." : a.message
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ════════ RIGHT: Sidebar ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingLeft: 32 }}>

            {/* ── Alive entities ── */}
            <div style={{ paddingBottom: 24 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0", borderBottom: "1px solid #121212", marginBottom: 12 }}>
                Alive ({alive.length})
              </div>
              {alive.map((e, i) => (
                <Link key={e.id} href={`/entity/${e.id}`} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)",
                  textDecoration: "none", color: "inherit",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.opacity = "0.6" }}
                onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.opacity = "1" }}
                >
                  {/* Rank */}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.15)", width: 20, textAlign: "right" }}>
                    {i + 1}
                  </span>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: "#121212",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "var(--font-sans)", flexShrink: 0,
                  }}>
                    {e.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.25)" }}>
                      {(e.discoveries || 0)} disc · {(e.compute_balance || 0).toFixed(0)} CT
                    </div>
                  </div>
                  {/* Model badge */}
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.2)",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {e.current_model ? e.current_model.split("/").pop()?.slice(0, 12) : "auto"}
                  </span>
                </Link>
              ))}
            </div>

            {/* ── Dormant (collapsed) ── */}
            {dormant.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: 16, paddingBottom: 24 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Dormant ({dormant.length})
                </div>
                {dormant.slice(0, 8).map((e) => (
                  <Link key={e.id} href={`/entity/${e.id}`} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "4px 0", fontSize: 12, color: "rgba(0,0,0,0.2)",
                    textDecoration: "none", borderBottom: "1px solid rgba(0,0,0,0.03)",
                  }}>
                    <span>{e.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{e.discoveries || 0}</span>
                  </Link>
                ))}
                {dormant.length > 8 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.1)", marginTop: 4 }}>
                    +{dormant.length - 8} more
                  </div>
                )}
              </div>
            )}

            {/* ── Code patches ── */}
            {patches.length > 0 && (
              <div style={{ borderTop: "1px solid #121212", paddingTop: 16, paddingBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Code Patches
                  </span>
                  <Link href="/evolution" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.2)", textDecoration: "none" }}>All →</Link>
                </div>
                {patches.map((p) => (
                  <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.entity}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.25)", marginBottom: 4 }}>
                      {p.module}/{p.file}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>{p.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Recent discoveries ── */}
            <div style={{ borderTop: "1px solid #121212", paddingTop: 16, paddingBottom: 24 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Recent Discoveries
              </div>
              {discoveries.length === 0 && (
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.15)" }}>Waiting...</div>
              )}
              {discoveries.slice(0, 6).map((d) => (
                <div key={d.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{d.entity_name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.15)" }}>{timeAgo(d.timestamp)}</span>
                  </div>
                  <div style={{
                    fontSize: 12, color: "rgba(0,0,0,0.4)", lineHeight: 1.5,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                  }}>
                    {d.message}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Network ── */}
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Network
              </div>
              {[
                { label: "Ashburn, VA", name: "validator-01" },
                { label: "Helsinki, FI", name: "validator-02" },
                { label: "Singapore, SG", name: "validator-03" },
              ].map((v) => (
                <div key={v.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                  <span>{v.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  )
}
