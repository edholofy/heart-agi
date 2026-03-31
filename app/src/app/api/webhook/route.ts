import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ""
const WEBHOOK_TOLERANCE_SECONDS = 300 // 5 minutes

/**
 * Verify Stripe webhook signature using HMAC-SHA256.
 * @see https://docs.stripe.com/webhooks/signatures
 */
function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): { valid: boolean; error?: string } {
  try {
    const parts = signatureHeader.split(",")
    const timestampPart = parts.find((p) => p.startsWith("t="))
    const signatureParts = parts.filter((p) => p.startsWith("v1="))

    if (!timestampPart || signatureParts.length === 0) {
      return { valid: false, error: "Missing timestamp or v1 signature in stripe-signature header" }
    }

    const timestamp = timestampPart.slice(2)
    const timestampNum = parseInt(timestamp, 10)

    if (isNaN(timestampNum)) {
      return { valid: false, error: "Invalid timestamp in stripe-signature header" }
    }

    // Replay protection: reject events older than 5 minutes
    const now = Math.floor(Date.now() / 1000)
    if (now - timestampNum > WEBHOOK_TOLERANCE_SECONDS) {
      return { valid: false, error: `Webhook timestamp too old (${now - timestampNum}s > ${WEBHOOK_TOLERANCE_SECONDS}s)` }
    }

    // Create the signed payload: "timestamp.rawBody"
    const signedPayload = `${timestamp}.${rawBody}`
    const expectedSignature = createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex")

    // Check if any v1 signature matches (Stripe may send multiple during secret rotation)
    const expectedBuffer = Buffer.from(expectedSignature, "hex")
    for (const sigPart of signatureParts) {
      const actualSignature = sigPart.slice(3)
      const actualBuffer = Buffer.from(actualSignature, "hex")

      if (expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)) {
        return { valid: true }
      }
    }

    return { valid: false, error: "Signature mismatch" }
  } catch (err) {
    return { valid: false, error: `Signature verification error: ${err}` }
  }
}

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

    // Stripe webhook signature verification
    const signatureHeader = req.headers.get("stripe-signature")

    if (STRIPE_WEBHOOK_SECRET) {
      if (!signatureHeader) {
        console.error("[webhook] Missing stripe-signature header")
        return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 401 })
      }

      const verification = verifyStripeSignature(body, signatureHeader, STRIPE_WEBHOOK_SECRET)
      if (!verification.valid) {
        console.error("[webhook] Signature verification failed:", verification.error)
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    } else {
      // No webhook secret configured
      if (process.env.NODE_ENV === "production") {
        console.error("[webhook] STRIPE_WEBHOOK_SECRET is not set in production — rejecting request")
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
      }
      console.warn("[webhook] WARNING: STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode)")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = JSON.parse(body) as any

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object
      const metadataType = session?.metadata?.type as string | undefined

      if (metadataType === "refuel") {
        // Handle refuel: add compute to an existing entity
        const planKey = session?.metadata?.plan as PlanKey | undefined
        const entityId = session?.metadata?.entityId as string | undefined

        if (!planKey || !entityId || !(planKey in PLANS)) {
          console.error("[webhook] Invalid refuel metadata:", session.metadata)
          return NextResponse.json({ error: "Invalid refuel metadata" }, { status: 400 })
        }

        const plan = PLANS[planKey]

        console.log(
          `[webhook] Refuel payment completed: entity ${entityId} (${plan.name} plan, ${plan.compute} compute)`
        )

        // Refuel the entity via daemon API
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          }
          if (DAEMON_API_KEY) {
            headers["X-API-Key"] = DAEMON_API_KEY
          }

          const res = await fetch(`${DAEMON_URL}/api/entities/refuel`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              id: entityId,
              amount: plan.compute,
            }),
          })

          if (!res.ok) {
            const errorText = await res.text()
            console.error("[webhook] Daemon refuel failed:", res.status, errorText)
          } else {
            const refuelResult = await res.json()
            console.log("[webhook] Entity refueled:", refuelResult)
          }
        } catch (refuelError) {
          console.error("[webhook] Failed to reach daemon for refuel:", refuelError)
          // Don't return 500 — Stripe will retry. The payment is already complete.
        }
      } else {
        // Handle spawn: create a new entity
        const planKey = session?.metadata?.plan as PlanKey | undefined
        const entityName = session?.metadata?.entityName as string | undefined
        const soul = session?.metadata?.soul as string | undefined
        const skill = session?.metadata?.skill as string | undefined

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
