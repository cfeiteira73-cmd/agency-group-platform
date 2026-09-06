import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { GeographyLevel } from '@/lib/database.types'

export const runtime = 'nodejs'

const VALID_LEVELS: GeographyLevel[] = [
  'COUNTRY', 'DISTRICT', 'MUNICIPALITY', 'PARISH', 'ZONE', 'AUTONOMOUS_REGION',
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const level   = searchParams.get('level') as GeographyLevel | null
  const country = searchParams.get('country')
  const parent  = searchParams.get('parent_id')
  const search  = searchParams.get('q')

  let query = supabaseAdmin
    .from('geography_nodes')
    .select('id, level, code, name_pt, name_en, name_fr, parent_id, country_code')
    .eq('is_active', true)
    .order('name_pt')
    .limit(200)

  if (level) {
    if (!VALID_LEVELS.includes(level)) {
      return NextResponse.json({ error: `Invalid level. Must be one of: ${VALID_LEVELS.join(', ')}` }, { status: 400 })
    }
    query = query.eq('level', level)
  }

  if (country) query = query.eq('country_code', country.toUpperCase())
  if (parent)  query = query.eq('parent_id', parent)
  if (search) {
    const safe = search.replace(/[%(),']/g, '').slice(0, 50)
    query = query.ilike('name_pt', `%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nodes: data })
}
