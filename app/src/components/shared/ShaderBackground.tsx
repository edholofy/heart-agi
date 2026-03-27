"use client"

import { useEffect, useRef } from "react"

/**
 * AURA-style WebGL shader background.
 * Renders a sweeping organic arc with soft glow — purely decorative.
 */
export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true })
    if (!gl) return

    // Vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `)
    gl.compileShader(vs)

    // Fragment shader — organic glow arc
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;

      vec2 hash(vec2 p) {
        p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
        return -1.0 + 2.0*fract(sin(p)*43758.5453123);
      }

      float noise(vec2 p) {
        float K1 = 0.366025404;
        float K2 = 0.211324865;
        vec2 i = floor(p + (p.x+p.y)*K1);
        vec2 a = p - i + (i.x+i.y)*K2;
        vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0*K2;
        vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
        vec3 n = h*h*h*h*vec3(dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
        return dot(n, vec3(70.0));
      }

      float sdArc(vec2 p, vec2 center, float radius, float width, float warp) {
        p.y += sin(p.x * 3.0 + u_time * 0.5) * warp;
        p.x += noise(p * 2.0 + u_time * 0.2) * (warp * 0.5);
        float d = length(p - center) - radius;
        return abs(d) - width;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 st = uv;
        st.x *= u_resolution.x / u_resolution.y;

        vec2 center = vec2(0.2, 0.5);
        float d1 = sdArc(st, center, 0.8, 0.01, 0.1);
        float d2 = sdArc(st, center, 0.82, 0.04, 0.15);

        float coreGlow = exp(-d1 * 40.0);
        float fringeGlow = exp(-d2 * 15.0);
        float wash = smoothstep(1.0, -0.2, st.x) * 0.3;

        vec3 coreColor = vec3(1.0);
        vec3 fringeColor = vec3(0.29, 0.53, 1.0);

        vec3 color = coreColor * coreGlow + fringeColor * fringeGlow + fringeColor * wash * (sin(u_time) * 0.1 + 0.9);
        color = vec3(1.0) - exp(-color * 2.0);

        float alpha = clamp(coreGlow + fringeGlow + wash, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `)
    gl.compileShader(fs)

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.useProgram(program)

    // Full-screen quad
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const timeLoc = gl.getUniformLocation(program, "u_time")
    const resLoc = gl.getUniformLocation(program, "u_resolution")

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }

    resize()
    window.addEventListener("resize", resize)

    let animId: number
    const start = Date.now()

    function render() {
      const t = (Date.now() - start) / 1000
      gl!.uniform1f(timeLoc, t)
      gl!.uniform2f(resLoc, canvas!.width, canvas!.height)
      gl!.clear(gl!.COLOR_BUFFER_BIT)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
      animId = requestAnimationFrame(render)
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
