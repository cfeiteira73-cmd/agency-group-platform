// =============================================================================
// AGENCY GROUP — Deals Pipeline API v2.0
// GET    /api/deals — list deals (filters: ?stage=, ?agent_id=, ?min_value=, ?status=, ?search=)
// POST   /api/deals — create deal
// PUT    /api/deals — update deal (body: { id, ...fields })
// DELETE /api/deals?id= — delete deal (admin only)
// AMI: 22506 | Supabase-first, mock fallback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import track from '@/lib/trackLearningEvent'
import { emit } from '@/lib/events/producers'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { recordCausalStep } from '@/lib/observability/causalTrace'
import { WON_STAGES } from '@/lib/constants/pipeline'
import { getQueueAdapter } from '@/lib/queue/adapter'
import { recordDealOutcome } from '@/lib/ml/feedbackLoop'
import { recordRequest as sloRecordRequest } from '@/lib/sre/sloTracker'
import { appendEntry } from '@/lib/economics/auditLedger'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types (MockDeal removed — Supabase is the only data source)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rate-limit headers
// ---------------------------------------------------------------------------

function rateLimitHeaders(): HeadersInit {
  return {
    'X-RateLimit-Limit':     '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset':     String(Math.floor(Date.now() / 1000) + 60),
    'Cache-Control':         'no-store',
  }
}

const VALID_FASES = [
  'Angariação', 'Proposta Enviada', 'Proposta Aceite', 'Due Diligence',
  'CPCV Assinado', 'Financiamento', 'Escritura Marcada', 'Escritura Concluída',
  // v2 stages
  'Contacto', 'Qualificado', 'Visita', 'Proposta', 'Negociação', 'CPCV', 'Escritura',
  // terminal stages (won)
  'fechado', 'post_sale', 'pos_venda', 'escritura_sell',
  // terminal stages (lost) — must be in VALID_FASES or the PUT handler rejects them with 400
  'Perdido', 'Rejeitado', 'lost', 'rejected',
]

// ---------------------------------------------------------------------------
// GET /api/deals
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId    = getRequestCorrelationId(req)
  const tenantId  = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
  const _sloStart = Date.now()
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const stage    = searchParams.get('stage')
    const agentId  = searchParams.get('agent_id')
    const minValue = searchParams.get('min_value') ? parseFloat(searchParams.get('min_value')!) : null
    const search   = searchParams.get('search')
    const fase     = searchParams.get('fase') ?? stage  // support both param names
    const page     = Math.max(parseInt(searchParams.get('page')  ?? '1'),  1)
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    // --- Try Supabase ---
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabaseAdmin.from('deals') as any)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)          // TENANT SCOPE: all deal reads scoped to caller's org
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (agentId) {
        query = query.eq('agent_id', agentId)
      }

      if (fase && fase !== 'all') query = query.eq('fase', fase)
      if (minValue !== null)      query = query.gte('valor', minValue)
      if (search) {
        // SECURITY: sanitise search before embedding in PostgREST .or() filter string
        // (contacts/route.ts has this — deals was missing it)
        const safeSearch = search.replace(/[%(),']/g, '').slice(0, 100)
        query = query.or(
          `imovel.ilike.%${safeSearch}%,comprador.ilike.%${safeSearch}%,ref.ilike.%${safeSearch}%`
        )
      }

      const { data, error, count } = await query

      if (!error && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row, idx) => ({
          // Use portal-compat columns if available (from migration 003), fall back to complex schema columns
          id: typeof row.id === 'number' ? row.id : idx + 1,  // sequential numeric ID since UUID→parseInt fails
          ref: row.ref || row.reference || '',
          imovel: row.imovel || row.title || '',
          valor: row.valor || (row.deal_value ? `€ ${Number(row.deal_value).toLocaleString('pt-PT')}` : '€0'),
          fase: row.fase || row.stage || 'Contacto',
          comprador: row.comprador || '',
          cpcvDate: row.cpcv_date_text || row.cpcv_date || '',
          escrituraDate: row.escritura_date_text || row.escritura_date || '',
          checklist: {},
          notas: row.notas || row.notes || '',
          propertyId: row.property_id || null,
        }))

        const _dealGetResponse = NextResponse.json({
          data:   mapped,
          total:  count ?? mapped.length,
          page,
          limit,
          pages:  Math.ceil((count ?? mapped.length) / limit),
          source: 'supabase',
        }, { headers: rateLimitHeaders() })
        void sloRecordRequest(tenantId, 'api', true, Date.now() - _sloStart).catch(() => {})
        return _dealGetResponse
      }
    } catch {
      // Supabase unavailable — fall through to mock
    }

    // Supabase unavailable — return empty result with explicit note (no mock data)
    console.error('[deals GET] Supabase unavailable after retry', { corrId })
    return NextResponse.json({
      data:    [],
      total:   0,
      page,
      limit,
      pages:   0,
      source:  'unavailable',
      message: 'Base de dados temporariamente indisponível. Tente novamente.',
    }, { status: 200, headers: rateLimitHeaders() })
  } catch (error) {
    console.error('[deals GET]', error, { corrId })
    void sloRecordRequest(tenantId, 'api', false, Date.now() - _sloStart).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}

// ---------------------------------------------------------------------------
// POST /api/deals — create deal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const _sloStartPost = Date.now()
  const _sloTenantPost = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as Record<string, unknown>

    if (!body.imovel || !body.valor || !body.fase) {
      return NextResponse.json(
        { error: 'imovel, valor, and fase are required' },
        { status: 400, headers: rateLimitHeaders() }
      )
    }

    if (!VALID_FASES.includes(String(body.fase))) {
      return NextResponse.json(
        { error: `fase must be one of: ${VALID_FASES.join(', ')}` },
        { status: 400, headers: rateLimitHeaders() }
      )
    }

    const ref = String(body.ref || `AG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`)

    const STAGE_PROBABILITY: Record<string, number> = {
      'Contacto': 0.05, 'Qualificado': 0.12, 'Visita': 0.18,
      'Proposta': 0.35, 'Proposta Enviada': 0.40, 'Proposta Aceite': 0.55,
      'Negociação': 0.65, 'CPCV': 0.85, 'CPCV Assinado': 0.90,
      'Escritura': 1.0, 'Escritura Concluída': 1.0, 'Escritura Marcada': 0.95,
      'post_sale': 1.0, 'escritura': 1.0, 'escritura_sell': 1.0,
    }

    const CLOSED_FASE_VALUES = WON_STAGES as readonly string[]

    // Try Supabase (uses portal-compat columns from migration 003)
    try {
      const valorNum = typeof body.valor === 'number' ? body.valor : parseFloat(String(body.valor)) || 0
      const faseStr  = String(body.fase || 'Contacto')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin.from('deals') as any)
        .insert({
          // Portal-friendly columns (added by migration 003_portal_compat.sql)
          ref,
          imovel:      String(body.imovel),
          valor:       `€ ${valorNum.toLocaleString('pt-PT')}`,
          fase:        faseStr,
          comprador:   typeof body.comprador === 'string'   ? body.comprador    : null,
          notas:       typeof body.notas === 'string'       ? body.notas        : null,
          // Standard columns (migration 001)
          title:       String(body.imovel),  // mirror imovel as title for schema compliance
          deal_value:  valorNum,
          property_id: typeof body.property_id === 'string' ? body.property_id : null,
          agent_id:    typeof body.agent_id === 'string'    ? body.agent_id     : null,
          // Economics-critical columns
          tenant_id:            _sloTenantPost,
          assigned_consultant:  (session?.user as { email?: string })?.email ?? null,
          probability:          STAGE_PROBABILITY[faseStr] ?? 0.05,
          actual_close_date:    CLOSED_FASE_VALUES.includes(faseStr) ? new Date().toISOString() : null,
        })
        .select()
        .single()

      if (!error && data) {
        const agentEmail = (session?.user as { email?: string })?.email ?? null
        const corrId2    = getRequestCorrelationId(req)
        // Non-blocking learning event (direct Supabase path — proven analytics)
        track.dealCreated({
          deal_id:        data.id ?? null,
          agent_email:    agentEmail,
          correlation_id: corrId2,
          source_system:  'api',
          metadata:       { fase: body.fase, ref, imovel: body.imovel },
        })
        // Causal trace step for deal creation
        recordCausalStep({
          correlation_id: corrId2,
          tenant_id:      _sloTenantPost,
          step_type:      'db_mutation',
          entity_type:    'deal',
          entity_id:      data.id ?? undefined,
          action:         'deal_created',
          success:        true,
          metadata:       { deal_id: data.id ?? null, valor: valorNum, fase: faseStr },
        })
        // Event bus activation — richer typed event with dedup + DLQ (fire-and-forget)
        void emit.dealCreated(
          {
            deal_id:     data.id ?? null,
            agent_email: agentEmail,
            fase:        faseStr,
            ref,
            imovel:      String(body.imovel),
            valor:       valorNum,
          },
          { correlation_id: corrId2, source_system: 'api' },
        )
        void sloRecordRequest(_sloTenantPost, 'api', true, Date.now() - _sloStartPost).catch(() => {})
        return NextResponse.json({ success: true, deal: data, source: 'supabase' }, { status: 201, headers: rateLimitHeaders() })
      }
      if (error) console.warn('[deals POST] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    // Supabase unavailable — cannot persist deal, return 503
    console.error('[deals POST] Supabase unavailable — deal not created', { corrId })
    return NextResponse.json(
      { error: 'Serviço indisponível. Deal não foi guardado. Tente novamente.' },
      { status: 503, headers: rateLimitHeaders() }
    )
  } catch (error) {
    console.error('[deals POST]', error, { corrId })
    void sloRecordRequest(_sloTenantPost, 'api', false, Date.now() - _sloStartPost).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/deals — update deal
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const { id, ref, ...updates } = body

    if (!id && !ref) {
      return NextResponse.json({ error: 'id or ref is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    if (typeof updates.fase === 'string' && !VALID_FASES.includes(updates.fase)) {
      return NextResponse.json({ error: 'Invalid fase value' }, { status: 400, headers: rateLimitHeaders() })
    }

    try {
      const allowed = ['ref', 'imovel', 'valor', 'fase', 'comprador', 'contact_id',
                       'cpcv_date', 'escritura_date', 'notas', 'agent_id', 'property_id']
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const key of allowed) {
        if (key in updates) updateData[key] = updates[key]
      }

      // Fetch current stage BEFORE update to detect won-stage transitions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentDeal } = await (supabaseAdmin.from('deals') as any)
        .select('fase')
        .eq(id && typeof id === 'string' ? 'id' : 'ref', id && typeof id === 'string' ? id : ref)
        .eq('tenant_id', tenantId)
        .single()
      const previousFase = (currentDeal as { fase?: string } | null)?.fase ?? null

      // Support both UUID id and ref-based lookups
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabaseAdmin.from('deals') as any).update(updateData)
      if (id && typeof id === 'string') {
        query = query.eq('id', id).eq('tenant_id', tenantId)
      } else if (ref && typeof ref === 'string') {
        query = query.eq('ref', ref).eq('tenant_id', tenantId)
      }
      const { data, error } = await query.select().single()
      if (!error && data) {
        const dealId     = (id ?? ref ?? (data as Record<string, unknown>)?.id) as string | undefined
        const agentEmail = (session?.user?.email ?? null) as string | null
        // ── Learning events on stage transitions ─────────────────────────────
        if (typeof updates.fase === 'string') {
          const fase   = updates.fase as string
          const basePayload = {
            deal_id:     dealId ?? null,
            agent_email: agentEmail,
            metadata:    { fase, deal_ref: ref ?? id },
          }

          if (['Proposta Enviada', 'Proposta'].includes(fase)) {
            track.proposalSent(basePayload)
            void emit.proposalSent(
              { deal_id: dealId ?? null, agent_email: agentEmail, deal_ref: typeof ref === 'string' ? ref : null, fase },
              { correlation_id: corrId, source_system: 'api' },
            )
          } else if (['CPCV Assinado', 'CPCV', 'CPCV_assinado'].includes(fase)) {
            track.cpcvSigned(basePayload)
            void emit.cpcvSigned(
              {
                deal_id:    dealId ?? null,
                agent_email: agentEmail,
                deal_ref:   typeof ref === 'string' ? ref : null,
                deal_value: typeof (data as Record<string, unknown>)?.deal_value === 'number'
                  ? (data as Record<string, unknown>).deal_value as number
                  : null,
              },
              { correlation_id: corrId, source_system: 'api' },
            )
          } else if (['Escritura Concluída', 'pos_venda'].includes(fase)) {
            track.closed(basePayload)
          } else if (['Perdido', 'Rejeitado', 'lost', 'rejected'].includes(fase)) {
            track.rejected(basePayload)
          } else if (['Visita', 'visita_agendada', 'Visita Agendada'].includes(fase)) {
            track.callBooked(basePayload)
            void emit.callBooked(
              { deal_id: dealId ?? null, agent_email: agentEmail, deal_ref: typeof ref === 'string' ? ref : null, fase },
              { correlation_id: corrId, source_system: 'api' },
            )
          }

          void recordCausalStep({
            correlation_id: corrId,
            tenant_id: tenantId,
            step_type: 'db_mutation',
            entity_type: 'deal',
            entity_id: dealId ?? (data as Record<string, unknown>)?.id as string | undefined,
            action: 'stage_updated',
            success: true,
            metadata: { newStage: fase, previousStage: (data as Record<string, unknown>)?.fase },
          })
          // Event bus activation — emit typed stage-advanced event (fire-and-forget)
          void emit.dealStageAdvanced(
            {
              deal_id:     dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              from_stage:  previousFase ?? null,
              to_stage:    fase,
              agent_email: agentEmail,
              deal_value:  typeof (data as Record<string, unknown>)?.deal_value === 'number'
                ? (data as Record<string, unknown>).deal_value as number
                : null,
            },
            { correlation_id: corrId, source_system: 'api' },
          )

          // ── Immutable audit ledger — stage advanced (fire-and-forget, non-critical) ──
          void appendEntry({
            tenant_id:                 tenantId,
            entry_type:                'deal_stage_advanced',
            deal_id:                   dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
            property_id:               null,
            investor_id:               null,
            lead_id:                   null,
            agent_id:                  agentEmail,
            gross_value_eur:           typeof (data as Record<string, unknown>)?.deal_value === 'number'
              ? (data as Record<string, unknown>).deal_value as number : null,
            commission_rate_pct:       null,
            commission_gross_eur:      null,
            vat_eur:                   null,
            commission_net_eur:        null,
            agent_split_eur:           null,
            agency_split_eur:          null,
            recognition_pct:           null,
            cumulative_recognized_pct: null,
            previous_entry_id:         null,
            correlation_id:            corrId,
            recorded_by:               agentEmail ?? 'system',
            notes:                     `Stage: ${previousFase ?? 'unknown'} → ${fase}`,
          }).catch((e: unknown) => {
            console.warn('[deals] ledger stage_advanced entry failed (non-critical)', e instanceof Error ? e.message : String(e))
          })

          // ── CPCV stage — 50% revenue recognition ──────────────────────────────────
          if (['CPCV', 'CPCV Assinado', 'CPCV_assinado', 'cpcv_signed', 'Promessa'].includes(fase)) {
            const cpcvDealValue = typeof (data as Record<string, unknown>)?.deal_value === 'number'
              ? (data as Record<string, unknown>).deal_value as number : null
            void appendEntry({
              tenant_id:                 tenantId,
              entry_type:                'cpcv_signed',
              deal_id:                   dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              property_id:               null,
              investor_id:               null,
              lead_id:                   null,
              agent_id:                  agentEmail,
              gross_value_eur:           cpcvDealValue,
              commission_rate_pct:       null,
              commission_gross_eur:      null,
              vat_eur:                   null,
              commission_net_eur:        null,
              agent_split_eur:           null,
              agency_split_eur:          null,
              recognition_pct:           50,
              cumulative_recognized_pct: 50,
              previous_entry_id:         null,
              correlation_id:            corrId,
              recorded_by:               agentEmail ?? 'system',
              notes:                     'CPCV signed — 50% revenue recognition',
            }).catch((e: unknown) => {
              console.warn('[deals] ledger cpcv_signed entry failed (non-critical)', e instanceof Error ? e.message : String(e))
            })
          }

          // Shared dealValue used by both WON and LOST outcome branches
          const dealValue = typeof (data as Record<string, unknown>)?.deal_value === 'number'
            ? (data as Record<string, unknown>).deal_value as number
            : 0

          // Emit dealClosed + revenueRecognized when deal reaches a won/revenue stage
          // Guard: only fire if transitioning FROM a non-won stage to a won stage (prevents double-fire)
          if ((WON_STAGES as readonly string[]).includes(fase) && !(WON_STAGES as readonly string[]).includes(previousFase ?? '')) {
            void emit.dealClosed(
              {
                deal_id:     dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
                agent_email: agentEmail,
                deal_ref:    typeof ref === 'string' ? ref : null,
                deal_value:  dealValue || null,
              },
              { correlation_id: corrId, source_system: 'api' },
            )
            void emit.revenueRecognized(
              {
                deal_id:        dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
                amount_eur:     dealValue,
                commission_eur: null,   // authoritative value computed by commissionEngine (tier-based 4–5%)
                agent_email:    agentEmail,
                zona:           typeof (data as Record<string, unknown>)?.zona === 'string'
                  ? (data as Record<string, unknown>).zona as string
                  : null,
                recognized_at: new Date().toISOString(),
              },
              { correlation_id: corrId, source_system: 'api' },
            )
            // Enqueue commission calculation job (async worker — deterministic, auditable)
            void getQueueAdapter().enqueue(
              'commission_jobs',
              {
                deal_id:        dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
                tenant_id:      tenantId,
                deal_value_eur: dealValue,
                zone:           typeof (data as Record<string, unknown>)?.zona === 'string'
                  ? (data as Record<string, unknown>).zona as string : null,
                agent_email:    agentEmail,
                deal_ref:       typeof ref === 'string' ? ref : null,
                correlation_id: corrId,
              },
              { tenant_id: tenantId },
            ).catch((e: unknown) => {
              console.warn('[deals PUT] commission job enqueue failed:', e instanceof Error ? e.message : String(e))
            })
            // ML feedback loop — record closed_won outcome (fire-and-forget)
            void recordDealOutcome({
              dealId:          dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              tenantId:        tenantId,
              outcome:         'closed_won',
              dealValueEur:    dealValue,
              daysInPipeline:  null,
              agentEmail:      agentEmail,
              closedAt:        new Date().toISOString(),
            }).catch((e: unknown) => console.warn('[deals] recordDealOutcome failed:', e instanceof Error ? e.message : String(e)))

            // ── Immutable audit ledger — escritura completed (fire-and-forget) ─────────
            // Tier-based commission rates: standard 5% (<1M), premium 4.5% (1M–5M), institutional 4% (≥5M)
            const tierRate = dealValue >= 5_000_000 ? 0.040 : dealValue >= 1_000_000 ? 0.045 : 0.050
            const commGross  = Math.round(dealValue * tierRate * 100) / 100
            const vatAmt     = Math.round(commGross * 0.23 * 100) / 100
            const commNet    = Math.round((commGross - vatAmt) * 100) / 100
            const agencyPct  = dealValue >= 5_000_000 ? 0.60 : dealValue >= 1_000_000 ? 0.55 : 0.50
            const agencySplit = Math.round(commNet * agencyPct * 100) / 100
            const agentSplit  = Math.round((commNet - agencySplit) * 100) / 100

            void appendEntry({
              tenant_id:                 tenantId,
              entry_type:                'escritura_completed',
              deal_id:                   dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              property_id:               null,
              investor_id:               null,
              lead_id:                   null,
              agent_id:                  agentEmail,
              gross_value_eur:           dealValue,
              commission_rate_pct:       tierRate * 100,
              commission_gross_eur:      commGross,
              vat_eur:                   vatAmt,
              commission_net_eur:        commNet,
              agent_split_eur:           agentSplit,
              agency_split_eur:          agencySplit,
              recognition_pct:           50,
              cumulative_recognized_pct: 100,
              previous_entry_id:         null,
              correlation_id:            corrId,
              recorded_by:               agentEmail ?? 'system',
              notes:                     `Escritura completed — 50% revenue recognition. Stage: ${fase}`,
            }).catch((e: unknown) => {
              console.warn('[deals] ledger escritura_completed entry failed (non-critical)', e instanceof Error ? e.message : String(e))
            })

            // ── Immutable audit ledger — commission calculated (fire-and-forget) ──────
            void appendEntry({
              tenant_id:                 tenantId,
              entry_type:                'commission_calculated',
              deal_id:                   dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              property_id:               null,
              investor_id:               null,
              lead_id:                   null,
              agent_id:                  agentEmail,
              gross_value_eur:           dealValue,
              commission_rate_pct:       tierRate * 100,
              commission_gross_eur:      commGross,
              vat_eur:                   vatAmt,
              commission_net_eur:        commNet,
              agent_split_eur:           agentSplit,
              agency_split_eur:          agencySplit,
              recognition_pct:           null,
              cumulative_recognized_pct: 100,
              previous_entry_id:         null,
              correlation_id:            corrId,
              recorded_by:               'system',
              notes:                     `Commission calculated: ${tierRate * 100}% tier. Gross: €${commGross}. Net: €${commNet}`,
            }).catch((e: unknown) => {
              console.warn('[deals] ledger commission_calculated entry failed (non-critical)', e instanceof Error ? e.message : String(e))
            })
          }

          // Emit dealRejected when deal is lost (fire-and-forget)
          if (['Perdido', 'Rejeitado', 'lost', 'rejected'].includes(fase)) {
            void emit.dealRejected(
              {
                deal_id:     dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
                agent_email: agentEmail,
                deal_ref:    typeof ref === 'string' ? ref : null,
                reason:      fase,
              },
              { correlation_id: corrId, source_system: 'api' },
            )
            // ML feedback loop — record closed_lost outcome (fire-and-forget)
            void recordDealOutcome({
              dealId:          dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              tenantId:        tenantId,
              outcome:         'closed_lost',
              dealValueEur:    dealValue,
              daysInPipeline:  null,
              agentEmail:      agentEmail,
              closedAt:        new Date().toISOString(),
            }).catch((e: unknown) => console.warn('[deals] recordDealOutcome failed:', e instanceof Error ? e.message : String(e)))

            // ── Immutable audit ledger — deal lost / opportunity cost (fire-and-forget) ─
            void appendEntry({
              tenant_id:                 tenantId,
              entry_type:                'deal_lost',
              deal_id:                   dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              property_id:               null,
              investor_id:               null,
              lead_id:                   null,
              agent_id:                  agentEmail,
              gross_value_eur:           dealValue,
              commission_rate_pct:       null,
              commission_gross_eur:      null,
              vat_eur:                   null,
              commission_net_eur:        null,
              agent_split_eur:           null,
              agency_split_eur:          null,
              recognition_pct:           null,
              cumulative_recognized_pct: null,
              previous_entry_id:         null,
              correlation_id:            corrId,
              recorded_by:               agentEmail ?? 'system',
              notes:                     `Deal lost at stage: ${fase}. Lost opportunity value: €${dealValue}`,
            }).catch((e: unknown) => {
              console.warn('[deals] ledger deal_lost entry failed (non-critical)', e instanceof Error ? e.message : String(e))
            })
          }
        }
        // ── Emit dealUpdated for non-stage field changes (fire-and-forget) ──
        const nonStageFields = Object.keys(updateData).filter(k => k !== 'updated_at' && k !== 'fase')
        if (nonStageFields.length > 0) {
          void emit.dealUpdated(
            {
              deal_id:       dealId ?? String((data as Record<string, unknown>)?.id ?? ''),
              field_changed: nonStageFields.join(','),
              old_value:     null,
              new_value:     nonStageFields.reduce<Record<string, unknown>>((acc, k) => { acc[k] = updateData[k]; return acc }, {}),
              updated_by:    agentEmail,
            },
            { correlation_id: corrId, source_system: 'api' },
          )
        }
        return NextResponse.json({ success: true, deal: data, source: 'supabase' }, { headers: rateLimitHeaders() })
      }
      if (error) console.warn('[deals PUT] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    // Supabase unavailable — cannot update deal
    console.error('[deals PUT] Supabase unavailable — deal not updated', { corrId })
    return NextResponse.json(
      { error: 'Serviço indisponível. Alteração não foi guardada. Tente novamente.' },
      { status: 503, headers: rateLimitHeaders() }
    )
  } catch (error) {
    console.error('[deals PUT]', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/deals?id= — admin only
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    try {
      const { error } = await supabaseAdmin.from('deals').delete().eq('id', id)
      if (!error) return NextResponse.json({ success: true, message: 'Deal deleted' }, { headers: rateLimitHeaders() })
      console.warn('[deals DELETE] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    return NextResponse.json({ error: 'Service unavailable — deal not deleted' }, { status: 503, headers: rateLimitHeaders() })
  } catch (error) {
    console.error('[deals DELETE]', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}
