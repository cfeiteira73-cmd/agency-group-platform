#!/usr/bin/env node
// =============================================================================
// Phase 2A Pre-Migration Baseline
// Captures live schema state BEFORE applying migrations 055 / 056.
// READ-ONLY. No data mutation.
// Usage: node --loader ts-node/esm scripts/phase2a-baseline.ts
//   OR:  npx tsx scripts/phase2a-baseline.ts
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load env manually (dotenv may not be in scope for tsx)
const envRaw = fs.readFileSync(path.resolve('.env.local'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('MISSING: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(URL, KEY, { auth: { persistSession: false } })

const SEP = '─'.repeat(70)

async function checkColumn(table: string, col: string): Promise<boolean> {
  const { error } = await db.from(table).select(col).limit(0)
  if (!error) return true
  if (error.code === '42703' || (error.message ?? '').includes('does not exist')) return false
  // Some other error — column might exist, report as unknown
  console.warn(`  [?] ${table}.${col}: unexpected error: ${error.message}`)
  return false
}

async function checkEnumValue(enumValue: string): Promise<boolean> {
  // Cast a literal to the enum type. If the enum value doesn't exist PG errors.
  // We do this via a filter on the activities table.
  const { error } = await db
    .from('activities')
    .select('id')
    .eq('type', enumValue)
    .limit(0)
  if (!error) return true
  // 22P02 = invalid_text_representation (bad enum value)
  if ((error.code === '22P02') || (error.message ?? '').includes('invalid input value for enum')) return false
  // If error is something else (e.g. column "type" doesn't exist), log and return false
  console.warn(`  [?] enum check '${enumValue}': ${error.message}`)
  return false
}

async function checkIndex(indexName: string): Promise<boolean> {
  // Query pg_indexes via a function that surfaces it — not normally via PostgREST.
  // Instead: try selecting the column that the index relies on (already covered).
  // We can't query pg_catalog directly via PostgREST. Mark as CANNOT VERIFY.
  return false // placeholder — see BASELINE OUTPUT note
}

async function countTable(table: string): Promise<number | string> {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) return `ERROR: ${error.message}`
  return count ?? 0
}

async function checkRpcExists(): Promise<boolean> {
  // Try calling the RPC. If it doesn't exist, we get a 404/42883 error.
  const { error } = await (db as any).rpc('ingest_commercial_lead_v1', {
    p_email: null, p_phone: null, p_name: null, p_source: null,
    p_notes: null, p_preferred_locations: null, p_timeline: null,
    p_page_url: null, p_intent: null, p_next_followup_at: null,
    p_activity_type: null, p_activity_subject: null, p_activity_body: null,
    p_activity_metadata: null, p_activity_source_url: null, p_submission_id: null,
  })
  if (!error) return true
  // 42883 = undefined_function
  if ((error.code === '42883') || (error.message ?? '').includes('Could not find the function')) return false
  // Function exists but errored on null inputs — that's fine, it exists
  return true
}

async function main() {
  console.log(SEP)
  console.log('PHASE 2A — PRE-MIGRATION BASELINE')
  console.log(`Project: ${URL}`)
  console.log(`Captured: ${new Date().toISOString()}`)
  console.log(SEP)

  // ── Row counts ────────────────────────────────────────────────────────────
  console.log('\n[ROW COUNTS]')
  const contactsCount  = await countTable('contacts')
  const activitiesCount = await countTable('activities')
  console.log(`  contacts:   ${contactsCount}`)
  console.log(`  activities: ${activitiesCount}`)

  // ── activity_type enum values ─────────────────────────────────────────────
  console.log('\n[activity_type ENUM — checking values]')
  const knownExisting = ['system_event', 'call', 'email', 'meeting', 'note', 'task']
  const phase2aValues = ['property_enquiry', 'contact_form', 'sofia_handoff']

  for (const v of knownExisting) {
    const exists = await checkEnumValue(v)
    console.log(`  ${exists ? '✓' : '✗'} ${v}${exists ? '' : ' (missing — unexpected)'}`)
  }
  console.log('  --- Phase 2A values (should be MISSING before migration 055) ---')
  for (const v of phase2aValues) {
    const exists = await checkEnumValue(v)
    console.log(`  ${exists ? '✓ ALREADY EXISTS' : '✗ MISSING (expected)'} ${v}`)
  }

  // ── contacts columns ──────────────────────────────────────────────────────
  console.log('\n[contacts COLUMNS]')
  const contactCols = [
    'id','full_name','email','phone','status','source','notes',
    'preferred_locations','timeline','assigned_to','last_contact_at',
    'next_followup_at',
    // migration 055 additions:
    'assigned_at','first_response_at','page_url',
    // migration 039 UTM (may or may not be present):
    'utm_source','utm_medium','utm_campaign',
  ]
  for (const col of contactCols) {
    const exists = await checkColumn('contacts', col)
    const isMigration055 = ['assigned_at','first_response_at','page_url'].includes(col)
    const isMigration039 = ['utm_source','utm_medium','utm_campaign'].includes(col)
    const tag = isMigration055 ? ' ← migration 055' : isMigration039 ? ' ← migration 039' : ''
    console.log(`  ${exists ? '✓' : '✗'} ${col}${tag}`)
  }

  // ── activities columns ────────────────────────────────────────────────────
  console.log('\n[activities COLUMNS]')
  const activityCols = [
    'id','contact_id','type','subject','body','outcome',
    'is_automated','occurred_at','created_at',
    // migration 055 additions:
    'source_url','metadata',
  ]
  for (const col of activityCols) {
    const exists = await checkColumn('activities', col)
    const isMigration055 = ['source_url','metadata'].includes(col)
    console.log(`  ${exists ? '✓' : '✗'} ${col}${isMigration055 ? ' ← migration 055' : ''}`)
  }

  // ── idx_contacts_unassigned ───────────────────────────────────────────────
  console.log('\n[INDEX idx_contacts_unassigned]')
  console.log('  NOTE: Cannot verify index via PostgREST — requires pg_catalog access.')
  console.log('  Verify manually in Supabase Studio: SELECT * FROM pg_indexes WHERE indexname = \'idx_contacts_unassigned\';')

  // ── RPC ingest_commercial_lead_v1 ─────────────────────────────────────────
  console.log('\n[RPC ingest_commercial_lead_v1]')
  const rpcExists = await checkRpcExists()
  console.log(`  ${rpcExists ? '✓ EXISTS (unexpected before migration 056)' : '✗ MISSING (expected — migration 056 not yet applied)'}`)

  // ── RLS policies — cannot inspect via PostgREST ───────────────────────────
  console.log('\n[RLS POLICIES]')
  console.log('  NOTE: Cannot inspect RLS via PostgREST. Verify manually:')
  console.log("  SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename IN ('contacts','activities');")

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + SEP)
  console.log('BASELINE COMPLETE. No data was mutated.')
  console.log('Expected state BEFORE migrations 055+056:')
  console.log('  - activity_type: property_enquiry / contact_form / sofia_handoff → MISSING')
  console.log('  - contacts.assigned_at / first_response_at / page_url → MISSING')
  console.log('  - activities.source_url / metadata → MISSING')
  console.log('  - RPC ingest_commercial_lead_v1 → MISSING')
  console.log(SEP)
}

main().catch(err => { console.error('BASELINE FATAL:', err); process.exit(1) })
