import { readFileSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) env[key.trim()] = vals.join('=').trim()
}

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

// Test connection
const { data, error } = await supabase.from('properties').select('id').limit(1)
console.log('Connection test:', error ? 'ERROR: ' + error.message : 'OK (properties table accessible)')

// Test deals table
const { data: dealData, error: dealError } = await supabase.from('deals').select('id').limit(1)
console.log('Deals table test:', dealError ? 'ERROR: ' + dealError.message : 'OK')

// Check what tables already exist
const { data: tables, error: tablesError } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public')
  .order('table_name')

if (tablesError) {
  console.log('Cannot query information_schema directly:', tablesError.message)
  // Try via RPC
} else {
  console.log('Existing tables:', tables?.map(t => t.table_name).join(', '))
}

// Check for sofia_memory, crm_tasks, crm_followups, deal_stage_history
const tablesToCheck = ['sofia_memory', 'crm_tasks', 'crm_followups', 'deal_stage_history']
for (const tbl of tablesToCheck) {
  const { data, error } = await supabase.from(tbl).select('id').limit(1)
  console.log(`Table ${tbl}:`, error ? `MISSING (${error.code}: ${error.message.slice(0, 60)})` : 'EXISTS')
}

// Check if properties has embedding column
const { data: propSample, error: propErr } = await supabase
  .from('properties')
  .select('id, embedding')
  .limit(1)
console.log('properties.embedding column:', propErr ? `MISSING (${propErr.message.slice(0, 80)})` : 'EXISTS')

const url = env['NEXT_PUBLIC_SUPABASE_URL']
const key = env['SUPABASE_SERVICE_ROLE_KEY']

// Try the pg/query endpoint
const res = await fetch(`${url}/pg/query`, {
  method: 'POST',
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'SELECT current_database()' })
})
console.log('\npg/query response:', res.status, (await res.text()).slice(0, 200))

// Try the database REST endpoint (newer Supabase)
const res2 = await fetch(`${url}/rest/v1/`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
console.log('REST root:', res2.status)
