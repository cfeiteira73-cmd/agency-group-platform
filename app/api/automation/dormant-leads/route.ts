import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, name, email, phone, last_contact, lead_score, status, zonas, tipos')
      .in('status', ['lead', 'prospect'])
      .or(`last_contact.lt.${cutoffStr},last_contact.is.null`)
      .order('lead_score', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({
      dormant: data || [],
      count: data?.length || 0,
      cutoff_date: cutoffStr,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    // Mock fallback
    return NextResponse.json({
      dormant: [],
      count: 0,
      source: 'error',
      error: String(error),
    })
  }
}
