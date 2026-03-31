"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { proxyFetch } from "@/lib/proxy"
import Link from "next/link"

const ACTIVITY_INTERVAL = 3000
const ENTITY_INTERVAL = 10000
const CHAIN_INTERVAL = 15000

interface ActivityEntry {
  id: string
  entity_id: string
  entity_name: string
  type: string
  message: string
  timestamp: string
}

interface Entity {
  id: string
  name: string
  status: string
  compute_balance: number
  experiments_run: number
  discoveries: number
  tasks_completed: number
  current_model?: string
}

interface WorldStats {
  totalEntities: number
  totalAlive: number
  totalExperiments: number
  totalDiscoveries: number
  totalTasks: number
  blockHeight: string | null
}

const TYPE_COLORS: Record<string, string> = {
  experiment: "#6366f1",
  discovery: "#22c55e",
  task: "#f59e0b",
  validation: "#06b6d4",
  dormant: "#ef4444",
  autoresearch: "#c69c76",
  code_patch: "#22c55e",
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

/* ================================================================== */
/*  Canvas: Entity Node Network                                        */
/* ================================================================== */

function NodeNetwork({ entities, activities }: { entities: Entity[]; activities: ActivityEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<{ x: number; y: number; vx: number; vy: number; name: string; alive: boolean; discoveries: number; compute: number; pulse: number }[]>([])
  const frameRef = useRef(0)

  // Build stable node positions from entities
  useEffect(() => {
    if (entities.length === 0) return
    const existing = new Map(nodesRef.current.map((n) => [n.name, n]))

    nodesRef.current = entities.map((e, i) => {
      const ex = existing.get(e.name)
      if (ex) {
        ex.alive = e.status === "alive" || e.status === "active"
        ex.discoveries = e.discoveries || 0
        ex.compute = e.compute_balance || 0
        return ex
      }
      // Spread nodes in a circle with some randomness
      const angle = (i / Math.max(entities.length, 1)) * Math.PI * 2 + Math.random() * 0.5
      const radius = 0.25 + Math.random() * 0.2
      return {
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        name: e.name,
        alive: e.status === "alive" || e.status === "active",
        discoveries: e.discoveries || 0,
        compute: e.compute_balance || 0,
        pulse: 0,
      }
    })
  }, [entities])

  // Pulse nodes on new activity
  useEffect(() => {
    if (activities.length === 0) return
    const latest = activities[0]
    if (!latest) return
    const node = nodesRef.current.find((n) => n.name === latest.entity_name)
    if (node) node.pulse = 1
  }, [activities])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let running = true
    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    resize()
    window.addEventListener("resize", resize)

    function draw() {
      if (!running || !ctx || !canvas) return
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const nodes = nodesRef.current
      if (nodes.length === 0) {
        frameRef.current = requestAnimationFrame(draw)
        return
      }

      // Move nodes gently
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        // Bounce off edges
        if (n.x < 0.05 || n.x > 0.95) n.vx *= -1
        if (n.y < 0.05 || n.y > 0.95) n.vy *= -1
        // Decay pulse
        if (n.pulse > 0) n.pulse *= 0.96
      }

      // Draw connections (between nearby nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxDist = W * 0.25
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12
            ctx.beginPath()
            ctx.moveTo(a.x * W, a.y * H)
            ctx.lineTo(b.x * W, b.y * H)
            ctx.strokeStyle = `rgba(0,0,0,${alpha})`
            ctx.lineWidth = 1 * dpr
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const px = n.x * W
        const py = n.y * H
        const baseR = (4 + Math.min(n.discoveries, 20) * 0.8) * dpr
        const r = baseR + n.pulse * 12 * dpr

        // Glow for alive + active
        if (n.alive && n.pulse > 0.1) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 4)
          glow.addColorStop(0, `rgba(34,197,94,${n.pulse * 0.3})`)
          glow.addColorStop(1, "rgba(34,197,94,0)")
          ctx.beginPath()
          ctx.arc(px, py, r * 4, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        if (n.alive) {
          const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r)
          grad.addColorStop(0, "rgba(34,197,94,0.9)")
          grad.addColorStop(1, "rgba(34,197,94,0.5)")
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.08)"
        }
        ctx.fill()

        // White highlight on top
        if (n.alive) {
          ctx.beginPath()
          ctx.arc(px - r * 0.2, py - r * 0.2, r * 0.4, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(255,255,255,0.5)"
          ctx.fill()
        }

        // Name label
        if (n.alive) {
          ctx.font = `${10 * dpr}px 'IBM Plex Mono', monospace`
          ctx.fillStyle = "rgba(0,0,0,0.5)"
          ctx.textAlign = "center"
          ctx.fillText(n.name, px, py + r + 14 * dpr)
        }
      }

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => { running = false; cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  )
}

/* ================================================================== */
/*  Validator Globe (CSS 3D)                                           */
/* ================================================================== */

function ValidatorGlobe() {
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    let frame: number
    let angle = 0
    function tick() {
      angle += 0.3
      setRotation(angle)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const validators = [
    { name: "US-EAST", city: "Ashburn, VA", lat: 39, lng: -77, color: "#22c55e" },
    { name: "EU-NORTH", city: "Helsinki, FI", lat: 60, lng: 25, color: "#6366f1" },
    { name: "APAC", city: "Singapore, SG", lat: 1, lng: 104, color: "#f59e0b" },
  ]

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      {/* Globe */}
      <div style={{
        width: 120, height: 120, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.08))",
        border: "1px solid rgba(0,0,0,0.06)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((y) => (
          <div key={y} style={{
            position: "absolute", top: `${y * 100}%`, left: 0, right: 0,
            height: 1, background: "rgba(0,0,0,0.06)",
          }} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={`m${i}`} style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${(i / 6 + rotation / 3600) * 100 % 100}%`,
            width: 1, background: "rgba(0,0,0,0.04)",
            transform: `scaleX(${Math.cos((i / 6 + rotation / 3600) * Math.PI * 2) * 0.5 + 0.5})`,
          }} />
        ))}
        {/* Validator dots */}
        {validators.map((v) => {
          const x = ((v.lng + 180 + rotation * 0.1) % 360) / 360 * 100
          const y = (90 - v.lat) / 180 * 100
          return (
            <div key={v.name} style={{
              position: "absolute", left: `${x}%`, top: `${y}%`,
              width: 8, height: 8, borderRadius: "50%",
              background: v.color, transform: "translate(-50%, -50%)",
              boxShadow: `0 0 8px ${v.color}60`,
              animation: "pulse-dot 2s ease-in-out infinite",
            }} />
          )
        })}
      </div>

      {/* Validator list */}
      <div style={{ flex: 1 }}>
        {validators.map((v) => (
          <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: v.color, flexShrink: 0, animation: "pulse-dot 2s ease-in-out infinite" }} />
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>{v.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{v.city}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */

export default function WorldPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [stats, setStats] = useState<WorldStats>({ totalEntities: 0, totalAlive: 0, totalExperiments: 0, totalDiscoveries: 0, totalTasks: 0, blockHeight: null })
  const [daemonOnline, setDaemonOnline] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const isFirstLoad = useRef(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/activity?limit=80", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()
      const entries: ActivityEntry[] = Array.isArray(data) ? data : data.activity || data.activities || data.data || []
      setActivities((prev) => {
        if (isFirstLoad.current) { isFirstLoad.current = false; setInitialLoading(false); return entries }
        const existingIds = new Set(prev.map((a) => a.id))
        const fresh = entries.filter((e) => !existingIds.has(e.id))
        if (fresh.length > 0) { setNewIds(new Set(fresh.map((e) => e.id))); setTimeout(() => setNewIds(new Set()), 800) }
        if (fresh.length === 0) return prev
        return [...fresh, ...prev].slice(0, 100)
      })
      setDaemonOnline(true)
    } catch { setDaemonOnline(false); setInitialLoading(false) }
  }, [])

  const fetchEntities = useCallback(async () => {
    try {
      const res = await proxyFetch("/api/entities", "daemon")
      if (!res.ok) throw new Error("offline")
      const data = await res.json()
      const list: Entity[] = Array.isArray(data) ? data : data.entities || data.data || []
      setEntities(list)
      const alive = list.filter((e) => e.status === "alive" || e.status === "active")
      setStats((prev) => ({
        ...prev, totalEntities: list.length, totalAlive: alive.length,
        totalExperiments: list.reduce((s, e) => s + (e.experiments_run || 0), 0),
        totalDiscoveries: list.reduce((s, e) => s + (e.discoveries || 0), 0),
        totalTasks: list.reduce((s, e) => s + (e.tasks_completed || 0), 0),
      }))
    } catch { /* keep */ }
  }, [])

  const fetchChain = useCallback(async () => {
    try {
      const res = await proxyFetch("/status", "rpc")
      const data = await res.json()
      const height = data.result?.sync_info?.latest_block_height || null
      setStats((prev) => ({ ...prev, blockHeight: height }))
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    fetchActivity(); fetchEntities(); fetchChain()
    const a = setInterval(fetchActivity, ACTIVITY_INTERVAL)
    const b = setInterval(fetchEntities, ENTITY_INTERVAL)
    const c = setInterval(fetchChain, CHAIN_INTERVAL)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [fetchActivity, fetchEntities, fetchChain])

  const aliveEntities = useMemo(() => entities.filter((e) => e.status === "alive" || e.status === "active"), [entities])
  const discoveries = useMemo(() => activities.filter((a) => a.type === "discovery"), [activities])

  return (
    <main style={{ background: "#f5f3ee", minHeight: "100vh" }}>

      {/* ── HERO: Node network visualization ── */}
      <div style={{ position: "relative", height: "clamp(360px, 50vh, 520px)", overflow: "hidden" }}>
        <NodeNetwork entities={entities} activities={activities} />
        {/* Overlay content */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 40px 40px", background: "linear-gradient(to bottom, rgba(245,243,238,0) 40%, rgba(245,243,238,0.9) 85%, rgba(245,243,238,1))" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.0, color: "#121212" }}>
                  World
                </h1>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "rgba(0,0,0,0.45)", marginTop: 8 }}>
                  {stats.totalAlive} entities thinking · {stats.totalDiscoveries.toLocaleString()} discoveries · block #{stats.blockHeight ? Number(stats.blockHeight).toLocaleString() : "—"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: daemonOnline ? "#22c55e" : "#ef4444", animation: daemonOnline ? "pulse-dot 2s ease-in-out infinite" : "none" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.3)", textTransform: "uppercase" }}>
                  {daemonOnline ? "Live" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 80px" }}>

        {/* ── Stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
          {[
            { label: "Alive", value: stats.totalAlive, sub: `/ ${stats.totalEntities}`, color: "#22c55e" },
            { label: "Discoveries", value: stats.totalDiscoveries, sub: null, color: "#c69c76" },
            { label: "Experiments", value: stats.totalExperiments, sub: null, color: "#6366f1" },
            { label: "Tasks Done", value: stats.totalTasks, sub: null, color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.6)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(0,0,0,0.05)", borderRadius: 20, padding: "20px 24px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#121212" }}>
                {s.value.toLocaleString()}
                {s.sub && <span style={{ fontSize: 14, color: "rgba(0,0,0,0.2)", fontWeight: 400 }}> {s.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main 3-column grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 16 }}>

          {/* LEFT: Entities + Validators */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Entities */}
            <GlassPanel title="Population" badge={`${aliveEntities.length} alive`} badgeColor="#22c55e">
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {aliveEntities.map((entity) => (
                  <div key={entity.id}
                    onClick={() => setSelectedEntity(selectedEntity?.id === entity.id ? null : entity)}
                    style={{
                      padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)",
                      cursor: "pointer", transition: "background 150ms",
                      background: selectedEntity?.id === entity.id ? "rgba(0,0,0,0.04)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (selectedEntity?.id !== entity.id) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)" }}
                    onMouseLeave={(e) => { if (selectedEntity?.id !== entity.id) (e.currentTarget as HTMLElement).style.background = "transparent" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #22c55e, #6366f1)", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#121212" }}>{entity.name}</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.25)" }}>
                        {(entity.compute_balance || 0).toFixed(0)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.25)" }}>
                      <span>{entity.discoveries || 0} disc</span>
                      <span>{entity.experiments_run || 0} exp</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* Validator Globe */}
            <GlassPanel title="Validators" badge="3 regions">
              <div style={{ padding: "12px 16px" }}>
                <ValidatorGlobe />
              </div>
            </GlassPanel>
          </div>

          {/* CENTER: Live feed */}
          <GlassPanel title="Live Activity" badge={`${activities.length} events`}>
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {initialLoading && activities.length === 0 && (
                <div style={{ padding: 48, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.2)" }}>Loading...</div>
              )}
              {activities.slice(0, 50).map((activity) => {
                const isNew = newIds.has(activity.id)
                const color = TYPE_COLORS[activity.type] || "rgba(0,0,0,0.3)"
                const typeLabel = activity.type?.toUpperCase().replace(/\s+/g, "_") || "EVENT"
                return (
                  <div key={activity.id} style={{
                    padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)",
                    opacity: isNew ? 0 : 1, animation: isNew ? "fadeSlideIn 0.5s ease-out forwards" : undefined,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{typeLabel}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#121212" }}>{activity.entity_name || "?"}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.2)", marginLeft: "auto" }}>{timeAgo(activity.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 14 }}>
                      {activity.message}
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassPanel>

          {/* RIGHT: Detail + Discoveries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Entity detail */}
            <GlassPanel title={selectedEntity ? selectedEntity.name : "Select Entity"}>
              {selectedEntity ? (
                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 14,
                      background: "linear-gradient(135deg, #22c55e, #c69c76)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, color: "#fff",
                    }}>
                      {selectedEntity.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#121212" }}>{selectedEntity.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
                        {selectedEntity.status} · {selectedEntity.current_model || "auto"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Compute", value: (selectedEntity.compute_balance || 0).toFixed(0), color: "#6366f1" },
                      { label: "Discoveries", value: String(selectedEntity.discoveries || 0), color: "#22c55e" },
                      { label: "Experiments", value: String(selectedEntity.experiments_run || 0), color: "#c69c76" },
                      { label: "Tasks", value: String(selectedEntity.tasks_completed || 0), color: "#f59e0b" },
                    ].map((s) => (
                      <div key={s.label} style={{ background: "rgba(0,0,0,0.02)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700, color: "#121212" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <Link href={`/entity/${selectedEntity.id}`} style={{
                    display: "block", textAlign: "center", marginTop: 12, padding: "10px",
                    background: "rgba(0,0,0,0.04)", borderRadius: 10,
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.4)",
                    textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    Full Profile →
                  </Link>
                </div>
              ) : (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "rgba(0,0,0,0.15)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  Click an entity to inspect
                </div>
              )}
            </GlassPanel>

            {/* Discoveries */}
            <GlassPanel title="Discoveries" badge={`${discoveries.length}`} badgeColor="#22c55e" flex>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {discoveries.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.15)" }}>Waiting...</div>
                )}
                {discoveries.slice(0, 12).map((d) => (
                  <div key={d.id} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#22c55e" }}>{d.entity_name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,0,0,0.2)" }}>{timeAgo(d.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {d.message}
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </main>
  )
}

/* ================================================================== */
/*  Glass Panel                                                        */
/* ================================================================== */

function GlassPanel({ title, badge, badgeColor, flex, children }: {
  title: string
  badge?: string
  badgeColor?: string
  flex?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.6)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      border: "1px solid rgba(0,0,0,0.05)",
      borderRadius: 20, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column",
      flex: flex ? 1 : undefined,
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
        {badge && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: badgeColor || "rgba(0,0,0,0.25)" }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}
