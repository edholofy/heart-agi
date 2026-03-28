"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * Entity specialization color palette — neon cyberpunk aesthetic.
 */
const DOMAIN_COLORS: Record<string, [number, number, number]> = {
  security: [59, 130, 246],
  systems: [59, 130, 246],
  consensus: [59, 130, 246],
  distributed: [59, 130, 246],
  blockchain: [59, 130, 246],
  crypto: [59, 130, 246],
  ai: [139, 92, 246],
  ml: [139, 92, 246],
  intelligence: [139, 92, 246],
  learning: [139, 92, 246],
  model: [139, 92, 246],
  alignment: [139, 92, 246],
  science: [34, 197, 94],
  physics: [34, 197, 94],
  quantum: [34, 197, 94],
  math: [34, 197, 94],
  research: [34, 197, 94],
  analysis: [34, 197, 94],
  creative: [245, 158, 11],
  narrative: [245, 158, 11],
  writing: [245, 158, 11],
  story: [245, 158, 11],
  strategy: [245, 158, 11],
  engineering: [6, 182, 212],
  code: [6, 182, 212],
  architecture: [6, 182, 212],
  compiler: [6, 182, 212],
  infrastructure: [6, 182, 212],
  chip: [6, 182, 212],
  hardware: [6, 182, 212],
  biology: [236, 72, 153],
  genomics: [236, 72, 153],
  health: [236, 72, 153],
  medical: [236, 72, 153],
  protein: [236, 72, 153],
}

const DEFAULT_RGB: [number, number, number] = [139, 92, 246]

interface SwarmVizProps {
  entities: Array<{
    name: string
    skill: string
    compute_balance: number
    discoveries: number
    status: string
  }>
  isRunning: boolean
  activeEntities?: string[]
  phase?: "idle" | "decomposing" | "working" | "synthesizing" | "complete"
}

interface EntityNode {
  x: number
  y: number
  targetX: number
  targetY: number
  radius: number
  rgb: [number, number, number]
  name: string
  discoveries: number
  computeBalance: number
  angle: number
  orbitSpeed: number
  orbitRadius: number
  isActive: boolean
  pulsePhase: number
  trail: Array<{ x: number; y: number; alpha: number }>
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  rgb: [number, number, number]
  size: number
  type: "flow" | "spark" | "ambient" | "nova"
}

function getEntityRgb(skill: string): [number, number, number] {
  const lower = skill.toLowerCase()
  for (const [keyword, rgb] of Object.entries(DOMAIN_COLORS)) {
    if (lower.includes(keyword)) return rgb
  }
  return DEFAULT_RGB
}

/**
 * SwarmVisualization — cinematic 2D canvas visualization.
 *
 * Entities orbit as glowing orbs with energy trails, connected by
 * constellation-style neural links. During swarm execution, entities
 * converge toward a central nexus with dramatic particle effects.
 */
export function SwarmVisualization({
  entities,
  isRunning,
  activeEntities = [],
  phase = "idle",
}: SwarmVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<EntityNode[]>([])
  const particlesRef = useRef<Particle[]>([])
  const frameRef = useRef(0)
  const timeRef = useRef(0)
  const centerRef = useRef({ x: 0, y: 0 })
  const starsRef = useRef<Array<{ x: number; y: number; size: number; twinkle: number }>>([])

  const buildNodes = useCallback(
    (width: number, height: number) => {
      const cx = width / 2
      const cy = height / 2
      centerRef.current = { x: cx, y: cy }

      // Generate background stars once
      if (starsRef.current.length === 0) {
        for (let i = 0; i < 80; i++) {
          starsRef.current.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.2 + 0.3,
            twinkle: Math.random() * Math.PI * 2,
          })
        }
      }

      const existing = nodesRef.current
      const activeSet = new Set(activeEntities)

      nodesRef.current = entities.map((entity, i) => {
        const prev = existing.find((n) => n.name === entity.name)
        const angle = (i / Math.max(entities.length, 1)) * Math.PI * 2 - Math.PI / 2
        const layerOffset = (i % 3) * 25
        const orbitRadius = Math.min(width, height) * 0.3 + layerOffset
        const rgb = getEntityRgb(entity.skill)
        const radius = Math.max(6, Math.min(18, 6 + Math.sqrt(entity.compute_balance) * 0.3))

        return {
          x: prev?.x ?? cx + Math.cos(angle) * orbitRadius,
          y: prev?.y ?? cy + Math.sin(angle) * orbitRadius,
          targetX: cx + Math.cos(angle) * orbitRadius,
          targetY: cy + Math.sin(angle) * orbitRadius,
          radius,
          rgb,
          name: entity.name,
          discoveries: entity.discoveries,
          computeBalance: entity.compute_balance,
          angle: prev?.angle ?? angle,
          orbitSpeed: 0.00015 + (i % 7) * 0.00008,
          orbitRadius,
          isActive: activeSet.size > 0 ? activeSet.has(entity.name) : true,
          pulsePhase: prev?.pulsePhase ?? Math.random() * Math.PI * 2,
          trail: prev?.trail ?? [],
        }
      })
    },
    [entities, activeEntities]
  )

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

    let running = true

    function spawnParticle(
      x: number, y: number,
      vx: number, vy: number,
      rgb: [number, number, number],
      type: Particle["type"] = "flow",
      size = 1.5,
      life = 80
    ) {
      if (particlesRef.current.length > 500) return
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx, vy,
        life, maxLife: life,
        rgb, size,
        type,
      })
    }

    function spawnNova(x: number, y: number, rgb: [number, number, number], count = 12) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2
        const speed = 1.5 + Math.random() * 2
        spawnParticle(
          x, y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          rgb, "nova", 2 + Math.random() * 2, 40 + Math.random() * 30
        )
      }
    }

    // Track phase transitions for nova effects
    let lastPhase = phase

    function animate(ts: number) {
      if (!running || !canvas || !ctx) return

      const dt = Math.min(ts - (timeRef.current || ts), 50)
      timeRef.current = ts
      frameRef.current++

      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const nodes = nodesRef.current
      const particles = particlesRef.current
      const cx = centerRef.current.x
      const cy = centerRef.current.y
      const t = ts * 0.001

      // Phase transition effects
      if (phase !== lastPhase) {
        if (phase === "decomposing") spawnNova(cx, cy, [139, 92, 246], 20)
        if (phase === "synthesizing") spawnNova(cx, cy, [139, 92, 246], 30)
        if (phase === "complete") spawnNova(cx, cy, [34, 197, 94], 40)
        lastPhase = phase
      }

      // === CLEAR ===
      ctx.clearRect(0, 0, w, h)

      // === BACKGROUND STARS ===
      for (const star of starsRef.current) {
        const twinkle = Math.sin(t * 0.8 + star.twinkle) * 0.5 + 0.5
        const alpha = 0.08 + twinkle * 0.12
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fill()
      }

      // === ORBITAL RINGS (subtle reference circles) ===
      const ringAlpha = isRunning ? 0.025 : 0.015
      for (let r = 0; r < 3; r++) {
        const ringR = Math.min(w, h) * 0.3 + r * 25
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`
        ctx.lineWidth = 0.5
        ctx.setLineDash([3, 8])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // === UPDATE NODE POSITIONS ===
      for (const node of nodes) {
        const dtFactor = dt * 0.001

        if (isRunning && node.isActive) {
          if (phase === "working" || phase === "synthesizing") {
            // Pull toward center — convergence
            const pullStr = phase === "synthesizing" ? 0.04 : 0.012
            node.targetX = cx + (node.x - cx) * (1 - pullStr)
            node.targetY = cy + (node.y - cy) * (1 - pullStr)
          } else if (phase === "decomposing") {
            // Slight outward push then converge
            node.angle += node.orbitSpeed * dt * 2
            node.targetX = cx + Math.cos(node.angle) * node.orbitRadius * 0.9
            node.targetY = cy + Math.sin(node.angle) * node.orbitRadius * 0.9
          }
        } else {
          // Idle orbit
          node.angle += node.orbitSpeed * dt
          node.targetX = cx + Math.cos(node.angle) * node.orbitRadius
          node.targetY = cy + Math.sin(node.angle) * node.orbitRadius
        }

        // Smooth interpolation
        node.x += (node.targetX - node.x) * Math.min(dtFactor * 3, 0.1)
        node.y += (node.targetY - node.y) * Math.min(dtFactor * 3, 0.1)

        // Update trail
        node.trail.push({ x: node.x, y: node.y, alpha: 1 })
        if (node.trail.length > 30) node.trail.shift()
        for (const tp of node.trail) {
          tp.alpha *= 0.94
        }
        node.pulsePhase += dtFactor * 2
      }

      // === DRAW CONSTELLATION CONNECTIONS ===
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxDist = Math.min(w, h) * 0.5

          if (dist < maxDist) {
            const falloff = 1 - dist / maxDist
            const baseAlpha = isRunning && a.isActive && b.isActive ? 0.08 : 0.03
            const alpha = falloff * falloff * baseAlpha

            // Gradient line between the two entity colors
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
            grad.addColorStop(0, `rgba(${a.rgb[0]}, ${a.rgb[1]}, ${a.rgb[2]}, ${alpha})`)
            grad.addColorStop(1, `rgba(${b.rgb[0]}, ${b.rgb[1]}, ${b.rgb[2]}, ${alpha})`)

            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = grad
            ctx.lineWidth = 0.6
            ctx.stroke()

            // Ambient particles along connections (idle)
            if (!isRunning && frameRef.current % 120 === 0 && Math.random() < 0.2) {
              const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 20
              const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 20
              spawnParticle(mx, my, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, a.rgb, "ambient", 1, 60)
            }
          }
        }
      }

      // === CENTRAL NEXUS (during swarm execution) ===
      if (isRunning) {
        const nexusPulse = Math.sin(t * 3) * 0.5 + 0.5
        const isSynth = phase === "synthesizing"
        const isComplete = phase === "complete"

        // Deep glow rings
        for (let ring = 0; ring < 3; ring++) {
          const rScale = isSynth ? 1.3 + Math.sin(t * 4 + ring) * 0.2 : 1.0
          const ringR = (20 + ring * 15) * rScale
          const ringA = (isSynth ? 0.12 : 0.06) * (1 - ring * 0.3) + nexusPulse * 0.03

          ctx.beginPath()
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = isComplete
            ? `rgba(34, 197, 94, ${ringA})`
            : `rgba(139, 92, 246, ${ringA})`
          ctx.lineWidth = 1.2 - ring * 0.3
          ctx.stroke()
        }

        // Central core glow
        const coreR = isSynth ? 35 + nexusPulse * 10 : 25
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
        const coreColor = isComplete ? "34, 197, 94" : "139, 92, 246"
        coreGrad.addColorStop(0, `rgba(${coreColor}, ${isSynth ? 0.25 : 0.12})`)
        coreGrad.addColorStop(0.5, `rgba(${coreColor}, ${isSynth ? 0.08 : 0.04})`)
        coreGrad.addColorStop(1, `rgba(${coreColor}, 0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
        ctx.fillStyle = coreGrad
        ctx.fill()

        // Rotating scan line
        const scanAngle = t * 1.5
        const scanLen = isSynth ? 60 : 40
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(scanAngle) * scanLen, cy + Math.sin(scanAngle) * scanLen)
        ctx.strokeStyle = `rgba(${coreColor}, 0.1)`
        ctx.lineWidth = 1
        ctx.stroke()

        // Phase label
        const labels: Record<string, string> = {
          decomposing: "DECOMPOSING",
          working: "ANALYZING",
          synthesizing: "SYNTHESIZING",
          complete: "COMPLETE",
        }
        const label = labels[phase] || "RUNNING"
        ctx.font = "600 9px 'JetBrains Mono', monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillStyle = isComplete
          ? `rgba(34, 197, 94, 0.6)`
          : `rgba(139, 92, 246, ${0.4 + nexusPulse * 0.2})`
        ctx.fillText(label, cx, cy + coreR + 10)

        // Connection beams from active entities to nexus
        for (const node of nodes) {
          if (!node.isActive) continue

          // Beam with gradient
          const beamGrad = ctx.createLinearGradient(node.x, node.y, cx, cy)
          beamGrad.addColorStop(0, `rgba(${node.rgb[0]}, ${node.rgb[1]}, ${node.rgb[2]}, 0.06)`)
          beamGrad.addColorStop(1, `rgba(${coreColor}, 0.03)`)
          ctx.beginPath()
          ctx.moveTo(node.x, node.y)
          ctx.lineTo(cx, cy)
          ctx.strokeStyle = beamGrad
          ctx.lineWidth = isSynth ? 1.2 : 0.6
          ctx.stroke()

          // Flow particles toward center
          if ((phase === "working" || phase === "decomposing") && frameRef.current % 6 === 0) {
            const dx = cx - node.x
            const dy = cy - node.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 10) {
              const speed = 1.5 + Math.random()
              spawnParticle(node.x, node.y, (dx / dist) * speed, (dy / dist) * speed, node.rgb, "flow", 1.5, dist / speed)
            }
          }

          // Synthesis: particles burst outward from center
          if (phase === "synthesizing" && frameRef.current % 10 === 0) {
            const dx = node.x - cx
            const dy = node.y - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 10) {
              const speed = 2 + Math.random()
              spawnParticle(cx, cy, (dx / dist) * speed, (dy / dist) * speed, [139, 92, 246], "spark", 2, dist / speed)
            }
          }
        }
      }

      // === DRAW ENTITY TRAILS ===
      for (const node of nodes) {
        if (node.trail.length < 2) continue
        const trailAlpha = isRunning && node.isActive ? 0.15 : 0.04
        for (let i = 1; i < node.trail.length; i++) {
          const p = node.trail[i - 1]
          const q = node.trail[i]
          const a = q.alpha * trailAlpha
          if (a < 0.005) continue
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(q.x, q.y)
          ctx.strokeStyle = `rgba(${node.rgb[0]}, ${node.rgb[1]}, ${node.rgb[2]}, ${a})`
          ctx.lineWidth = 1.5 * q.alpha
          ctx.stroke()
        }
      }

      // === UPDATE & DRAW PARTICLES ===
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * Math.min(dt * 0.06, 2)
        p.y += p.vy * Math.min(dt * 0.06, 2)
        p.life -= Math.min(dt * 0.06, 2)

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        const lifeRatio = p.life / p.maxLife
        const alpha = lifeRatio * (p.type === "nova" ? 0.8 : p.type === "spark" ? 0.6 : 0.5)
        const size = p.size * (p.type === "nova" ? lifeRatio : 1)

        // Glow for special particles
        if (p.type === "nova" || p.type === "spark") {
          const glowR = size * 3
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
          glow.addColorStop(0, `rgba(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]}, ${alpha * 0.4})`)
          glow.addColorStop(1, `rgba(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]}, 0)`)
          ctx.beginPath()
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]}, ${alpha})`
        ctx.fill()
      }

      // === DRAW ENTITY NODES ===
      for (const node of nodes) {
        const [r, g, b] = node.rgb
        const pulse = Math.sin(node.pulsePhase) * 0.08
        const discoveryGlow = Math.min(node.discoveries * 0.008, 0.2)
        const isActiveNow = node.isActive && isRunning
        const baseGlow = isActiveNow ? 0.35 : 0.15

        // Outer aura (large, soft)
        const auraR = node.radius * 4
        const aura = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, auraR)
        aura.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(baseGlow + pulse + discoveryGlow) * 0.5})`)
        aura.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${(baseGlow + pulse) * 0.15})`)
        aura.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        ctx.beginPath()
        ctx.arc(node.x, node.y, auraR, 0, Math.PI * 2)
        ctx.fillStyle = aura
        ctx.fill()

        // Core orb with glass effect
        const coreGrad = ctx.createRadialGradient(
          node.x - node.radius * 0.25,
          node.y - node.radius * 0.3,
          node.radius * 0.1,
          node.x,
          node.y,
          node.radius
        )
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.25 + pulse})`)
        coreGrad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.8)`)
        coreGrad.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.4)`)
        coreGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.15)`)
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = coreGrad
        ctx.fill()

        // Thin border ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 0.5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + pulse})`
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Active indicator ring (pulsing)
        if (isActiveNow) {
          const activeR = node.radius + 4 + Math.sin(node.pulsePhase * 2) * 2
          ctx.beginPath()
          ctx.arc(node.x, node.y, activeR, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.15 + pulse})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        // Name label
        ctx.font = "500 10px 'JetBrains Mono', system-ui, monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        const labelAlpha = isActiveNow ? 0.75 : node.isActive || !isRunning ? 0.45 : 0.15
        ctx.fillStyle = `rgba(255, 255, 255, ${labelAlpha})`
        ctx.fillText(node.name, node.x, node.y + node.radius + 8)

        // Discovery count badge
        if (node.discoveries > 0) {
          ctx.font = "400 8px 'JetBrains Mono', system-ui, monospace"
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${labelAlpha * 0.7})`
          ctx.fillText(`${node.discoveries}d`, node.x, node.y + node.radius + 20)
        }

        // Ambient sparkle particles from active entities
        if (isActiveNow && frameRef.current % 15 === 0) {
          const sparkAngle = Math.random() * Math.PI * 2
          const sparkSpeed = 0.3 + Math.random() * 0.5
          spawnParticle(
            node.x + Math.cos(sparkAngle) * node.radius,
            node.y + Math.sin(sparkAngle) * node.radius,
            Math.cos(sparkAngle) * sparkSpeed,
            Math.sin(sparkAngle) * sparkSpeed,
            node.rgb, "ambient", 0.8, 40
          )
        }
      }

      // === AMBIENT FLOATING PARTICLES (always) ===
      if (frameRef.current % 30 === 0) {
        const edge = Math.floor(Math.random() * 4)
        let px = 0, py = 0
        if (edge === 0) { px = Math.random() * w; py = 0 }
        else if (edge === 1) { px = w; py = Math.random() * h }
        else if (edge === 2) { px = Math.random() * w; py = h }
        else { px = 0; py = Math.random() * h }

        spawnParticle(px, py,
          (cx - px) * 0.002 + (Math.random() - 0.5) * 0.3,
          (cy - py) * 0.002 + (Math.random() - 0.5) * 0.3,
          [255, 255, 255], "ambient", 0.6, 200
        )
      }

      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)

    return () => {
      running = false
      window.removeEventListener("resize", resize)
    }
  }, [buildNodes, isRunning, phase])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  )
}
