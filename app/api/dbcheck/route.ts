// TEMPORARY DEBUG ROUTE — DELETE AFTER USE
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const ts = Date.now()
  const errors: string[] = []
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: any = {
    agent_email: 'geral@agencygroup.pt',
    name: `Debug ${ts}`,
    full_name: `Debug ${ts}`,
    email: `debug-col-${ts}@test.com`,
    status: 'lead',
    source: 'debug',
    origin: 'website',
    notes: 'test',
    last_contact_at: new Date().toISOString(),
  }

  // Try insert with all columns
  const { data, error } = await supabaseAdmin
    .from('contacts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(columns as any)
    .select('id')
    .single()

  if (error) {
    errors.push(`full_payload: ${error.code} — ${error.message}`)

    // Try with just the minimal set — name + agent_email (schema.sql NOT NULL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e2 } = await supabaseAdmin.from('contacts').insert({ agent_email: 'geral@agencygroup.pt', name: `Min ${ts}`, email: `min-${ts}@test.com`, status: 'lead' } as any).select('id').single()
    if (e2) errors.push(`minimal: ${e2.code} — ${e2.message}`)
    else errors.push('minimal: OK')
  }
  
  return NextResponse.json({ ok: !error, inserted_id: data?.id, errors })
}
