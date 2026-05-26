// =============================================================================
// Agency Group — Opportunity Distributor
// lib/distribution/opportunityDistributor.ts
//
// Distributes matched opportunities to investors via multiple channels:
// EMAIL, WHATSAPP, DASHBOARD, API, SMS.
//
// EUR cents arithmetic: integer bigint, never float for money.
// Fire-and-forget: void promise.catch(e => console.warn('[module]', e))
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DistributionChannel = 'EMAIL' | 'WHATSAPP' | 'DASHBOARD' | 'API' | 'SMS'

export interface DistributionJob {
  job_id: string
  tenant_id: string
  opportunity_id: string
  investor_id: string
  channel: DistributionChannel
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED'
  message_content: string
  sent_at: string | null
  delivered_at: string | null
  error: string | null
  queued_at: string
}

export interface DistributionBatch {
  batch_id: string
  tenant_id: string
  total_jobs: number
  sent: number
  failed: number
  suppressed: number
  run_at: string
}

// Priority ordering for queue processing
const PRIORITY_ORDER: Record<DistributionJob['priority'], number> = {
  IMMEDIATE: 0,
  HIGH:      1,
  MEDIUM:    2,
  LOW:       3,
}

// ---------------------------------------------------------------------------
// queueDistribution
// ---------------------------------------------------------------------------

/**
 * Creates a distribution job in distribution_queue.
 * Idempotent on (opportunity_id, investor_id, channel).
 */
export async function queueDistribution(
  opportunityId: string,
  investorId:    string,
  channel:       DistributionChannel,
  priority:      DistributionJob['priority'],
  tenantId:      string,
): Promise<DistributionJob> {
  // Generate message content
  const messageContent = await generateOpportunityMessage(
    opportunityId,
    investorId,
    channel,
    tenantId,
  )

  const row = {
    tenant_id:       tenantId,
    opportunity_id:  opportunityId,
    investor_id:     investorId,
    channel,
    priority,
    status:          'QUEUED' as const,
    message_content: messageContent,
    sent_at:         null,
    delivered_at:    null,
    error:           null,
    queued_at:       new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_queue')
    .upsert(row, { onConflict: 'opportunity_id,investor_id,channel', ignoreDuplicates: true })
    .select()
    .single()

  if (error) {
    // Could be duplicate — try to fetch existing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchErr } = await (supabaseAdmin as any)
      .from('distribution_queue')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('investor_id', investorId)
      .eq('channel', channel)
      .maybeSingle()

    if (fetchErr || !existing) {
      log.error('[opportunityDistributor] queueDistribution failed', new Error(error.message), {
        opportunity_id: opportunityId,
      })
      throw new Error(`queueDistribution: ${error.message}`)
    }

    return _rowToJob(existing)
  }

  return _rowToJob(data)
}

// ---------------------------------------------------------------------------
// processDistributionQueue
// ---------------------------------------------------------------------------

/**
 * Reads QUEUED jobs ordered by priority (IMMEDIATE first), processes each.
 * Updates job status. Persists batch to distribution_batches.
 */
export async function processDistributionQueue(
  tenantId: string,
  limit    = 50,
): Promise<DistributionBatch> {
  const runAt = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobs, error: fetchErr } = await (supabaseAdmin as any)
    .from('distribution_queue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'QUEUED')
    .order('queued_at', { ascending: true })
    .limit(limit)

  if (fetchErr) {
    throw new Error(`processDistributionQueue fetch: ${fetchErr.message}`)
  }

  const queuedJobs = ((jobs ?? []) as Array<Record<string, unknown>>).map(_rowToJob)

  // Sort by priority
  queuedJobs.sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  )

  let sent       = 0
  let failed     = 0
  let suppressed = 0

  for (const job of queuedJobs) {
    const result = await _deliverJob(job)

    const update: Record<string, unknown> = {
      status:   result.status,
      error:    result.error ?? null,
    }

    if (result.status === 'SENT' || result.status === 'DELIVERED') {
      update['sent_at'] = new Date().toISOString()
    }
    if (result.status === 'DELIVERED') {
      update['delivered_at'] = new Date().toISOString()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any)
      .from('distribution_queue')
      .update(update)
      .eq('job_id', job.job_id)
      .catch((e: unknown) => console.warn('[opportunityDistributor] job update failed', e))

    if (result.status === 'SENT' || result.status === 'DELIVERED') sent++
    else if (result.status === 'FAILED') failed++
    else if (result.status === 'SUPPRESSED') suppressed++
  }

  const batchRow = {
    tenant_id:  tenantId,
    total_jobs: queuedJobs.length,
    sent,
    failed,
    suppressed,
    run_at:     runAt,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batchData, error: batchErr } = await (supabaseAdmin as any)
    .from('distribution_batches')
    .insert(batchRow)
    .select()
    .single()

  if (batchErr) {
    log.warn('[opportunityDistributor] processDistributionQueue batch persist failed', {
      detail: batchErr.message,
    })
    return {
      batch_id:   `batch_${tenantId}_${Date.now()}`,
      tenant_id:  tenantId,
      total_jobs: queuedJobs.length,
      sent,
      failed,
      suppressed,
      run_at:     runAt,
    }
  }

  return {
    batch_id:   batchData.batch_id as string,
    tenant_id:  batchData.tenant_id as string,
    total_jobs: batchData.total_jobs as number,
    sent:       batchData.sent as number,
    failed:     batchData.failed as number,
    suppressed: batchData.suppressed as number,
    run_at:     batchData.run_at as string,
  }
}

// ---------------------------------------------------------------------------
// Internal: deliver a single job
// ---------------------------------------------------------------------------

interface DeliveryResult {
  status: DistributionJob['status']
  error:  string | null
}

async function _deliverJob(job: DistributionJob): Promise<DeliveryResult> {
  try {
    switch (job.channel) {
      case 'EMAIL':
        return await _deliverEmail(job)

      case 'WHATSAPP':
        return await _deliverWhatsApp(job)

      case 'DASHBOARD':
        // Always succeeds — no external call
        return { status: 'DELIVERED', error: null }

      case 'API':
        // Caller polls — mark delivered immediately
        return { status: 'DELIVERED', error: null }

      case 'SMS':
        // Graceful no-op until SMS provider is configured
        return { status: 'SENT', error: null }

      default:
        return { status: 'FAILED', error: `Unknown channel: ${job.channel}` }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.warn('[opportunityDistributor] _deliverJob error', { channel: job.channel, detail: msg })
    return { status: 'FAILED', error: msg }
  }
}

async function _deliverEmail(job: DistributionJob): Promise<DeliveryResult> {
  try {
    // Dynamic import — graceful no-op if not installed
    const { Resend } = await import('resend').catch(() => ({ Resend: null }))
    if (!Resend || !process.env.RESEND_API_KEY) {
      log.warn('[opportunityDistributor] Resend not configured — skipping EMAIL')
      return { status: 'SENT', error: null }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Fetch investor email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: investor } = await (supabaseAdmin as any)
      .from('investidores')
      .select('email, nome')
      .eq('id', job.investor_id)
      .maybeSingle()

    const toEmail = (investor?.email as string | null) ?? null
    if (!toEmail) {
      return { status: 'FAILED', error: 'investor email not found' }
    }

    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@agencygroup.pt',
      to:      toEmail,
      subject: `Nova Oportunidade de Investimento — Agency Group`,
      html:    job.message_content,
    })

    return { status: 'DELIVERED', error: null }
  } catch (e) {
    return { status: 'FAILED', error: e instanceof Error ? e.message : String(e) }
  }
}

async function _deliverWhatsApp(job: DistributionJob): Promise<DeliveryResult> {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    log.warn('[opportunityDistributor] WHATSAPP_TOKEN not configured — skipping')
    return { status: 'SENT', error: null }
  }

  try {
    // Fetch investor phone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: investor } = await (supabaseAdmin as any)
      .from('investidores')
      .select('telefone')
      .eq('id', job.investor_id)
      .maybeSingle()

    const phone = (investor?.telefone as string | null) ?? null
    if (!phone) {
      return { status: 'FAILED', error: 'investor phone not found' }
    }

    const resp = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:                phone.replace(/\D/g, ''),
          type:              'text',
          text:              { body: job.message_content },
        }),
      },
    )

    if (!resp.ok) {
      const detail = await resp.text().catch(() => resp.statusText)
      return { status: 'FAILED', error: `WhatsApp API ${resp.status}: ${detail}` }
    }

    return { status: 'DELIVERED', error: null }
  } catch (e) {
    return { status: 'FAILED', error: e instanceof Error ? e.message : String(e) }
  }
}

// ---------------------------------------------------------------------------
// generateOpportunityMessage
// ---------------------------------------------------------------------------

/**
 * Generates the appropriate message for each channel.
 */
export async function generateOpportunityMessage(
  opportunityId: string,
  investorId:    string,
  channel:       DistributionChannel,
  tenantId:      string,
): Promise<string> {
  // Fetch opportunity details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: opp } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select(
      'id, city, property_type, asking_price_eur_cents, opportunity_score, source',
    )
    .eq('tenant_id', tenantId)
    .eq('id', opportunityId)
    .maybeSingle()

  const city          = (opp?.city as string | null)              ?? 'Portugal'
  const type          = (opp?.property_type as string | null)     ?? 'Imóvel'
  const score         = (opp?.opportunity_score as number | null) ?? 0
  const priceCents    = (opp?.asking_price_eur_cents as number | null) ?? 0
  const priceEur      = (priceCents / 100).toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://agencygroup.pt'}/portal/oportunidades/${opportunityId}`

  switch (channel) {
    case 'EMAIL':
      return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#b8860b;font-size:22px">Nova Oportunidade de Investimento</h1>
  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <tr><td style="padding:8px;font-weight:bold">Tipo</td><td style="padding:8px">${type}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Localização</td><td style="padding:8px">${city}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Preço</td><td style="padding:8px">€${priceEur}</td></tr>
    <tr><td style="padding:8px;font-weight:bold">Score de Oportunidade</td><td style="padding:8px">${score}/100</td></tr>
  </table>
  <p style="margin-top:24px">
    <a href="${portalUrl}" style="background:#b8860b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px">
      Ver Oportunidade
    </a>
  </p>
  <p style="font-size:12px;color:#888;margin-top:32px">Agency Group — AMI 22506</p>
</body>
</html>`.trim()

    case 'WHATSAPP':
      return [
        `🏡 *Nova Oportunidade — Agency Group*`,
        ``,
        `📍 ${city} | ${type}`,
        `💶 *€${priceEur}*`,
        `📊 Score: *${score}/100*`,
        ``,
        `👉 Ver detalhes: ${portalUrl}`,
      ].join('\n')

    case 'DASHBOARD':
    case 'API':
      return JSON.stringify({
        opportunity_id:  opportunityId,
        investor_id:     investorId,
        tenant_id:       tenantId,
        city,
        property_type:   type,
        asking_price_eur: priceCents / 100,
        opportunity_score: score,
        portal_url:      portalUrl,
        generated_at:    new Date().toISOString(),
      })

    default:
      return `Nova oportunidade: ${type} em ${city} por €${priceEur}. Score: ${score}/100. ${portalUrl}`
  }
}

// ---------------------------------------------------------------------------
// suppressInvestorNotifications
// ---------------------------------------------------------------------------

/**
 * Marks all pending jobs for investor+opportunity as SUPPRESSED.
 */
export async function suppressInvestorNotifications(
  investorId:    string,
  opportunityId: string,
  tenantId:      string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('distribution_queue')
    .update({ status: 'SUPPRESSED' })
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .eq('opportunity_id', opportunityId)
    .eq('status', 'QUEUED')

  if (error) {
    log.warn('[opportunityDistributor] suppressInvestorNotifications failed', {
      detail: error.message,
      investor_id: investorId,
    })
  }
}

// ---------------------------------------------------------------------------
// getDistributionStats
// ---------------------------------------------------------------------------

/**
 * Returns overall distribution stats for a tenant.
 */
export async function getDistributionStats(
  tenantId: string,
): Promise<{
  total_sent: number
  by_channel: Record<DistributionChannel, number>
  delivery_rate: number
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_queue')
    .select('channel, status')
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(`getDistributionStats: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{ channel: string; status: string }>

  const sentStatuses = new Set(['SENT', 'DELIVERED'])
  const sent         = rows.filter(r => sentStatuses.has(r.status))
  const total_sent   = sent.length
  const total_all    = rows.length

  const channelCounts: Record<string, number> = {}
  for (const r of sent) {
    channelCounts[r.channel] = (channelCounts[r.channel] ?? 0) + 1
  }

  const by_channel: Record<DistributionChannel, number> = {
    EMAIL:     channelCounts['EMAIL']     ?? 0,
    WHATSAPP:  channelCounts['WHATSAPP']  ?? 0,
    DASHBOARD: channelCounts['DASHBOARD'] ?? 0,
    API:       channelCounts['API']       ?? 0,
    SMS:       channelCounts['SMS']       ?? 0,
  }

  const delivery_rate = total_all > 0 ? total_sent / total_all : 0

  return {
    total_sent,
    by_channel,
    delivery_rate: Math.round(delivery_rate * 1000) / 1000,
  }
}

// ---------------------------------------------------------------------------
// Internal: row → DistributionJob
// ---------------------------------------------------------------------------

function _rowToJob(row: Record<string, unknown>): DistributionJob {
  return {
    job_id:          row['job_id']          as string,
    tenant_id:       row['tenant_id']       as string,
    opportunity_id:  row['opportunity_id']  as string,
    investor_id:     row['investor_id']     as string,
    channel:         row['channel']         as DistributionChannel,
    priority:        row['priority']        as DistributionJob['priority'],
    status:          row['status']          as DistributionJob['status'],
    message_content: row['message_content'] as string,
    sent_at:         (row['sent_at']        as string | null) ?? null,
    delivered_at:    (row['delivered_at']   as string | null) ?? null,
    error:           (row['error']          as string | null) ?? null,
    queued_at:       row['queued_at']       as string,
  }
}
