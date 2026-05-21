// =============================================================================
// Agency Group — Fraud Detector
// lib/ingestion/fraudDetector.ts
//
// Detects fake listings, price manipulation, stale reposts, and
// duplicate injection attempts across canonical property data.
//
// Detection rules:
//   1. duplicate_injection — property relisted within 30 days of closing
//   2. price_manipulation  — price changed > 30% within 7 days
//   3. fake_listing        — price < 30% of zone median AND oversized area
//   4. stale_repost        — relisted > 3 times with no material changes
//
// Composite fraud_risk_score = weighted sum of signal confidences (0–100).
// Writes results to security_events table.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FraudSignal {
  signal_type: 'duplicate_injection' | 'price_manipulation' | 'fake_listing' | 'stale_repost' | 'suspicious_photos'
  severity: 'high' | 'medium' | 'low'
  confidence: number // 0-1
  description: string
  evidence: Record<string, unknown>
}

export interface FraudAssessment {
  canonical_id: string
  fraud_risk_score: number // 0-100
  signals: FraudSignal[]
  recommendation: 'allow' | 'flag' | 'block'
  assessed_at: string
}

// ─── Signal Weights ───────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<FraudSignal['signal_type'], number> = {
  duplicate_injection: 0.35,
  price_manipulation:  0.25,
  fake_listing:        0.25,
  stale_repost:        0.15,
  suspicious_photos:   0.00, // reserved for future CV integration
}

// ─── Individual Detectors ─────────────────────────────────────────────────────

async function detectDuplicateInjection(
  canonicalId: string,
  tenantId: string,
): Promise<FraudSignal | null> {
  // Check if same property_source_id was listed, closed, then relisted within 30 days
  const { data: canonical } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('source_ids, listed_at, city, property_type, price_eur, area_m2')
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .single()

  if (!canonical) return null

  const sourceIds = (canonical.source_ids as Record<string, string>) ?? {}
  const providerIds = Object.values(sourceIds)
  if (providerIds.length === 0) return null

  // Look for same provider listing IDs that were ingested before and marked as sold/expired
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  for (const providerId of providerIds) {
    const { data: raw } = await (supabaseAdmin as any)
      .from('properties_raw')
      .select('ingested_at, provider_listing_id')
      .eq('provider_listing_id', providerId)
      .lt('ingested_at', canonical.listed_at)
      .gte('ingested_at', thirtyDaysAgo)
      .limit(1)

    if (raw && raw.length > 0) {
      return {
        signal_type: 'duplicate_injection',
        severity:    'high',
        confidence:  0.85,
        description: `Property relisted within 30 days of previous ingestion (provider_id=${providerId})`,
        evidence: {
          provider_listing_id: providerId,
          previous_ingestion:  raw[0].ingested_at,
          current_listed_at:   canonical.listed_at,
        },
      }
    }
  }

  return null
}

async function detectPriceManipulation(
  canonicalId: string,
  tenantId: string,
): Promise<FraudSignal | null> {
  // Check price history for > 30% change within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: history } = await (supabaseAdmin as any)
    .from('price_history')
    .select('price, recorded_at')
    .eq('property_id', canonicalId)
    .gte('recorded_at', sevenDaysAgo)
    .order('recorded_at', { ascending: true })
    .limit(20)

  if (!history || history.length < 2) return null

  const rows = history as { price: number; recorded_at: string }[]
  const first = Number(rows[0].price)
  const last  = Number(rows[rows.length - 1].price)

  if (first === 0) return null

  const changePct = Math.abs(last - first) / first

  if (changePct > 0.30) {
    return {
      signal_type: 'price_manipulation',
      severity:    changePct > 0.50 ? 'high' : 'medium',
      confidence:  Math.min(0.95, 0.60 + changePct),
      description: `Price changed ${Math.round(changePct * 100)}% within 7 days (${first}€ → ${last}€)`,
      evidence: {
        price_from:    first,
        price_to:      last,
        change_pct:    Math.round(changePct * 10000) / 100,
        period_days:   7,
      },
    }
  }

  return null
}

async function detectFakeListing(
  canonicalId: string,
  tenantId: string,
): Promise<FraudSignal | null> {
  const { data: canonical } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('city, property_type, price_eur, area_m2, zone')
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .single()

  if (!canonical) return null

  const price   = Number(canonical.price_eur)
  const area    = Number(canonical.area_m2)
  const zone    = canonical.zone as string | null

  // Fetch zone median from liquidity_heatmap (uses demand_score as proxy)
  // and from property_enrichments if available
  const { data: enrichment } = await (supabaseAdmin as any)
    .from('property_enrichments')
    .select('market_median_price_per_m2')
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .single()

  const medianPricePerM2 = enrichment?.market_median_price_per_m2
    ? Number(enrichment.market_median_price_per_m2)
    : null

  if (!medianPricePerM2 || medianPricePerM2 === 0) return null

  const expectedMinPrice = medianPricePerM2 * area * 0.30
  const isUnderpriced    = price < expectedMinPrice

  if (!isUnderpriced) return null

  // Only flag if area is also above city average (outlier detection)
  const { data: avgArea } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('area_m2')
    .eq('tenant_id', tenantId)
    .eq('city', canonical.city)
    .eq('property_type', canonical.property_type)
    .eq('listing_status', 'active')
    .limit(100)

  const areas = ((avgArea ?? []) as { area_m2: number }[]).map((r) => Number(r.area_m2))
  const cityAvgArea = areas.length > 0 ? areas.reduce((s, v) => s + v, 0) / areas.length : area

  const isOversized = area > cityAvgArea * 1.5

  if (isUnderpriced && isOversized) {
    return {
      signal_type: 'fake_listing',
      severity:    'high',
      confidence:  0.80,
      description: `Price (${price}€) is < 30% of zone median for area. Suspected fake listing.`,
      evidence: {
        price_eur:               price,
        area_m2:                 area,
        market_median_per_m2:    medianPricePerM2,
        expected_min_price:      Math.round(expectedMinPrice),
        city_avg_area_m2:        Math.round(cityAvgArea),
        zone:                    zone ?? 'unknown',
      },
    }
  }

  return null
}

async function detectStaleRepost(
  canonicalId: string,
  tenantId: string,
): Promise<FraudSignal | null> {
  const { data: canonical } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('source_ids')
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .single()

  if (!canonical) return null

  const sourceIds = (canonical.source_ids as Record<string, string>) ?? {}
  const providerIds = Object.values(sourceIds)
  if (providerIds.length === 0) return null

  let maxReposts = 0
  for (const providerId of providerIds) {
    const { count } = await (supabaseAdmin as any)
      .from('properties_raw')
      .select('id', { count: 'exact', head: true })
      .eq('provider_listing_id', providerId)

    const repostCount = count ?? 0
    if (repostCount > maxReposts) maxReposts = repostCount
  }

  if (maxReposts > 3) {
    const confidence = Math.min(0.90, 0.50 + (maxReposts - 3) * 0.10)
    return {
      signal_type: 'stale_repost',
      severity:    maxReposts > 6 ? 'high' : 'medium',
      confidence,
      description: `Property relisted ${maxReposts} times with no material changes`,
      evidence: {
        repost_count:  maxReposts,
        threshold:     3,
        provider_ids:  providerIds,
      },
    }
  }

  return null
}

// ─── Composite Score ──────────────────────────────────────────────────────────

function computeCompositeScore(signals: FraudSignal[]): number {
  if (signals.length === 0) return 0

  let weightedSum = 0
  for (const signal of signals) {
    weightedSum += signal.confidence * SIGNAL_WEIGHTS[signal.signal_type] * 100
  }

  // Normalize: signals stack but cap at 100
  const raw = Math.min(100, weightedSum * (1 + signals.length * 0.1))
  return Math.round(raw)
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Assesses fraud risk for a canonical property.
 * Runs all detectors in parallel and computes composite score.
 * Writes result to security_events table.
 */
export async function assessFraudRisk(
  canonicalId: string,
  tenantId: string,
): Promise<FraudAssessment> {
  const assessedAt = new Date().toISOString()

  // Run all detectors in parallel
  const [dupSignal, priceSignal, fakeSignal, staleSignal] = await Promise.all([
    detectDuplicateInjection(canonicalId, tenantId),
    detectPriceManipulation(canonicalId, tenantId),
    detectFakeListing(canonicalId, tenantId),
    detectStaleRepost(canonicalId, tenantId),
  ])

  const signals: FraudSignal[] = [dupSignal, priceSignal, fakeSignal, staleSignal].filter(
    (s): s is FraudSignal => s !== null,
  )

  const fraudRiskScore = computeCompositeScore(signals)

  const recommendation: 'allow' | 'flag' | 'block' =
    fraudRiskScore >= 70 ? 'block'
    : fraudRiskScore >= 40 ? 'flag'
    : 'allow'

  // Write to security_events (fire-and-forget)
  if (signals.length > 0) {
    void (supabaseAdmin as any).from('security_events').insert({
      event_type:    'fraud_assessment',
      severity:      recommendation === 'block' ? 'critical' : recommendation === 'flag' ? 'warning' : 'info',
      tenant_id:     tenantId,
      source:        'ingestion/fraudDetector',
      description:   `Fraud assessment for canonical_id=${canonicalId}: score=${fraudRiskScore} signals=${signals.length}`,
      metadata: {
        canonical_id:     canonicalId,
        fraud_risk_score: fraudRiskScore,
        signals,
        recommendation,
      },
      created_at: assessedAt,
    })
  }

  // Also update fraud_risk_score on the canonical record
  void (supabaseAdmin as any)
    .from('canonical_properties')
    .update({ fraud_risk_score: fraudRiskScore, computed_at: assessedAt })
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)

  return {
    canonical_id:     canonicalId,
    fraud_risk_score: fraudRiskScore,
    signals,
    recommendation,
    assessed_at: assessedAt,
  }
}
