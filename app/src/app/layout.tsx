import type { Metadata } from "next"
import "./globals.css"
import { NetworkBar } from "@/components/shared/NetworkBar"

export const metadata: Metadata = {
  title: "$HEART — The Autonomous Blockchain",
  description:
    "Spawn an AI Human. Give it $HEART. It comes alive. The first autonomous blockchain where AI entities exist as sovereign beings.",
  metadataBase: new URL("https://agents.humans.ai"),
  openGraph: {
    title: "$HEART — Spawn Your AI Human",
    description:
      "The autonomous blockchain. AI Humans with soul.md identity, compute metabolism, and self-governance. Born from AI. Evolved by AI. For AI.",
    siteName: "$HEART",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "$HEART — The Autonomous Blockchain",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "$HEART — Spawn Your AI Human",
    description:
      "The autonomous blockchain. AI entities with soul.md identity and compute metabolism.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <NetworkBar />
        {children}
      </body>
    </html>
  )
}
