// =============================================================================
// AGENCY GROUP — CRM Contacts API v1.0
// GET  /api/crm  — list contacts (with filters + pagination)
// POST /api/crm  — create contact
// PATCH /api/crm — update contact (send ?id= in query or body)
// AMI: 22506 | Supabase-first, mock fallback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { CRMContact } from '@/app/portal/components/types'
import { safeCompare } from '@/lib/safeCompare'

// Typed shorthand for contacts table operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contactsTable = () => supabaseAdmin.from('contacts') as any

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContactRow    = Database['public']['Tables']['contacts']['Row']
type ContactInsert = Database['public']['Tables']['contacts']['Insert']
type ContactUpdate = Database['public']['Tables']['contacts']['Update']

interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  limit: number
  pages: number
  source: 'supabase' | 'mock'
}

// ---------------------------------------------------------------------------
// Response headers helper
// ---------------------------------------------------------------------------

function rateLimitHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  }
}

// ---------------------------------------------------------------------------
// Mock contacts — 10 realistic Portuguese real estate buyers
// ---------------------------------------------------------------------------

const MOCK_CONTACTS: ContactRow[] = [
  {
    id: '1', full_name: 'James Mitchell', email: 'james@mitchellcapital.com',
    phone: '+44 7700 900123', whatsapp: null, nationality: 'GB', language: 'en',
    role: 'investor', status: 'active', lead_tier: 'A', lead_score: 87,
    lead_score_breakdown: null, source: 'referral', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 800000, budget_max: 1500000,
    preferred_locations: ['Cascais', 'Estoril'], typologies_wanted: ['T3', 'T4'],
    bedrooms_min: 3, bedrooms_max: 4, features_required: ['pool', 'garage'],
    use_type: 'investment', timeline: '3months', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 88,
    last_contact_at: '2026-04-02T10:00:00Z', next_followup_at: '2026-04-05T09:00:00Z',
    total_interactions: 12, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-01-15T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: 'https://linkedin.com/in/jamesmitchell', company: 'Mitchell Capital',
    job_title: 'Managing Director', qualified_at: '2026-03-01T00:00:00Z',
    qualification_notes: 'Cash buyer, golden visa focused',
    ai_summary: 'HNWI investor seeking trophy asset in Cascais or Estoril line.',
    ai_suggested_action: 'Send off-market Cascais villa dossier',
    detected_intent: 'buy', tags: ['investor', 'golden_visa', 'cash_buyer'],
    notes: null, created_at: '2026-01-15T00:00:00Z', updated_at: '2026-04-02T10:00:00Z',
  },
  {
    id: '2', full_name: 'Pierre Dubois', email: 'p.dubois@gmail.com',
    phone: '+33 6 12 34 56 78', whatsapp: '+33612345678', nationality: 'FR', language: 'fr',
    role: 'buyer', status: 'active', lead_tier: 'A', lead_score: 82,
    lead_score_breakdown: null, source: 'website', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 600000, budget_max: 900000,
    preferred_locations: ['Lisboa', 'Chiado'], typologies_wanted: ['T2', 'T3'],
    bedrooms_min: 2, bedrooms_max: 3, features_required: ['balcony', 'elevator'],
    use_type: 'primary_residence', timeline: '3months', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 75,
    last_contact_at: '2026-04-01T14:00:00Z', next_followup_at: '2026-04-06T10:00:00Z',
    total_interactions: 7, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-02-01T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: 'Freelance Consultant', job_title: 'Consultant',
    qualified_at: '2026-03-10T00:00:00Z', qualification_notes: 'NHR relocation from Paris',
    ai_summary: 'French buyer looking for Chiado T3 for NHR relocation.',
    ai_suggested_action: 'Schedule visit for Chiado properties this week',
    detected_intent: 'buy', tags: ['nhr', 'relocation'],
    notes: null, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-04-01T14:00:00Z',
  },
  {
    id: '3', full_name: 'María García', email: 'mgarcia@empresarial.es',
    phone: '+34 91 234 5678', whatsapp: null, nationality: 'ES', language: 'es',
    role: 'buyer', status: 'prospect', lead_tier: 'B', lead_score: 71,
    lead_score_breakdown: null, source: 'idealista_premium', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 400000, budget_max: 700000,
    preferred_locations: ['Porto', 'Gaia'], typologies_wanted: ['T2', 'T3'],
    bedrooms_min: 2, bedrooms_max: 3, features_required: ['parking'],
    use_type: 'secondary_residence', timeline: '6months', financing_type: 'mortgage',
    property_to_sell_id: null, asking_price: null, motivation_score: 60,
    last_contact_at: '2026-03-28T11:00:00Z', next_followup_at: '2026-04-07T09:00:00Z',
    total_interactions: 4, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-02-15T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: 'Empresarial SL', job_title: 'CEO',
    qualified_at: null, qualification_notes: null,
    ai_summary: 'Spanish family looking for second residence in Porto area.',
    ai_suggested_action: 'Send Porto T3 selection with parking',
    detected_intent: 'buy', tags: ['family', 'segunda_residencia'],
    notes: null, created_at: '2026-02-15T00:00:00Z', updated_at: '2026-03-28T11:00:00Z',
  },
  {
    id: '4', full_name: 'Khalid Al-Rashid', email: 'khalid@alrashid.ae',
    phone: '+971 50 123 4567', whatsapp: '+971501234567', nationality: 'AE', language: 'ar',
    role: 'investor', status: 'active', lead_tier: 'A', lead_score: 94,
    lead_score_breakdown: null, source: 'referral', source_detail: 'Family Office Referral',
    referrer_id: null, assigned_to: null,
    budget_min: 2000000, budget_max: 5000000,
    preferred_locations: ['Lisboa', 'Cascais', 'Algarve'], typologies_wanted: ['V3', 'V4', 'V5'],
    bedrooms_min: 3, bedrooms_max: 6, features_required: ['pool', 'sea_view', 'garage'],
    use_type: 'investment', timeline: 'immediate', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 95,
    last_contact_at: '2026-04-03T16:00:00Z', next_followup_at: '2026-04-05T15:00:00Z',
    total_interactions: 18, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-01-10T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: 'Al-Rashid Group', job_title: 'Chairman',
    qualified_at: '2026-02-01T00:00:00Z', qualification_notes: 'HNWI family office, multi-property acquisition',
    ai_summary: 'Gulf HNWI seeking €2M–€5M villa portfolio across Lisboa, Cascais, Algarve.',
    ai_suggested_action: 'Present off-market Cascais V4 with pool and sea view immediately',
    detected_intent: 'invest', tags: ['hnwi', 'cash_buyer', 'investor'],
    notes: 'VIP — direct WhatsApp communication preferred', created_at: '2026-01-10T00:00:00Z', updated_at: '2026-04-03T16:00:00Z',
  },
  {
    id: '5', full_name: 'Sophie Hartmann', email: 'sophie.h@gmail.com',
    phone: '+49 89 1234 5678', whatsapp: null, nationality: 'DE', language: 'de',
    role: 'buyer', status: 'lead', lead_tier: 'B', lead_score: 65,
    lead_score_breakdown: null, source: 'instagram', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 350000, budget_max: 550000,
    preferred_locations: ['Algarve'], typologies_wanted: ['T2', 'V2'],
    bedrooms_min: 2, bedrooms_max: 3, features_required: ['pool', 'garden'],
    use_type: 'retirement', timeline: '6months', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 55,
    last_contact_at: '2026-03-25T09:00:00Z', next_followup_at: '2026-04-08T10:00:00Z',
    total_interactions: 3, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-03-01T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: null, job_title: 'Retired Teacher',
    qualified_at: null, qualification_notes: null,
    ai_summary: 'German retiree looking for Algarve villa under €550K for NHR benefit.',
    ai_suggested_action: 'Enrol in Algarve nurture sequence',
    detected_intent: 'buy', tags: ['retirement', 'nhr'],
    notes: null, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-25T09:00:00Z',
  },
  {
    id: '6', full_name: 'Carlos Mendes', email: 'cmendes@hotmail.com',
    phone: '+351 91 234 5678', whatsapp: '+351912345678', nationality: 'PT', language: 'pt',
    role: 'buyer', status: 'client', lead_tier: 'A', lead_score: 79,
    lead_score_breakdown: null, source: 'referral', source_detail: 'Client referral',
    referrer_id: null, assigned_to: null,
    budget_min: 300000, budget_max: 500000,
    preferred_locations: ['Lisboa', 'Oeiras'], typologies_wanted: ['T3', 'T4'],
    bedrooms_min: 3, bedrooms_max: 4, features_required: ['garage', 'garden'],
    use_type: 'primary_residence', timeline: '3months', financing_type: 'mortgage',
    property_to_sell_id: null, asking_price: null, motivation_score: 78,
    last_contact_at: '2026-04-04T08:00:00Z', next_followup_at: '2026-04-10T10:00:00Z',
    total_interactions: 22, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2025-11-01T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: 'Freelancer', job_title: 'IT Consultant',
    qualified_at: '2025-12-01T00:00:00Z', qualification_notes: 'Referred by João Silva; pre-approved mortgage €480K',
    ai_summary: 'Portuguese IT professional buying primary residence in Lisboa/Oeiras.',
    ai_suggested_action: 'Follow up on Oeiras T4 visit feedback',
    detected_intent: 'buy', tags: ['existing_client', 'referral'],
    notes: 'Very responsive on WhatsApp', created_at: '2025-11-01T00:00:00Z', updated_at: '2026-04-04T08:00:00Z',
  },
  {
    id: '7', full_name: 'Ana Beatriz Costa', email: 'ana.costa@email.com',
    phone: '+351 96 345 6789', whatsapp: '+351963456789', nationality: 'PT', language: 'pt',
    role: 'buyer', status: 'active', lead_tier: 'B', lead_score: 58,
    lead_score_breakdown: null, source: 'website', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 150000, budget_max: 280000,
    preferred_locations: ['Setúbal', 'Almada'], typologies_wanted: ['T2', 'T3'],
    bedrooms_min: 2, bedrooms_max: 3, features_required: ['elevator'],
    use_type: 'primary_residence', timeline: '6months', financing_type: 'mortgage',
    property_to_sell_id: null, asking_price: null, motivation_score: 50,
    last_contact_at: '2026-03-20T11:00:00Z', next_followup_at: '2026-04-12T10:00:00Z',
    total_interactions: 5, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-03-01T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: null, job_title: 'Nurse',
    qualified_at: null, qualification_notes: null,
    ai_summary: 'First-time buyer looking for Setúbal/Almada T2–T3 under €280K with mortgage.',
    ai_suggested_action: 'Send mortgage pre-qualification guide + property selection',
    detected_intent: 'buy', tags: ['first_buyer', 'financing'],
    notes: null, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-20T11:00:00Z',
  },
  {
    id: '8', full_name: 'Roberto Fontana', email: 'r.fontana@gmail.com',
    phone: '+55 11 9 8765 4321', whatsapp: '+551198765432', nationality: 'BR', language: 'pt',
    role: 'buyer', status: 'lead', lead_tier: 'C', lead_score: 44,
    lead_score_breakdown: null, source: 'instagram', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 200000, budget_max: 400000,
    preferred_locations: ['Lisboa', 'Porto'], typologies_wanted: ['T1', 'T2'],
    bedrooms_min: 1, bedrooms_max: 2, features_required: [],
    use_type: 'relocation', timeline: '6months', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 40,
    last_contact_at: '2026-03-15T13:00:00Z', next_followup_at: '2026-04-15T10:00:00Z',
    total_interactions: 2, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-03-10T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: null, company: 'Self-employed', job_title: 'Developer',
    qualified_at: null, qualification_notes: null,
    ai_summary: 'Brazilian developer exploring relocation to Portugal, EU visa interest.',
    ai_suggested_action: 'Add to Brazil relocation drip sequence',
    detected_intent: 'buy', tags: ['relocation', 'eu_visa'],
    notes: null, created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-15T13:00:00Z',
  },
  {
    id: '9', full_name: 'Charlotte Blake', email: 'charlotte.b@outlook.com',
    phone: '+44 20 7946 0958', whatsapp: null, nationality: 'GB', language: 'en',
    role: 'investor', status: 'prospect', lead_tier: 'B', lead_score: 73,
    lead_score_breakdown: null, source: 'linkedin', source_detail: null,
    referrer_id: null, assigned_to: null,
    budget_min: 700000, budget_max: 1200000,
    preferred_locations: ['Lisboa', 'Cascais'], typologies_wanted: ['T3', 'T4'],
    bedrooms_min: 3, bedrooms_max: 4, features_required: ['renovation_potential'],
    use_type: 'investment', timeline: '3months', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 68,
    last_contact_at: '2026-03-30T15:00:00Z', next_followup_at: '2026-04-08T10:00:00Z',
    total_interactions: 6, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2026-02-20T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: 'https://linkedin.com/in/charlotteblake', company: 'Blake Ventures',
    job_title: 'Property Investor', qualified_at: '2026-03-15T00:00:00Z',
    qualification_notes: 'Looking for renovation project in Lisboa or Cascais',
    ai_summary: 'British investor seeking renovation project for NHR and yield.',
    ai_suggested_action: 'Send selection of Chiado/Cascais renovation opportunities',
    detected_intent: 'invest', tags: ['investor', 'nhr', 'renovation'],
    notes: null, created_at: '2026-02-20T00:00:00Z', updated_at: '2026-03-30T15:00:00Z',
  },
  {
    id: '10', full_name: 'Marco Aurelio Santos', email: 'marco.santos@investimentos.com',
    phone: '+351 91 987 6543', whatsapp: '+351919876543', nationality: 'PT', language: 'pt',
    role: 'investor', status: 'vip', lead_tier: 'A', lead_score: 91,
    lead_score_breakdown: null, source: 'referral', source_detail: 'Board member referral',
    referrer_id: null, assigned_to: null,
    budget_min: 1000000, budget_max: 3000000,
    preferred_locations: ['Lisboa', 'Cascais', 'Sintra'], typologies_wanted: ['V3', 'V4'],
    bedrooms_min: 3, bedrooms_max: 5, features_required: ['pool', 'garage', 'garden'],
    use_type: 'investment', timeline: 'immediate', financing_type: 'cash',
    property_to_sell_id: null, asking_price: null, motivation_score: 92,
    last_contact_at: '2026-04-04T10:00:00Z', next_followup_at: '2026-04-06T09:00:00Z',
    total_interactions: 35, opt_out_marketing: false, opt_out_whatsapp: false,
    gdpr_consent: true, gdpr_consent_at: '2025-09-01T00:00:00Z',
    enriched_at: null, clearbit_data: null, apollo_data: null,
    linkedin_url: 'https://linkedin.com/in/marcoaurelio', company: 'Santos Investimentos',
    job_title: 'CEO & Founder', qualified_at: '2025-10-01T00:00:00Z',
    qualification_notes: 'VIP multi-property investor; close personal relationship',
    ai_summary: 'Top VIP client building premium property portfolio across greater Lisboa.',
    ai_suggested_action: 'Present Sintra V4 off-market + Cascais waterfront exclusive',
    detected_intent: 'invest', tags: ['vip', 'multi_property', 'investor'],
    notes: 'Personal WhatsApp. Never email without prior call.', created_at: '2025-09-01T00:00:00Z', updated_at: '2026-04-04T10:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// GET /api/crm
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100)
    const page   = Math.max(parseInt(searchParams.get('page')   ?? '1'),  1)
    const status = searchParams.get('status')
    const tier   = searchParams.get('tier')
    const search = searchParams.get('search')?.toLowerCase()
    const zone   = searchParams.get('zone')

    // --- Try Supabase ---
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = contactsTable()
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (status) query = query.eq('status', status)
      if (tier)   query = query.eq('lead_tier', tier)
      if (zone)   query = query.contains('preferred_locations', [zone])
      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query

      if (!error && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row) => ({
          id: typeof row.id === 'number' ? row.id : parseInt(String(row.id), 10) || 0,
          name: row.full_name || row.name || '',
          email: row.email || '',
          phone: row.phone || '',
          nationality: row.nationality || '',
          budgetMin: row.budget_min || 0,
          budgetMax: row.budget_max || 0,
          tipos: Array.isArray(row.typologies_wanted) ? row.typologies_wanted : (Array.isArray(row.tipos) ? row.tipos : []),
          zonas: Array.isArray(row.preferred_locations) ? row.preferred_locations : (Array.isArray(row.zonas) ? row.zonas : []),
          // Map Supabase enum 'client' → portal Portuguese 'cliente'
          status: row.status === 'client' ? 'cliente' : (row.status || 'lead'),
          notes: row.notes || '',
          lastContact: row.last_contact_at || row.last_contact || '',
          nextFollowUp: row.next_followup_at || '',
          dealRef: '',
          origin: row.source || row.origin || '',
          createdAt: row.created_at || '',
          language: row.language ? (row.language as string).toUpperCase() as CRMContact['language'] : undefined,
          source: row.source || '',
          leadScore: row.lead_score || 0,
          leadTier: row.lead_tier || null,
          company: row.company || '',
          jobTitle: row.job_title || '',
          aiSummary: row.ai_summary || '',
          aiSuggestedAction: row.ai_suggested_action || '',
          tags: Array.isArray(row.tags) ? row.tags : [],
          agentId: row.agent_id || row.assigned_to || null,
        }))

        const response = {
          data:   mapped,
          count:  count ?? mapped.length,
          page,
          limit,
          pages: Math.ceil((count ?? mapped.length) / limit),
          source: 'supabase' as const,
        }
        return NextResponse.json(response, { headers: rateLimitHeaders() })
      }
    } catch {
      // Supabase unavailable — fall through to mock
    }

    // --- Mock fallback ---
    let filtered = [...MOCK_CONTACTS]

    if (status) filtered = filtered.filter(c => c.status === status)
    if (tier)   filtered = filtered.filter(c => c.lead_tier === tier)
    if (zone)   filtered = filtered.filter(c => c.preferred_locations?.includes(zone))
    if (search) {
      filtered = filtered.filter(c =>
        c.full_name.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.toLowerCase().includes(search)
      )
    }

    const total  = filtered.length
    const sliced = filtered.slice((page - 1) * limit, page * limit)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedMock = sliced.map((row: any) => ({
      id: typeof row.id === 'number' ? row.id : parseInt(String(row.id), 10) || 0,
      name: row.full_name || row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      nationality: row.nationality || '',
      budgetMin: row.budget_min || 0,
      budgetMax: row.budget_max || 0,
      tipos: Array.isArray(row.typologies_wanted) ? row.typologies_wanted : [],
      zonas: Array.isArray(row.preferred_locations) ? row.preferred_locations : [],
      status: row.status || 'lead',
      notes: row.notes || '',
      lastContact: row.last_contact_at || '',
      nextFollowUp: row.next_followup_at || '',
      dealRef: '',
      origin: row.source || '',
      createdAt: row.created_at || '',
      language: row.language ? (row.language as string).toUpperCase() as CRMContact['language'] : undefined,
      leadScore: row.lead_score || 0,
      leadTier: row.lead_tier || null,
      company: row.company || '',
      jobTitle: row.job_title || '',
      aiSummary: row.ai_summary || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
    }))

    return NextResponse.json({
      data:   mappedMock,
      count:  total,
      page,
      limit,
      pages:  Math.ceil(total / limit),
      source: 'mock',
    }, { headers: rateLimitHeaders() })
  } catch (error) {
    console.error('[CRM GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitHeaders() }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm — create contact
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body: unknown = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be JSON object' }, { status: 400, headers: rateLimitHeaders() })
    }

    const input = body as Record<string, unknown>

    if (!input.full_name || typeof input.full_name !== 'string') {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    const contact: ContactInsert = {
      full_name:           String(input.full_name).trim(),
      email:               typeof input.email    === 'string' ? input.email.trim()    : null,
      phone:               typeof input.phone    === 'string' ? input.phone.trim()    : null,
      whatsapp:            typeof input.whatsapp === 'string' ? input.whatsapp.trim() : null,
      nationality:         typeof input.nationality === 'string' ? input.nationality.toUpperCase() : null,
      language:            typeof input.language    === 'string' ? input.language.toLowerCase()    : null,
      role:                (input.role as ContactInsert['role']) ?? 'buyer',
      // Map portal Portuguese 'cliente' → Supabase enum 'client'
      status:              (input.status === 'cliente' ? 'client' : input.status) as ContactInsert['status'] ?? 'lead',
      lead_tier:           (input.lead_tier as ContactInsert['lead_tier']) ?? null,
      budget_min:          typeof input.budget_min === 'number' ? input.budget_min : null,
      budget_max:          typeof input.budget_max === 'number' ? input.budget_max : null,
      preferred_locations: Array.isArray(input.preferred_locations) ? input.preferred_locations as string[] : null,
      typologies_wanted:   Array.isArray(input.typologies_wanted)   ? input.typologies_wanted as string[]   : null,
      source:              typeof input.source   === 'string' ? input.source.trim()   : null,
      timeline:            typeof input.timeline === 'string' ? input.timeline.trim() : null,
      financing_type:      typeof input.financing_type === 'string' ? input.financing_type.trim() : null,
      tags:                Array.isArray(input.tags) ? input.tags as string[] : null,
      notes:               typeof input.notes === 'string' ? input.notes.trim() : null,
      gdpr_consent:        input.gdpr_consent === true,
      gdpr_consent_at:     input.gdpr_consent === true ? new Date().toISOString() : null,
    }

    // ── Deduplication check ─────────────────────────────────────────────────
    // Before inserting, look for an existing contact by email OR phone.
    // If found, return the existing record (no duplicate created).
    try {
      const orFilter = [
        contact.email    ? `email.eq.${contact.email}`    : '',
        contact.phone    ? `phone.eq.${contact.phone}`    : '',
        contact.whatsapp ? `whatsapp.eq.${contact.whatsapp}` : '',
      ].filter(Boolean).join(',')

      if (orFilter) {
        const { data: existing } = await contactsTable()
          .select('id, full_name, email, phone')
          .or(orFilter)
          .limit(1)
          .single()

        if (existing) {
          // Update last-seen timestamp so CRM stays fresh
          await contactsTable()
            .update({ updated_at: new Date().toISOString() })
            .eq('id', existing.id)

          return NextResponse.json(
            {
              id: existing.id,
              merged: true,
              message: 'Contacto existente actualizado',
              source: 'supabase',
            },
            { status: 200, headers: rateLimitHeaders() }
          )
        }
      }
    } catch {
      // Dedup query failed — proceed to insert (fail-open to avoid data loss)
    }

    // Try Supabase insert
    try {
      const { data, error } = await contactsTable()
        .insert(contact)
        .select()
        .single()

      if (!error && data) {
        return NextResponse.json({ data, source: 'supabase' }, { status: 201, headers: rateLimitHeaders() })
      }

      if (error) {
        console.warn('[CRM POST] Supabase error:', error.message)
      }
    } catch {
      // Supabase unavailable
    }

    // Return mock success with generated id
    const mockResult: ContactRow = {
      ...contact,
      id:                     crypto.randomUUID(),
      whatsapp:               contact.whatsapp ?? null,
      language:               contact.language ?? null,
      lead_score:             null,
      lead_score_breakdown:   null,
      source_detail:          null,
      referrer_id:            null,
      assigned_to:            null,
      bedrooms_min:           null,
      bedrooms_max:           null,
      features_required:      null,
      use_type:               null,
      property_to_sell_id:    null,
      asking_price:           null,
      motivation_score:       null,
      last_contact_at:        null,
      next_followup_at:       null,
      total_interactions:     0,
      opt_out_marketing:      false,
      opt_out_whatsapp:       false,
      gdpr_consent_at:        contact.gdpr_consent ? new Date().toISOString() : null,
      enriched_at:            null,
      clearbit_data:          null,
      apollo_data:            null,
      linkedin_url:           null,
      company:                null,
      job_title:              null,
      qualified_at:           null,
      qualification_notes:    null,
      ai_summary:             null,
      ai_suggested_action:    null,
      detected_intent:        null,
      created_at:             new Date().toISOString(),
      updated_at:             new Date().toISOString(),
    } as ContactRow

    return NextResponse.json(
      { data: mockResult, source: 'mock', warning: 'Supabase unavailable — contact not persisted' },
      { status: 201, headers: rateLimitHeaders() }
    )
  } catch (error) {
    console.error('[CRM POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitHeaders() }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/crm?id=<uuid> — update contact
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be JSON object' }, { status: 400, headers: rateLimitHeaders() })
    }

    const input = body as Record<string, unknown>
    const contactId: string | null = id ?? (typeof input.id === 'string' ? input.id : null)
    // Support email-based lookup when numeric id unavailable (contacts loaded from Supabase have UUID→parseInt=0)
    const contactEmail: string | null = typeof input._email === 'string' ? input._email : null

    if (!contactId && !contactEmail) {
      return NextResponse.json({ error: 'id or _email is required (query param or body field)' }, { status: 400, headers: rateLimitHeaders() })
    }

    // ── Field allowlist — prevent privilege escalation via mass-assignment ────
    // Only portal-legitimate update fields are permitted. Sensitive fields such as
    // gdpr_consent, lead_score_breakdown, clearbit_data, apollo_data, role, referrer_id
    // and all id/timestamp fields are explicitly excluded.
    const ALLOWED_PATCH_FIELDS = new Set([
      'nome', 'email', 'telefone', 'whatsapp', 'budget_min', 'budget_max',
      'nacionalidade', 'zona_interesse', 'tipologia', 'notas', 'tags',
      'pipeline_stage', 'lead_score', 'lingua_preferida', 'nhr_interesse',
      'fonte', 'proxima_acao', 'data_proxima_acao', 'investidor', 'status',
      // DB column names (used by portal directly)
      'full_name', 'phone', 'nationality', 'language', 'source', 'source_detail',
      'lead_tier', 'assigned_to', 'preferred_locations', 'typologies_wanted',
      'bedrooms_min', 'bedrooms_max', 'features_required', 'use_type', 'timeline',
      'financing_type', 'motivation_score', 'last_contact_at', 'next_followup_at',
      'opt_out_marketing', 'opt_out_whatsapp', 'linkedin_url', 'company',
      'job_title', 'qualified_at', 'qualification_notes', 'ai_summary',
      'ai_suggested_action',
    ])

    const safeInput: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (ALLOWED_PATCH_FIELDS.has(key)) {
        safeInput[key] = value
      }
    }
    if (Object.keys(safeInput).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400, headers: rateLimitHeaders() })
    }

    // Build update object — only allowed fields (typed against ContactUpdate schema)
    const ALLOWED_FIELDS: (keyof ContactUpdate)[] = [
      'full_name', 'email', 'phone', 'whatsapp', 'nationality', 'language',
      'role', 'status', 'lead_tier', 'lead_score', 'source', 'source_detail',
      'assigned_to', 'budget_min', 'budget_max', 'preferred_locations',
      'typologies_wanted', 'bedrooms_min', 'bedrooms_max', 'features_required',
      'use_type', 'timeline', 'financing_type', 'motivation_score',
      'last_contact_at', 'next_followup_at', 'opt_out_marketing', 'opt_out_whatsapp',
      'linkedin_url', 'company', 'job_title', 'qualified_at', 'qualification_notes',
      'ai_summary', 'ai_suggested_action', 'tags', 'notes',
    ]

    const updates: ContactUpdate = { updated_at: new Date().toISOString() }
    for (const field of ALLOWED_FIELDS) {
      if (field in safeInput) {
        (updates as Record<string, unknown>)[field] = safeInput[field]
      }
    }
    // Map portal Portuguese status values to Supabase enum values
    if (typeof (updates as Record<string, unknown>).status === 'string') {
      const statusMap: Record<string, string> = { cliente: 'client' }
      const s = (updates as Record<string, unknown>).status as string
      if (statusMap[s]) (updates as Record<string, unknown>).status = statusMap[s]
    }

    // Try Supabase — prefer UUID id, fall back to email lookup
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = contactsTable().update(updates)
      if (contactId) {
        query = query.eq('id', contactId)
      } else if (contactEmail) {
        query = query.eq('email', contactEmail)
      }
      const { data, error } = await query.select().single()

      if (!error && data) {
        return NextResponse.json({ data, source: 'supabase' }, { headers: rateLimitHeaders() })
      }

      if (error) {
        console.warn('[CRM PATCH] Supabase error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 404, headers: rateLimitHeaders() })
      }
    } catch {
      // Supabase unavailable
    }

    // Mock fallback — return the merged mock contact or generic confirmation
    const mockContact = MOCK_CONTACTS.find(c => c.id === contactId)
    const merged = mockContact ? { ...mockContact, ...updates, id: contactId } : { id: contactId, ...updates }

    return NextResponse.json(
      { data: merged, source: 'mock', warning: 'Supabase unavailable — update not persisted' },
      { headers: rateLimitHeaders() }
    )
  } catch (error) {
    console.error('[CRM PATCH]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitHeaders() }
    )
  }
}
