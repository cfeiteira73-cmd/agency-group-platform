// TEMPORARY DEBUG ROUTE — DELETE AFTER USE
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const ts = Date.now()
  const errors: string[] = []
  
  // Test ONLY confirmed COMBINED_OFFMARKET_MIGRATIONS columns for contacts:
  // full_name, email, phone, status, source, notes, preferred_locations,
  // last_contact_at, next_followup_at, timeline, role, whatsapp, lead_tier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t1: any = { full_name: `T1 ${ts}`, name: `T1 ${ts}`, email: `t1-${ts}@test.com`, status: 'lead', source: 'debug', notes: 'test', last_contact_at: new Date().toISOString() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r1 = await supabaseAdmin.from('contacts').insert(t1 as any).select('id').single()
  if (r1.error) errors.push(`T1(full_name+email+status+source+notes+last_contact_at): ${r1.error.code} — ${r1.error.message}`)
  else errors.push(`T1: OK — id=${r1.data?.id}`)

  // Try with preferred_locations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t2: any = { full_name: `T2 ${ts}`, name: `T2 ${ts}`, email: `t2-${ts}@test.com`, status: 'lead', preferred_locations: ['Lisboa'], next_followup_at: new Date(Date.now()+86400000).toISOString() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r2 = await supabaseAdmin.from('contacts').insert(t2 as any).select('id').single()
  if (r2.error) errors.push(`T2(+preferred_locations+next_followup_at): ${r2.error.code} — ${r2.error.message}`)
  else errors.push(`T2: OK`)

  const { data, error } = r1
  
  return NextResponse.json({ ok: !error, inserted_id: data?.id, errors })
}
