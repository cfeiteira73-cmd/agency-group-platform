import webpush from 'web-push'

let vapidInitialised = false
function initVapid() {
  if (vapidInitialised) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return // skip silently at build time
  webpush.setVapidDetails('mailto:tech@agencygroup.pt', pub, priv)
  vapidInitialised = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  image?: string
  tag?: string
  urgent?: boolean
  actions?: Array<{ action: string; title: string }>
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<{ success: boolean; expired?: boolean }> {
  initVapid()
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { success: true }
  } catch (error: unknown) {
    const webPushError = error as { statusCode?: number }
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      // Subscription expired or invalid — caller should remove from DB
      return { success: false, expired: true }
    }
    throw error
  }
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('id, token')
    .eq('user_id', userId)

  if (!tokens?.length) return

  const results = await Promise.allSettled(
    tokens.map(async ({ id, token }: { id: string; token: string }) => {
      let sub: webpush.PushSubscription
      try {
        sub = JSON.parse(token) as webpush.PushSubscription
      } catch {
        return
      }
      const result = await sendPushNotification(sub, payload)
      if (result.expired) {
        // Clean up expired subscription
        await supabase.from('push_tokens').delete().eq('id', id)
      }
    })
  )

  // Log any unexpected failures
  results.forEach(r => {
    if (r.status === 'rejected') {
      console.error('[Push] sendToUser error:', r.reason)
    }
  })
}

// ─── Notification Templates ───────────────────────────────────────────────────
export const notifications = {
  newLead: (name: string, budget: string): PushPayload => ({
    title: '🎯 Novo Lead',
    body: `${name} — Budget: ${budget}`,
    url: '/portal?section=crm',
    tag: 'new-lead',
  }),

  visitReminder: (property: string, time: string): PushPayload => ({
    title: '🏠 Visita Amanhã',
    body: `${property} às ${time}`,
    url: '/portal?section=visitas',
    tag: 'visit-reminder',
    urgent: true,
  }),

  dealUpdate: (ref: string, stage: string): PushPayload => ({
    title: '📋 Deal Actualizado',
    body: `${ref} avançou para ${stage}`,
    url: '/portal?section=pipeline',
    tag: `deal-${ref}`,
  }),

  followUpAlert: (name: string): PushPayload => ({
    title: '⏰ Follow-up Pendente',
    body: `Contactar ${name} hoje`,
    url: '/portal?section=crm',
    tag: 'follow-up',
  }),
}
