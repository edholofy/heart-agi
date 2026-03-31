"use client"

import { useEffect, useRef, useCallback } from "react"

/* ─── Types ─── */

export interface EntityBrainMonitorProps {
  entityName: string
  status: "alive" | "dormant" | "stopped"
  discoveries: number
  experiments: number
  computeBalance: number
  lastActivity?: string
}

/* ─── WebGL helpers ─── */

const VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    vUv = position * 0.5 + 0.5;
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_glitch;
  uniform float u_amp;
  uniform float u_freq;
  uniform float u_health;
  uniform float u_alive;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    // Glitch horizontal offset
    if (u_glitch > 0.0) {
      float gOffset = (random(vec2(floor(uv.y * 12.0), u_time * 3.0)) - 0.5) * u_glitch * 0.15;
      uv.x += gOffset;
      // Vertical tear on heavy glitch
      if (u_glitch > 0.5) {
        float tear = step(0.97, random(vec2(floor(uv.y * 20.0), floor(u_time * 5.0))));
        uv.y += tear * 0.03 * u_glitch;
      }
    }

    // Background — very dark
    float dimFactor = mix(0.3, 1.0, u_alive);
    vec3 color = vec3(0.015, 0.012, 0.01) * dimFactor;

    // Grid overlay (oscilloscope grid)
    float gridX = step(0.97, fract(uv.x * 16.0));
    float gridY = step(0.97, fract(uv.y * 10.0));
    // Major gridlines (thicker at center)
    float majorX = smoothstep(0.005, 0.0, abs(uv.x - 0.5));
    float majorY = smoothstep(0.005, 0.0, abs(uv.y - 0.5));
    vec3 gridColor = vec3(0.06, 0.08, 0.06) * dimFactor;
    color += gridColor * max(gridX, gridY) * (1.0 - u_glitch * 0.5);
    color += vec3(0.04, 0.06, 0.04) * (majorX + majorY) * dimFactor;

    // Waveform
    float t = u_time * 0.6 + u_glitch * random(uv) * 0.15;
    float amp = u_amp * u_alive;

    // Add noise to waveform when health is low
    float noiseAmp = (1.0 - u_health) * 0.08;
    float waveNoise = (random(vec2(uv.x * 50.0, u_time * 2.0)) - 0.5) * noiseAmp;

    // Multi-harmonic waveform for richer brain signal
    float waveY = sin(uv.x * u_freq + t) * amp * 0.6;
    waveY += sin(uv.x * u_freq * 2.3 + t * 1.7) * amp * 0.25;
    waveY += sin(uv.x * u_freq * 0.5 + t * 0.3) * amp * 0.15;
    waveY += waveNoise;

    // Flatline when dead
    waveY *= u_alive;

    float waveDist = abs((uv.y - 0.5) - waveY);
    float lineThick = 0.004 + u_glitch * 0.025;
    float waveGlow = smoothstep(lineThick * 5.0, 0.0, waveDist);
    float waveCore = smoothstep(lineThick, 0.0, waveDist);

    // Color based on health: green -> amber -> red
    vec3 healthyColor = vec3(0.133, 0.773, 0.369);  // #22c55e
    vec3 warningColor = vec3(0.961, 0.620, 0.043);   // #f59e0b
    vec3 dangerColor  = vec3(0.937, 0.267, 0.267);   // #ef4444

    vec3 waveColor;
    if (u_alive < 0.5) {
      waveColor = dangerColor;
    } else if (u_health < 0.3) {
      waveColor = mix(dangerColor, warningColor, u_health / 0.3);
    } else if (u_health < 0.7) {
      waveColor = mix(warningColor, healthyColor, (u_health - 0.3) / 0.4);
    } else {
      waveColor = healthyColor;
    }

    color += waveColor * waveCore * dimFactor;
    color += waveColor * 0.35 * waveGlow * dimFactor;

    // Phosphor trail (trailing glow behind waveform)
    float trailDist = abs((uv.y - 0.5) - waveY);
    float trail = smoothstep(lineThick * 12.0, lineThick * 3.0, trailDist);
    color += waveColor * 0.06 * trail * dimFactor;

    // CRT scanlines
    float scanline = sin(uv.y * 600.0 - u_time * 8.0) * 0.05;
    color -= scanline * dimFactor;

    // Film grain noise (more when dormant)
    float noiseIntensity = mix(0.06, 0.15, 1.0 - u_alive);
    float noise = random(uv + u_time) * noiseIntensity;
    color += noise * dimFactor;

    // Vignette
    float dist = distance(vUv, vec2(0.5));
    float vig = smoothstep(0.85, 0.35, dist);
    color *= vig;

    // Edge fade (CRT bezel)
    color *= smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
    color *= smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);

    // Red tint overlay when compute is critically low
    if (u_health < 0.2 && u_alive > 0.5) {
      float redPulse = sin(u_time * 3.0) * 0.5 + 0.5;
      color += vec3(0.05, 0.0, 0.0) * redPulse * (0.2 - u_health) * 5.0;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog))
    return null
  }
  return prog
}

/* ─── Component ─── */

export function EntityBrainMonitor({
  entityName,
  status,
  discoveries,
  experiments,
  computeBalance,
  lastActivity,
}: EntityBrainMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glitchRef = useRef(0)
  const currentAmpRef = useRef(0)
  const currentFreqRef = useRef(8)
  const prevDiscoveriesRef = useRef(discoveries)
  const animIdRef = useRef<number>(0)

  const isAlive = status === "alive"
  const discoveryRate =
    experiments > 0 ? discoveries / experiments : 0
  const maxCompute = 10000
  const healthRatio = Math.min(1, computeBalance / maxCompute)

  // Target amplitude from discovery rate (0 = flatline, 0.3 = max wave)
  const targetAmp = isAlive ? 0.04 + discoveryRate * 0.26 : 0.005
  // Target frequency from experiment count
  const targetFreq = isAlive
    ? 6.0 + Math.min(experiments, 500) * 0.04
    : 2.0

  /** Trigger glitch when discovery count changes */
  const triggerGlitch = useCallback((intensity: number) => {
    glitchRef.current = Math.min(1.0, intensity)
  }, [])

  useEffect(() => {
    if (discoveries > prevDiscoveriesRef.current) {
      triggerGlitch(1.0)
    }
    prevDiscoveriesRef.current = discoveries
  }, [discoveries, triggerGlitch])

  /** WebGL render loop */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", { alpha: false })
    if (!gl) return

    // Size canvas at 2x for retina
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()

    const prog = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
    if (!prog) return

    gl.useProgram(prog)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(prog, "position")
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, "u_time")
    const uGlitch = gl.getUniformLocation(prog, "u_glitch")
    const uAmp = gl.getUniformLocation(prog, "u_amp")
    const uFreq = gl.getUniformLocation(prog, "u_freq")
    const uHealth = gl.getUniformLocation(prog, "u_health")
    const uAlive = gl.getUniformLocation(prog, "u_alive")

    const startTime = Date.now()
    const aliveTarget = isAlive ? 1.0 : 0.0
    let currentAlive = isAlive ? 1.0 : 0.0

    function render() {
      if (!gl || !canvas) return
      resize()
      gl.viewport(0, 0, canvas.width, canvas.height)

      // Smooth interpolation
      currentAmpRef.current +=
        (targetAmp - currentAmpRef.current) * 0.08
      currentFreqRef.current +=
        (targetFreq - currentFreqRef.current) * 0.08
      currentAlive += (aliveTarget - currentAlive) * 0.05
      glitchRef.current *= 0.88

      gl.uniform1f(uTime, (Date.now() - startTime) / 1000)
      gl.uniform1f(uGlitch, glitchRef.current)
      gl.uniform1f(uAmp, currentAmpRef.current)
      gl.uniform1f(uFreq, currentFreqRef.current)
      gl.uniform1f(uHealth, healthRatio)
      gl.uniform1f(uAlive, currentAlive)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animIdRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animIdRef.current)
    }
  }, [isAlive, targetAmp, targetFreq, healthRatio])

  // Derive display values
  const discoveryPct =
    experiments > 0
      ? ((discoveries / experiments) * 100).toFixed(1)
      : "0.0"

  const statusColor = isAlive
    ? healthRatio < 0.1
      ? "#ef4444"
      : healthRatio < 0.3
        ? "#f59e0b"
        : "#22c55e"
    : "#ef4444"

  const statusLabel = status.toUpperCase()

  const timeSinceActivity = lastActivity
    ? formatTimeAgo(lastActivity)
    : "N/A"

  return (
    <div style={{ width: "100%" }}>
      {/* CRT Monitor housing */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#0a0a0a",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow:
            "inset 0 2px 8px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        {/* WebGL canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        />

        {/* Glass reflection overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: "50%",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* HUD overlay on CRT */}
        <div
          style={{
            position: "absolute",
            inset: 12,
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            pointerEvents: "none",
            fontFamily: "var(--font-mono)",
          }}
        >
          {/* Top row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                color: statusColor,
                opacity: 0.6,
                textShadow: `0 0 4px ${statusColor}40`,
              }}
            >
              NEURAL_MONITOR v1.0
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                color: statusColor,
                opacity: 0.6,
                textShadow: `0 0 4px ${statusColor}40`,
              }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Entity name large */}
          <div style={{ marginTop: "auto", marginBottom: 16 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: statusColor,
                textShadow: `0 0 8px ${statusColor}60`,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              {entityName}
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                color: statusColor,
                opacity: 0.5,
                marginTop: 4,
              }}
            >
              $HEART ENTITY // BRAIN ACTIVITY
            </div>
          </div>

          {/* Bottom stats row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: statusColor,
                opacity: 0.5,
              }}
            >
              DISC_RATE: {discoveryPct}%
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: statusColor,
                opacity: 0.5,
              }}
            >
              LAST: {timeSinceActivity}
            </span>
          </div>
        </div>
      </div>

      {/* Stats panel below CRT */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginTop: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        <MonitorStat label="ENTITY" value={entityName.toUpperCase()} />
        <MonitorStat
          label="STATUS"
          value={statusLabel}
          dotColor={statusColor}
        />
        <MonitorStat
          label="DISC_RATE"
          value={`${discoveryPct}%`}
        />
        <MonitorStat
          label="COMPUTE"
          value={computeBalance.toLocaleString()}
          warn={computeBalance < 100}
        />
      </div>
    </div>
  )
}

/* ─── Stat cell ─── */

function MonitorStat({
  label,
  value,
  dotColor,
  warn,
}: {
  label: string
  value: string
  dotColor?: string
  warn?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          opacity: 0.5,
          marginBottom: 2,
          fontFamily: "var(--font-mono)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 400,
          fontFamily: "var(--font-mono)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: warn ? "#ef4444" : "inherit",
        }}
      >
        {dotColor && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: dotColor,
              display: "inline-block",
              flexShrink: 0,
            }}
            className={dotColor === "#22c55e" ? "animate-pulse-dot" : ""}
          />
        )}
        {value}
      </div>
    </div>
  )
}

/* ─── Helpers ─── */

function formatTimeAgo(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return "JUST NOW"
  if (seconds < 60) return `${seconds}S AGO`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}M AGO`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}H AGO`
  return `${Math.floor(hours / 24)}D AGO`
}
