import { NextRequest, NextResponse } from 'next/server'
import { sendToUser, notifications, type PushPayload } from '@/lib/push/notifications'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Internal endpoint — validate with a shared secret
  const authHeader = req.headers.get('x-internal-secret')
  const internalSecret = process.env.INTERNAL_API_SECRET

  if (!internalSecret || authHeader !== internalSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId, type, data } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    let payload: PushPayload

    switch (type) {
      case 'new_lead':
        payload = notifications.newLead(data.name, data.budget)
        break
      case 'visit_reminder':
        payload = notifications.visitReminder(data.property, data.time)
        break
      case 'deal_update':
        payload = notifications.dealUpdate(data.ref, data.stage)
        break
      case 'follow_up':
        payload = notifications.followUpAlert(data.name)
        break
      default:
        if (!data?.title || !data?.body) {
          return NextResponse.json({ error: 'title and body required for custom type' }, { status: 400 })
        }
        payload = { title: data.title, body: data.body, url: data.url, tag: data.tag }
    }

    await sendToUser(userId, payload)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push] Send route error:', error)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
