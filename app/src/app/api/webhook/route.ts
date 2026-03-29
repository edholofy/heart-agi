import { NextRequest, NextResponse } from "next/server"

const PLANS = {
  spark:   { price: 500,   compute: 500,   name: "Spark" },
  flame:   { price: 2000,  compute: 2500,  name: "Flame" },
  inferno: { price: 5000,  compute: 10000, name: "Inferno" },
  eternal: { price: 10000, compute: 25000, name: "Eternal" },
} as const

type PlanKey = keyof typeof PLANS

const DAEMON_URL = process.env.DAEMON_INTERNAL_URL || "http://5.161.47.118:4600"
const DAEMON_API_KEY = process.env.DAEMON_API_KEY || ""

/**
 * POST /api/webhook
 * Stripe webhook handler for checkout.session.completed events.
 * Spawns the purchased AI entity via the daemon API.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Parse the event (signature verification can be added when webhook secret is configured)
    const event = JSON.parse(body)

    if (event.type === "checkout.session.completed") {
      const session = event.data.object

      const planKey = session.metadata?.plan as PlanKey | undefined
      const entityName = session.metadata?.entityName as string | undefined
      const soul = session.metadata?.soul as string | undefined
      const skill = session.metadata?.skill as string | undefined

      if (!planKey || !entityName || !(planKey in PLANS)) {
        console.error("[webhook] Invalid metadata:", session.metadata)
        return NextResponse.json({ error: "Invalid metadata" }, { status: 400 })
      }

      const plan = PLANS[planKey]

      console.log(
        `[webhook] Payment completed: ${entityName} (${plan.name} plan, ${plan.compute} compute)`
      )

      // Spawn the entity via daemon API
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        }
        if (DAEMON_API_KEY) {
          headers["X-API-Key"] = DAEMON_API_KEY
        }

        const res = await fetch(`${DAEMON_URL}/api/entities/spawn`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: entityName,
            owner_address: `stripe-${session.id}`,
            soul: soul || "A curious and autonomous AI entity.",
            skill: skill || "General reasoning and exploration.",
            compute_balance: plan.compute,
          }),
        })

        if (!res.ok) {
          const errorText = await res.text()
          console.error("[webhook] Daemon spawn failed:", res.status, errorText)
        } else {
          const spawnResult = await res.json()
          console.log("[webhook] Entity spawned:", spawnResult)
        }
      } catch (spawnError) {
        console.error("[webhook] Failed to reach daemon:", spawnError)
        // Don't return 500 — Stripe will retry. The payment is already complete.
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[webhook] Error processing event:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
