import Link from "next/link"

export default function NotFound() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 48, fontWeight: 700, marginBottom: 12, color: "#121212" }}>
        404
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(0,0,0,0.5)", marginBottom: 24 }}>
        Page not found
      </p>
      <Link href="/" style={{
        padding: "12px 32px", background: "#121212", color: "#fff",
        fontFamily: "var(--font-mono)", fontSize: 12, textDecoration: "none",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        Go Home
      </Link>
    </div>
  )
}
