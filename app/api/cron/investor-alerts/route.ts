// =============================================================================
// Agency Group — Investor Alerts Cron
// GET /api/cron/investor-alerts
// Scheduled: daily at 08:30 UTC via vercel.json (after sync-listings at 06:00)
//
// PIPELINE:
//   1. Fetch high-score properties (opportunity_score ≥ 75, investor_suitable)
//      scored in last 24h (i.e. freshly detected by sync-listings)
//   2. For each property, find matching investors (budget + location + status)
//   3. Generate personalized Claude alert message (PT European, 2 sentences)
//   4. Write deal_packs row (status: 'ready') for each property
//   5. Log to automations_log
//
// NOTE: This cron does NOT send messages — it prepares the pipeline.
//       Sending is done by separate n8n workflows triggered by deal_packs status.
//       (This is intentional: avoid double-sending + allow agent review)
//
// AUTH: CRON_SECRET (x-cron-secret header or Authorization: Bearer)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime    = 'nodejs'
export const maxDuration = 120

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()
  return token === secret
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertProperty {
  id:               string
  title:            string
  price:            number
  zone:             string | null
  zone_key:         string | null
  type:             string | null
  area_m2:          number | null
  bedrooms:         number | null
  opportunity_score: number
  score_reason:     string | null
  estimated_rental_yield: number | null
  is_exclusive:     boolean | null
  is_off_market:    boolean | null
  photos:           string[] | null
}

interface MatchedInvestor {
  id:           string
  full_name:    string
  email:        string | null
  whatsapp:     string | null
  budget_max:   number | null
  lead_tier:    string | null
  agent_email:  string | null
}

interface AlertResult {
  property_id:      string
  property_title:   string
  investors_matched: number
  deal_pack_id:     string | null
  alert_message:    string
  error?:           string
}

// ---------------------------------------------------------------------------
// Step 1 — Fetch high-score properties scored in last 24h
// ---------------------------------------------------------------------------

async function fetchFreshHighScoreProperties(
  minScore  = 75,
  maxHoursOld = 24,
): Promise<AlertProperty[]> {
  const since = new Date(Date.now() - maxHoursOld * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('properties')
    .select([
      'id', 'title', 'price', 'zone', 'zone_key', 'type',
      'area_m2', 'bedrooms', 'opportunity_score', 'score_reason',
      'estimated_rental_yield', 'is_exclusive', 'is_off_market', 'photos',
    ].join(','))
    .eq('status', 'active')
    .eq('investor_suitable', true)
    .gte('opportunity_score', minScore)
    .gte('scored_at', since)
    .order('opportunity_score', { ascending: false })
    .limit(10)  // Max 10 alerts per run to avoid spam

  if (error) throw new Error(`fetchFreshHighScoreProperties: ${error.message}`)
  return ((data ?? []) as unknown) as AlertProperty[]
}

// ---------------------------------------------------------------------------
// Step 2 — Find matching investors for a property
// ---------------------------------------------------------------------------

async function findMatchingInvestors(
  property: AlertProperty,
): Promise<MatchedInvestor[]> {
  const priceFloor = property.price * 0.85  // 15% below asking (negotiation room)
  const priceCeil  = property.price * 1.10  // 10% above (investor flexibility)

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name, email, whatsapp, budget_max, lead_tier, agent_email')
    .in('status', ['prospect', 'qualified', 'active', 'vip'])
    .eq('opt_out_whatsapp', false)
    .lte('budget_min', priceCeil)
    .gte('budget_max', priceFloor)
    .limit(15)

  if (error) {
    console.error(`[investor-alerts] findMatchingInvestors: ${error.message}`)
    return []
  }

  return (data ?? []) as MatchedInvestor[]
}

// ---------------------------------------------------------------------------
// Step 3 — Generate alert message via Claude Haiku
// ---------------------------------------------------------------------------

async function generateAlertMessage(property: AlertProperty): Promise<string> {
  const fallback = buildFallbackMessage(property)
  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const preco = property.price.toLocaleString('pt-PT')
    const area  = property.area_m2 ? `${property.area_m2}m²` : ''
    const quartos = property.bedrooms ? `T${property.bedrooms}` : ''
    const tipo  = property.type ?? ''
    const zona  = property.zone ?? property.zone_key ?? 'Portugal'
    const yield_ = property.estimated_rental_yield
      ? `, yield ${property.estimated_rental_yield}%`
      : ''
    const exclusive = property.is_exclusive || property.is_off_market
      ? ' (imóvel exclusivo, fora do portal)' : ''
    const score = property.opportunity_score

    const msg = await client.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 200,
      system:     'Agente imobiliário de luxo em Portugal. Responde APENAS com a mensagem de WhatsApp, sem aspas, sem JSON, sem prefixos.',
      messages: [{
        role:    'user',
        content: `Escreve uma mensagem WhatsApp (máx 2 frases, português europeu formal) para alertar um investidor VIP sobre esta oportunidade imobiliária${exclusive}.

IMÓVEL:
- ${[area, quartos, tipo].filter(Boolean).join(' · ')} em ${zona}
- Preço: €${preco}${yield_}
- Score de oportunidade: ${score}/100
${property.score_reason ? `- Destaque: ${property.score_reason}` : ''}

Menciona zona + preço + exclusividade. Cria urgência real. Convida contacto imediato.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || fallback
  } catch {
    return fallback
  }
}

function buildFallbackMessage(property: AlertProperty): string {
  const zona  = property.zone ?? property.zone_key ?? 'Portugal'
  const preco = property.price.toLocaleString('pt-PT')
  const score = property.opportunity_score
  const excl  = property.is_exclusive || property.is_off_market ? ' (exclusivo)' : ''
  return `Oportunidade Agency Group${excl}: ${property.title} em ${zona} a €${preco} — score de investimento ${score}/100. Contacte-nos para visita privada.`
}

// ---------------------------------------------------------------------------
// Step 4 — Create deal_pack row
// ---------------------------------------------------------------------------

async function createDealPack(
  property:  AlertProperty,
  investors: MatchedInvestor[],
  message:   string,
): Promise<string | null> {
  if (investors.length === 0) return null

  // Use first matched investor as primary lead
  const lead = investors[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('deal_packs')
    .insert({
      property_id:  property.id,
      lead_id:      lead.id,
      created_by:   lead.agent_email ?? 'system@agency-group.pt',
      status:       'ready',
      title:        property.title,       // required by schema
      ai_summary:   message,
      metadata: {
        trigger:            'investor_alerts_cron',
        opportunity_score:  property.opportunity_score,
        investors_matched:  investors.length,
        investor_ids:       investors.map(i => i.id),
        generated_at:       new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[investor-alerts] createDealPack: ${error.message}`)
    return null
  }

  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Step 5 — Log execution
// ---------------------------------------------------------------------------

async function logExecution(
  results:    AlertResult[],
  startedAt:  string,
  durationMs: number,
  errors:     string[],
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('automations_log')
    .insert({
      workflow_name: 'investor_alerts_cron',
      trigger_type:  'cron',
      status:        errors.length === 0 ? 'success' : 'partial',
      started_at:    startedAt,
      completed_at:  new Date().toISOString(),
      duration_ms:   durationMs,
      outcome: {
        properties_processed: results.length,
        deal_packs_created:   results.filter(r => r.deal_pack_id).length,
        total_investors_matched: results.reduce((s, r) => s + r.investors_matched, 0),
      },
      error_message: errors.length > 0 ? errors.join('; ') : null,
    })
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const t0        = Date.now()
  const errors:   string[] = []
  const results:  AlertResult[] = []

  const minScore    = parseInt(req.nextUrl.searchParams.get('min_score') ?? '75', 10)
  const maxHoursOld = parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10)

  try {
    // 1. Fetch fresh high-score properties
    const properties = await fetchFreshHighScoreProperties(minScore, maxHoursOld)

    if (properties.length === 0) {
      return NextResponse.json({
        ok:      true,
        message: `No high-score properties (≥${minScore}) scored in last ${maxHoursOld}h`,
        results: [],
        duration_ms: Date.now() - t0,
      })
    }

    // 2. Process each property sequentially (avoid Claude rate limits)
    for (const property of properties) {
      const result: AlertResult = {
        property_id:      property.id,
        property_title:   property.title,
        investors_matched: 0,
        deal_pack_id:     null,
        alert_message:    '',
      }

      try {
        // Find investors + generate message in parallel
        const [investors, message] = await Promise.all([
          findMatchingInvestors(property),
          generateAlertMessage(property),
        ])

        result.investors_matched = investors.length
        result.alert_message     = message

        // Create deal pack if investors found
        if (investors.length > 0) {
          result.deal_pack_id = await createDealPack(property, investors, message)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.error = msg
        errors.push(`property ${property.id}: ${msg}`)
      }

      results.push(result)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`fatal: ${msg}`)
  }

  const durationMs = Date.now() - t0

  // Log (best-effort)
  try {
    await logExecution(results, startedAt, durationMs, errors)
  } catch { /* silent */ }

  return NextResponse.json(
    {
      ok:          errors.length === 0,
      results,
      summary: {
        properties_processed:   results.length,
        deal_packs_created:     results.filter(r => r.deal_pack_id).length,
        total_investors_matched: results.reduce((s, r) => s + r.investors_matched, 0),
      },
      duration_ms: durationMs,
      ...(errors.length > 0 ? { errors } : {}),
    },
    { status: errors.length > 0 && results.length === 0 ? 500 : 200 },
  )
}
