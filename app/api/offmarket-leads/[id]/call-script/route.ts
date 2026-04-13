// =============================================================================
// Agency Group — Call Script Generator
// GET /api/offmarket-leads/[id]/call-script
//
// Gera o script de chamada, objeções e sequência de follow-up para 1 lead.
// Usado pelo portal (botão "Ver Script" no Deal Desk).
// Auth: portal session.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'
import { generateCallEngineOutput, type CallLeadInput } from '@/lib/call-engine'

export const runtime = 'nodejs'

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && incoming === cronSecret) return true
  const session = await auth()
  return !!session
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  try {
    const { data: lead, error } = await s
      .from('offmarket_leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found', detail: error?.message }, { status: 404 })
    }

    const output = generateCallEngineOutput(lead as CallLeadInput)

    return NextResponse.json({
      success: true,
      ...output,
      lead_id: id,    // override output.lead_id with route param (same value, avoids TS dupe)
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[call-script]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
