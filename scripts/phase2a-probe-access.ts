#!/usr/bin/env node
// Probe: can we execute raw SQL via any available Supabase endpoint?
// READ-ONLY test query only. Never writes.
import * as fs from 'fs'
import * as path from 'path'

const envRaw = fs.readFileSync(path.resolve('.env.local'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL   = env.NEXT_PUBLIC_SUPABASE_URL  // https://isbfiofwpxqqpgxoftph.supabase.co
const KEY   = env.SUPABASE_SERVICE_ROLE_KEY
const ANON  = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const REF   = URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''

console.log('Project ref:', REF)
console.log('URL:', URL)
console.log('Service role key: PRESENT =', KEY?.length > 10)
console.log()

const SAFE_QUERY = "SELECT current_database() AS db, pg_postmaster_start_time() AS uptime"

async function tryEndpoint(label: string, url: string, body: string, headers: Record<string,string>) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    })
    const text = await res.text()
    console.log(`[${label}] status=${res.status} body=${text.slice(0, 200)}`)
    return { status: res.status, ok: res.ok, body: text }
  } catch (e: any) {
    console.log(`[${label}] ERROR: ${e.message}`)
    return { status: 0, ok: false, body: '' }
  }
}

async function main() {
  // 1. pg-meta endpoint (used by Supabase Studio)
  await tryEndpoint(
    'pg-meta/query (service_role)',
    `${URL}/pg/query`,
    JSON.stringify({ query: SAFE_QUERY }),
    { Authorization: `Bearer ${KEY}` }
  )

  // 2. Management API query endpoint (requires PAT, but try with service_role)
  await tryEndpoint(
    'management-api/query (service_role)',
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    JSON.stringify({ query: SAFE_QUERY }),
    { Authorization: `Bearer ${KEY}` }
  )

  // 3. Check if an exec_sql RPC exists in public schema
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(URL, KEY, { auth: { persistSession: false } })
  const { data, error } = await (db as any).rpc('exec_sql', { query: SAFE_QUERY })
  console.log(`[PostgREST/exec_sql] data=${JSON.stringify(data)} error=${JSON.stringify(error)}`)

  // 4. Check for pg_execute or similar
  const { data: d2, error: e2 } = await (db as any).rpc('pg_execute', { sql: SAFE_QUERY })
  console.log(`[PostgREST/pg_execute] data=${JSON.stringify(d2)} error=${JSON.stringify(e2)}`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
