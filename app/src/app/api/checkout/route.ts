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
 * POST /api/checkout
 * Creates a Stripe Checkout Session using the REST API directly
 * (avoids SDK connection issues on Vercel serverless).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { plan, entityName, soul, skill } = body as {
      plan: string
      entityName: string
      soul: string
      skill: string
    }

    if (!plan || !entityName || !soul || !skill) {
      return NextResponse.json(
        { error: "Missing required fields: plan, entityName, soul, skill" },
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
    params.append("line_items[0][price_data][product_data][name]", `$HEART ${selectedPlan.name} Plan`)
    params.append("line_items[0][price_data][product_data][description]", `${selectedPlan.compute.toLocaleString()} Compute credits for AI Human "${entityName}"`)
    params.append("line_items[0][price_data][unit_amount]", String(selectedPlan.price))
    params.append("line_items[0][quantity]", "1")
    params.append("metadata[plan]", plan)
    params.append("metadata[entityName]", entityName)
    params.append("metadata[soul]", soul.slice(0, 500))
    params.append("metadata[skill]", skill.slice(0, 500))
    params.append("success_url", `${origin}/spawn/success?session_id={CHECKOUT_SESSION_ID}`)
    params.append("cancel_url", `${origin}/spawn`)

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
      console.error("[checkout] Stripe error:", data.error?.message)
      return NextResponse.json(
        { error: data.error?.message || "Stripe error" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: data.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[checkout] Error:", message)
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/checkout?session_id=xxx
 * Retrieves the status of a checkout session.
 */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id")

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id parameter" },
        { status: 400 }
      )
    }

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      },
    })

    const session = await res.json()

    return NextResponse.json({
      status: session.payment_status,
      entityName: session.metadata?.entityName || "Unknown",
      plan: session.metadata?.plan || "unknown",
      soul: session.metadata?.soul || "",
      skill: session.metadata?.skill || "",
    })
  } catch (error) {
    console.error("[checkout] Error retrieving session:", error)
    return NextResponse.json(
      { error: "Failed to retrieve session" },
      { status: 500 }
    )
  }
}
