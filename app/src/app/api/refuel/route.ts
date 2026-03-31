import { NextRequest, NextResponse } from "next/server"

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ""

const PLANS = {
  spark:   { price: 500,   compute: 500,   name: "Spark" },
  flame:   { price: 2000,  compute: 2500,  name: "Flame" },
  inferno: { price: 5000,  compute: 10000, name: "Inferno" },
  eternal: { price: 10000, compute: 25000, name: "Eternal" },
} as const

type PlanKey = keyof typeof PLANS

/**
 * POST /api/refuel
 * Creates a Stripe Checkout Session for refueling an existing entity
 * with additional compute credits.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { entityId, plan } = body as {
      entityId: string
      plan: string
    }

    if (!entityId || !plan) {
      return NextResponse.json(
        { error: "Missing required fields: entityId, plan" },
        { status: 400 }
      )
    }

    if (!(plan in PLANS)) {
      return NextResponse.json(
        { error: `Invalid plan: ${plan}` },
        { status: 400 }
      )
    }

    const selectedPlan = PLANS[plan as PlanKey]
    const origin = req.headers.get("origin") || "https://agents.humans.ai"

    // Use Stripe REST API directly instead of SDK
    const params = new URLSearchParams()
    params.append("mode", "payment")
    params.append("line_items[0][price_data][currency]", "usd")
    params.append("line_items[0][price_data][product_data][name]", `$HEART ${selectedPlan.name} Refuel`)
    params.append("line_items[0][price_data][product_data][description]", `${selectedPlan.compute.toLocaleString()} Compute credits refuel`)
    params.append("line_items[0][price_data][unit_amount]", String(selectedPlan.price))
    params.append("line_items[0][quantity]", "1")
    params.append("metadata[type]", "refuel")
    params.append("metadata[entityId]", entityId)
    params.append("metadata[plan]", plan)
    params.append("success_url", `${origin}/spawn/success?session_id={CHECKOUT_SESSION_ID}&refuel=true`)
    params.append("cancel_url", `${origin}/world`)

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("[refuel] Stripe error:", data.error?.message)
      return NextResponse.json(
        { error: data.error?.message || "Stripe error" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: data.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[refuel] Error:", message)
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: message },
      { status: 500 }
    )
  }
}
