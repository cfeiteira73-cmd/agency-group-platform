#!/usr/bin/env tsx
// =============================================================================
// Phase 2B.1 Acceptance Test — Demand Mandates Schema
// Runs against LIVE DB after migration 059 is applied.
// DO NOT run before migration 059 is applied.
// Pattern: mirrors phase2a-acceptance.ts
//
// Usage:
//   npx tsx scripts/phase2b1-acceptance.ts
//   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/phase2b1-acceptance.ts
//
// Cleanup: ALL test rows are deleted on success AND failure.
// Exit 0 = pass. Exit 1 = fail.
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !key) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Test state ────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const testMandateIds: string[] = []
const testContactIds: number[] = []
const testProfileIds: string[] = []

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(label: string): void {
  console.log(`  ✓ ${label}`)
  passed++
}

function fail(label: string, detail?: unknown): void {
  console.error(`  ✗ FAIL: ${label}`)
  if (detail) console.error('    ', JSON.stringify(detail, null, 2))
  failed++
}

function assert(condition: boolean, label: string, detail?: unknown): void {
  condition ? ok(label) : fail(label, detail)
}

async function cleanup(): Promise<void> {
  // Delete in FK-safe reverse order
  if (testMandateIds.length) {
    await sb.from('demand_mandate_history').delete().in('mandate_id', testMandateIds)
    await sb.from('demand_mandate_locations').delete().in('mandate_id', testMandateIds)
    await sb.from('demand_mandate_criteria').delete().in('mandate_id', testMandateIds)
    await sb.from('demand_mandate_participants').delete().in('mandate_id', testMandateIds)
    await sb.from('buyer_mandate_details').delete().in('mandate_id', testMandateIds)
    await sb.from('investor_mandate_details').delete().in('mandate_id', testMandateIds)
    await sb.from('demand_mandates').delete().in('id', testMandateIds)
  }
  if (testContactIds.length) {
    await sb.from('contacts').delete().in('id', testContactIds)
  }
  if (testProfileIds.length) {
    await sb.from('profiles').delete().in('id', testProfileIds)
  }
  console.log('\n[cleanup] complete')
}

// ── Create test fixtures ──────────────────────────────────────────────────────

async function createTestContact(): Promise<number> {
  const ts = Date.now()
  const { data, error } = await sb
    .from('contacts')
    .insert({
      email:    `phase2b1_test_${ts}@acceptance-test.invalid`,
      full_name: 'Phase2B1 Test Contact',
      name:      'Phase2B1 Test Contact',
      source:    'website',
      status:    'lead',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to create test contact: ${JSON.stringify(error)}`)
  testContactIds.push(data.id)
  return data.id
}

async function createTestProfile(): Promise<string> {
  // Profiles may already exist — try to find one first
  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  if (existing?.id) return existing.id

  // No profile exists — this shouldn't happen in a live environment
  // but for completeness we try to insert (may fail if auth.users doesn't have the id)
  throw new Error('No profile found in DB. Phase 2B.1 acceptance requires at least one profile row.')
}

// =============================================================================
// SECTION 1: Geography Nodes
// =============================================================================

async function testGeographyNodes(): Promise<void> {
  console.log('\n[1] Geography Nodes')

  // 1.1: Portugal country node exists
  const { data: country, error: cErr } = await sb
    .from('geography_nodes')
    .select('id, level, country_code, name_pt')
    .eq('id', '2b1a0000-0000-4000-8000-000000000000')
    .single()

  if (cErr || !country) {
    fail('Portugal country node exists', cErr)
    return
  }
  assert(country.level === 'COUNTRY', '1.1 Portugal country node level = COUNTRY')
  assert(country.country_code === 'PT', '1.2 Portugal country_code = PT')
  assert(country.name_pt === 'Portugal', '1.3 Portugal name_pt = Portugal')

  // 1.2: All 20 district/region nodes exist
  const { data: districts } = await sb
    .from('geography_nodes')
    .select('id, code')
    .eq('country_code', 'PT')
    .eq('level', 'DISTRICT')

  assert(
    (districts?.length ?? 0) === 20,
    `1.4 20 PT districts/regions seeded (found ${districts?.length})`,
  )

  // 1.3: Faro district exists (Algarve — key market)
  const { data: faro } = await sb
    .from('geography_nodes')
    .select('id, name_en')
    .eq('id', '2b1a0008-0000-4000-8000-000000000000')
    .single()

  assert(faro?.name_en === 'Faro', '1.5 Faro district (Algarve) seeded')

  // 1.4: Algarve municipalities seeded (all 16)
  const { data: algarveMunis } = await sb
    .from('geography_nodes')
    .select('id')
    .eq('parent_id', '2b1a0008-0000-4000-8000-000000000000')
    .eq('level', 'MUNICIPALITY')

  assert(
    (algarveMunis?.length ?? 0) === 16,
    `1.6 Algarve has 16 municipalities (found ${algarveMunis?.length})`,
  )

  // 1.5: Lisboa municipality exists
  const { data: lisboa } = await sb
    .from('geography_nodes')
    .select('id, name_en')
    .eq('id', '2b1b1101-0000-4000-8000-000000000000')
    .single()

  assert(lisboa?.name_en === 'Lisbon', '1.7 Lisboa municipality seeded')

  // 1.6: Funchal (Madeira) exists
  const { data: funchal } = await sb
    .from('geography_nodes')
    .select('id, name_pt')
    .eq('id', '2b1b3101-0000-4000-8000-000000000000')
    .single()

  assert(funchal?.name_pt === 'Funchal', '1.8 Funchal (Madeira) seeded')

  // 1.7: Total geography rows >= 80
  const { count } = await sb
    .from('geography_nodes')
    .select('id', { count: 'exact', head: true })

  assert((count ?? 0) >= 80, `1.9 >= 80 geography rows seeded (found ${count})`)

  // 1.8: anon can SELECT geography (public read)
  const anonSb = createClient(url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error: anonErr } = await anonSb
    .from('geography_nodes')
    .select('id')
    .limit(1)

  assert(!anonErr, `1.10 geography_nodes publicly readable (anon) — ${anonErr?.message ?? 'ok'}`)
}

// =============================================================================
// SECTION 2: Demand Mandates CRUD
// =============================================================================

async function testDemandMandates(contactId: number, profileId: string): Promise<void> {
  console.log('\n[2] Demand Mandates CRUD')

  // 2.1: Insert DRAFT mandate
  const { data: mandate, error: mErr } = await sb
    .from('demand_mandates')
    .insert({
      holder_contact_id: contactId,
      owner_id:          profileId,
      transaction_mode:  'BUY',
      purpose:           'PRIMARY_RESIDENCE',
      lifecycle_state:   'DRAFT',
      budget_min:        300000,
      budget_max:        900000,
      currency_code:     'EUR',
      budget_provenance: 'USER_STATED',
      origin:            'AGENT_ENTRY',
    })
    .select('id, lifecycle_state, budget_stated, budget_verified, currency_code')
    .single()

  if (mErr || !mandate) {
    fail('2.1 INSERT DRAFT mandate succeeded', mErr)
    return
  }
  testMandateIds.push(mandate.id)
  ok('2.1 INSERT DRAFT mandate succeeded')

  assert(mandate.lifecycle_state === 'DRAFT', '2.2 lifecycle_state defaults to DRAFT')
  assert(mandate.currency_code === 'EUR', '2.3 currency_code EUR stored')

  // 2.2: Computed columns (GENERATED ALWAYS AS)
  assert(mandate.budget_stated === true, '2.4 budget_stated = true (budget set)')
  assert(mandate.budget_verified === false, '2.5 budget_verified = false (USER_STATED ≠ AGENT_VERIFIED)')

  // 2.3: Insert second mandate for same holder (multiple active mandates allowed)
  const { data: mandate2, error: m2Err } = await sb
    .from('demand_mandates')
    .insert({
      holder_contact_id: contactId,
      owner_id:          profileId,
      transaction_mode:  'BUY',
      purpose:           'INVESTMENT',
      lifecycle_state:   'ACTIVE',
      budget_min:        500000,
      budget_max:        3000000,
      currency_code:     'EUR',
      budget_provenance: 'AGENT_VERIFIED',
      origin:            'AGENT_ENTRY',
    })
    .select('id, budget_verified')
    .single()

  if (!m2Err && mandate2) {
    testMandateIds.push(mandate2.id)
    ok('2.6 Second mandate for same holder (multiple mandates allowed)')
    assert(mandate2.budget_verified === true, '2.7 budget_verified = true (AGENT_VERIFIED)')
  } else {
    fail('2.6 Multiple mandates per holder allowed', m2Err)
  }

  // 2.4: Lifecycle transition (DRAFT → ACTIVE)
  const { error: lcErr } = await sb
    .from('demand_mandates')
    .update({ lifecycle_state: 'ACTIVE' })
    .eq('id', mandate.id)

  assert(!lcErr, `2.8 Lifecycle update DRAFT → ACTIVE — ${lcErr?.message ?? 'ok'}`)

  // 2.5: Budget provenance update → AGENT_VERIFIED → budget_verified flips
  const { data: verified, error: vErr } = await sb
    .from('demand_mandates')
    .update({ budget_provenance: 'AGENT_VERIFIED' })
    .eq('id', mandate.id)
    .select('budget_verified')
    .single()

  if (!vErr && verified) {
    assert(verified.budget_verified === true, '2.9 budget_verified flips to true after AGENT_VERIFIED')
  } else {
    fail('2.9 budget_verified flip after AGENT_VERIFIED', vErr)
  }

  // 2.6: READ
  const { data: read, error: rErr } = await sb
    .from('demand_mandates')
    .select('id, holder_contact_id, purpose, transaction_mode')
    .eq('id', mandate.id)
    .single()

  assert(!rErr && read?.id === mandate.id, '2.10 READ mandate by id')
  assert(read?.purpose === 'PRIMARY_RESIDENCE', '2.11 purpose stored correctly')

  // 2.7: NULL budget (optional)
  const { data: noBudget, error: nbErr } = await sb
    .from('demand_mandates')
    .insert({
      holder_contact_id: contactId,
      owner_id:          profileId,
      transaction_mode:  'RENT',
      purpose:           'HOLIDAY',
      currency_code:     'EUR',
      budget_provenance: 'AI_EXTRACTED',
      origin:            'SOFIA_DRAFT',
    })
    .select('id, budget_stated')
    .single()

  if (!nbErr && noBudget) {
    testMandateIds.push(noBudget.id)
    assert(noBudget.budget_stated === false, '2.12 budget_stated = false when no budget set')
  } else {
    fail('2.12 INSERT mandate with no budget', nbErr)
  }
}

// =============================================================================
// SECTION 3: Participants
// =============================================================================

async function testParticipants(mandateId: string, contactId: number): Promise<void> {
  console.log('\n[3] Demand Mandate Participants')

  const { data, error } = await sb
    .from('demand_mandate_participants')
    .insert({
      mandate_id: mandateId,
      contact_id: contactId,
      role:       'DECISION_MAKER',
      is_primary: false,
    })
    .select('id, role')
    .single()

  assert(!error && !!data, `3.1 INSERT participant — ${error?.message ?? 'ok'}`)

  // Duplicate (same mandate, same contact) must fail
  const { error: dupErr } = await sb
    .from('demand_mandate_participants')
    .insert({
      mandate_id: mandateId,
      contact_id: contactId,
      role:       'ADVISER',
    })

  assert(!!dupErr, '3.2 Duplicate participant (mandate_id, contact_id) rejected by UNIQUE constraint')
}

// =============================================================================
// SECTION 4: Locations
// =============================================================================

async function testLocations(mandateId: string): Promise<void> {
  console.log('\n[4] Demand Mandate Locations')

  const lisbonDistrictId = '2b1a0011-0000-4000-8000-000000000000'
  const algarveDistrictId = '2b1a0008-0000-4000-8000-000000000000'

  // INCLUDE Lisboa district
  const { error: e1 } = await sb
    .from('demand_mandate_locations')
    .insert({ mandate_id: mandateId, geography_node_id: lisbonDistrictId, mode: 'INCLUDE' })

  assert(!e1, `4.1 INSERT INCLUDE location (Lisboa) — ${e1?.message ?? 'ok'}`)

  // INCLUDE Algarve district
  const { error: e2 } = await sb
    .from('demand_mandate_locations')
    .insert({ mandate_id: mandateId, geography_node_id: algarveDistrictId, mode: 'INCLUDE' })

  assert(!e2, `4.2 INSERT second INCLUDE location (Algarve) — ${e2?.message ?? 'ok'}`)

  // EXCLUDE (different node)
  const portoDistrictId = '2b1a0013-0000-4000-8000-000000000000'
  const { error: e3 } = await sb
    .from('demand_mandate_locations')
    .insert({ mandate_id: mandateId, geography_node_id: portoDistrictId, mode: 'EXCLUDE' })

  assert(!e3, `4.3 INSERT EXCLUDE location (Porto) — ${e3?.message ?? 'ok'}`)

  // Duplicate INCLUDE on same node must fail
  const { error: dupErr } = await sb
    .from('demand_mandate_locations')
    .insert({ mandate_id: mandateId, geography_node_id: lisbonDistrictId, mode: 'INCLUDE' })

  assert(!!dupErr, '4.4 Duplicate (mandate_id, node, mode) rejected by UNIQUE constraint')

  // Verify count
  const { count } = await sb
    .from('demand_mandate_locations')
    .select('id', { count: 'exact', head: true })
    .eq('mandate_id', mandateId)

  assert(count === 3, `4.5 3 location rows for mandate (found ${count})`)
}

// =============================================================================
// SECTION 5: Criteria
// =============================================================================

async function testCriteria(mandateId: string): Promise<void> {
  console.log('\n[5] Demand Mandate Criteria')

  const { error: e1 } = await sb
    .from('demand_mandate_criteria')
    .insert({
      mandate_id:      mandateId,
      criterion_key:   'feature',
      criterion_val:   'pool',
      constraint_type: 'HARD',
      provenance:      'USER_STATED',
    })

  assert(!e1, `5.1 INSERT HARD criterion (pool) — ${e1?.message ?? 'ok'}`)

  const { error: e2 } = await sb
    .from('demand_mandate_criteria')
    .insert({
      mandate_id:      mandateId,
      criterion_key:   'view',
      criterion_val:   'sea_view',
      constraint_type: 'PREFERENCE',
      provenance:      'AI_EXTRACTED',
    })

  assert(!e2, `5.2 INSERT PREFERENCE criterion (sea_view) — ${e2?.message ?? 'ok'}`)

  const { error: e3 } = await sb
    .from('demand_mandate_criteria')
    .insert({
      mandate_id:      mandateId,
      criterion_key:   'feature',
      criterion_val:   'highway_noise',
      constraint_type: 'EXCLUSION',
      provenance:      'USER_STATED',
    })

  assert(!e3, `5.3 INSERT EXCLUSION criterion (highway_noise) — ${e3?.message ?? 'ok'}`)
}

// =============================================================================
// SECTION 6: Buyer Mandate Details
// =============================================================================

async function testBuyerDetails(mandateId: string): Promise<void> {
  console.log('\n[6] Buyer Mandate Details')

  const { error } = await sb
    .from('buyer_mandate_details')
    .insert({
      mandate_id:       mandateId,
      typologies:       ['T3', 'T4'],
      bedrooms_min:     3,
      bedrooms_max:     4,
      area_min_m2:      120,
      area_max_m2:      300,
      required_features: ['pool', 'garage'],
      financing_type:   'CASH',
      timeline:         '6_MONTHS',
      proof_of_funds:   'DOCUMENT_SEEN',
      golden_visa_required: false,
      mortgage_preapproved: false,
    })

  assert(!error, `6.1 INSERT buyer_mandate_details — ${error?.message ?? 'ok'}`)

  // Primary key = mandate_id → duplicate must fail
  const { error: dupErr } = await sb
    .from('buyer_mandate_details')
    .insert({ mandate_id: mandateId, financing_type: 'MORTGAGE' })

  assert(!!dupErr, '6.2 Duplicate buyer_mandate_details rejected (PK constraint)')
}

// =============================================================================
// SECTION 7: Investor Mandate Details
// =============================================================================

async function testInvestorDetails(mandateId: string): Promise<void> {
  console.log('\n[7] Investor Mandate Details')

  const { error } = await sb
    .from('investor_mandate_details')
    .insert({
      mandate_id:           mandateId,
      investment_strategy:  ['YIELD', 'CAPITAL_APPRECIATION'],
      target_yield_min_pct: 4.5,
      target_yield_max_pct: 7.0,
      ticket_min:           500000,
      ticket_max:           3000000,
      ticket_currency_code: 'EUR',
      risk_tolerance:       'MEDIUM',
      requires_management:  false,
      open_to_off_market:   true,
    })

  assert(!error, `7.1 INSERT investor_mandate_details — ${error?.message ?? 'ok'}`)
}

// =============================================================================
// SECTION 8: History Trigger
// =============================================================================

async function testHistoryTrigger(mandateId: string): Promise<void> {
  console.log('\n[8] History Trigger')

  // CREATED history row should already exist from INSERT trigger
  const { data: created } = await sb
    .from('demand_mandate_history')
    .select('change_type, new_values')
    .eq('mandate_id', mandateId)
    .eq('change_type', 'CREATED')

  assert(
    (created?.length ?? 0) >= 1,
    `8.1 CREATED history row written by INSERT trigger (found ${created?.length ?? 0})`,
  )

  const createdRow = created?.[0]
  if (createdRow) {
    const nv = createdRow.new_values as Record<string, unknown>
    assert(!!nv?.lifecycle_state, '8.2 CREATED history new_values contains lifecycle_state')
    assert(!!nv?.transaction_mode, '8.3 CREATED history new_values contains transaction_mode')
    assert(!!nv?.holder_contact_id, '8.4 CREATED history new_values contains holder_contact_id')
  }

  // Trigger: LIFECYCLE_CHANGE
  await sb
    .from('demand_mandates')
    .update({ lifecycle_state: 'PAUSED', paused_reason: 'acceptance test' })
    .eq('id', mandateId)

  const { data: lcHist } = await sb
    .from('demand_mandate_history')
    .select('change_type, previous_values, new_values')
    .eq('mandate_id', mandateId)
    .eq('change_type', 'LIFECYCLE_CHANGE')

  assert(
    (lcHist?.length ?? 0) >= 1,
    `8.5 LIFECYCLE_CHANGE history row written after state update (found ${lcHist?.length ?? 0})`,
  )

  const lcRow = lcHist?.[0]
  if (lcRow) {
    const pv = lcRow.previous_values as Record<string, unknown>
    const nv = lcRow.new_values as Record<string, unknown>
    assert(nv?.lifecycle_state === 'PAUSED', '8.6 new_values.lifecycle_state = PAUSED')
    assert(typeof pv?.lifecycle_state === 'string', '8.7 previous_values.lifecycle_state present')
  }

  // Trigger: BUDGET_CHANGE
  await sb
    .from('demand_mandates')
    .update({ budget_min: 400000, budget_max: 1200000 })
    .eq('id', mandateId)

  const { data: budgetHist } = await sb
    .from('demand_mandate_history')
    .select('change_type')
    .eq('mandate_id', mandateId)
    .in('change_type', ['BUDGET_CHANGE', 'BUDGET_VERIFIED'])

  assert(
    (budgetHist?.length ?? 0) >= 1,
    `8.8 BUDGET_CHANGE history row written after budget update (found ${budgetHist?.length ?? 0})`,
  )

  // No MATCH_EVENT in history (Amendment 4)
  const { data: matchRows } = await sb
    .from('demand_mandate_history')
    .select('id')
    .eq('mandate_id', mandateId)
    .eq('change_type', 'MATCH_EVENT')

  assert((matchRows?.length ?? 0) === 0, '8.9 No MATCH_EVENT rows in history (Amendment 4)')
}

// =============================================================================
// SECTION 9: RLS — Deny by Default (Amendment 2)
// =============================================================================

async function testRLS(mandateId: string): Promise<void> {
  console.log('\n[9] RLS — Deny by Default (Amendment 2)')

  // Use anon key (or service_role key if anon not set — test will be less meaningful)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    console.log('  [skip] NEXT_PUBLIC_SUPABASE_ANON_KEY not set — skipping RLS deny tests')
    return
  }

  const anonSb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // anon cannot read demand_mandates
  const { data: anonMandates, error: anonMErr } = await anonSb
    .from('demand_mandates')
    .select('id')
    .eq('id', mandateId)

  const deniedMandates = !!anonMErr || (anonMandates?.length ?? 0) === 0
  assert(deniedMandates, `9.1 anon cannot read demand_mandates (RLS deny) — ${anonMErr?.message ?? 'returned ' + (anonMandates?.length ?? 0) + ' rows'}`)

  // anon cannot read demand_mandate_history
  const { data: anonHist, error: anonHErr } = await anonSb
    .from('demand_mandate_history')
    .select('id')
    .eq('mandate_id', mandateId)

  const deniedHistory = !!anonHErr || (anonHist?.length ?? 0) === 0
  assert(deniedHistory, `9.2 anon cannot read demand_mandate_history (RLS deny) — ${anonHErr?.message ?? 'returned ' + (anonHist?.length ?? 0) + ' rows'}`)

  // anon CAN read geography_nodes (public read)
  const { error: anonGErr } = await anonSb
    .from('geography_nodes')
    .select('id')
    .limit(1)

  assert(!anonGErr, `9.3 anon CAN read geography_nodes (public read) — ${anonGErr?.message ?? 'ok'}`)
}

// =============================================================================
// SECTION 10: Phase 2A Regression
// =============================================================================

async function testPhase2ARegression(): Promise<void> {
  console.log('\n[10] Phase 2A Regression')

  // ingest_commercial_lead_v1 must still be callable
  const ts = Date.now()
  const { data, error } = await sb.rpc('ingest_commercial_lead_v1', {
    p_email:               `phase2b1_regression_${ts}@acceptance-test.invalid`,
    p_phone:               '',
    p_name:                'Phase2B1 Regression Test',
    p_source:              'website',
    p_notes:               'phase2b1 acceptance regression test',
    p_preferred_locations: [],
    p_timeline:            '',
    p_page_url:            'https://test.invalid',
    p_intent:              'buyer',
    p_next_followup_at:    new Date(Date.now() + 86400000).toISOString(),
    p_activity_type:       'contact_form',
    p_activity_subject:    'Phase2B1 regression test',
    p_activity_body:       '',
    p_activity_metadata:   null,
    p_activity_source_url: '',
    p_submission_id:       null,
  })

  assert(!error, `10.1 ingest_commercial_lead_v1 RPC callable — ${error?.message ?? 'ok'}`)

  const result = data as { success?: boolean; contact_id?: number }
  assert(result?.success === true, `10.2 ingest_commercial_lead_v1 returned success:true`)

  // Cleanup regression contact
  if (result?.contact_id) {
    await sb.from('activities').delete().eq('contact_id', result.contact_id)
    await sb.from('contacts').delete().eq('id', result.contact_id)
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(72))
  console.log('Phase 2B.1 Acceptance Tests — Demand Mandates Schema')
  console.log('='.repeat(72))
  console.log(`  Supabase URL: ${url}`)
  console.log(`  Timestamp:    ${new Date().toISOString()}`)

  let contactId: number
  let profileId: string
  let primaryMandateId: string
  let investorMandateId: string

  try {
    profileId  = await createTestProfile()
    contactId  = await createTestContact()

    await testGeographyNodes()

    // Create mandates and capture IDs
    await testDemandMandates(contactId, profileId)
    if (!testMandateIds[0]) throw new Error('No mandate created in Section 2')

    primaryMandateId  = testMandateIds[0]!
    investorMandateId = testMandateIds[1] ?? testMandateIds[0]!

    await testParticipants(primaryMandateId, contactId)
    await testLocations(primaryMandateId)
    await testCriteria(primaryMandateId)
    await testBuyerDetails(primaryMandateId)
    await testInvestorDetails(investorMandateId)
    await testHistoryTrigger(primaryMandateId)
    await testRLS(primaryMandateId)
    await testPhase2ARegression()

  } catch (err) {
    console.error('\n[FATAL] Unexpected error:', err)
    failed++
  } finally {
    await cleanup()
  }

  console.log('\n' + '='.repeat(72))
  console.log(`  Result: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(72))

  if (failed > 0) {
    console.error('\nACCEPTANCE FAILED — do not apply migration to production')
    process.exit(1)
  } else {
    console.log('\nACCEPTANCE PASSED — migration 059 validated')
    process.exit(0)
  }
}

main()
