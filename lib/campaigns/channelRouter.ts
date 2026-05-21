// Agency Group — Channel Router
// lib/campaigns/channelRouter.ts
// Routes messages from channel_send_queue to actual delivery providers.
// Providers: Resend (email), WhatsApp Business API, Twilio (SMS), in-app notifications.
// Each provider gracefully no-ops when not configured.
// Every send attempt recorded for attribution and deliverability tracking.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { recordTouchpoint } from '@/lib/growth/attributionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SendStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'OPTED_OUT'
  | 'BOUNCED'

export interface ChannelSendJob {
  job_id: string
  tenant_id: string
  campaign_id: string | null
  execution_id: string | null
  investor_id: string
  channel: string
  message_content: string
  send_at: string
  status: SendStatus
  provider_response: string | null
  sent_at: string | null
  delivered_at: string | null
}

// ─── queueSend ────────────────────────────────────────────────────────────────

export async function queueSend(
  job: Omit<
    ChannelSendJob,
    'job_id' | 'status' | 'provider_response' | 'sent_at' | 'delivered_at'
  >,
): Promise<void> {
  const job_id = `send_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  void (supabaseAdmin as any)
    .from('channel_send_queue')
    .insert({
      job_id,
      tenant_id: job.tenant_id,
      campaign_id: job.campaign_id ?? null,
      execution_id: job.execution_id ?? null,
      investor_id: job.investor_id,
      channel: job.channel,
      message_content: job.message_content,
      send_at: job.send_at,
      status: 'QUEUED',
      provider_response: null,
      sent_at: null,
      delivered_at: null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[channelRouter] queueSend insert failed', {
          job_id,
          error: error.message,
        })
      }
    })
}

// ─── processEmailSend ─────────────────────────────────────────────────────────

export async function processEmailSend(
  job: ChannelSendJob,
  tenantId: string,
): Promise<SendStatus> {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'noreply@agencygroup.pt'

  if (!apiKey) {
    log.warn('[channelRouter] processEmailSend: RESEND_API_KEY not configured — no-op', {
      job_id: job.job_id,
    })
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', 'RESEND_API_KEY not configured')
    return 'FAILED'
  }

  // Load investor email
  const { data: investorRow } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('email')
    .eq('investor_id', job.investor_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const toEmail: string | null = investorRow?.email ?? null
  if (!toEmail) {
    log.warn('[channelRouter] processEmailSend: no email for investor — no-op', {
      investor_id: job.investor_id,
      job_id: job.job_id,
    })
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', 'no investor email on file')
    return 'FAILED'
  }

  try {
    // Dynamic import — graceful no-op if resend package not installed
    const ResendModule = await import('resend').catch(() => null)
    if (!ResendModule) {
      log.warn('[channelRouter] processEmailSend: resend package not installed — no-op', {
        job_id: job.job_id,
      })
      await _updateJobStatus(job.job_id, tenantId, 'FAILED', 'resend package not installed')
      return 'FAILED'
    }

    const { Resend } = ResendModule
    const resend = new Resend(apiKey)

    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to: toEmail,
      subject: `Agency Group — Campaign Message`,
      text: job.message_content,
      html: `<p>${job.message_content.replace(/\n/g, '<br/>')}</p>`,
    })

    if (sendErr) {
      log.warn('[channelRouter] processEmailSend: Resend API error', {
        job_id: job.job_id,
        error: String(sendErr),
      })
      await _updateJobStatus(job.job_id, tenantId, 'FAILED', String(sendErr))
      return 'FAILED'
    }

    const providerResponse = JSON.stringify({ id: (sendData as { id?: string })?.id })
    await _updateJobStatus(job.job_id, tenantId, 'SENT', providerResponse)

    void recordTouchpoint({
      tenant_id: tenantId,
      investor_id: job.investor_id,
      channel: 'email',
      campaign_id: job.campaign_id,
      execution_id: job.execution_id,
      job_id: job.job_id,
      event_type: 'send',
      metadata: { provider: 'resend', to: toEmail },
      occurred_at: new Date().toISOString(),
    }).catch((e: unknown) =>
      log.warn('[channelRouter] recordTouchpoint failed', { error: String(e) }),
    )

    return 'SENT'
  } catch (e: unknown) {
    log.error('[channelRouter] processEmailSend unexpected error', e, {
      job_id: job.job_id,
    })
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', String(e))
    return 'FAILED'
  }
}

// ─── processWhatsAppSend ──────────────────────────────────────────────────────

export async function processWhatsAppSend(
  job: ChannelSendJob,
  tenantId: string,
): Promise<SendStatus> {
  const token = process.env.WHATSAPP_API_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID

  if (!token || !phoneId) {
    log.warn('[channelRouter] processWhatsAppSend: not configured — no-op', {
      job_id: job.job_id,
    })
    await _updateJobStatus(
      job.job_id,
      tenantId,
      'FAILED',
      'WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID not configured',
    )
    return 'FAILED'
  }

  // Load investor phone
  const { data: investorRow } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('phone')
    .eq('investor_id', job.investor_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const phone: string | null = investorRow?.phone ?? null
  if (!phone) {
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', 'no phone for investor')
    return 'FAILED'
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: job.message_content },
        }),
      },
    )

    const resBody = (await res.json()) as Record<string, unknown>

    if (!res.ok) {
      await _updateJobStatus(
        job.job_id,
        tenantId,
        'FAILED',
        JSON.stringify(resBody),
      )
      return 'FAILED'
    }

    await _updateJobStatus(job.job_id, tenantId, 'SENT', JSON.stringify(resBody))

    void recordTouchpoint({
      tenant_id: tenantId,
      investor_id: job.investor_id,
      channel: 'whatsapp',
      campaign_id: job.campaign_id,
      execution_id: job.execution_id,
      job_id: job.job_id,
      event_type: 'send',
      metadata: { provider: 'meta_whatsapp', to: phone },
      occurred_at: new Date().toISOString(),
    }).catch((e: unknown) =>
      log.warn('[channelRouter] recordTouchpoint failed', { error: String(e) }),
    )

    return 'SENT'
  } catch (e: unknown) {
    log.error('[channelRouter] processWhatsAppSend error', e, { job_id: job.job_id })
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', String(e))
    return 'FAILED'
  }
}

// ─── processSMSSend ───────────────────────────────────────────────────────────

export async function processSMSSend(
  job: ChannelSendJob,
  tenantId: string,
): Promise<SendStatus> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !from) {
    log.warn('[channelRouter] processSMSSend: Twilio not configured — no-op', {
      job_id: job.job_id,
    })
    await _updateJobStatus(
      job.job_id,
      tenantId,
      'FAILED',
      'Twilio credentials not configured',
    )
    return 'FAILED'
  }

  // Load investor phone
  const { data: investorRow } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('phone')
    .eq('investor_id', job.investor_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const phone: string | null = investorRow?.phone ?? null
  if (!phone) {
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', 'no phone for investor')
    return 'FAILED'
  }

  try {
    // Dynamic import — graceful no-op if twilio package not installed
    const TwilioModule = await import('twilio').catch(() => null)
    if (!TwilioModule) {
      log.warn('[channelRouter] processSMSSend: twilio package not installed — no-op', {
        job_id: job.job_id,
      })
      await _updateJobStatus(
        job.job_id,
        tenantId,
        'FAILED',
        'twilio package not installed',
      )
      return 'FAILED'
    }

    const client = TwilioModule.default(accountSid, authToken)
    const message = await client.messages.create({
      body: job.message_content,
      from,
      to: phone,
    })

    await _updateJobStatus(
      job.job_id,
      tenantId,
      'SENT',
      JSON.stringify({ sid: message.sid, status: message.status }),
    )

    void recordTouchpoint({
      tenant_id: tenantId,
      investor_id: job.investor_id,
      channel: 'sms',
      campaign_id: job.campaign_id,
      execution_id: job.execution_id,
      job_id: job.job_id,
      event_type: 'send',
      metadata: { provider: 'twilio', sid: message.sid },
      occurred_at: new Date().toISOString(),
    }).catch((e: unknown) =>
      log.warn('[channelRouter] recordTouchpoint failed', { error: String(e) }),
    )

    return 'SENT'
  } catch (e: unknown) {
    log.error('[channelRouter] processSMSSend error', e, { job_id: job.job_id })
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', String(e))
    return 'FAILED'
  }
}

// ─── processInAppNotification ─────────────────────────────────────────────────

export async function processInAppNotification(
  job: ChannelSendJob,
  tenantId: string,
): Promise<SendStatus> {
  const { error } = await (supabaseAdmin as any)
    .from('investor_notifications')
    .insert({
      tenant_id: tenantId,
      investor_id: job.investor_id,
      campaign_id: job.campaign_id ?? null,
      notification_type: 'in_app',
      title: 'Agency Group Update',
      message: job.message_content,
      read: false,
      created_at: new Date().toISOString(),
    })

  if (error) {
    log.warn('[channelRouter] processInAppNotification: insert failed', {
      job_id: job.job_id,
      error: error.message,
    })
    await _updateJobStatus(job.job_id, tenantId, 'FAILED', error.message)
    return 'FAILED'
  }

  await _updateJobStatus(job.job_id, tenantId, 'SENT', 'in-app notification inserted')

  void recordTouchpoint({
    tenant_id: tenantId,
    investor_id: job.investor_id,
    channel: 'in_app',
    campaign_id: job.campaign_id,
    execution_id: job.execution_id,
    job_id: job.job_id,
    event_type: 'send',
    metadata: { provider: 'in_app' },
    occurred_at: new Date().toISOString(),
  }).catch((e: unknown) =>
    log.warn('[channelRouter] recordTouchpoint failed', { error: String(e) }),
  )

  return 'SENT'
}

// ─── processPendingJobs ───────────────────────────────────────────────────────

export async function processPendingJobs(
  tenantId: string,
  limit = 50,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date().toISOString()

  const { data: jobs, error: qErr } = await (supabaseAdmin as any)
    .from('channel_send_queue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'QUEUED')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(limit)

  if (qErr) {
    log.error('[channelRouter] processPendingJobs: query failed', qErr, {
      tenant_id: tenantId,
    })
    throw new Error(`processPendingJobs: ${qErr.message}`)
  }

  const jobList: ChannelSendJob[] = (jobs ?? []).map(_mapJobRow)
  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const job of jobList) {
    processed++
    let status: SendStatus = 'FAILED'

    try {
      const ch = job.channel.toLowerCase()
      if (ch === 'email') {
        status = await processEmailSend(job, tenantId)
      } else if (ch === 'whatsapp') {
        status = await processWhatsAppSend(job, tenantId)
      } else if (ch === 'sms') {
        status = await processSMSSend(job, tenantId)
      } else {
        // Default: in-app
        status = await processInAppNotification(job, tenantId)
      }
    } catch (e: unknown) {
      log.error('[channelRouter] processPendingJobs: job processing error', e, {
        job_id: job.job_id,
        channel: job.channel,
      })
      await _updateJobStatus(job.job_id, tenantId, 'FAILED', String(e)).catch(
        () => undefined,
      )
      status = 'FAILED'
    }

    if (status === 'SENT' || status === 'DELIVERED') {
      succeeded++
    } else {
      failed++
    }
  }

  log.info('[channelRouter] processPendingJobs complete', {
    processed,
    succeeded,
    failed,
    tenant_id: tenantId,
  })

  return { processed, succeeded, failed }
}

// ─── getDeliverabilityStats ───────────────────────────────────────────────────

export async function getDeliverabilityStats(
  tenantId: string,
  windowDays = 30,
): Promise<
  Array<{
    channel: string
    sent: number
    delivered: number
    failed: number
    delivery_rate_pct: number
  }>
> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await (supabaseAdmin as any)
    .from('channel_send_queue')
    .select('channel, status')
    .eq('tenant_id', tenantId)
    .gte('send_at', since)

  if (error) {
    throw new Error(`getDeliverabilityStats: ${error.message}`)
  }

  const rows: Array<{ channel: string; status: string }> = data ?? []

  // Aggregate per channel
  const channelMap = new Map<
    string,
    { sent: number; delivered: number; failed: number }
  >()

  for (const row of rows) {
    const ch = row.channel
    const existing = channelMap.get(ch) ?? { sent: 0, delivered: 0, failed: 0 }

    if (row.status === 'SENT') existing.sent++
    else if (row.status === 'DELIVERED') {
      existing.sent++
      existing.delivered++
    } else if (row.status === 'FAILED' || row.status === 'BOUNCED') {
      existing.failed++
    }

    channelMap.set(ch, existing)
  }

  return Array.from(channelMap.entries()).map(([channel, stats]) => {
    const total = stats.sent + stats.failed
    const delivery_rate_pct =
      total > 0 ? Math.round((stats.sent / total) * 100) : 0
    return {
      channel,
      sent: stats.sent,
      delivered: stats.delivered,
      failed: stats.failed,
      delivery_rate_pct,
    }
  })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _updateJobStatus(
  jobId: string,
  tenantId: string,
  status: SendStatus,
  providerResponse: string,
): Promise<void> {
  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    status,
    provider_response: providerResponse,
  }
  if (status === 'SENT' || status === 'DELIVERED') {
    updatePayload.sent_at = now
  }
  if (status === 'DELIVERED') {
    updatePayload.delivered_at = now
  }

  const { error } = await (supabaseAdmin as any)
    .from('channel_send_queue')
    .update(updatePayload)
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)

  if (error) {
    log.warn('[channelRouter] _updateJobStatus failed', {
      job_id: jobId,
      status,
      error: error.message,
    })
  }
}

function _mapJobRow(row: Record<string, unknown>): ChannelSendJob {
  return {
    job_id: row.job_id as string,
    tenant_id: row.tenant_id as string,
    campaign_id: (row.campaign_id as string | null) ?? null,
    execution_id: (row.execution_id as string | null) ?? null,
    investor_id: row.investor_id as string,
    channel: row.channel as string,
    message_content: (row.message_content as string) ?? '',
    send_at: row.send_at as string,
    status: row.status as SendStatus,
    provider_response: (row.provider_response as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
  }
}
