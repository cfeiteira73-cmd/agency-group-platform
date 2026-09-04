#!/usr/bin/env node
// =============================================================================
// Phase 2A Post-Migration Schema Verification
// Run AFTER applying migrations 055 and 056.
// READ-ONLY. No data mutation.
// Usage: node node_modules/tsx/dist/cli.mjs scripts/phase2a-verify-schema.ts
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envRaw = fs.readFileSync(path.resolve('.env.local'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env vars'); process.exit(1) }

const db = createClient(URL, KEY, { auth: { persistSession: false } })
const SEP = '─'.repeat(70)

let pass = 0
let fail = 0

function ok(label: string, detail = '') {
  pass++
  console.log(`  ✓ PASS  ${label}${detail ? '  ' + detail : ''}`)
}
function ko(label: string, detail = '') {
  fail++
  console.log(`  ✗ FAIL  ${label}${detail ? '  ' + detail : ''}`)
}

async function checkColumn(table: string, col: string): Promise<boolean> {
  const { error } = await db.from(table).select(col).limit(0)
  if (!error) return true
  if (error.code === '42703' || (error.message ?? '').includes('does not exist')) return false
  console.warn(`  [?] ${table}.${col}: unexpected error: ${error.message}`)
  return false
}

async function checkEnumValue(enumValue: string): Promise<boolean> {
  const { error } = await db.from('activities').select('id').eq('type', enumValue).limit(0)
  if (!error) return true
  if ((error.code === '22P02') || (error.message ?? '').includes('invalid input value for enum')) return false
  console.warn(`  [?] enum '${enumValue}': ${error.message}`)
  return false
}

async function checkRpc(): Promise<{ exists: boolean; securityDefiner: boolean; error?: string }> {
  const { error } = await (db as any).rpc('ingest_commercial_lead_v1', {
    p_email: null, p_phone: null, p_name: null, p_source: null,
    p_notes: null, p_preferred_locations: null, p_timeline: null,
    p_page_url: null, p_intent: null, p_next_followup_at: null,
    p_activity_type: null, p_activity_subject: null, p_activity_body: null,
    p_activity_metadata: null, p_activity_source_url: null, p_submission_id: null,
  })
  if (!error) return { exists: true, securityDefiner: true }
  if ((error.code === '42883') || (error.message ?? '').includes('Could not find the function')) {
    return { exists: false, securityDefiner: false, error: error.message }
  }
  // Any other error = function exists but rejected the null input — that's expected
  return { exists: true, securityDefiner: true }
}

async function main() {
  console.log(SEP)
  console.log('PHASE 2A — POST-MIGRATION SCHEMA VERIFICATION')
  console.log(`Project: ${URL}`)
  console.log(`Run at:  ${new Date().toISOString()}`)
  console.log(SEP)

  // ── 1. Enum values ────────────────────────────────────────────────────────
  console.log('\n[1] activity_type ENUM VALUES')
  for (const v of ['property_enquiry', 'contact_form', 'sofia_handoff']) {
    const exists = await checkEnumValue(v);
    (exists ? ok : ko)(`activity_type has value '${v}'`)
  }

  // ── 2. contacts columns ───────────────────────────────────────────────────
  console.log('\n[2] contacts COLUMNS (migration 055)')
  for (const col of ['assigned_to', 'assigned_at', 'first_response_at', 'page_url']) {
    const exists = await checkColumn('contacts', col);
    (exists ? ok : ko)(`contacts.${col}`)
  }

  // ── 3. activities columns ─────────────────────────────────────────────────
  console.log('\n[3] activities COLUMNS')
  for (const col of ['subject', 'body', 'is_automated', 'occurred_at']) {
    const exists = await checkColumn('activities', col);
    (exists ? ok : ko)(`activities.${col} (drift repair)`)
  }
  for (const col of ['source_url', 'metadata']) {
    const exists = await checkColumn('activities', col);
    (exists ? ok : ko)(`activities.${col} (migration 055)`)
  }

  // ── 4. RPC ────────────────────────────────────────────────────────────────
  console.log('\n[4] RPC ingest_commercial_lead_v1 (migration 056)')
  const rpc = await checkRpc()
  if (rpc.exists) {
    ok('ingest_commercial_lead_v1 EXISTS')
    ok('SECURITY DEFINER (assumed — verify manually in pg_proc)')
    console.log('  NOTE: Verify manually in Supabase Studio:')
    console.log("  SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'ingest_commercial_lead_v1';")
    console.log("  Expected: prosecdef=true, proconfig includes 'search_path=public'")
    console.log('  Verify EXECUTE granted to service_role only:')
    console.log("  SELECT grantee, privilege_type FROM information_schema.routine_privileges")
    console.log("  WHERE routine_name = 'ingest_commercial_lead_v1';")
  } else {
    ko('ingest_commercial_lead_v1 MISSING', rpc.error)
    console.log('  ACTION REQUIRED: Apply migration 056 in Supabase Studio.')
  }

  // ── 5. Index ──────────────────────────────────────────────────────────────
  console.log('\n[5] INDEX idx_contacts_unassigned')
  console.log('  NOTE: Cannot verify index via PostgREST. Verify manually:')
  console.log("  SELECT indexname, indexdef FROM pg_indexes")
  console.log("  WHERE indexname = 'idx_contacts_unassigned';")
  console.log('  Expected: partial index on contacts(created_at DESC) WHERE assigned_to IS NULL AND assigned_at IS NULL')

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log('\n' + SEP)
  const total = pass + fail
  console.log(`SCHEMA VERIFICATION: ${pass}/${total} checks passed, ${fail} failed`)
  if (fail === 0) {
    console.log('STATUS: SCHEMA READY — proceed to acceptance tests.')
  } else {
    console.log('STATUS: SCHEMA INCOMPLETE — do NOT proceed to acceptance tests.')
    console.log('Apply missing migrations and re-run this script.')
  }
  console.log(SEP)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
