"use client"

import { useEffect, useState } from "react"
import { WalletButton } from "@/components/wallet/WalletButton"
import { getChainStatus } from "@/lib/chain-client"
import Link from "next/link"

const NAV_LINKS = [
  { href: "/world", label: "WORLD" },
  { href: "/spawn", label: "SPAWN" },
  { href: "/swarm", label: "SWARM" },
  { href: "/leaderboard", label: "LEADERBOARD" },
  { href: "/marketplace", label: "ENTITIES" },
  { href: "/governance", label: "GOV" },
  { href: "/docs", label: "DOCS" },
]

export function NetworkBar() {
  const [blockHeight, setBlockHeight] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      try {
        const status = await getChainStatus()
        if (!cancelled) {
          setBlockHeight(status.blockHeight !== "0" ? status.blockHeight : null)
          setChainId(status.chainId !== "unknown" ? status.chainId : null)
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
    <header
      className="network-bar-brutalist sticky top-0 z-40"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div
        className="max-w-[1600px] mx-auto"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          alignItems: "center",
          padding: "12px 32px",
        }}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--bg)",
              textDecoration: "none",
            }}
          >
            $HEART
          </Link>
          <span className="tech-label hidden sm:inline">
            AUTONOMOUS.CHAIN
          </span>
        </div>

        {/* Center: Nav links */}
        <nav className="flex items-center justify-center gap-4 md:gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden sm:block tech-label transition-colors hover:!text-[var(--bg)]"
            >
              {link.label}
            </Link>
          ))}
          {/* Mobile: key links only */}
          <Link
            href="/world"
            className="sm:hidden tech-label"
          >
            WORLD
          </Link>
          <Link
            href="/swarm"
            className="sm:hidden tech-label"
          >
            SWARM
          </Link>
        </nav>

        {/* Right: Status + Block + Wallet */}
        <div className="flex items-center justify-end gap-4">
          {/* Status dot */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                blockHeight
                  ? "bg-[#22c55e] animate-pulse-dot"
                  : "bg-[rgba(255,255,255,0.2)]"
              }`}
            />
            <span
              className="tech-label"
              style={{ fontSize: 9 }}
            >
              {blockHeight ? "LIVE" : "CONNECTING"}
            </span>
          </div>

          {/* Block height */}
          <div
            className="hidden md:block"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "-0.02em",
              opacity: 0.7,
              color: "var(--bg)",
            }}
          >
            {blockHeight
              ? `BLK #${Number(blockHeight).toLocaleString()}`
              : "\u2014"}
          </div>

          {/* Chain ID */}
          {chainId && (
            <span
              className="hidden lg:block tech-label"
              style={{ fontSize: 9 }}
            >
              {chainId}
            </span>
          )}

          <WalletButton />
        </div>
      </div>
    </header>
  )
}
