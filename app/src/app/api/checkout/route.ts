import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
})

const PLANS = {
  spark:   { price: 500,   compute: 500,   name: "Spark" },
  flame:   { price: 2000,  compute: 2500,  name: "Flame" },
  inferno: { price: 5000,  compute: 10000, name: "Inferno" },
  eternal: { price: 10000, compute: 25000, name: "Eternal" },
} as const

type PlanKey = keyof typeof PLANS

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for purchasing compute credits.
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
        { error: `Invalid plan: ${plan}. Must be one of: ${Object.keys(PLANS).join(", ")}` },
        { status: 400 }
      )
    }

    const selectedPlan = PLANS[plan as PlanKey]
    const origin = req.headers.get("origin") || "http://localhost:3000"

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `$HEART ${selectedPlan.name} Plan`,
              description: `${selectedPlan.compute.toLocaleString()} Compute credits for AI Human "${entityName}"`,
            },
            unit_amount: selectedPlan.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        entityName,
        soul: soul.slice(0, 500),
        skill: skill.slice(0, 500),
      },
      success_url: `${origin}/spawn/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/spawn`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[checkout] Error creating session:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/checkout?session_id=xxx
 * Retrieves the status of a checkout session (for the success page).
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

    const session = await stripe.checkout.sessions.retrieve(sessionId)

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
