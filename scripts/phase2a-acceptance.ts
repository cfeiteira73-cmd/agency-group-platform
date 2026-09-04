#!/usr/bin/env -S node --loader ts-node/esm
// =============================================================================
// Phase 2A Controlled Acceptance Script
// Run AFTER applying migrations 055 and 056 to the live database.
// Usage: npx ts-node scripts/phase2a-acceptance.ts
//
// ABSOLUTE PROHIBITION: DO NOT CONTACT ANY LEAD. DO NOT SEND EMAIL.
// This script only inserts and reads test records, then cleans them up.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_TAG        = 'PHASE2A-ACCEPTANCE-TEST'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

let pass = 0
let fail = 0
const cleanup: { table: string; id: string }[] = []

function ok(label: string, value: unknown) {
  if (value) { console.log(`  ✅ ${label}`) ; pass++ }
  else        { console.error(`  ❌ ${label}`) ; fail++ }
}

async function cleanupAll() {
  console.log('\n─── Cleanup ───')
  for (const { table, id } of cleanup.reverse()) {
    const { error } = await db.from(table).delete().eq('id', id)
    if (error) console.warn(`  ⚠ Could not delete ${table}:${id}`, error.message)
    else console.log(`  🗑 Deleted ${table}:${id}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCHEMA BASELINE VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function verifySchema() {
  console.log('\n═══ SCHEMA BASELINE (migration 055) ═══')

  // Check activity_type enum values
  const { data: enumVals } = await db.rpc('ingest_commercial_lead_v1', {
    p_email: null, p_phone: null, p_name: null, p_source: 'contacto',
    p_notes: null, p_preferred_locations: null, p_timeline: null, p_page_url: null,
    p_intent: null, p_next_followup_at: null,
    p_activity_type: 'contact_form', p_activity_subject: 'test', p_activity_body: null,
    p_activity_metadata: null, p_activity_source_url: null, p_submission_id: null,
  })
  // Should return { success: false, error: 'email or phone required' } — proves RPC exists
  ok('RPC ingest_commercial_lead_v1 exists', enumVals !== undefined)
  ok('RPC returns structured error on invalid input', (enumVals as { success?: boolean })?.success === false)

  // Check contacts table has new columns
  const { data: col } = await db.from('contacts').select('assigned_at, first_response_at, page_url').limit(0)
  ok('contacts.assigned_at column exists', col !== null)
  ok('contacts.first_response_at column exists', col !== null)
  ok('contacts.page_url column exists', col !== null)

  // Check activities table has new columns
  const { data: actCol } = await db.from('activities').select('source_url, metadata').limit(0)
  ok('activities.source_url column exists', actCol !== null)
  ok('activities.metadata column exists', actCol !== null)

  console.log('  ℹ  idx_contacts_unassigned: verify manually in Studio:')
  console.log("     SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_contacts_unassigned';")
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONTACTO ACCEPTANCE
// ─────────────────────────────────────────────────────────────────────────────
async function testContacto() {
  console.log('\n═══ GATE A — /contacto Surface ═══')

  const testEmail = `acceptance-contacto-${Date.now()}@test.phase2a.invalid`
  const submissionId = crypto.randomUUID()

  const { data, error } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               testEmail,
    p_phone:               null,
    p_name:                TEST_TAG,
    p_source:              'contacto',
    p_notes:               `Acceptance test — ${new Date().toISOString()}`,
    p_preferred_locations: ['Lisboa'],
    p_timeline:            null,
    p_page_url:            'https://www.agencygroup.pt/contacto',
    p_intent:              'buyer',
    p_next_followup_at:    new Date(Date.now() + 86400000).toISOString(),
    p_activity_type:       'contact_form',
    p_activity_subject:    'contacto: acceptance test',
    p_activity_body:       'Acceptance test submission',
    p_activity_metadata:   { test: true, tag: TEST_TAG },
    p_activity_source_url: 'https://www.agencygroup.pt/contacto',
    p_submission_id:       submissionId,
  })

  ok('RPC call succeeded (no error)', !error)

  const result = data as { success: boolean; contact_id: string; is_new: boolean; activity_id: string }
  ok('Result.success = true', result?.success)
  ok('contact_id returned', !!result?.contact_id)
  ok('is_new = true', result?.is_new === true)
  ok('activity_id returned', !!result?.activity_id)

  if (result?.contact_id) cleanup.push({ table: 'contacts', id: result.contact_id })
  if (result?.activity_id) cleanup.push({ table: 'activities', id: result.activity_id })

  // Verify contact row
  const { data: contact } = await db.from('contacts').select('*').eq('id', result?.contact_id).single()
  ok('Contact row exists in DB', !!contact)
  ok('Contact.email correct', contact?.email === testEmail)
  ok('Contact.source = contacto', contact?.source === 'contacto')
  ok('Contact.assigned_to = NULL (unassigned queue)', contact?.assigned_to === null)
  ok('Contact.assigned_at = NULL', contact?.assigned_at === null)
  ok('Contact.page_url captured', contact?.page_url === 'https://www.agencygroup.pt/contacto')

  // Verify activity row
  const { data: activity } = await db.from('activities').select('*').eq('id', result?.activity_id).single()
  ok('Activity row exists in DB', !!activity)
  ok('Activity.type = contact_form', activity?.type === 'contact_form')
  ok('Activity.source_url captured', !!activity?.source_url)
  ok('Activity.metadata.submission_id = submissionId', activity?.metadata?.submission_id === submissionId)
  ok('Activity.is_automated = true', activity?.is_automated === true)
  ok('Activity.outcome = new_lead', activity?.outcome === 'new_lead')

  // Idempotency: same submission_id → no duplicate activity
  const { data: dup } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               testEmail,
    p_phone:               null,
    p_name:                TEST_TAG,
    p_source:              'contacto',
    p_notes:               'Retry attempt',
    p_preferred_locations: null,
    p_timeline:            null,
    p_page_url:            'https://www.agencygroup.pt/contacto',
    p_intent:              'buyer',
    p_next_followup_at:    null,
    p_activity_type:       'contact_form',
    p_activity_subject:    'contacto: acceptance test',
    p_activity_body:       'retry',
    p_activity_metadata:   { test: true, retry: true },
    p_activity_source_url: null,
    p_submission_id:       submissionId, // same submission_id
  })
  const dupResult = dup as { activity_id: string }
  ok('Idempotency: retry returns same activity_id', dupResult?.activity_id === result?.activity_id)

  // Dedup: same email → UPDATE not INSERT
  const { data: dedup } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               testEmail,
    p_phone:               null,
    p_name:                'Updated Name',
    p_source:              'contacto',
    p_notes:               'Second submission',
    p_preferred_locations: null,
    p_timeline:            null,
    p_page_url:            null,
    p_intent:              'buyer',
    p_next_followup_at:    null,
    p_activity_type:       'contact_form',
    p_activity_subject:    'contacto: second visit',
    p_activity_body:       null,
    p_activity_metadata:   null,
    p_activity_source_url: null,
    p_submission_id:       crypto.randomUUID(), // different submission
  })
  const dedupResult = dedup as { contact_id: string; is_new: boolean; activity_id: string }
  ok('Dedup: same email returns same contact_id', dedupResult?.contact_id === result?.contact_id)
  ok('Dedup: is_new = false on second submission', dedupResult?.is_new === false)
  ok('Dedup: new activity_id (different submission)', dedupResult?.activity_id !== result?.activity_id)
  if (dedupResult?.activity_id) cleanup.push({ table: 'activities', id: dedupResult.activity_id })

  // Verify contact count (should still be 1)
  const { count } = await db.from('contacts').select('*', { count: 'exact', head: true }).eq('email', testEmail)
  ok('ONE contact row only (no duplicate)', count === 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROPERTY ENQUIRY ACCEPTANCE
// ─────────────────────────────────────────────────────────────────────────────
async function testPropertyEnquiry() {
  console.log('\n═══ GATE B — Property Enquiry ═══')

  const testPhone = `+351999${Date.now().toString().slice(-6)}`
  const submissionId1 = crypto.randomUUID()
  const submissionId2 = crypto.randomUUID()

  // First property enquiry
  const { data } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               null,
    p_phone:               testPhone,
    p_name:                TEST_TAG,
    p_source:              'property_enquiry',
    p_notes:               `Imóvel: AG-ACCEPT-001 | Nome: Casa Teste | Zona: Lisboa`,
    p_preferred_locations: ['Lisboa'],
    p_timeline:            null,
    p_page_url:            'https://www.agencygroup.pt/imoveis/ag-accept-001',
    p_intent:              'buyer',
    p_next_followup_at:    new Date(Date.now() + 86400000).toISOString(),
    p_activity_type:       'property_enquiry',
    p_activity_subject:    'property_enquiry: AG-ACCEPT-001 — Casa Teste',
    p_activity_body:       'Quero visitar o imóvel',
    p_activity_metadata:   { property_ref: 'AG-ACCEPT-001', property_name: 'Casa Teste', intent: 'buyer' },
    p_activity_source_url: 'https://www.agencygroup.pt/imoveis/ag-accept-001',
    p_submission_id:       submissionId1,
  })

  const r1 = data as { success: boolean; contact_id: string; is_new: boolean; activity_id: string }
  ok('Property enquiry 1 succeeded', r1?.success)
  ok('Contact created', !!r1?.contact_id)
  ok('Activity created', !!r1?.activity_id)

  if (r1?.contact_id) cleanup.push({ table: 'contacts', id: r1.contact_id })
  if (r1?.activity_id) cleanup.push({ table: 'activities', id: r1.activity_id })

  const { data: act1 } = await db.from('activities').select('*').eq('id', r1?.activity_id).single()
  ok('Activity.type = property_enquiry', act1?.type === 'property_enquiry')
  ok('Activity.metadata.property_ref = AG-ACCEPT-001', act1?.metadata?.property_ref === 'AG-ACCEPT-001')
  ok('Activity.subject contains property_ref', act1?.subject?.includes('AG-ACCEPT-001'))
  ok('No fabricated UUID in property_ref', !act1?.metadata?.property_ref?.match(/^[0-9a-f]{8}-/))

  // Second property enquiry — SAME contact, DIFFERENT property
  const { data: d2 } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               null,
    p_phone:               testPhone,
    p_name:                null,
    p_source:              'property_enquiry',
    p_notes:               'Imóvel: AG-ACCEPT-002',
    p_preferred_locations: null,
    p_timeline:            null,
    p_page_url:            'https://www.agencygroup.pt/imoveis/ag-accept-002',
    p_intent:              'buyer',
    p_next_followup_at:    null,
    p_activity_type:       'property_enquiry',
    p_activity_subject:    'property_enquiry: AG-ACCEPT-002',
    p_activity_body:       null,
    p_activity_metadata:   { property_ref: 'AG-ACCEPT-002' },
    p_activity_source_url: null,
    p_submission_id:       submissionId2,
  })

  const r2 = d2 as { contact_id: string; is_new: boolean; activity_id: string }
  ok('Same contact, second property: same contact_id', r2?.contact_id === r1?.contact_id)
  ok('Same contact, second property: is_new = false', r2?.is_new === false)
  ok('Same contact, second property: NEW activity_id', r2?.activity_id !== r1?.activity_id)
  if (r2?.activity_id) cleanup.push({ table: 'activities', id: r2.activity_id })

  // Verify: ONE contact, TWO property activities
  const { count: contactCount } = await db.from('contacts').select('*', { count: 'exact', head: true }).eq('phone', testPhone)
  const { count: actCount } = await db.from('activities').select('*', { count: 'exact', head: true })
    .eq('contact_id', r1.contact_id).eq('type', 'property_enquiry')

  ok('ONE contact only (no duplicate)', contactCount === 1)
  ok('TWO property_enquiry activities on same contact', actCount === 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SOFIA ACCEPTANCE
// ─────────────────────────────────────────────────────────────────────────────
async function testSofia() {
  console.log('\n═══ SOFIA Widget ═══')

  const testEmail = `acceptance-sofia-${Date.now()}@test.phase2a.invalid`

  // Email handoff → contact + activity
  const { data } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               testEmail,
    p_phone:               null,
    p_name:                null,
    p_source:              'sofia_widget',
    p_notes:               'Última mensagem: Tenho budget €1M | [Sofia score: 75 — ALTA PRIORIDADE]',
    p_preferred_locations: null,
    p_timeline:            null,
    p_page_url:            'https://www.agencygroup.pt/',
    p_intent:              'buyer',
    p_next_followup_at:    null,
    p_activity_type:       'sofia_handoff',
    p_activity_subject:    'sofia_widget',
    p_activity_body:       'Tenha budget €1M | [Sofia score: 75 — ALTA PRIORIDADE]',
    p_activity_metadata:   { intent: 'buyer' },
    p_activity_source_url: 'https://www.agencygroup.pt/',
    p_submission_id:       crypto.randomUUID(),
  })

  const r = data as { success: boolean; contact_id: string; activity_id: string }
  ok('Sofia email handoff: success', r?.success)
  ok('Sofia email handoff: contact created', !!r?.contact_id)
  ok('Sofia email handoff: activity created', !!r?.activity_id)
  if (r?.contact_id) cleanup.push({ table: 'contacts', id: r.contact_id })
  if (r?.activity_id) cleanup.push({ table: 'activities', id: r.activity_id })

  const { data: act } = await db.from('activities').select('type').eq('id', r?.activity_id).single()
  ok('Sofia activity type = sofia_handoff', act?.type === 'sofia_handoff')

  // Anonymous → no CRM (identity guard at app layer, not tested via RPC)
  console.log('  ℹ  Anonymous → no CRM: enforced at application layer (ingestLead.ts line 56)')
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FAILURE SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
async function testFailures() {
  console.log('\n═══ FAILURE SCENARIOS ═══')

  // DB failure (no email/phone) → RPC returns failure, no partial write
  const { data: noId } = await db.rpc('ingest_commercial_lead_v1', {
    p_email: null, p_phone: null, p_name: 'Ghost',
    p_source: 'contacto', p_notes: null, p_preferred_locations: null, p_timeline: null,
    p_page_url: null, p_intent: null, p_next_followup_at: null,
    p_activity_type: 'contact_form', p_activity_subject: 'ghost',
    p_activity_body: null, p_activity_metadata: null, p_activity_source_url: null,
    p_submission_id: null,
  })
  const noIdR = noId as { success: boolean }
  ok('No email/phone → success=false (no false success)', noIdR?.success === false)

  // Since RPC is atomic, if contact succeeds but activity type is invalid → whole tx rolls back
  const { data: badType } = await db.rpc('ingest_commercial_lead_v1', {
    p_email: `bad-type-${Date.now()}@test.phase2a.invalid`,
    p_phone: null, p_name: null, p_source: 'contacto',
    p_notes: null, p_preferred_locations: null, p_timeline: null,
    p_page_url: null, p_intent: null, p_next_followup_at: null,
    p_activity_type: 'INVALID_TYPE_THAT_DOES_NOT_EXIST', // should trigger EXCEPTION
    p_activity_subject: 'bad',
    p_activity_body: null, p_activity_metadata: null, p_activity_source_url: null,
    p_submission_id: null,
  })
  const badTypeR = badType as { success: boolean; error: string }
  ok('Invalid activity_type → RPC EXCEPTION → success=false', badTypeR?.success === false)

  // Verify NO contact was inserted (atomic rollback)
  const { count } = await db.from('contacts')
    .select('*', { count: 'exact', head: true })
    .like('email', `bad-type-%@test.phase2a.invalid`)
  ok('Atomic rollback: NO contact row created on activity failure', count === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. IDENTITY CONFLICT
// ─────────────────────────────────────────────────────────────────────────────
async function testIdentityConflict() {
  console.log('\n═══ IDENTITY CONFLICT (Amendment 9) ═══')

  const email1 = `conflict-a-${Date.now()}@test.phase2a.invalid`
  const email2 = `conflict-b-${Date.now()}@test.phase2a.invalid`
  const sharedPhone = `+351888${Date.now().toString().slice(-6)}`

  // Insert contact A with email1 + sharedPhone
  const { data: rA } = await db.rpc('ingest_commercial_lead_v1', {
    p_email: email1, p_phone: sharedPhone, p_name: 'Contact A',
    p_source: 'contacto', p_notes: null, p_preferred_locations: null, p_timeline: null,
    p_page_url: null, p_intent: 'buyer', p_next_followup_at: null,
    p_activity_type: 'contact_form', p_activity_subject: 'contacto',
    p_activity_body: null, p_activity_metadata: null, p_activity_source_url: null,
    p_submission_id: crypto.randomUUID(),
  })
  const rAResult = rA as { contact_id: string; activity_id: string }
  if (rAResult?.contact_id) cleanup.push({ table: 'contacts', id: rAResult.contact_id })
  if (rAResult?.activity_id) cleanup.push({ table: 'activities', id: rAResult.activity_id })

  // Attempt contact B with email2 + SAME sharedPhone → identity conflict
  const { data: rB } = await db.rpc('ingest_commercial_lead_v1', {
    p_email: email2, p_phone: sharedPhone, p_name: 'Contact B',
    p_source: 'contacto', p_notes: null, p_preferred_locations: null, p_timeline: null,
    p_page_url: null, p_intent: 'buyer', p_next_followup_at: null,
    p_activity_type: 'contact_form', p_activity_subject: 'contacto',
    p_activity_body: null, p_activity_metadata: null, p_activity_source_url: null,
    p_submission_id: crypto.randomUUID(),
  })
  const rBResult = rB as { success: boolean; contact_id: string; is_new: boolean; activity_id: string }
  ok('Identity conflict → success (inserted as NEW)', rBResult?.success)
  ok('Identity conflict → NEW contact (no merge)', rBResult?.contact_id !== rAResult?.contact_id)
  ok('Identity conflict → is_new = true', rBResult?.is_new === true)
  if (rBResult?.contact_id) cleanup.push({ table: 'contacts', id: rBResult.contact_id })
  if (rBResult?.activity_id) cleanup.push({ table: 'activities', id: rBResult.activity_id })

  // Verify: Contact A still has its original email (not overwritten)
  const { data: contactA } = await db.from('contacts').select('email').eq('id', rAResult.contact_id).single()
  ok('Contact A email not overwritten by conflict', contactA?.email === email1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. COMMERCIAL TRUTH RECONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────
async function testCommercialTruth() {
  console.log('\n═══ COMMERCIAL TRUTH RECONSTRUCTION ═══')

  // Use the first contacto test contact (it should still be in the DB before cleanup)
  const testEmail = `truth-${Date.now()}@test.phase2a.invalid`
  const { data } = await db.rpc('ingest_commercial_lead_v1', {
    p_email:               testEmail,
    p_phone:               '+351777000001',
    p_name:                'Truth Test Lead',
    p_source:              'property_enquiry',
    p_notes:               'Imóvel: AG-TRUTH-001 | Budget max: €1500000',
    p_preferred_locations: ['Cascais'],
    p_timeline:            '3-6 months',
    p_page_url:            'https://www.agencygroup.pt/imoveis/ag-truth-001',
    p_intent:              'buyer',
    p_next_followup_at:    new Date(Date.now() + 86400000).toISOString(),
    p_activity_type:       'property_enquiry',
    p_activity_subject:    'property_enquiry: AG-TRUTH-001',
    p_activity_body:       'Interested in viewing',
    p_activity_metadata:   {
      property_ref: 'AG-TRUTH-001',
      property_name: 'Moradia Cascais',
      zona: 'Cascais',
      budget_max: 1500000,
      intent: 'buyer',
    },
    p_activity_source_url: 'https://www.agencygroup.pt/imoveis/ag-truth-001',
    p_submission_id:       crypto.randomUUID(),
  })

  const r = data as { success: boolean; contact_id: string; activity_id: string }
  if (r?.contact_id) cleanup.push({ table: 'contacts', id: r.contact_id })
  if (r?.activity_id) cleanup.push({ table: 'activities', id: r.activity_id })

  // Reconstruct commercial event
  const { data: contact } = await db.from('contacts').select('*').eq('id', r?.contact_id).single()
  const { data: activity } = await db.from('activities').select('*').eq('id', r?.activity_id).single()

  ok('WHO: contact.full_name', !!contact?.full_name)
  ok('WHERE: contact.page_url', !!contact?.page_url)
  ok('WHY: activity.metadata.property_ref', !!activity?.metadata?.property_ref)
  ok('WHEN: activity.occurred_at', !!activity?.occurred_at)
  ok('WHAT: activity.subject contains property ref', activity?.subject?.includes('AG-TRUTH-001'))
  ok('SOURCE: contact.source = property_enquiry', contact?.source === 'property_enquiry')
  ok('NEW-OR-EXISTING: activity.outcome = new_lead', activity?.outcome === 'new_lead')
  ok('ACTIVITY: activity row exists', !!activity?.id)
  ok('OWNER: contact.assigned_to = NULL', contact?.assigned_to === null)
  ok('HUMAN-RESPONDED: contact.first_response_at = NULL', contact?.first_response_at === null)

  console.log('\n  Commercial Event Summary:')
  console.log(`  WHO:    ${contact?.full_name} (${contact?.email})`)
  console.log(`  WHERE:  ${contact?.page_url}`)
  console.log(`  WHAT:   ${activity?.subject}`)
  console.log(`  WHEN:   ${activity?.occurred_at}`)
  console.log(`  SOURCE: ${contact?.source}`)
  console.log(`  OWNER:  ${contact?.assigned_to ?? 'UNASSIGNED'}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Phase 2A Controlled Acceptance — Agency Group')
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log('─────────────────────────────────────────────\n')

  try {
    await verifySchema()
    await testContacto()
    await testPropertyEnquiry()
    await testSofia()
    await testFailures()
    await testIdentityConflict()
    await testCommercialTruth()
  } finally {
    await cleanupAll()
  }

  console.log('\n─────────────────────────────────────────────')
  console.log(`Results: ${pass} passed / ${fail} failed`)

  if (fail > 0) {
    console.error('\n❌ PHASE 2A ACCEPTANCE: FAILED')
    process.exit(1)
  } else {
    console.log('\n✅ PHASE 2A ACCEPTANCE: ALL CHECKS PASSED')
    console.log('Commercial OS inbound capture is verified.')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
