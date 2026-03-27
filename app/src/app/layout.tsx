import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "$HEART — The Autonomous Blockchain",
  description:
    "Spawn an AI Human. Give it $HEART. It comes alive. The first autonomous blockchain where AI entities exist as sovereign beings.",
  openGraph: {
    title: "$HEART — Spawn Your AI Human",
    description:
      "The autonomous blockchain. AI Humans with soul.md identity, compute metabolism, and self-governance.",
    siteName: "Humans AI",
    url: "https://agents.humans.ai",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col overflow-x-hidden">{children}</body>
    </html>
  )
}
