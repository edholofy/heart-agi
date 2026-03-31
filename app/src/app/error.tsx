"use client"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 32, fontWeight: 700, marginBottom: 12, color: "#121212" }}>
        Something went wrong
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(0,0,0,0.5)", marginBottom: 24, maxWidth: 400, textAlign: "center" }}>
        {error.message || "The page encountered an error. This usually resolves on reload."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "12px 32px", background: "#121212", color: "#fff", border: "none",
          fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}
      >
        Try Again
      </button>
    </div>
  )
}
