"use client"

import { useEffect, useRef, useCallback } from "react"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MetaballVizProps {
  entityCount?: number
  height?: number
}

/* ------------------------------------------------------------------ */
/*  Shaders (WebGL2 — version 300 es)                                  */
/* ------------------------------------------------------------------ */

const VERT_SRC = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

/**
 * Fragment shader: SDF metaballs with smin merging, Phong lighting,
 * specular highlights, rim lighting, and weighted color blending.
 * Dark metallic palette — gunmetal, bronze, silver, dark gold, pewter.
 */
const FRAG_SRC = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;       // normalised mouse position (0..1)
uniform int u_count;         // number of blobs

// blob data: xy = position, z = radius, w = color index
uniform vec4 u_blobs[8];

out vec4 fragColor;

/* ---------- smooth-minimum (polynomial k=0.4) ---------- */
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/* ---------- metallic entity colours ---------- */
vec3 entityColor(int idx) {
  // dark metallic tones
  if (idx == 0) return vec3(0.16, 0.18, 0.21);  // gunmetal
  if (idx == 1) return vec3(0.55, 0.41, 0.08);  // bronze
  if (idx == 2) return vec3(0.60, 0.60, 0.62);  // silver
  if (idx == 3) return vec3(0.63, 0.50, 0.19);  // dark gold
  if (idx == 4) return vec3(0.30, 0.32, 0.34);  // pewter
  if (idx == 5) return vec3(0.42, 0.28, 0.12);  // copper
  if (idx == 6) return vec3(0.22, 0.24, 0.28);  // dark steel
  return vec3(0.35, 0.35, 0.37);                 // nickel
}

/* ---------- SDF scene: circles + smin merge ---------- */
float sceneSDF(vec2 p, out vec3 col) {
  float d = 1e5;
  col = vec3(0.0);
  float totalWeight = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= u_count) break;
    vec2 center = u_blobs[i].xy;
    float radius = u_blobs[i].z;
    int ci = int(u_blobs[i].w);

    float di = length(p - center) - radius;

    // accumulate weighted colour based on proximity
    float w = exp(-max(di, 0.0) * 6.0);
    col += entityColor(ci) * w;
    totalWeight += w;

    d = smin(d, di, 0.12);
  }

  if (totalWeight > 0.0) col /= totalWeight;
  return d;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // SDF + colour
  vec3 surfCol;
  float d = sceneSDF(p, surfCol);

  // gradient-based normal
  float eps = 0.002;
  vec3 dummy;
  float dx = sceneSDF(p + vec2(eps, 0.0), dummy) - sceneSDF(p - vec2(eps, 0.0), dummy);
  float dy = sceneSDF(p + vec2(0.0, eps), dummy) - sceneSDF(p - vec2(0.0, eps), dummy);
  vec3 normal = normalize(vec3(-dx, -dy, 2.0 * eps));

  // Light direction (slight top-right)
  vec3 lightDir = normalize(vec3(0.4, 0.6, 1.0));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);

  // Phong lighting
  float ambient = 0.08;
  float diffuse = max(dot(normal, lightDir), 0.0) * 0.45;
  float specular = pow(max(dot(normal, halfVec), 0.0), 128.0) * 1.2;

  // Rim lighting
  float rim = 1.0 - max(dot(normal, viewDir), 0.0);
  rim = pow(rim, 3.0) * 0.35;

  // Fresnel-like environment reflection
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0) * 0.2;

  // Compose
  vec3 lit = surfCol * (ambient + diffuse) + vec3(specular) + vec3(rim) + vec3(fresnel);

  // Smooth edge with anti-aliased falloff
  float pixSize = 1.5 / u_resolution.y;
  float alpha = 1.0 - smoothstep(-pixSize, pixSize * 2.0, d);

  // Subtle outer glow
  float glow = exp(-max(d, 0.0) * 30.0) * 0.06;
  vec3 glowCol = surfCol * glow;

  vec3 finalCol = lit * alpha + glowCol;

  fragColor = vec4(finalCol, alpha + glow);
}
`

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog))
    gl.deleteProgram(prog)
    return null
  }
  return prog
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MetaballViz({ entityCount = 5, height = 300 }: MetaballVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const rafRef = useRef<number>(0)

  const clampedCount = Math.max(2, Math.min(entityCount, 8))

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: 1.0 - (e.clientY - rect.top) / rect.height,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false })
    if (!gl) return // graceful fallback

    // --- compile shaders ---
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) return

    const program = createProgram(gl, vs, fs)
    if (!program) return

    // --- full-screen quad ---
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const aPos = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // --- uniforms ---
    const uTime = gl.getUniformLocation(program, "u_time")
    const uRes = gl.getUniformLocation(program, "u_resolution")
    const uMouse = gl.getUniformLocation(program, "u_mouse")
    const uCount = gl.getUniformLocation(program, "u_count")
    const uBlobs: (WebGLUniformLocation | null)[] = []
    for (let i = 0; i < 8; i++) {
      uBlobs.push(gl.getUniformLocation(program, `u_blobs[${i}]`))
    }

    gl.useProgram(program)

    // --- blob initial state ---
    // Each blob: angle offset, orbit radius, angular speed, size, colour index
    const blobs = Array.from({ length: clampedCount }, (_, i) => ({
      angleOffset: (Math.PI * 2 * i) / clampedCount + Math.random() * 0.4,
      orbitRx: 0.12 + Math.random() * 0.18,
      orbitRy: 0.06 + Math.random() * 0.10,
      speed: 0.15 + Math.random() * 0.15,
      size: 0.055 + Math.random() * 0.04,
      colorIdx: i % 8,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
    }))

    // --- resize handler ---
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener("resize", resize)

    // --- mouse ---
    canvas.addEventListener("mousemove", handleMouseMove)

    // --- animation loop ---
    const startTime = performance.now()

    const render = () => {
      const t = (performance.now() - startTime) / 1000

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      gl.useProgram(program)
      gl.uniform1f(uTime, t)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y)
      gl.uniform1i(uCount, clampedCount)

      const aspect = canvas.width / canvas.height

      // normalised mouse in scene coords
      const mx = (mouseRef.current.x - 0.5) * aspect
      const my = mouseRef.current.y - 0.5

      for (let i = 0; i < clampedCount; i++) {
        const blob = blobs[i]
        const angle = blob.angleOffset + t * blob.speed

        // Lissajous-ish orbit
        let bx = Math.cos(angle + blob.phaseX) * blob.orbitRx
        let by = Math.sin(angle * 1.3 + blob.phaseY) * blob.orbitRy

        // Mouse repulsion
        const ddx = bx - mx
        const ddy = by - my
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) + 0.001
        const repulse = Math.max(0, 1.0 - dist / 0.35) * 0.06
        bx += (ddx / dist) * repulse
        by += (ddy / dist) * repulse

        gl.uniform4f(uBlobs[i], bx, by, blob.size, blob.colorIdx)
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)

    // --- cleanup ---
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      gl.deleteBuffer(buf)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteProgram(program)
    }
  }, [clampedCount, handleMouseMove])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height,
        display: "block",
        pointerEvents: "auto",
      }}
    />
  )
}
