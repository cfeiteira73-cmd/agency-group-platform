// =============================================================================
// COMMERCIAL LEAD INGESTION SERVICE — Agency Group
// Single source of truth for inbound lead persistence.
// Called by: /api/contacto (direct import), /api/leads (via same logic)
// Does NOT send alerts — callers decide secondary actions.
// Does NOT throw — always returns { success, error? }.
//
// Architecture: calls Postgres RPC ingest_commercial_lead_v1 (migration 056)
// which atomically upserts contact + inserts activity in one transaction.
// submissionId provides idempotency: same browser submission retried → one activity.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

export type IngestSource =
  | 'contacto'
  | 'property_enquiry'
  | 'sofia_widget'
  | 'sofia_handoff'
  | 'scheduling'
  | 'website'

export interface IngestLeadInput {
  // Identity — at least email OR phone required (enforced here)
  email?:        string
  phone?:        string
  name?:         string
  // Source
  source:        IngestSource
  // Context
  message?:      string
  zona?:         string
  budget_min?:   number
  budget_max?:   number
  timeline?:     string
  intent?:       'buyer' | 'seller' | 'investor'
  use_type?:     string
  nationality?:  string
  // Property context (static data — no FK; stored in activity.subject + metadata)
  property_ref?:  string
  property_name?: string
  // Attribution
  page_url?:     string
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_term?:     string
  utm_content?:  string
  utm_landing?:  string
  // Idempotency: UUID generated per browser submission; prevents duplicate activities on retry
  submissionId?: string
  // Observability
  corrId?:       string
}

export interface IngestLeadResult {
  success:     boolean
  contactId?:  string
  isNew:       boolean
  activityId?: string
  error?:      string
}

function normalizeEmail(raw: string): string { return raw.trim().toLowerCase() }
function normalizePhone(raw: string): string  { return raw.trim() }

export async function ingestCommercialLead(input: IngestLeadInput): Promise<IngestLeadResult> {
  const corrId = input.corrId ?? crypto.randomUUID()

  // ── Identity normalization ────────────────────────────────────────────────
  const email = input.email ? normalizeEmail(input.email) : undefined
  const phone = input.phone ? normalizePhone(input.phone) : undefined

  if (!email && !phone) {
    return { success: false, isNew: false, error: 'email or phone required' }
  }

  // ── Notes: structured context (written into contacts.notes) ───────────────
  const noteParts: string[] = []
  if (input.message)       noteParts.push(`Mensagem: ${input.message}`)
  if (input.property_ref)  noteParts.push(`Imóvel: ${input.property_ref}`)
  if (input.property_name) noteParts.push(`Nome: ${input.property_name}`)
  if (input.zona)          noteParts.push(`Zona: ${input.zona}`)
  if (input.use_type)      noteParts.push(`Tipo: ${input.use_type}`)
  if (input.nationality)   noteParts.push(`Nacionalidade: ${input.nationality}`)
  if (input.budget_min)    noteParts.push(`Budget min: €${input.budget_min}`)
  if (input.budget_max)    noteParts.push(`Budget max: €${input.budget_max}`)
  if (input.intent)        noteParts.push(`Intent: ${input.intent}`)

  // ── Intent + follow-up timing ─────────────────────────────────────────────
  const intentLabel = input.intent ?? (
    input.use_type === 'vendedor'   ? 'seller'   :
    input.use_type === 'investidor' ? 'investor' : 'buyer'
  )
  const now = new Date()
  const nextFollowup = new Date(now)
  if (intentLabel === 'seller') { nextFollowup.setHours(now.getHours() + 2) }
  else                          { nextFollowup.setDate(now.getDate() + 1) }

  // ── Activity type + subject (Amendment 5) ────────────────────────────────
  const activityType = (
    input.source === 'property_enquiry'  ? 'property_enquiry' :
    input.source === 'contacto'          ? 'contact_form'     :
    input.source === 'sofia_widget' || input.source === 'sofia_handoff' ? 'sofia_handoff' :
    'system_event'
  )
  const activitySubject = input.property_ref
    ? `${input.source}: ${input.property_ref}${input.property_name ? ` — ${input.property_name}` : ''}`
    : input.source

  const activityMetadata: Record<string, unknown> = {}
  if (input.property_ref)  activityMetadata.property_ref  = input.property_ref
  if (input.property_name) activityMetadata.property_name = input.property_name
  if (input.zona)          activityMetadata.zona          = input.zona
  if (input.budget_max)    activityMetadata.budget_max    = input.budget_max
  if (input.intent)        activityMetadata.intent        = input.intent

  // ── Atomic RPC call (migration 056): contact upsert + activity in one tx ──
  try {
    const { data, error } = await supabaseAdmin.rpc('ingest_commercial_lead_v1', {
      p_email:               email               ?? null,
      p_phone:               phone               ?? null,
      p_name:                input.name          ?? null,
      p_source:              input.source,
      p_notes:               noteParts.length ? noteParts.join(' | ') : null,
      p_preferred_locations: input.zona ? [input.zona] : null,
      p_timeline:            input.timeline      ?? null,
      p_page_url:            input.page_url      ?? null,
      p_intent:              intentLabel,
      p_next_followup_at:    nextFollowup.toISOString(),
      p_activity_type:       activityType,
      p_activity_subject:    activitySubject,
      p_activity_body:       input.message       ?? null,
      p_activity_metadata:   Object.keys(activityMetadata).length
                               ? activityMetadata
                               : null,
      p_activity_source_url: input.page_url      ?? null,
      p_submission_id:       input.submissionId  ?? null,
    })

    if (error) {
      console.error('[ingestLead] RPC error:', error.message, { corrId, source: input.source })
      return { success: false, isNew: false, error: error.message }
    }

    // RPC returns JSONB: { success, contact_id, is_new, activity_id } or { success:false, error }
    const result = data as {
      success: boolean
      contact_id?: string
      is_new?: boolean
      activity_id?: string
      error?: string
    }

    if (!result.success) {
      console.error('[ingestLead] RPC returned failure:', result.error, { corrId, source: input.source })
      return { success: false, isNew: false, error: result.error ?? 'rpc failure' }
    }

    // ── Post-commit: update UTM columns if present (non-atomic, optional) ──
    // UTM columns added by migration 039 — may not be in live DB yet.
    // These are attribution metadata — loss is lower severity than commercial event loss.
    if (result.contact_id && (input.utm_source || input.utm_medium || input.utm_campaign)) {
      const utmPatch: Record<string, string> = {}
      if (input.utm_source)   utmPatch.utm_source   = input.utm_source
      if (input.utm_medium)   utmPatch.utm_medium   = input.utm_medium
      if (input.utm_campaign) utmPatch.utm_campaign = input.utm_campaign
      if (input.utm_term)     utmPatch.utm_term     = input.utm_term!
      if (input.utm_content)  utmPatch.utm_content  = input.utm_content!
      if (input.utm_landing)  utmPatch.utm_landing  = input.utm_landing!

      supabaseAdmin
        .from('contacts')
        .update(utmPatch)
        .eq('id', result.contact_id)
        .then(({ error: utmErr }) => {
          if (utmErr) console.warn('[ingestLead] UTM update failed (non-fatal):', utmErr.message, { corrId })
        })
    }

    return {
      success:    true,
      contactId:  result.contact_id,
      isNew:      result.is_new ?? false,
      activityId: result.activity_id,
    }
  } catch (exc) {
    console.error('[ingestLead] unexpected exception:', exc, { corrId, source: input.source })
    return { success: false, isNew: false, error: 'unexpected error' }
  }
}
