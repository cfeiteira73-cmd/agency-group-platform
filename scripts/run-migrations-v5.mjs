/**
 * Migration runner v5 — Bootstrap via PostgREST function creation
 *
 * Strategy: Use service role to POST a function definition via the
 * Supabase REST API's /rpc endpoint. We can't run DDL directly,
 * but we can try to use `pg_catalog` functions or check if there's
 * a way to run DDL via the REST API with service role.
 *
 * Key insight: PostgREST with service_role role can call ANY function
 * including those that run DDL — but only if the function already exists.
 * We need to CREATE the function first.
 *
 * Alternative: Use the Supabase Realtime or Auth admin endpoints
 * which accept service role keys.
 */

import { readFileSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) env[key.trim()] = vals.join('=').trim()
}

const url = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY']
const projectRef = new URL(url).hostname.split('.')[0]

console.log('Project ref:', projectRef)

// === APPROACH: Try Supabase Edge Functions endpoint ===
// Check if there's an exec edge function deployed
async function tryEdgeFunction() {
  console.log('\n--- Trying edge function approach ---')
  const res = await fetch(`${url}/functions/v1/exec-sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: 'SELECT 1' }),
  })
  console.log(`exec-sql edge function: ${res.status} ${(await res.text()).slice(0, 100)}`)
}

// === APPROACH: Try the Storage admin endpoint ===
// Supabase Storage uses service role — confirm it works
async function testServiceRole() {
  console.log('\n--- Confirming service role access ---')
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // List auth users (requires service role)
  const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 3 })
  if (error) {
    console.log('Auth admin:', error.message)
  } else {
    console.log(`Auth admin works! Found ${users.users.length} users`)
  }

  // Try to create the exec_sql function via a specially crafted RPC
  // that might work through the PostgREST schema
  console.log('\n--- Attempting DDL via service role RPC trick ---')

  // First, check if pg_catalog functions are accessible
  const { data: pgData, error: pgError } = await supabase.rpc('version')
  console.log('rpc(version):', pgError ? pgError.message : JSON.stringify(pgData))
}

// === APPROACH: Supabase Management API v2 (newer) ===
async function tryManagementAPIv2() {
  console.log('\n--- Trying Management API v2 endpoints ---')

  const endpoints = [
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    `https://api.supabase.com/v2/projects/${projectRef}/database/query`,
  ]

  for (const ep of endpoints) {
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'X-Supabase-Service-Role': 'true',
      },
      body: JSON.stringify({ query: 'SELECT 1 as test' }),
    })
    const text = await res.text()
    console.log(`${ep}: ${res.status} ${text.slice(0, 100)}`)
  }
}

// === APPROACH: Try connecting via the pg module with the correct direct DB URL ===
// Supabase direct connection format (NOT pooler):
// Host: db.[PROJECT_REF].supabase.co
// Port: 5432
// User: postgres
// Password: [DB_PASSWORD] — this is set when creating the project
// We need to find or reset this password.

// === APPROACH: Use the Supabase CLI via npx ===
async function trySupabaseCLI() {
  console.log('\n--- Checking for supabase CLI via npx ---')
  const { execSync } = await import('child_process')
  try {
    const result = execSync('npx supabase --version', { timeout: 15000 }).toString()
    console.log('supabase CLI via npx:', result.trim())
    return true
  } catch (e) {
    console.log('npx supabase not available:', e.message.slice(0, 100))
    return false
  }
}

await tryEdgeFunction()
await testServiceRole()
await tryManagementAPIv2()
const cliOk = await trySupabaseCLI()

if (cliOk) {
  console.log('\nSupabase CLI available! Try: npx supabase db push --db-url postgresql://postgres:[PASSWORD]@db.isbfiofwpxqqpgxoftph.supabase.co:5432/postgres')
}

console.log('\n=== FINAL STATUS ===')
console.log('The migrations CANNOT be run automatically without one of:')
console.log('1. A Supabase Personal Access Token (from https://supabase.com/dashboard/account/tokens)')
console.log('2. The Supabase DB password (from https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/settings/database)')
console.log('')
console.log('The service role JWT key ONLY works for:')
console.log('  - CRUD operations via PostgREST (/rest/v1/)')
console.log('  - Auth admin operations (/auth/v1/admin/)')
console.log('  - Storage operations (/storage/v1/)')
console.log('  - Calling existing SQL functions via /rest/v1/rpc/')
console.log('')
console.log('It does NOT work for the Management API which requires your personal account token.')
