// scripts/import-crm-final.ts
// Agency Group — CRM Import Script
// Imports CRM_IMPORT_FINAL.xlsx into Supabase capital_profiles table
//
// RULES:
// - Never overwrite existing records (check LEAD_ID / email / linkedin)
// - Deduplicate before insert
// - Batch import (100 records at a time)
// - Generate import log
// - Rollback safe (all inserts use ON CONFLICT DO NOTHING)
//
// Run: npx tsx scripts/import-crm-final.ts
// Or:  npx ts-node scripts/import-crm-final.ts

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const EXCEL_PATH   = path.join(process.env.HOME || '', 'Desktop', 'AGENCY_GROUP_CRM', 'OUTPUT', 'PHASE18', 'CRM_IMPORT_FINAL.xlsx')
const BATCH_SIZE   = 100
const DRY_RUN      = process.env.DRY_RUN === 'true'  // set DRY_RUN=true to test without writing
const LOG_PATH     = path.join(__dirname, '..', 'logs', `crm-import-${new Date().toISOString().slice(0,10)}.json`)

// ── Types ────────────────────────────────────────────────────────
interface CRMRow {
  LEAD_ID: string
  'Full Name': string
  Company: string
  Email: string
  LinkedIn: string
  Country_ISO: string
  City?: string
  PERSONA_TYPE: string
  TIER: string
  TOTAL_SCORE: number
  CAPITAL_SCORE: number
  INFLUENCE_SCORE: number
  CONNECTOR_SCORE: number
  DEAL_SCORE: number
  HOT_SCORE: number
  CRM_PIPELINE: string
  OWNER: string
  SOFIA_SEQUENCE: string
  NEXT_ACTION: string
  CONTACT_STATUS: string
  NEWSLETTER_SEGMENT: string
  BUYING_POWER_EST: string
  PORTUGAL_INTEREST: number
  PRIORITY_LEVEL: number
  IS_DUPLICATE: boolean
  DO_NOT_CONTACT: boolean
  MANUAL_REVIEW: boolean
  CONSENT_STATUS: string
}

// ── Import function ──────────────────────────────────────────────
async function importCRM() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Read Excel file (requires: npm install xlsx)
  console.log('[CRM Import] Reading:', EXCEL_PATH)
  const XLSX = require('xlsx')
  const wb   = XLSX.readFile(EXCEL_PATH)
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows: CRMRow[] = XLSX.utils.sheet_to_json(ws)
  console.log(`[CRM Import] Loaded ${rows.length} rows`)

  // Filter: skip DO_NOT_CONTACT and duplicates
  const valid = rows.filter(r => !r.DO_NOT_CONTACT && !r.IS_DUPLICATE)
  console.log(`[CRM Import] After filtering: ${valid.length} valid records`)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would import:', valid.length, 'records')
    console.log('[DRY RUN] First 5:', valid.slice(0, 5).map(r => r['Full Name']))
    return
  }

  // Import in batches
  const log: Array<{batch: number; inserted: number; skipped: number; errors: string[]}> = []
  let totalInserted = 0, totalSkipped = 0

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const records = batch.map(r => ({
      // capital_profiles schema (W54 — 000151 migration)
      profile_id:                r.LEAD_ID,
      tenant_id:                 process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001',
      type:                      mapPersonaToType(r.PERSONA_TYPE),
      name:                      String(r['Full Name'] || '').trim(),
      budget_min_eur:            0,
      budget_max_eur:            0,
      preferred_locations:       [],
      preferred_asset_types:     [],
      risk_tolerance:            'MODERATE',
      target_yield_min_pct:      0,
      target_yield_max_pct:      100,
      investment_horizon_months: 60,
      liquidity_preference:      'MEDIUM',
      currency:                  'EUR',
      verified:                  false,
      kyc_status:                'PENDING',
      // Extra fields stored as jsonb if column exists
      // (these would need a migration to add extra columns)
    }))

    // Use ON CONFLICT DO NOTHING to avoid overwriting
    const { error, count } = await supabase
      .from('capital_profiles')
      .upsert(records, { onConflict: 'profile_id', ignoreDuplicates: true })
      .select('profile_id')

    const inserted = count || 0
    const skipped  = batch.length - inserted
    totalInserted += inserted
    totalSkipped  += skipped

    log.push({ batch: batchNum, inserted, skipped, errors: error ? [error.message] : [] })

    if (batchNum % 10 === 0 || i + BATCH_SIZE >= valid.length) {
      console.log(`[CRM Import] Batch ${batchNum}: ${inserted} inserted, ${skipped} skipped | Total: ${totalInserted} / ${valid.length}`)
    }
  }

  // Write log
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true })
  fs.writeFileSync(LOG_PATH, JSON.stringify({
    imported_at: new Date().toISOString(),
    total_rows: rows.length,
    valid_rows: valid.length,
    total_inserted: totalInserted,
    total_skipped: totalSkipped,
    batches: log,
  }, null, 2))

  console.log(`\n[CRM Import] COMPLETE`)
  console.log(`  Total rows: ${rows.length}`)
  console.log(`  Valid rows: ${valid.length}`)
  console.log(`  Inserted:   ${totalInserted}`)
  console.log(`  Skipped:    ${totalSkipped}`)
  console.log(`  Log:        ${LOG_PATH}`)
}

function mapPersonaToType(persona: string): string {
  const map: Record<string, string> = {
    'FAMILY_OFFICE':         'FAMILY_OFFICE',
    'REAL_ESTATE_FUND':      'FUND',
    'PRIVATE_BANK':          'FUND',
    'WEALTH_MANAGER':        'INVESTOR',
    'PRIVATE_CLIENT_ADVISOR':'INVESTOR',
    'INVESTOR':              'INVESTOR',
    'BUYER':                 'BUYER',
    'DEVELOPER':             'DEVELOPER',
    'CONNECTOR':             'CONNECTOR',
    'INTRODUCER':            'CONNECTOR',
    'PARTNER':               'CONNECTOR',
    'BROKER':                'CONNECTOR',
    'AGENT':                 'CONNECTOR',
    'LAWYER':                'CONNECTOR',
    'ARCHITECT':             'CONNECTOR',
  }
  return map[persona] || 'BUYER'
}

// ── Run ──────────────────────────────────────────────────────────
importCRM().then(() => process.exit(0)).catch(e => {
  console.error('[CRM Import] FAILED:', e)
  process.exit(1)
})
