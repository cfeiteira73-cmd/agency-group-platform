// =============================================================================
// AGENCY GROUP — Notifications API v1.0
// GET  /api/notifications       — get user notifications
// POST /api/notifications/read  — mark notification(s) as read
//   Returns: { unread: number, notifications: [...] }
// AMI: 22506 | Smart alert generation + Supabase-first, mock fallback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Typed shorthand — bypasses PostgrestVersion: "12" never-type issue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notificationsTable = () => supabaseAdmin.from('notifications') as any

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType = 'alert' | 'warning' | 'info' | 'success'

interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  read: boolean
  deal_id: string | null
  contact_id: string | null
  created_at: string
}

interface NotificationsResponse {
  unread: number
  notifications: AppNotification[]
  source: 'supabase' | 'mock'
}

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------

function responseHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  }
}

// ---------------------------------------------------------------------------
// Smart alert generation logic
// ---------------------------------------------------------------------------

interface DealAlert {
  id: string
  stage: string
  property: string
  contact: string
  days_in_stage: number
  health: number
}

interface FollowUpAlert {
  contact_id: string
  full_name: string
  follow_up_date: string
}

function generateDealStallAlerts(deals: DealAlert[]): AppNotification[] {
  return deals
    .filter(d => d.days_in_stage > 14)
    .map(d => ({
      id:         `stall-${d.id}`,
      type:       (d.health < 50 ? 'alert' : 'warning') as NotificationType,
      title:      `Deal parado: ${d.property}`,
      body:       `${d.contact} está há ${d.days_in_stage} dias em "${d.stage}". Health score: ${d.health}/100. Acção necessária.`,
      link:       `/deals/${d.id}`,
      read:       false,
      deal_id:    d.id,
      contact_id: null,
      created_at: new Date().toISOString(),
    }))
}

function generateFollowUpAlerts(contacts: FollowUpAlert[]): AppNotification[] {
  const today = new Date()
  return contacts
    .filter(c => {
      const followUp = new Date(c.follow_up_date)
      return followUp <= today
    })
    .map(c => {
      const followUp = new Date(c.follow_up_date)
      const isOverdue = followUp < today
      return {
        id:         `followup-${c.contact_id}`,
        type:       (isOverdue ? 'alert' : 'info') as NotificationType,
        title:      isOverdue ? `Follow-up em atraso: ${c.full_name}` : `Follow-up hoje: ${c.full_name}`,
        body:       isOverdue
          ? `O follow-up com ${c.full_name} estava agendado para ${c.follow_up_date} e não foi feito.`
          : `Follow-up agendado para hoje com ${c.full_name}.`,
        link:       `/crm/${c.contact_id}`,
        read:       false,
        deal_id:    null,
        contact_id: c.contact_id,
        created_at: new Date().toISOString(),
      }
    })
}

// ---------------------------------------------------------------------------
// Mock notification generation (always returns 5-8 smart alerts)
// ---------------------------------------------------------------------------

function generateMockNotifications(): AppNotification[] {
  const stalledDeals: DealAlert[] = [
    { id: 'AG-2026-0009', stage: 'Proposta',   property: 'T2 Príncipe Real',  contact: 'Charlotte Blake',   days_in_stage: 18, health: 55 },
    { id: 'AG-2026-0005', stage: 'Negociação', property: 'Villa Algarve',     contact: 'Roberto Fontana',   days_in_stage: 25, health: 42 },
    { id: 'AG-2026-0007', stage: 'Escritura',  property: 'T4 Belém',          contact: 'Marco Aurelio Santos', days_in_stage: 22, health: 95 },
  ]

  const todayStr    = new Date().toISOString().slice(0, 10)
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const followUpContacts: FollowUpAlert[] = [
    { contact_id: '1',  full_name: 'James Mitchell',       follow_up_date: todayStr    },
    { contact_id: '4',  full_name: 'Khalid Al-Rashid',     follow_up_date: todayStr    },
    { contact_id: '10', full_name: 'Marco Aurelio Santos',  follow_up_date: tomorrowStr },
    { contact_id: '2',  full_name: 'Pierre Dubois',        follow_up_date: tomorrowStr },
  ]

  const stallAlerts    = generateDealStallAlerts(stalledDeals)
  const followUpAlerts = generateFollowUpAlerts(followUpContacts)

  // Static intelligence alerts
  const intelAlerts: AppNotification[] = [
    {
      id:         'signal-inherit-001',
      type:       'info',
      title:      'Novo sinal: Herança Cascais',
      body:       'Moradia V4 em Cascais identificada em partilha de herança. Valor estimado €1.8M. Acção recomendada: contactar herdeiros.',
      link:       '/signals',
      read:       false,
      deal_id:    null,
      contact_id: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id:         'signal-price-drop-002',
      type:       'info',
      title:      'Redução de preço: Chiado T3',
      body:       'Imóvel em watchlist reduziu preço de €950K para €880K (−7.4%). Potencial match com James Mitchell.',
      link:       '/signals',
      read:       false,
      deal_id:    null,
      contact_id: '1',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id:         'market-alert-003',
      type:       'info',
      title:      'Mercado: Algarve +22.1% YoY',
      body:       'Dados 2026 Q1: Algarve lidera valorização nacional com +22.1% YoY. Rendimento médio 6.5%. Partilhe com investidores.',
      link:       '/market-data',
      read:       true,
      deal_id:    null,
      contact_id: null,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id:         'deal-success-004',
      type:       'success',
      title:      'Escritura agendada: T4 Belém',
      body:       'A escritura do T4 Belém (Marco Aurelio Santos) foi confirmada. Comissão: €55.000. Parabéns!',
      link:       '/deals/AG-2026-0007',
      read:       false,
      deal_id:    'AG-2026-0007',
      contact_id: '10',
      created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const all = [...stallAlerts, ...followUpAlerts, ...intelAlerts]

  // Sort: unread first, then by created_at desc
  all.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Return 5-8 notifications
  return all.slice(0, 8)
}

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const userId    = searchParams.get('user_id')
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

    // --- Try Supabase ---
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = notificationsTable()
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit)

      if (userId) query = query.eq('user_id', userId)
      if (unreadOnly) query = query.eq('status', 'pending')

      const { data, error } = await query

      if (!error && data) {
        // Map Supabase notification rows to AppNotification shape
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: AppNotification[] = (data as any[]).map((n: Record<string, unknown>) => ({
          id:         n['id'] as string,
          type:       (n['status'] === 'failed' ? 'alert' : 'info') as NotificationType,
          title:      (n['subject'] as string | null) ?? 'Notificação',
          body:       n['body'] as string,
          link:       n['deal_id'] ? `/deals/${n['deal_id']}` : n['contact_id'] ? `/crm/${n['contact_id']}` : null,
          read:       n['status'] === 'opened' || n['status'] === 'delivered',
          deal_id:    (n['deal_id'] as string | null) ?? null,
          contact_id: (n['contact_id'] as string | null) ?? null,
          created_at: n['created_at'] as string,
        }))

        const unreadCount = mapped.filter(n => !n.read).length

        const response: NotificationsResponse = {
          unread:        unreadCount,
          notifications: mapped,
          source:        'supabase',
        }

        return NextResponse.json(response, { headers: responseHeaders() })
      }
    } catch {
      // Supabase unavailable
    }

    // --- Mock fallback with smart generation ---
    const notifications = generateMockNotifications()
    const filtered = unreadOnly ? notifications.filter(n => !n.read) : notifications
    const sliced   = filtered.slice(0, limit)

    const response: NotificationsResponse = {
      unread:        sliced.filter(n => !n.read).length,
      notifications: sliced,
      source:        'mock',
    }

    return NextResponse.json(response, { headers: responseHeaders() })
  } catch (error) {
    console.error('[notifications GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: responseHeaders() }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/notifications — mark notification(s) as read
// Body: { ids: string[] } or { id: string } or { all: true }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be JSON object' },
        { status: 400, headers: responseHeaders() }
      )
    }

    const input = body as Record<string, unknown>

    // Collect ids to mark as read
    let ids: string[] = []
    let markAll = false

    if (input.all === true) {
      markAll = true
    } else if (Array.isArray(input.ids)) {
      ids = input.ids.filter((id): id is string => typeof id === 'string')
    } else if (typeof input.id === 'string') {
      ids = [input.id]
    } else {
      return NextResponse.json(
        { error: 'Provide ids: string[], id: string, or all: true' },
        { status: 400, headers: responseHeaders() }
      )
    }

    // Guard: empty ids array would crash Supabase .in() with 400
    if (!markAll && ids.length === 0) {
      return NextResponse.json(
        { success: true, marked_read: 0, source: 'noop' },
        { headers: responseHeaders() }
      )
    }

    // Try Supabase
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = notificationsTable()
        .update({ status: 'opened', opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })

      if (markAll) {
        query = query.eq('status', 'pending')
      } else {
        query = query.in('id', ids)
      }

      const { error } = await query

      if (!error) {
        return NextResponse.json(
          { success: true, marked_read: markAll ? 'all' : ids.length, source: 'supabase' },
          { headers: responseHeaders() }
        )
      }
      console.warn('[notifications POST] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    // Mock success
    return NextResponse.json(
      {
        success:     true,
        marked_read: markAll ? 'all' : ids.length,
        source:      'mock',
        warning:     'Supabase unavailable — read status not persisted',
      },
      { headers: responseHeaders() }
    )
  } catch (error) {
    console.error('[notifications POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: responseHeaders() }
    )
  }
}
