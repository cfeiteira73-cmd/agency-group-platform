/**
 * Migration runner v4 — Bootstrap approach
 *
 * Since we have service role access (bypasses RLS), we can use the
 * PostgREST schema introspection to check if we can POST to rpc/
 * endpoints that might run arbitrary SQL.
 *
 * Better approach: Use the Supabase Management API with a personal access token.
 * The token needs to be obtained from: https://supabase.com/dashboard/account/tokens
 *
 * This script accepts SUPABASE_ACCESS_TOKEN from env or command line.
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

// Check for personal access token (can be set as env var)
const pat = process.env.SUPABASE_ACCESS_TOKEN || env['SUPABASE_ACCESS_TOKEN']
const dbPassword = process.env.SUPABASE_DB_PASSWORD || env['SUPABASE_DB_PASSWORD']

console.log('Project ref:', projectRef)
console.log('PAT available:', pat ? 'YES' : 'NO')
console.log('DB password available:', dbPassword ? 'YES' : 'NO')

if (!pat && !dbPassword) {
  console.log('\n=== DIAGNOSIS: Missing credentials ===')
  console.log('To run migrations programmatically, you need ONE of:')
  console.log('')
  console.log('Option A — Supabase Personal Access Token:')
  console.log('  1. Go to https://supabase.com/dashboard/account/tokens')
  console.log('  2. Create a new token')
  console.log('  3. Run: SUPABASE_ACCESS_TOKEN=<token> node scripts/run-migrations-v4.mjs')
  console.log('')
  console.log('Option B — Supabase Database Password:')
  console.log('  1. Go to https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/settings/database')
  console.log('  2. Find "Database password" (reset if needed)')
  console.log('  3. Run: SUPABASE_DB_PASSWORD=<password> node scripts/run-migrations-v4.mjs')
  console.log('')
  console.log('Option C — Run the SQL manually in the Supabase Dashboard:')
  console.log('  URL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new')
  console.log('  File: supabase/migrations/COMBINED_RUN_IN_SUPABASE_DASHBOARD.sql')
  process.exit(1)
}

const sql = readFileSync('supabase/migrations/COMBINED_RUN_IN_SUPABASE_DASHBOARD.sql', 'utf8')

if (pat) {
  console.log('\n--- Using Management API with Personal Access Token ---')

  // Split SQL into individual statements, being careful with function bodies
  // Use a smarter split: split on lines that start with -- ===
  const migrations = sql.split(/-- ={10,}\n-- MIGRATION:.*\n-- ={10,}\n/).filter(s => s.trim())

  console.log(`Running ${migrations.length} migration blocks...`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < migrations.length; i++) {
    const block = migrations[i].trim()
    if (!block) continue

    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: block }),
      })
      const text = await res.text()
      if (res.ok) {
        console.log(`OK Block ${i+1}: success`)
        successCount++
      } else {
        console.log(`WARN Block ${i+1} (${res.status}): ${text.slice(0, 200)}`)
        // Try statement by statement
        console.log('  Retrying statement by statement...')
        const stmts = block.split(/;\s*\n/).filter(s => s.trim())
        for (let j = 0; j < stmts.length; j++) {
          const stmt = stmts[j].trim() + ';'
          if (stmt === ';') continue
          const res2 = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${pat}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: stmt }),
          })
          const t2 = await res2.text()
          if (res2.ok) {
            console.log(`    OK stmt ${j+1}: ok`)
            successCount++
          } else {
            const parsed = JSON.parse(t2)
            // Ignore "already exists" errors
            if (parsed.message?.includes('already exists')) {
              console.log(`    SKIP stmt ${j+1}: already exists (ok)`)
            } else {
              console.log(`    ERROR stmt ${j+1} (${res2.status}): ${t2.slice(0, 150)}`)
              errorCount++
            }
          }
        }
      }
    } catch (e) {
      console.log(`ERROR Block ${i+1}:`, e.message)
      errorCount++
    }
  }

  console.log(`\nDone. ${successCount} succeeded, ${errorCount} errors.`)
}

if (dbPassword) {
  console.log('\n--- Using direct PostgreSQL connection ---')
  try {
    const { default: pg } = await import('pg')

    const connectionStrings = [
      `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
      `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    ]

    for (const connStr of connectionStrings) {
      try {
        const displayStr = connStr.replace(dbPassword, '***')
        console.log('Trying:', displayStr)
        const client = new pg.Client({
          connectionString: connStr,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 15000
        })
        await client.connect()
        console.log('Connected! Running migrations...')
        await client.query(sql)
        await client.end()
        console.log('ALL MIGRATIONS EXECUTED SUCCESSFULLY via direct connection!')
        process.exit(0)
      } catch (e) {
        console.log(`  Failed: ${e.message.slice(0, 100)}`)
      }
    }
  } catch (e) {
    console.log('pg not available:', e.message)
  }
}
