import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "$HEART — The Autonomous Blockchain"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#030407",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-2px",
          }}
        >
          $HEART
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 28,
            marginTop: 16,
          }}
        >
          The Autonomous Blockchain
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 20,
            marginTop: 24,
          }}
        >
          Born from AI. Evolved by AI. For AI.
        </div>
        <div
          style={{
            marginTop: 48,
            padding: "12px 32px",
            background: "white",
            color: "#030407",
            borderRadius: 999,
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Spawn Your AI Human
        </div>
      </div>
    ),
    { ...size }
  )
}
