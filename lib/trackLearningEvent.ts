// =============================================================================
// AGENCY OS — Learning Events Tracker v1.0
// Fire-and-forget tracking to `learning_events` table
// Never throws — all errors are suppressed (non-blocking by design)
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
  /** contacts.id — BIGINT or UUID depending on table */
  lead_id?: string | number | null
  /** deals.id — BIGINT or UUID depending on table */
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

  // Store IDs in metadata too for maximum compatibility across FK types
  const enrichedMeta = {
    ...(payload.metadata ?? {}),
    _lead_id:      payload.lead_id   ?? null,
    _deal_id:      payload.deal_id   ?? null,
    _property_id:  payload.property_id ?? null,
  }

  try {
    await client.from('learning_events').insert({
      event_type,
      // FK columns — cast to string to avoid type errors; DB will coerce or ignore
      lead_id:      payload.lead_id   != null ? String(payload.lead_id)  : null,
      deal_id:      payload.deal_id   != null ? String(payload.deal_id)  : null,
      property_id:  payload.property_id ?? null,
      match_id:     payload.match_id     ?? null,
      deal_pack_id: payload.deal_pack_id ?? null,
      agent_email:  payload.agent_email  ?? null,
      match_score:  payload.match_score  ?? null,
      metadata:     enrichedMeta,
    })
  } catch {
    // Intentionally silent — tracking must never break the calling code
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
