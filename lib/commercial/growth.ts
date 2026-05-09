// =============================================================================
// Agency Group — Growth Machine
// lib/commercial/growth.ts
// Referral tracking, viral coefficient, CAC/LTV analytics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrowthAnalytics {
  period_days: number
  new_leads: number
  new_qualified: number
  new_clients: number
  referral_count: number
  viral_coefficient: number  // avg referrals per closed client (K-factor)
  top_referrers: Array<{ email: string; referrals: number; deals_generated: number }>
  source_breakdown: Array<{ source: string; count: number; conversion_rate: number }>
  weekly_trend: Array<{ week: string; new_leads: number; referrals: number; clients: number }>
  cac_avg: number
  ltv_avg: number
}

interface ContactRow {
  status: string | null
  created_at: string
  source_channel: string | null
}

interface ReferralRow {
  referrer_email: string | null
  referred_email: string | null
  source: string
  deal_id: string | null
  created_at: string
}

interface GrowthMetricRow {
  week_start: string
  new_leads: number
  referral_count: number
  new_clients: number
  cac_eur: number | null
  ltv_eur: number | null
}

// ─── Main Analytics Function ──────────────────────────────────────────────────

export async function getGrowthAnalytics(days = 90): Promise<GrowthAnalytics> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const result: GrowthAnalytics = {
    period_days: days,
    new_leads: 0,
    new_qualified: 0,
    new_clients: 0,
    referral_count: 0,
    viral_coefficient: 0,
    top_referrers: [],
    source_breakdown: [],
    weekly_trend: [],
    cac_avg: 0,
    ltv_avg: 0,
  }

  try {
    // ── 1. Contacts metrics ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contacts, error: cErr } = await supabaseAdmin
      .from('contacts')
      .select('status, created_at, source_channel')
      .gte('created_at', since) as { data: ContactRow[] | null; error: { message: string } | null }

    if (cErr) {
      log.warn('[growth] contacts query error', { route: 'lib/commercial/growth', error: cErr.message })
    }

    if (contacts) {
      const rows = contacts
      result.new_leads      = rows.filter(c => c.status !== 'dormant').length
      result.new_qualified  = rows.filter(c => ['qualified', 'client', 'closed'].includes(c.status ?? '')).length
      result.new_clients    = rows.filter(c => ['client', 'closed'].includes(c.status ?? '')).length

      // Source breakdown from contacts
      const sourceMap: Record<string, { total: number; converted: number }> = {}
      for (const c of rows) {
        const src = c.source_channel ?? 'direct'
        if (!sourceMap[src]) sourceMap[src] = { total: 0, converted: 0 }
        sourceMap[src].total++
        if (['client', 'closed'].includes(c.status ?? '')) sourceMap[src].converted++
      }
      result.source_breakdown = Object.entries(sourceMap).map(([source, stats]) => ({
        source,
        count: stats.total,
        conversion_rate: stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) / 100 : 0,
      })).sort((a, b) => b.count - a.count)
    }

    // ── 2. Referrals metrics ───────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: referrals, error: rErr } = await supabaseAdmin
      .from('referrals')
      .select('referrer_email, referred_email, source, deal_id, created_at')
      .gte('created_at', since) as { data: ReferralRow[] | null; error: { message: string } | null }

    if (rErr) {
      log.warn('[growth] referrals query error', { route: 'lib/commercial/growth', error: rErr.message })
    }

    if (referrals && referrals.length > 0) {
      result.referral_count = referrals.length

      // Viral coefficient: referrals per client
      result.viral_coefficient = result.new_clients > 0
        ? Math.round((referrals.length / result.new_clients) * 1000) / 1000
        : 0

      // Top referrers
      const referrerMap: Record<string, { referrals: number; deals: number }> = {}
      for (const r of referrals) {
        const email = r.referrer_email ?? 'unknown'
        if (!referrerMap[email]) referrerMap[email] = { referrals: 0, deals: 0 }
        referrerMap[email].referrals++
        if (r.deal_id) referrerMap[email].deals++
      }
      result.top_referrers = Object.entries(referrerMap)
        .map(([email, stats]) => ({
          email,
          referrals: stats.referrals,
          deals_generated: stats.deals,
        }))
        .sort((a, b) => b.referrals - a.referrals)
        .slice(0, 10)

      // Enrich source_breakdown with referral source data
      const refSourceMap: Record<string, number> = {}
      for (const r of referrals) {
        refSourceMap[r.source] = (refSourceMap[r.source] ?? 0) + 1
      }
      // Merge referral sources into source_breakdown if not already present
      for (const [source, count] of Object.entries(refSourceMap)) {
        const existing = result.source_breakdown.find(s => s.source === source)
        if (!existing) {
          result.source_breakdown.push({ source, count, conversion_rate: 0 })
        }
      }
    }

    // ── 3. Weekly trend from growth_metrics ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: weeklyData, error: wErr } = await supabaseAdmin
      .from('growth_metrics')
      .select('week_start, new_leads, referral_count, new_clients, cac_eur, ltv_eur')
      .gte('week_start', new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10))
      .order('week_start', { ascending: true }) as { data: GrowthMetricRow[] | null; error: { message: string } | null }

    if (wErr) {
      log.warn('[growth] growth_metrics query error', { route: 'lib/commercial/growth', error: wErr.message })
    }

    if (weeklyData && weeklyData.length > 0) {
      result.weekly_trend = weeklyData.map(w => ({
        week: w.week_start,
        new_leads: w.new_leads,
        referrals: w.referral_count,
        clients: w.new_clients,
      }))

      // CAC/LTV averages from weekly snapshots
      const cacValues = weeklyData.filter(w => w.cac_eur != null).map(w => w.cac_eur as number)
      const ltvValues = weeklyData.filter(w => w.ltv_eur != null).map(w => w.ltv_eur as number)
      result.cac_avg = cacValues.length > 0
        ? Math.round(cacValues.reduce((s, v) => s + v, 0) / cacValues.length)
        : 0
      result.ltv_avg = ltvValues.length > 0
        ? Math.round(ltvValues.reduce((s, v) => s + v, 0) / ltvValues.length)
        : 0
    }

  } catch (err) {
    log.error('[growth] getGrowthAnalytics error', err instanceof Error ? err : new Error(String(err)), { route: 'lib/commercial/growth' })
  }

  return result
}

// ─── Record a Referral ────────────────────────────────────────────────────────

export async function recordReferral(
  referrerEmail: string,
  referredEmail: string,
  source: string,
  dealId?: string,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin.from('referrals').insert({
      referrer_email: referrerEmail,
      referred_email: referredEmail,
      source,
      deal_id: dealId ?? null,
    })
    if (error) {
      log.warn('[growth] recordReferral insert error', { route: 'lib/commercial/growth', error: error.message })
    }
  } catch (err) {
    log.error('[growth] recordReferral error', err instanceof Error ? err : new Error(String(err)), { route: 'lib/commercial/growth' })
  }
}
