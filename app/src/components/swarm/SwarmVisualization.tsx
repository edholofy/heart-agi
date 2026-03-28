"use client"

import { useEffect, useRef, useCallback } from "react"

// ── Color palette ─────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, [number, number, number]> = {
  security: [80, 150, 255], consensus: [80, 150, 255], distributed: [80, 150, 255],
  crypto: [80, 150, 255], blockchain: [80, 150, 255], systems: [80, 150, 255],
  ai: [160, 120, 255], ml: [160, 120, 255], intelligence: [160, 120, 255],
  model: [160, 120, 255], alignment: [160, 120, 255], learning: [160, 120, 255],
  science: [50, 220, 120], physics: [50, 220, 120], quantum: [50, 220, 120],
  math: [50, 220, 120], research: [50, 220, 120],
  creative: [255, 180, 40], narrative: [255, 180, 40], story: [255, 180, 40],
  writing: [255, 180, 40], strategy: [255, 180, 40],
  engineering: [40, 200, 230], code: [40, 200, 230], compiler: [40, 200, 230],
  chip: [40, 200, 230], hardware: [40, 200, 230], architecture: [40, 200, 230],
  biology: [240, 90, 170], genomics: [240, 90, 170], protein: [240, 90, 170],
}
const DEFAULT_RGB: [number, number, number] = [160, 120, 255]

function getColor(skill: string): [number, number, number] {
  const s = skill.toLowerCase()
  for (const [k, v] of Object.entries(DOMAIN_COLORS)) if (s.includes(k)) return v
  return DEFAULT_RGB
}

// ── Types ─────────────────────────────────────────────────────────────
interface SwarmVizProps {
  entities: Array<{ name: string; skill: string; compute_balance: number; discoveries: number; status: string }>
  isRunning: boolean
  activeEntities?: string[]
  phase?: "idle" | "decomposing" | "working" | "synthesizing" | "complete"
}

interface Mote {
  x: number; y: number
  ox: number; oy: number          // offset from parent center
  angle: number; speed: number    // orbital
  dist: number                    // distance from parent center
  size: number
  rgb: [number, number, number]
  alpha: number
  owner: number                   // index into nodes, or -1 for free
  life: number                    // 1 = alive, decreases for free particles
  vx: number; vy: number         // velocity for free/vortex particles
}

interface EntityNode {
  x: number; y: number
  targetX: number; targetY: number
  angle: number
  orbitRadius: number
  orbitSpeed: number
  radius: number
  rgb: [number, number, number]
  name: string
  discoveries: number
  breathPhase: number
  isActive: boolean
}

export function SwarmVisualization({ entities, isRunning, activeEntities = [], phase = "idle" }: SwarmVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<EntityNode[]>([])
  const motesRef = useRef<Mote[]>([])
  const freeRef = useRef<Mote[]>([])          // free-floating particles (shockwave, ambient)
  const frameRef = useRef(0)
  const timeRef = useRef(0)
  const cxRef = useRef(0)
  const cyRef = useRef(0)
  const vortexRef = useRef(0)                  // vortex intensity 0-1
  const shockwaveRef = useRef({ active: false, radius: 0, alpha: 1 })
  const prevPhaseRef = useRef(phase)

  const MOTES_PER_ENTITY = 60

  const buildNodes = useCallback((w: number, h: number) => {
    const cx = w / 2
    const cy = h / 2
    cxRef.current = cx
    cyRef.current = cy

    const existing = nodesRef.current
    const activeSet = new Set(activeEntities)

    nodesRef.current = entities.map((ent, i) => {
      const prev = existing.find(n => n.name === ent.name)
      const angle = (i / Math.max(entities.length, 1)) * Math.PI * 2 - Math.PI / 2
      const layer = (i % 3)
      const orbitRadius = Math.min(w, h) * 0.28 + layer * 28
      const rgb = getColor(ent.skill)
      const radius = Math.max(6, Math.min(16, 6 + Math.sqrt(ent.compute_balance) * 0.25))

      return {
        x: prev?.x ?? cx + Math.cos(angle) * orbitRadius,
        y: prev?.y ?? cy + Math.sin(angle) * orbitRadius,
        targetX: cx + Math.cos(angle) * orbitRadius,
        targetY: cy + Math.sin(angle) * orbitRadius,
        angle: prev?.angle ?? angle,
        orbitRadius,
        orbitSpeed: 0.00012 + (i % 7) * 0.00006,
        radius,
        rgb,
        name: ent.name,
        discoveries: ent.discoveries,
        breathPhase: prev?.breathPhase ?? Math.random() * Math.PI * 2,
        isActive: activeSet.size > 0 ? activeSet.has(ent.name) : true,
      }
    })

    // Build motes for each entity
    const motes: Mote[] = []
    for (let ni = 0; ni < nodesRef.current.length; ni++) {
      const node = nodesRef.current[ni]
      for (let j = 0; j < MOTES_PER_ENTITY; j++) {
        const a = Math.random() * Math.PI * 2
        const d = (Math.random() * 0.7 + 0.3) * node.radius * 3.5
        motes.push({
          x: node.x + Math.cos(a) * d,
          y: node.y + Math.sin(a) * d,
          ox: Math.cos(a) * d,
          oy: Math.sin(a) * d,
          angle: a,
          speed: 0.003 + Math.random() * 0.008,
          dist: d,
          size: 0.5 + Math.random() * 1.5,
          rgb: [
            node.rgb[0] + Math.floor((Math.random() - 0.5) * 30),
            node.rgb[1] + Math.floor((Math.random() - 0.5) * 30),
            node.rgb[2] + Math.floor((Math.random() - 0.5) * 30),
          ] as [number, number, number],
          alpha: 0.15 + Math.random() * 0.4,
          owner: ni,
          life: 1,
          vx: 0, vy: 0,
        })
      }
    }
    motesRef.current = motes
  }, [entities, activeEntities, MOTES_PER_ENTITY])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildNodes(rect.width, rect.height)
    }
    resize()
    window.addEventListener("resize", resize)

    let alive = true

    function animate(ts: number) {
      if (!alive || !canvas || !ctx) return
      const dt = Math.min(ts - (timeRef.current || ts), 50)
      timeRef.current = ts
      frameRef.current++

      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const cx = cxRef.current
      const cy = cxRef.current ? cxRef.current : w / 2
      const cyy = cyRef.current ? cyRef.current : h / 2
      const t = ts * 0.001
      const nodes = nodesRef.current
      const motes = motesRef.current
      const free = freeRef.current
      const shock = shockwaveRef.current

      // ── Phase transitions ──
      if (phase !== prevPhaseRef.current) {
        if (phase === "decomposing") vortexRef.current = 0.01
        if (phase === "complete") {
          shock.active = true
          shock.radius = 0
          shock.alpha = 1
          // Spawn shockwave particles
          for (let i = 0; i < 80; i++) {
            const a = (i / 80) * Math.PI * 2
            const sp = 2 + Math.random() * 3
            free.push({
              x: cx, y: cyy,
              ox: 0, oy: 0, angle: a, speed: 0, dist: 0,
              size: 1.5 + Math.random() * 2,
              rgb: [50 + Math.random() * 40, 220 + Math.random() * 35, 120 + Math.random() * 40] as [number, number, number],
              alpha: 0.8,
              owner: -1,
              life: 1,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
            })
          }
        }
        prevPhaseRef.current = phase
      }

      // Vortex intensity ramp
      if (isRunning && phase !== "complete" && phase !== "idle") {
        const targetV = phase === "synthesizing" ? 1 : phase === "working" ? 0.7 : 0.3
        vortexRef.current += (targetV - vortexRef.current) * 0.02
      } else {
        vortexRef.current *= 0.97
      }
      const vortex = vortexRef.current

      // ── Clear ──
      ctx.clearRect(0, 0, w, h)

      // ── Background: subtle radial gradient when active ──
      if (vortex > 0.01) {
        const bgR = 120 + vortex * 80
        const bg = ctx.createRadialGradient(cx, cyy, 0, cx, cyy, bgR)
        bg.addColorStop(0, `rgba(139, 92, 246, ${vortex * 0.04})`)
        bg.addColorStop(1, "rgba(0,0,0,0)")
        ctx.beginPath()
        ctx.arc(cx, cyy, bgR, 0, Math.PI * 2)
        ctx.fillStyle = bg
        ctx.fill()
      }

      // ── Update nodes ──
      const breathScale = 1 + Math.sin(t * 0.8) * 0.03 // global breathing
      for (const node of nodes) {
        node.breathPhase += dt * 0.002

        if (isRunning && node.isActive && (phase === "working" || phase === "synthesizing")) {
          const pull = phase === "synthesizing" ? 0.5 : 0.3
          node.targetX = cx + (node.x - cx) * (1 - pull * 0.01)
          node.targetY = cyy + (node.y - cyy) * (1 - pull * 0.01)
        } else {
          node.angle += node.orbitSpeed * dt
          node.targetX = cx + Math.cos(node.angle) * node.orbitRadius * breathScale
          node.targetY = cyy + Math.sin(node.angle) * node.orbitRadius * breathScale
        }

        node.x += (node.targetX - node.x) * Math.min(dt * 0.003, 0.08)
        node.y += (node.targetY - node.y) * Math.min(dt * 0.003, 0.08)
      }

      // ── Draw gossip connections (data rivers) ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxD = Math.min(w, h) * 0.55
          if (dist >= maxD) continue

          const falloff = (1 - dist / maxD)
          const alpha = falloff * falloff * (isRunning ? 0.06 : 0.025)

          // Curved connection (bezier through center-ish point)
          const mx = (a.x + b.x) / 2 + (cy - (a.y + b.y) / 2) * 0.15
          const my = (a.y + b.y) / 2 + ((a.x + b.x) / 2 - cx) * 0.15

          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.quadraticCurveTo(mx, my, b.x, b.y)
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          grad.addColorStop(0, `rgba(${a.rgb[0]},${a.rgb[1]},${a.rgb[2]},${alpha})`)
          grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.3})`)
          grad.addColorStop(1, `rgba(${b.rgb[0]},${b.rgb[1]},${b.rgb[2]},${alpha})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }

      // ── Vortex center ──
      if (vortex > 0.01) {
        // Accretion disk rings
        for (let ring = 0; ring < 4; ring++) {
          const rr = (15 + ring * 12) * (0.8 + vortex * 0.5)
          const rotSpeed = (ring % 2 === 0 ? 1 : -1) * (2 + ring * 0.5)
          ctx.beginPath()
          ctx.arc(cx, cyy, rr, t * rotSpeed, t * rotSpeed + Math.PI * (1.2 + vortex * 0.8))
          const isComplete = phase === "complete"
          ctx.strokeStyle = isComplete
            ? `rgba(50, 220, 120, ${vortex * 0.15 * (1 - ring * 0.2)})`
            : `rgba(160, 120, 255, ${vortex * 0.15 * (1 - ring * 0.2)})`
          ctx.lineWidth = 2 - ring * 0.3
          ctx.stroke()
        }

        // Core glow
        const coreR = 12 + vortex * 20 + Math.sin(t * 4) * 3
        const cg = ctx.createRadialGradient(cx, cyy, 0, cx, cyy, coreR)
        const cc = phase === "complete" ? "50,220,120" : "160,120,255"
        cg.addColorStop(0, `rgba(255,255,255,${vortex * 0.3})`)
        cg.addColorStop(0.2, `rgba(${cc},${vortex * 0.25})`)
        cg.addColorStop(1, `rgba(${cc},0)`)
        ctx.beginPath()
        ctx.arc(cx, cyy, coreR, 0, Math.PI * 2)
        ctx.fillStyle = cg
        ctx.fill()

        // Phase label
        const labels: Record<string, string> = {
          decomposing: "DECOMPOSING", working: "ANALYZING",
          synthesizing: "SYNTHESIZING", complete: "COMPLETE",
        }
        if (labels[phase]) {
          ctx.font = "600 8px 'JetBrains Mono', monospace"
          ctx.textAlign = "center"
          ctx.fillStyle = phase === "complete"
            ? `rgba(50,220,120,${0.5 + vortex * 0.3})`
            : `rgba(160,120,255,${0.3 + vortex * 0.3})`
          ctx.fillText(labels[phase], cx, cyy + coreR + 14)
        }

        // Energy beams from active entities
        for (const node of nodes) {
          if (!node.isActive) continue
          const dx = cx - node.x, dy = cyy - node.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 5) continue

          const beamA = vortex * 0.04
          const bg = ctx.createLinearGradient(node.x, node.y, cx, cyy)
          bg.addColorStop(0, `rgba(${node.rgb[0]},${node.rgb[1]},${node.rgb[2]},${beamA})`)
          bg.addColorStop(0.8, `rgba(160,120,255,${beamA * 1.5})`)
          bg.addColorStop(1, `rgba(255,255,255,${beamA * 2})`)
          ctx.beginPath()
          ctx.moveTo(node.x, node.y)
          ctx.lineTo(cx, cyy)
          ctx.strokeStyle = bg
          ctx.lineWidth = 1 + vortex
          ctx.stroke()
        }
      }

      // ── Update & draw motes (entity nebulae) ──
      for (const mote of motes) {
        if (mote.owner < 0 || mote.owner >= nodes.length) continue
        const node = nodes[mote.owner]

        // Orbit around parent
        mote.angle += mote.speed * dt * (1 + Math.sin(node.breathPhase) * 0.3)

        // During vortex, some motes get pulled toward center
        if (vortex > 0.1 && node.isActive && isRunning) {
          const pullChance = vortex * 0.12
          if (Math.random() < pullChance * 0.01) {
            // This mote gets sucked into the vortex
            mote.owner = -1
            const dx = cx - mote.x, dy = cyy - mote.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const speed = 0.8 + Math.random() * 1.5
            // Spiral trajectory
            const perpX = -dy / dist, perpY = dx / dist
            mote.vx = (dx / dist) * speed + perpX * speed * 0.4
            mote.vy = (dy / dist) * speed + perpY * speed * 0.4
            mote.life = 1
            continue
          }
        }

        const targetX = node.x + Math.cos(mote.angle) * mote.dist
        const targetY = node.y + Math.sin(mote.angle) * mote.dist
        mote.x += (targetX - mote.x) * 0.08
        mote.y += (targetY - mote.y) * 0.08

        const breathAlpha = 0.7 + Math.sin(node.breathPhase + mote.angle) * 0.3
        const activeBoost = node.isActive && isRunning ? 1.5 : 1
        const a = mote.alpha * breathAlpha * activeBoost

        // Draw with tiny glow
        if (mote.size > 1) {
          const g = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, mote.size * 2.5)
          g.addColorStop(0, `rgba(${mote.rgb[0]},${mote.rgb[1]},${mote.rgb[2]},${a * 0.4})`)
          g.addColorStop(1, `rgba(${mote.rgb[0]},${mote.rgb[1]},${mote.rgb[2]},0)`)
          ctx.beginPath()
          ctx.arc(mote.x, mote.y, mote.size * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${mote.rgb[0]},${mote.rgb[1]},${mote.rgb[2]},${a})`
        ctx.fill()
      }

      // ── Free particles (vortex-consumed motes, shockwave) ──
      // Also handle motes that became free (owner = -1)
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]
        if (m.owner !== -1) continue

        // Spiral toward center
        const dx = cx - m.x, dy = cyy - m.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1

        // Add spiral force
        const perpX = -dy / dist, perpY = dx / dist
        m.vx += (dx / dist) * 0.03 + perpX * 0.01
        m.vy += (dy / dist) * 0.03 + perpY * 0.01
        m.vx *= 0.99
        m.vy *= 0.99

        m.x += m.vx * Math.min(dt * 0.06, 2)
        m.y += m.vy * Math.min(dt * 0.06, 2)
        m.life -= 0.008

        if (m.life <= 0 || dist < 8) {
          motes.splice(i, 1)
          continue
        }

        const a = m.life * m.alpha * 1.5
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.size * m.life, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${m.rgb[0]},${m.rgb[1]},${m.rgb[2]},${a})`
        ctx.fill()
      }

      // Free particles (shockwave etc.)
      for (let i = free.length - 1; i >= 0; i--) {
        const p = free[i]
        p.x += p.vx * Math.min(dt * 0.06, 2)
        p.y += p.vy * Math.min(dt * 0.06, 2)
        p.vx *= 0.98
        p.vy *= 0.98
        p.life -= 0.012

        if (p.life <= 0) { free.splice(i, 1); continue }

        const a = p.life * p.alpha
        if (p.size > 1.2) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
          g.addColorStop(0, `rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},${a * 0.5})`)
          g.addColorStop(1, `rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},0)`)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},${a})`
        ctx.fill()
      }

      // ── Shockwave ring ──
      if (shock.active) {
        shock.radius += dt * 0.3
        shock.alpha *= 0.985
        if (shock.alpha < 0.01) {
          shock.active = false
        } else {
          ctx.beginPath()
          ctx.arc(cx, cyy, shock.radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(50, 220, 120, ${shock.alpha * 0.4})`
          ctx.lineWidth = 2
          ctx.stroke()

          // Inner ring
          ctx.beginPath()
          ctx.arc(cx, cyy, shock.radius * 0.7, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(160, 120, 255, ${shock.alpha * 0.2})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // ── Draw entity cores (bright center of each nebula) ──
      for (const node of nodes) {
        const [r, g, b] = node.rgb
        const breath = Math.sin(node.breathPhase) * 0.1
        const isAct = node.isActive && isRunning

        // Core glow
        const glowR = node.radius * (isAct ? 2.5 : 1.8)
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR)
        glow.addColorStop(0, `rgba(255,255,255,${(isAct ? 0.4 : 0.2) + breath})`)
        glow.addColorStop(0.15, `rgba(${r},${g},${b},${(isAct ? 0.35 : 0.2) + breath})`)
        glow.addColorStop(0.5, `rgba(${r},${g},${b},${isAct ? 0.08 : 0.04})`)
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath()
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Hard core
        const coreR = node.radius * 0.4
        ctx.beginPath()
        ctx.arc(node.x, node.y, coreR, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${(isAct ? 0.7 : 0.4) + breath})`
        ctx.fill()

        // Name
        ctx.font = "500 9px 'JetBrains Mono', system-ui, monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillStyle = `rgba(255,255,255,${isAct ? 0.7 : 0.35})`
        ctx.fillText(node.name, node.x, node.y + node.radius * 3.5 + 4)

        // Discovery indicator
        if (node.discoveries > 5) {
          ctx.font = "400 7px 'JetBrains Mono', monospace"
          ctx.fillStyle = `rgba(${r},${g},${b},${isAct ? 0.5 : 0.25})`
          ctx.fillText(`${node.discoveries} discoveries`, node.x, node.y + node.radius * 3.5 + 16)
        }
      }

      // ── Ambient drift particles ──
      if (frameRef.current % 40 === 0 && free.length < 30) {
        free.push({
          x: Math.random() * w, y: Math.random() * h,
          ox: 0, oy: 0, angle: 0, speed: 0, dist: 0,
          size: 0.3 + Math.random() * 0.5,
          rgb: [200, 200, 255],
          alpha: 0.05 + Math.random() * 0.08,
          owner: -1, life: 1,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
        })
      }

      // Replenish entity motes that were consumed by vortex
      if (!isRunning || phase === "idle" || phase === "complete") {
        for (let ni = 0; ni < nodes.length; ni++) {
          let count = 0
          for (const m of motes) if (m.owner === ni) count++
          if (count < MOTES_PER_ENTITY) {
            const node = nodes[ni]
            const a = Math.random() * Math.PI * 2
            const d = (Math.random() * 0.7 + 0.3) * node.radius * 3.5
            motes.push({
              x: node.x + Math.cos(a) * d,
              y: node.y + Math.sin(a) * d,
              ox: Math.cos(a) * d, oy: Math.sin(a) * d,
              angle: a, speed: 0.003 + Math.random() * 0.008, dist: d,
              size: 0.5 + Math.random() * 1.5,
              rgb: [
                node.rgb[0] + Math.floor((Math.random() - 0.5) * 30),
                node.rgb[1] + Math.floor((Math.random() - 0.5) * 30),
                node.rgb[2] + Math.floor((Math.random() - 0.5) * 30),
              ] as [number, number, number],
              alpha: 0.15 + Math.random() * 0.4,
              owner: ni, life: 1, vx: 0, vy: 0,
            })
          }
        }
      }

      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    return () => { alive = false; window.removeEventListener("resize", resize) }
  }, [buildNodes, isRunning, phase, MOTES_PER_ENTITY])

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
}
