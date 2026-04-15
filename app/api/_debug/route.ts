// TEMPORARY DEBUG ROUTE — DELETE AFTER USE
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const ts = Date.now()
  const errors: string[] = []
  
  // Test each column individually
  const columns: Record<string, unknown> = {
    full_name: `Debug ${ts}`,
    email: `debug-col-${ts}@test.com`,
    status: 'lead',
    source: 'debug',
    notes: 'test',
    preferred_locations: ['Lisboa'],
    timeline: '6months',
    next_followup_at: new Date(Date.now() + 86400000).toISOString(),
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  
  // Try insert with all columns
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert(columns)
    .select('id')
    .single()
  
  if (error) {
    errors.push(`full_payload: ${error.code} — ${error.message}`)
    
    // Try with just the minimal set
    const { error: e2 } = await supabaseAdmin
      .from('contacts')
      .insert({ full_name: `Min ${ts}`, email: `min-${ts}@test.com`, status: 'lead' })
      .select('id')
      .single()
    if (e2) errors.push(`minimal: ${e2.code} — ${e2.message}`)
    else errors.push('minimal: OK')
  }
  
  return NextResponse.json({ ok: !error, inserted_id: data?.id, errors })
}
