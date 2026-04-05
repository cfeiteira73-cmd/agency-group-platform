#!/usr/bin/env node
/**
 * Agency Group — Setup Verification Script
 * Run: node scripts/verify-setup.js
 */

const https = require('https')
require('dotenv').config({ path: '.env.local' })

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
]

console.log('\n🔍 Agency Group — Setup Verification\n')

// Check env vars
let allOk = true
for (const key of required) {
  const val = process.env[key]
  if (!val || val.includes('your-') || val === 'PREENCHER') {
    console.log(`  ✗ ${key}: NOT SET`)
    allOk = false
  } else {
    console.log(`  ✓ ${key}: ${val.slice(0, 20)}...`)
  }
}

if (!allOk) {
  console.log('\n❌ Missing required environment variables. Check .env.local\n')
  process.exit(1)
}

// Check Supabase connection
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
const opts = {
  hostname: url.hostname,
  path: '/rest/v1/contacts?select=id&limit=1',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

console.log('\n📡 Testing Supabase connection...')
https.get(opts, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    if (res.statusCode === 200) {
      const rows = JSON.parse(data)
      console.log(`  ✓ Supabase connected (${rows.length} contact(s) found)\n`)
      console.log('✅ Setup verified! Run: npm run dev\n')
    } else {
      console.log(`  ✗ Supabase returned ${res.statusCode}: ${data.slice(0, 100)}\n`)
    }
  })
}).on('error', e => console.log(`  ✗ Connection error: ${e.message}\n`))
