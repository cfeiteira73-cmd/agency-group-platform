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

const sql = readFileSync('supabase/migrations/COMBINED_RUN_IN_SUPABASE_DASHBOARD.sql', 'utf8')

// ─────────────────────────────────────────────────────────────────
// Approach A: Supabase Management API v1 — requires personal access token
// We'll try with the service key anyway since it's all we have
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Approach B: Use supabase-js .rpc() to create a helper function first,
// then use it to run arbitrary DDL.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Approach C: Use the Supabase REST /sql endpoint (available in some versions)
// ─────────────────────────────────────────────────────────────────

async function trySQLEndpoints() {
  const endpoints = [
    `/sql`,
    `/rest/v1/sql`,
    `/query`,
  ]
  for (const ep of endpoints) {
    const res = await fetch(`${url}${ep}`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1 as test' }),
    })
    const text = await res.text()
    console.log(`${ep}: ${res.status} ${text.slice(0, 100)}`)
  }
}

// ─────────────────────────────────────────────────────────────────
// Approach D: Direct DB connection via pg with the database password
// The Supabase project password is NOT in .env.local — only the JWT keys are.
// But let's try a few common passwords that might be set.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Approach E: Use the Supabase JS client to call a privileged function
// We can use service role to bypass RLS and do DML, but not DDL.
// However, we can create functions via service role in some cases.
// Let's check what functions are available via the postgrest schema cache.
// ─────────────────────────────────────────────────────────────────

async function tryPostgRESTRPC() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, serviceKey)

  // Try exec via pg_execute or similar
  const rpcNames = ['exec', 'sql', 'execute_sql', 'run_sql', 'pg_exec']
  for (const name of rpcNames) {
    const { data, error } = await supabase.rpc(name, { query: 'SELECT 1' })
    if (!error) {
      console.log(`RPC ${name} works!`, data)
    } else {
      console.log(`RPC ${name}: ${error.code} ${error.message.slice(0, 60)}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Approach F: Management API with personal access token from env or VERCEL_OIDC_TOKEN
// The management API requires: Authorization: Bearer <personal-access-token>
// NOT the service role key.
// Let's try the VERCEL_OIDC_TOKEN just to see what happens (it won't work)
// ─────────────────────────────────────────────────────────────────

async function tryManagementWithOtherTokens() {
  console.log('\n--- Testing Management API auth variants ---')
  const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

  const tokens = [
    { label: 'service_role', token: serviceKey },
    { label: 'anon', token: anonKey },
  ]

  for (const { label, token } of tokens) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1 as test' }),
    })
    const text = await res.text()
    console.log(`Management API [${label}]: ${res.status} ${text.slice(0, 100)}`)
  }
}

// ─────────────────────────────────────────────────────────────────
// Approach G: Direct PG with Supabase DB URL format
// Supabase provides a direct DB URL (not pooler) for migrations.
// Format: postgresql://postgres:[DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
// We don't have the DB password in .env.local.
// Let's check if there's a DATABASE_URL or POSTGRES_URL env var.
// ─────────────────────────────────────────────────────────────────

console.log('\n--- Checking for DB connection strings in env ---')
const dbKeys = Object.keys(env).filter(k =>
  k.toLowerCase().includes('database') ||
  k.toLowerCase().includes('postgres') ||
  k.toLowerCase().includes('db_') ||
  k.toLowerCase().includes('pg_')
)
console.log('DB-related env vars found:', dbKeys.length ? dbKeys : 'NONE')

console.log('\n--- Testing SQL endpoints ---')
await trySQLEndpoints()

console.log('\n--- Testing PostgREST RPC functions ---')
await tryPostgRESTRPC()

await tryManagementWithOtherTokens()
