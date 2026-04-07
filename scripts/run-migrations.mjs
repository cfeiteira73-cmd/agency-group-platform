import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Load env
const envContent = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) env[key.trim()] = vals.join('=').trim()
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY']
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

console.log('Project ref:', projectRef)
console.log('Supabase URL:', supabaseUrl)

// Read combined migration
const sql = readFileSync('supabase/migrations/COMBINED_RUN_IN_SUPABASE_DASHBOARD.sql', 'utf8')

// Approach 1: Management API with service role JWT
async function tryManagementAPI() {
  console.log('\n--- Trying Supabase Management API ---')

  // Split SQL into chunks (Management API has size limits)
  const chunks = sql.split(/;\s*\n/).filter(s => s.trim())

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim() + ';'
    if (!chunk || chunk === ';') continue

    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: chunk }),
      })
      const text = await res.text()
      if (res.ok) {
        console.log(`OK Statement ${i+1}: OK`)
      } else {
        console.log(`WARN Statement ${i+1} (${res.status}): ${text.slice(0, 200)}`)
      }
    } catch (e) {
      console.log(`ERROR Statement ${i+1} error:`, e.message)
    }
  }
}

// Approach 2: Try postgres direct via pg module
async function tryPostgresDirectConnection() {
  console.log('\n--- Trying direct PostgreSQL connection ---')
  try {
    const { default: pg } = await import('pg').catch(() => ({ default: null }))
    if (!pg) {
      console.log('pg module not available')
      return false
    }

    const connectionStrings = [
      `postgresql://postgres.${projectRef}:postgres@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${projectRef}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${projectRef}:postgres@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    ]

    for (const connStr of connectionStrings) {
      try {
        console.log('Trying:', connStr.replace(/:postgres@/, ':***@'))
        const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
        await client.connect()
        await client.query(sql)
        await client.end()
        console.log('Direct connection worked!')
        return true
      } catch (e) {
        console.log(`Connection failed: ${e.message.slice(0, 100)}`)
      }
    }
    return false
  } catch (e) {
    console.log('pg approach failed:', e.message)
    return false
  }
}

// Approach 3: Supabase REST API - execute via stored procedure
async function trySupabaseRPC() {
  console.log('\n--- Trying Supabase REST exec_sql RPC ---')

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  console.log(`Response (${res.status}):`, text.slice(0, 200))
  return res.ok
}

// Try all approaches
await tryManagementAPI()
const directOk = await tryPostgresDirectConnection()
if (!directOk) await trySupabaseRPC()
