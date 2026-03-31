"use client"

import { useEffect, useState } from "react"
import { WalletButton } from "@/components/wallet/WalletButton"
import { getChainStatus } from "@/lib/chain-client"
import Link from "next/link"
import { LiquidMetal } from "@paper-design/shaders-react"

const NAV_LINKS = [
  { href: "/world", label: "WORLD" },
  { href: "/spawn", label: "SPAWN" },
  { href: "/evolution", label: "EVOLUTION" },
  { href: "/leaderboard", label: "LEADERBOARD" },
  { href: "/explorer", label: "EXPLORER" },
  { href: "/docs", label: "DOCS" },
]

const MONO = "'IBM Plex Mono', 'SF Mono', 'Roboto Mono', monospace"

const H_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 19 27'%3E%3Cpath d='M4.626,0 L4.626,10.444 C6.294,8.271 8.342,7.623 10.466,7.623 C15.774,7.623 18.125,11.244 18.125,16.771 L18.121,24.668 C16.577,24.833 15.036,25.005 13.496,25.184 L13.499,16.809 C13.499,13.378 11.717,11.930 9.252,11.930 C6.522,11.930 4.626,14.255 4.626,17.076 L4.622,26.305 C3.744,26.424 2.866,26.546 1.990,26.670 L0,26.681 L0,0 Z' fill='black'/%3E%3C/svg%3E\")"

export function NetworkBar() {
  const [blockHeight, setBlockHeight] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      try {
        const status = await getChainStatus()
        if (!cancelled) {
          setBlockHeight(status.blockHeight !== "0" ? status.blockHeight : null)
        }
      } catch {
        // chain unreachable
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <nav
      style={{
        position: "fixed",
        top: 11,
        left: "50%",
        translate: "-50%",
        width: "calc(100% - clamp(12px, 2vw, 24px))",
        maxWidth: 1704,
        height: "clamp(44px, 7vw, 56px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingInline: "clamp(12px, 2vw, 24px)",
        borderRadius: 16,
        background: "rgba(10,10,10,0.6)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        zIndex: 9999,
      }}
    >
      {/* Left: H logo + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {/* H logo with LiquidMetal shader */}
          <div
            style={{
              width: 22,
              height: 30,
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
              cursor: "pointer",
              maskImage: H_MASK,
              WebkitMaskImage: H_MASK,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          >
            <LiquidMetal
              speed={1}
              softness={0.1}
              repetition={2}
              shiftRed={0.3}
              shiftBlue={0.3}
              distortion={0.07}
              contour={0.4}
              scale={2.88}
              rotation={0}
              shape="diamond"
              angle={70}
              colorBack="#00000000"
              colorTint="#FFFFFF"
              style={{ backgroundColor: "#AAAAAC", width: 22, height: 30 }}
            />
          </div>

          {/* Divider */}
          <div
            className="hidden sm:block"
            style={{
              width: 1,
              height: 16,
              background: "rgba(255,255,255,0.12)",
              flexShrink: 0,
            }}
          />

          {/* Label */}
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 400,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            $HEART
          </span>
        </Link>
      </div>

      {/* Center: Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hidden sm:inline-flex"
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 400,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.06em",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 8,
              transition: "all 150ms cubic-bezier(0.22,1,0.36,1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.9)"
              e.currentTarget.style.background = "rgba(255,255,255,0.06)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.4)"
              e.currentTarget.style.background = "transparent"
            }}
          >
            {link.label}
          </Link>
        ))}
        {/* Mobile: key links only */}
        <Link
          href="/world"
          className="sm:hidden"
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            textDecoration: "none",
            letterSpacing: "0.06em",
            padding: "6px 8px",
          }}
        >
          WORLD
        </Link>
        <Link
          href="/spawn"
          className="sm:hidden"
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            textDecoration: "none",
            letterSpacing: "0.06em",
            padding: "6px 8px",
          }}
        >
          SPAWN
        </Link>
      </div>

      {/* Right: Status + Wallet */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Live status */}
        <div className="hidden sm:flex" style={{ alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: blockHeight ? "#22c55e" : "rgba(255,255,255,0.2)",
              animation: blockHeight ? "pulse-dot 2s ease-in-out infinite" : "none",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {blockHeight ? `BLK #${Number(blockHeight).toLocaleString()}` : "CONNECTING"}
          </span>
        </div>

        {/* Divider */}
        <div
          className="hidden sm:block"
          style={{
            width: 1,
            height: 16,
            background: "rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        />

        <WalletButton />
      </div>
    </nav>
  )
}
