"use client"

import { useEffect } from "react"

export default function Error({ error }: { error: Error; reset: () => void }) {
  // Auto-reload after 2 seconds
  useEffect(() => {
    console.error("Page error, auto-reloading:", error.message)
    const timer = setTimeout(() => window.location.reload(), 2000)
    return () => clearTimeout(timer)
  }, [error])

  return null // invisible — user just sees a brief flash then page reloads
}
