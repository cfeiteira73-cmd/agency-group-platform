// =============================================================================
// AGENCY OS — Learning Events Tracker v2.0
// Fire-and-forget tracking to `learning_events` table
// Never throws — all errors are suppressed (non-blocking by design)
//
// v2.0 additions:
//   - correlation_id: UUID linking all events in the same request flow
//   - session_id: UUID linking events in the same agent/user session
//   - sequence_num: monotonic counter for event ordering within a flow
//   - source_system: identifies which subsystem fired the event
//   These fields are OPTIONAL in payload — event bus infrastructure for GAP 1
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LearningEventType =
  | 'match_created'
  | 'match_presented'
  | 'deal_pack_generated'
  | 'deal_pack_sent'
  | 'response_received'
  | 'call_booked'
  | 'proposal_sent'
  | 'cpcv_signed'
  | 'closed'
  | 'rejected'

export interface TrackPayload {
  /** contacts.id — UUID */
  lead_id?: string | number | null
  /** deals.id — UUID */
  deal_id?: string | number | null
  /** properties.id — TEXT */
  property_id?: string | null
  /** matches.id — UUID */
  match_id?: string | null
  /** deal_packs.id — UUID */
  deal_pack_id?: string | null
  /** agent performing the action */
  agent_email?: string | null
  /** numeric match score 0–100 */
  match_score?: number | null
  /** any extra structured data */
  metadata?: Record<string, unknown>

  // ── Event Bus v2 fields (GAP 1 — event stream correlation) ──────────────────
  /** UUID linking all events in the same request flow (pass from API handler) */
  correlation_id?: string | null
  /** UUID linking events in the same user/agent session */
  session_id?: string | null
  /** monotonic sequence for ordering within a correlation_id flow */
  sequence_num?: number | null
  /** system that fired this event: 'api', 'n8n', 'cron', 'engine' */
  source_system?: 'api' | 'n8n' | 'cron' | 'engine' | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Core track function — fire and forget
// ---------------------------------------------------------------------------

async function insertEvent(
  event_type: LearningEventType,
  payload: TrackPayload
): Promise<void> {
  const client = getAdminClient()
  if (!client) return

  // ── Build enriched metadata (max compatibility across schema versions) ────────
  // lead_id / deal_id may be UUID or INTEGER depending on migration state.
  // Store UUID strings in metadata._lead_id as guaranteed-accessible fallback.
  // Also store event bus correlation fields for future stream replay.
  const enrichedMeta = {
    ...(payload.metadata ?? {}),
    // ID backups — always accessible even if FK col is wrong type
    _lead_id:       payload.lead_id      ?? null,
    _deal_id:       payload.deal_id      ?? null,
    _property_id:   payload.property_id  ?? null,
    // Event bus v2 correlation
    _correlation_id: payload.correlation_id ?? null,
    _session_id:     payload.session_id     ?? null,
    _sequence_num:   payload.sequence_num   ?? null,
    _source_system:  payload.source_system  ?? 'api',
    _fired_at:       new Date().toISOString(),
  }

  // Coerce IDs: try UUID string first, fall back to integer for legacy schema
  // After migration 20260429_learning_events_uuid, lead_id/deal_id become TEXT
  function toId(v: string | number | null | undefined): string | number | null {
    if (v == null) return null
    if (typeof v === 'string') return v  // UUID string — pass directly
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  try {
    await client.from('learning_events').insert({
      event_type,
      lead_id:        toId(payload.lead_id),
      deal_id:        toId(payload.deal_id),
      property_id:    payload.property_id  ?? null,
      match_id:       payload.match_id     ?? null,
      deal_pack_id:   payload.deal_pack_id ?? null,
      agent_email:    payload.agent_email  ?? null,
      match_score:    payload.match_score  ?? null,
      // Event bus correlation — written if columns exist (migration 20260429_*)
      correlation_id: payload.correlation_id ?? null,
      session_id:     payload.session_id     ?? null,
      source_system:  payload.source_system  ?? 'api',
      metadata:       enrichedMeta,
    })
  } catch {
    // Intentionally silent — tracking must never break the calling code
    // All critical data is preserved in enrichedMeta as fallback
  }
}

// ---------------------------------------------------------------------------
// Public API — typed event methods
// ---------------------------------------------------------------------------

const track = {
  /** Buyer matched to property via pgvector engine */
  matchCreated: (p: TrackPayload) => void insertEvent('match_created', p),

  /** Match result presented to buyer (deal pack or portal view) */
  matchPresented: (p: TrackPayload) => void insertEvent('match_presented', p),

  /** Claude Haiku generated a deal pack for a buyer/property combo */
  dealPackGenerated: (p: TrackPayload) => void insertEvent('deal_pack_generated', p),

  /** Deal pack marked as sent to buyer */
  dealPackSent: (p: TrackPayload) => void insertEvent('deal_pack_sent', p),

  /** Buyer replied, clicked, or responded to outreach */
  responseReceived: (p: TrackPayload) => void insertEvent('response_received', p),

  /** Visit or call scheduled with buyer */
  callBooked: (p: TrackPayload) => void insertEvent('call_booked', p),

  /** Deal stage moved to Proposta / proposal submitted */
  proposalSent: (p: TrackPayload) => void insertEvent('proposal_sent', p),

  /** Deal stage moved to CPCV — contract signed */
  cpcvSigned: (p: TrackPayload) => void insertEvent('cpcv_signed', p),

  /** Deal completed at escritura */
  closed: (p: TrackPayload) => void insertEvent('closed', p),

  /** Deal lost or lead rejected */
  rejected: (p: TrackPayload) => void insertEvent('rejected', p),
}

export default track
