// =============================================================================
// Agency Group — Batch Deal Evaluation
// POST /api/offmarket-leads/batch-eval
//
// Runs deal-eval on all leads with score ≥ min_score and missing deal_evaluation_score.
// Calls /api/offmarket-leads/[id]/deal-eval for each lead (internal fetch).
// CRON_SECRET only — not exposed to portal sessions.
//
// Query params:
//   ?limit=30       — max leads per batch (default 30, max 50)
//   ?min_score=40   — minimum lead score (default 40)
//   ?force=true     — re-evaluate even if already has score
//   ?stage=all|price|match|eval — which stages to run (default: eval only)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'
import { safeCompare } from '@/lib/safeCompare'
import { runPriceIntel } from '@/app/api/offmarket-leads/[id]/price-intel/route'
import { runMatchBuyers } from '@/app/api/offmarket-leads/[id]/match-buyers/route'
import { runDealEval } from '@/app/api/offmarket-leads/[id]/deal-eval/route'

// ── Auth: CRON_SECRET (automated) OR portal session (manual trigger) ──────────
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && incoming && safeCompare(incoming, cronSecret)) return true
  const session = await auth()
  return !!session
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const limit    = Math.min(50, parseInt(sp.get('limit') ?? '30', 10))
  const minScore = Math.max(0, parseInt(sp.get('min_score') ?? '40', 10))
  const force    = sp.get('force') === 'true'
  const stage    = sp.get('stage') ?? 'eval' // 'all' | 'price' | 'match' | 'eval'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin

    // Get leads to process — exclude test leads (cleaned by migration 011)
    let query = s
      .from('offmarket_leads')
      .select('id, nome, score, cidade, tipo_ativo, price_ask, area_m2, gross_discount_pct')
      .gte('score', minScore)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')
      .not('nome', 'ilike', '%test%')
      .not('nome', 'ilike', '%e2e%')
      .not('nome', 'ilike', '%direct%')
      .order('score', { ascending: false })
      .limit(limit)

    if (!force) {
      query = query.is('deal_evaluation_score', null)
    }

    const { data: leads, error: queryError } = await query

    if (queryError) {
      console.error('[batch-eval] Query error:', queryError)
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!leads?.length) {
      return NextResponse.json({
        processed: 0,
        failed: 0,
        total: 0,
        message: 'No leads require evaluation',
      })
    }

    console.log(`[batch-eval] Processing ${leads.length} leads (stage=${stage}, force=${force})`)

    // Process leads with concurrency control (max 5 concurrent)
    const results: Array<{
      id: string; nome: string; score: number
      eval_score?: number; rank?: number; classification?: string
      stages_run: string[]; error?: string
    }> = []

    const CONCURRENCY = 5
    for (let i = 0; i < leads.length; i += CONCURRENCY) {
      const batch = leads.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map(async (lead: {
          id: string; nome: string; score: number | null
          cidade: string | null; tipo_ativo: string | null
          price_ask: number | null; area_m2: number | null; gross_discount_pct: number | null
        }) => {
          const stagesRun: string[] = []
          let evalData: Record<string, unknown> = {}

          // AUTO-TRIGGER: price-intel when price_ask + area_m2 exist but no discount data
          const needsPriceIntel = lead.price_ask !== null
            && lead.area_m2 !== null
            && lead.gross_discount_pct === null
          const shouldRunPriceIntel = stage === 'all' || stage === 'price' || needsPriceIntel

          // Stage 1: Price Intel
          if (shouldRunPriceIntel) {
            await runPriceIntel(lead.id)
            stagesRun.push(needsPriceIntel ? 'price-intel(auto)' : 'price-intel')
          }

          // Stage 2: Buyer Match (if stage=all or stage=match)
          if (stage === 'all' || stage === 'match') {
            await runMatchBuyers(lead.id)
            stagesRun.push('match-buyers')
          }

          // Stage 3: Deal Eval (always)
          const dealResult = await runDealEval(lead.id)
          if (!dealResult) {
            throw new Error('deal-eval returned null')
          }
          evalData = dealResult as unknown as Record<string, unknown>
          stagesRun.push('deal-eval')

          return {
            id: lead.id,
            nome: lead.nome,
            score: lead.score ?? 0,
            eval_score: evalData.deal_evaluation_score as number,
            rank: evalData.master_attack_rank as number,
            classification: evalData.classification as string,
            stages_run: stagesRun,
          }
        })
      )

      for (let j = 0; j < batch.length; j++) {
        const result = batchResults[j]
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            id: batch[j].id,
            nome: batch[j].nome,
            score: batch[j].score ?? 0,
            stages_run: [],
            error: String((result as PromiseRejectedResult).reason?.message ?? result.reason),
          })
        }
      }
    }

    const succeeded = results.filter(r => !r.error)
    const failed    = results.filter(r => !!r.error)

    // Sort by rank desc for summary
    const topLeads = succeeded
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
      .slice(0, 10)

    const classificationSummary = succeeded.reduce<Record<string, number>>((acc, r) => {
      const c = r.classification ?? 'unknown'
      acc[c] = (acc[c] ?? 0) + 1
      return acc
    }, {})

    console.log(`[batch-eval] Done: ${succeeded.length} OK, ${failed.length} failed`)

    return NextResponse.json({
      processed: succeeded.length,
      failed: failed.length,
      total: leads.length,
      stage,
      classification_summary: classificationSummary,
      top_leads: topLeads,
      errors: failed.map(r => ({ id: r.id, nome: r.nome, error: r.error })),
    })
  } catch (err) {
    console.error('[batch-eval] Fatal error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET — dry run: shows how many leads would be processed
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const minScore = Math.max(0, parseInt(sp.get('min_score') ?? '40', 10))
  const force    = sp.get('force') === 'true'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin
    let query = s
      .from('offmarket_leads')
      .select('id, nome, score, cidade, deal_evaluation_score, master_attack_rank', { count: 'exact' })
      .gte('score', minScore)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')

    if (!force) query = query.is('deal_evaluation_score', null)

    const { count, data } = await query.limit(5)

    return NextResponse.json({
      pending_evaluation: count ?? 0,
      min_score: minScore,
      force,
      sample: data?.slice(0, 5) ?? [],
    })
  } catch (err) {
    console.error('[batch-eval GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
