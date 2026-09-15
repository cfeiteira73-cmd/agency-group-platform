// =============================================================================
// Agency Group — Buyer-Property Matching API V1
// POST /api/automation/match-buyer
//
// Phase 2C.C1 changes:
//   FIX-1: Removed broken match_properties RPC and search_properties_semantic.
//          Direct query WHERE status='active' is the canonical V1 retrieval path.
//          Off-market properties ARE eligible (D1: internal match ≠ public search).
//   FIX-2: Removed tenant_id from persistence (not in production schema).
//   FIX-3: Explicit error handling on DB operations — no silent swallow.
//   FIX-4: matched_by defaults to 'system:v1:match-buyer' (not null).
//   FIX-5: is_off_market included in property select; visible in match output
//          so agents can make informed disclosure decisions.
//          MATCH FOUND ≠ PROPERTY DISCLOSED.
//   FIX-6: Deal-pack trigger gated behind trigger_deal_pack param (default false).
//   FIX-7: supabaseAdmin (service role) used for ALL match read/write.
//   V1:    Persistence via upsert_match_v1() RPC (race-safe, non-destructive).
//          Scoring via v1-scoring-engine (normalized, UNKNOWN ≠ BAD FIT).
// =============================================================================

import { NextRequest, NextResponse }   from 'next/server'
import { createClient }                from '@supabase/supabase-js'
import { safeCompare }                 from '@/lib/safeCompare'
import track                           from '@/lib/trackLearningEvent'
import { getRequestCorrelationId }     from '@/lib/observability/correlation'
import {
  matchV1,
  rankV1Results,
  scoreV1,
  computeV1Decision,
  THRESHOLD_DEAL_PACK,
  type V1ContactProfile,
  type V1PropertyCandidate,
  type V1MatchResult,
  type UpsertResult,
} from '@/lib/matching/v1-scoring-engine'

export const runtime    = 'nodejs'
export const maxDuration = 30

// ---------------------------------------------------------------------------
// Supabase — service role for all operations (matches RLS=true, 0 policies)
// ---------------------------------------------------------------------------

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface MatchBuyerRequest {
  lead_id?:           number             // contacts.id (bigint) — links match to contact
  budget_min?:        number            // EUR, optional when lead_id provided
  budget_max?:        number            // EUR, optional when lead_id provided
  locations?:         string[]          // fallback when no contact in DB
  typology?:          string            // fallback when no contact in DB
  bedrooms_min?:      number            // contacts has no quartos field — from request
  use_type?:          string
  trigger_deal_pack?: boolean           // FIX-6: must be explicitly true to fire
}

// ---------------------------------------------------------------------------
// OpenAI embedding — best-effort; null when unavailable (0/55 properties
// have embeddings in Phase 2C.C1, so semantic_bonus = 0 for all matches)
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data?.data?.[0]?.embedding ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Fetch contact profile from DB (when lead_id provided)
// Returns null if contact not found — callers fall back to request body fields
// ---------------------------------------------------------------------------

interface ContactRow {
  id:          number
  zonas:       string[] | null
  tipos:       string[] | null
  budget_min:  number | null
  budget_max:  number | null
  buyer_score: number | null
}

async function fetchContact(leadId: number): Promise<ContactRow | null> {
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('id, zonas, tipos, budget_min, budget_max, buyer_score')
    .eq('id', leadId)
    .single()

  if (error || !data) return null
  return data as ContactRow
}

// ---------------------------------------------------------------------------
// Build V1ContactProfile from contact row + request fields
// ---------------------------------------------------------------------------

function buildContactProfile(
  contact: ContactRow | null,
  req:     MatchBuyerRequest
): V1ContactProfile {
  if (contact) {
    return {
      zonas:       contact.zonas  ?? (req.locations ?? []),
      tipos:       contact.tipos  ?? (req.typology ? [req.typology] : []),
      budget_min:  contact.budget_min,   // may be null — correct (UNKNOWN ≠ BAD FIT)
      budget_max:  contact.budget_max,   // may be null — correct
      quartos_min: typeof req.bedrooms_min === 'number' ? req.bedrooms_min : null,
      buyer_score: contact.buyer_score ?? null,
    }
  }
  return {
    zonas:       req.locations  ?? [],
    tipos:       req.typology   ? [req.typology] : [],
    budget_min:  req.budget_min  ?? null,
    budget_max:  req.budget_max  ?? null,
    quartos_min: typeof req.bedrooms_min === 'number' ? req.bedrooms_min : null,
    buyer_score: null,
  }
}

// ---------------------------------------------------------------------------
// V1 property retrieval — canonical internal path
//
// Query: WHERE status = 'active'   ← off-market properties ARE included (D1)
//        No is_off_market filter   ← internal matching ≠ public visibility
//        is_off_market in SELECT   ← so agents see the flag and decide disclosure
//
// INVARIANT: PUBLIC VISIBILITY ≠ INTERNAL MATCH ELIGIBILITY
// INVARIANT: MATCH FOUND ≠ PROPERTY DISCLOSED
// ---------------------------------------------------------------------------

async function fetchActiveProperties(): Promise<V1PropertyCandidate[]> {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('id, nome, zona, tipo, preco, quartos, area, is_off_market')
    .eq('status', 'active')
    .limit(200)

  if (error) throw new Error(`Property fetch failed: ${error.message}`)
  if (!data || data.length === 0) return []

  return (data as Array<{
    id:           string
    nome:         string | null
    zona:         string | null
    tipo:         string | null
    preco:        number | null
    quartos:      number | null
    area:         number | null
    is_off_market: boolean | null
  }>).map(p => ({
    id:           p.id,
    nome:         p.nome,
    zona:         p.zona,
    tipo:         p.tipo,
    preco:        p.preco,
    quartos:      p.quartos,
    area:         p.area,
    is_off_market: p.is_off_market ?? false,
    similarity:   null,  // no embeddings in Phase 2C.C1 — semantic_bonus = 0
  }))
}

// ---------------------------------------------------------------------------
// V1 persistence via upsert_match_v1 RPC
//
// Returns a structured UpsertResult per candidate:
//   'created'              → new match row written
//   'rescored'             → existing V1 row updated
//   'legacy_duplicate_set' → legacy duplicates detected, nothing written
//   'below_threshold'      → score < THRESHOLD_WRITE (40)
//   'failed'               → DB error
//
// FIX-3: All errors are explicit — no silent swallow
// FIX-4: matched_by = agentEmail ?? 'system:v1:match-buyer'
// FIX-7: supabaseAdmin used (service role bypasses RLS)
// ---------------------------------------------------------------------------

async function persistV1Match(
  leadId:    number,
  result:    V1MatchResult,
  agentEmail: string,
  corrId:    string
): Promise<UpsertResult> {
  const p = result.property

  const { data, error } = await supabaseAdmin.rpc('upsert_match_v1', {
    p_lead_id:              leadId,
    p_property_id:          p.id,
    p_mandate_id:           null,   // V1 = contact-level, no mandate
    p_property_title:       p.nome ?? null,
    p_match_score:          result.score,
    p_breakdown:            result.score_detail,
    p_match_reasons:        result.match_reasons,
    p_explanation:          result.explanation,
    p_similarity:           p.similarity ?? null,
    p_estimated_yield:      result.estimated_yield ?? null,
    p_matched_by:           agentEmail,
    p_next_best_action:     result.decision.next_best_action,
    p_match_weaknesses:     result.decision.match_weaknesses,
    p_priority_level:       result.decision.priority_level,
    p_next_action_deadline: result.decision.next_action_deadline,
  })

  if (error) {
    console.error('[match-buyer] upsert_match_v1 error:', {
      corrId, leadId, property_id: p.id, error: error.message,
    })
    return { result: 'failed', error: error.message }
  }

  const upsertResult = data as UpsertResult

  // Log legacy duplicate sets for telemetry (future cleanup phase)
  if (upsertResult.result === 'legacy_duplicate_set') {
    console.warn('[match-buyer] legacy_duplicate_set detected:', {
      corrId,
      lead_id:         (upsertResult as { lead_id: number }).lead_id,
      property_id:     (upsertResult as { property_id: string }).property_id,
      mandate_id:      null,
      duplicate_count: (upsertResult as { duplicate_count: number }).duplicate_count,
      algorithm_version: 'v1',
    })
  }

  return upsertResult
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const corrId     = getRequestCorrelationId(request)
  const startedAt  = new Date().toISOString()
  const agentEmail = request.headers.get('x-agent-email') ?? 'system:v1:match-buyer'  // FIX-4

  // Auth
  const authHeader = request.headers.get('authorization')
  const secret     = process.env.PORTAL_API_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }
    const data = body as Record<string, unknown>

    // Parse request
    const req: MatchBuyerRequest = {
      lead_id:           (() => {
                           if (data.lead_id == null) return undefined
                           const n = typeof data.lead_id === 'string'
                             ? parseInt(data.lead_id, 10)
                             : Number(data.lead_id)
                           return isNaN(n) ? undefined : n
                         })(),
      budget_min:        typeof data.budget_min  === 'number' ? data.budget_min  : undefined,
      budget_max:        typeof data.budget_max  === 'number' ? data.budget_max  : undefined,
      locations:         Array.isArray(data.locations)
                           ? (data.locations as unknown[]).filter(l => typeof l === 'string') as string[]
                           : undefined,
      typology:          typeof data.typology     === 'string' ? data.typology     : undefined,
      bedrooms_min:      typeof data.bedrooms_min === 'number' ? data.bedrooms_min : undefined,
      use_type:          typeof data.use_type     === 'string' ? data.use_type     : undefined,
      trigger_deal_pack: data.trigger_deal_pack === true,  // FIX-6: must be explicitly true
    }

    const leadId: number | null = req.lead_id != null ? req.lead_id : null
    const hasBudget = req.budget_min != null && req.budget_max != null
    const hasLocations = (req.locations?.length ?? 0) > 0

    // Require at least (lead_id) or (budget + locations) to proceed
    if (leadId == null && (!hasBudget || !hasLocations)) {
      return NextResponse.json(
        { error: 'Provide lead_id, or both budget_min+budget_max and locations[]' },
        { status: 400 }
      )
    }

    // ── Step 1: Fetch contact profile from DB when lead_id provided ───────────
    let contact: ContactRow | null = null
    if (leadId != null) {
      contact = await fetchContact(leadId)
      if (!contact) {
        return NextResponse.json(
          { error: `Contact not found: lead_id=${leadId}` },
          { status: 404 }
        )
      }
    }

    const profile = buildContactProfile(contact, req)

    // ── Step 2: Fetch active properties (canonical V1 retrieval) ─────────────
    // Includes off-market properties — internal match eligibility ≠ public search
    let properties: V1PropertyCandidate[]
    try {
      properties = await fetchActiveProperties()
    } catch (err) {
      console.error('[match-buyer] fetchActiveProperties failed:', { corrId, err })
      return NextResponse.json(
        { error: 'Failed to fetch properties', correlation_id: corrId },
        { status: 500 }
      )
    }

    if (properties.length === 0) {
      return NextResponse.json({
        matches: [],
        total_properties_evaluated: 0,
        source: 'direct_query',
        correlation_id: corrId,
        generated_at: new Date().toISOString(),
      }, { headers: { 'x-correlation-id': corrId } })
    }

    // ── Step 3: Best-effort embedding (semantic bonus when available) ─────────
    // Phase 2C.C1: 0/55 properties have embeddings → similarity = null → bonus = 0
    // Keeping this hook so Phase 2C.C0 embedding backfill activates it automatically.
    const queryText = [
      profile.zonas.join(' '),
      profile.tipos.join(' '),
      req.typology ?? '',
    ].filter(Boolean).join('. ')

    if (queryText.trim()) {
      const embedding = await generateEmbedding(queryText)
      if (embedding) {
        // Similarity scoring against property embeddings is a no-op until
        // Phase 2C.C0 backfill runs — similarity remains null for all properties
        void embedding
      }
    }

    // ── Step 4: Score and rank via V1 engine ──────────────────────────────────
    const ranked = matchV1(profile, properties)  // already filtered ≥ 40 and sorted
    const top5   = ranked.slice(0, 5)

    // ── Step 5: Persist via upsert_match_v1 (race-safe, non-destructive) ─────
    const persistResults: Array<UpsertResult & { property_id: string }> = []

    if (leadId != null && top5.length > 0) {
      for (const matchResult of top5) {
        const r = await persistV1Match(leadId, matchResult, agentEmail, corrId)
        persistResults.push({ ...r, property_id: matchResult.property.id })
      }
    }

    // Summarize persistence outcomes
    const persistSummary = {
      created:              persistResults.filter(r => r.result === 'created').length,
      rescored:             persistResults.filter(r => r.result === 'rescored').length,
      legacy_duplicate_set: persistResults.filter(r => r.result === 'legacy_duplicate_set').length,
      failed:               persistResults.filter(r => r.result === 'failed').length,
    }

    // ── Step 6: Deal-pack trigger — FIX-6: explicit gate, default false ───────
    const topMatch = top5[0]
    if (
      req.trigger_deal_pack === true &&   // must be explicitly requested
      topMatch &&
      topMatch.score >= THRESHOLD_DEAL_PACK &&
      topMatch.property.id &&
      leadId != null
    ) {
      const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
      const svcToken = process.env.INTERNAL_API_TOKEN
      if (svcToken) {
        void fetch(`${baseUrl}/api/deal-packs/generate`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${svcToken}`,
          },
          body: JSON.stringify({
            property_id: topMatch.property.id,
            lead_id:     leadId,
          }),
        }).catch(e => console.warn('[match-buyer] deal-pack trigger failed:', e))
      }
    }

    // ── Step 7: Learning event ─────────────────────────────────────────────────
    if (leadId != null && top5.length > 0) {
      track.matchCreated({
        lead_id:        String(leadId),
        property_id:    top5[0]?.property?.id ?? null,
        agent_email:    agentEmail !== 'system:v1:match-buyer' ? agentEmail : null,
        match_score:    top5[0]?.score ?? null,
        correlation_id: corrId,
        source_system:  'api',
        metadata: {
          total_evaluated:  properties.length,
          top5_scores:      top5.map(r => r.score),
          source:           'direct_query_v1',
          algorithm:        'v1',
          persist_summary:  persistSummary,
          trigger_deal_pack: req.trigger_deal_pack ?? false,
        },
      })
    }

    // ── Step 8: Audit log — best-effort, non-blocking ─────────────────────────
    try {
      await (supabaseAdmin as unknown as { from: Function }).from('automations_log').insert({
        workflow_name:  'match-buyer-v1',
        trigger_type:   'api',
        status:         'success',
        started_at:     startedAt,
        completed_at:   new Date().toISOString(),
        outcome: {
          total_evaluated:  properties.length,
          matches_returned: top5.length,
          source:           'direct_query_v1',
          lead_id:          leadId,
          top_score:        top5[0]?.score ?? null,
          persist_summary:  persistSummary,
          correlation_id:   corrId,
        },
      })
    } catch { /* non-fatal — audit log failure does not fail the match */ }

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      matches:                    top5,
      total_properties_evaluated: properties.length,
      source:                     'direct_query_v1',
      algorithm:                  'v1',
      ...(leadId != null && { persist_summary: persistSummary }),
      contact_profile_used: {
        zonas:       profile.zonas,
        tipos:       profile.tipos,
        budget_min:  profile.budget_min,
        budget_max:  profile.budget_max,
        quartos_min: profile.quartos_min,
        // buyer_score deliberately omitted from response (internal tiebreaker)
      },
      generated_at:   new Date().toISOString(),
      correlation_id: corrId,
    }, {
      headers: { 'x-correlation-id': corrId },
    })

  } catch (error) {
    console.error('[match-buyer] Unexpected error:', { corrId, error })
    return NextResponse.json(
      { error: 'Internal server error', correlation_id: corrId },
      { status: 500, headers: { 'x-correlation-id': corrId } }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint:    'POST /api/automation/match-buyer',
    version:     'v1',
    description: 'Match buyer profile against active properties (including off-market). Requires lead_id or budget+locations. Returns top-5 ranked matches. Persists via upsert_match_v1 when lead_id provided.',
    request_schema: {
      lead_id:           'number|string — contacts.id (bigint). When provided, contact profile is fetched from DB.',
      budget_min:        'number? — EUR. Required when lead_id not provided.',
      budget_max:        'number? — EUR. Required when lead_id not provided.',
      locations:         'string[]? — fallback zones when no contact in DB.',
      typology:          'string? — property type fallback.',
      bedrooms_min:      'number? — minimum quartos (contacts table has no quartos field).',
      use_type:          'string? — "primary_residence" | "investment" | "holiday" | "golden_visa".',
      trigger_deal_pack: 'boolean? — must be explicitly true to trigger deal-pack (default false).',
    },
    scoring: {
      algorithm:        'V1 normalized (Phase 2C.C1)',
      zona_match:        25,
      tipo_match:        20,
      budget_match:      30,
      quartos_match:     10,
      semantic_bonus:    '0–5 (bonus only, not in denominator)',
      unknown_handling:  'UNKNOWN ≠ BAD FIT — missing fields excluded from denominator',
      write_threshold:   40,
      alert_threshold:   70,
      deal_pack_threshold: 80,
    },
    persistence: 'upsert_match_v1 (race-safe advisory lock, non-destructive)',
    invariants: [
      'OFF-MARKET ≠ RESTRICTED — off-market properties eligible for internal matching',
      'MATCH FOUND ≠ PROPERTY DISCLOSED — disclosure requires explicit agent decision',
      'SERVICE ROLE ≠ HUMAN AUTHORIZATION',
    ],
  })
}
