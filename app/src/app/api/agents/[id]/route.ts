import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key)
}

/** GET /api/agents/[id] — get a single agent */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('agents')
      .select('*, users!inner(wallet_address, display_name)')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ agent: data })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** PATCH /api/agents/[id] — update agent fields */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if (body.soul !== undefined || body.skill !== undefined) {
      // Combine soul + skill into system_prompt field for DB compatibility
      updates.system_prompt = [body.soul ?? '', '---', body.skill ?? ''].join('\n')
    }
    if (body.status !== undefined) updates.status = body.status
    if (body.computeTier !== undefined) updates.compute_tier = body.computeTier
    if (body.name !== undefined) updates.name = body.name

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agent: data })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
