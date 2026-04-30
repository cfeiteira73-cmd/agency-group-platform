// =============================================================================
// Agency Group — Property Signal Detector
// lib/scoring/signalDetector.ts
//
// Detects actionable market signals on any property and generates:
//   - property_signals rows (for the signals table)
//   - priority_items rows (for the priority queue)
//
// Signal types (matches signal_type enum in 001_initial_schema.sql):
//   price_reduction      — price dropped ≥ 5% vs previous
//   stagnated_listing    — DOM > 1.5× zone median
//   new_below_avm        — listed below AVM estimate
//   hot_zone_new         — new listing in zone with demanda ≥ 8
//   listing_removed      — property set to withdrawn/sold externally
//
// Pure functions — no DB side effects. Caller writes to DB.
// =============================================================================

import { ZoneMarket, getZone, resolvePropertyZone } from '@/lib/market/zones'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DetectedSignalType =
  | 'price_reduction'
  | 'stagnated_listing'
  | 'new_below_avm'
  | 'hot_zone_new'
  | 'listing_removed'

export interface DetectedSignal {
  signal_type:    DetectedSignalType
  severity:       'HIGH' | 'MEDIUM' | 'LOW'
  title:          string          // Short title for UI
  description:    string          // Human-readable detail
  metadata:       Record<string, unknown>   // Signal-specific data
  priority_score: number          // 0-100 for priority_items table
  revenue_impact: number          // Estimated € revenue impact
  action_label:   string          // CTA: "Contact Owner", "Send Deal Pack", etc.
}

export interface SignalPropertyInput {
  id?:              string
  price:            number
  price_previous?:  number | null
  price_per_sqm?:   number | null
  avm_estimate?:    number | null
  area_m2?:         number | null
  days_on_market?:  number | null
  status?:          string | null
  zone?:            string | null
  zona?:            string | null
  city?:            string | null
  concelho?:        string | null
  address?:         string | null
  titulo?:          string | null
  title?:           string | null
  type?:            string | null
  created_at?:      string | null
}

// ---------------------------------------------------------------------------
// Thresholds (configurable constants)
// ---------------------------------------------------------------------------

const PRICE_REDUCTION_THRESHOLD = 0.05      // 5% drop triggers signal
const PRICE_REDUCTION_HIGH      = 0.10      // 10%+ = HIGH severity
const DOM_STALE_RATIO           = 1.5       // 1.5× zone median = stale
const DOM_SEVERELY_STALE_RATIO  = 2.5       // 2.5× = HIGH severity
const AVM_DISCOUNT_THRESHOLD    = 0.05      // 5% below AVM triggers signal
const AVM_DISCOUNT_HIGH         = 0.12      // 12%+ below AVM = HIGH severity
const HOT_ZONE_DEMAND_MIN       = 8.0       // Zone demanda ≥ 8 = hot zone
const NEW_LISTING_DAYS          = 3         // "New" = on market ≤ 3 days

// ---------------------------------------------------------------------------
// Revenue impact estimation
// Rough: commission = 5% of deal value; impact = probability × commission
// ---------------------------------------------------------------------------

function estimateRevenueImpact(price: number, probability: number): number {
  const commission = price * 0.05
  return Math.round(commission * probability)
}

// ---------------------------------------------------------------------------
// Detect: price reduction
// ---------------------------------------------------------------------------

function detectPriceReduction(
  p: SignalPropertyInput,
): DetectedSignal | null {
  const { price, price_previous } = p
  if (!price_previous || price_previous <= 0 || price >= price_previous) return null

  const reduction = (price_previous - price) / price_previous
  if (reduction < PRICE_REDUCTION_THRESHOLD) return null

  const isHigh     = reduction >= PRICE_REDUCTION_HIGH
  const severity   = isHigh ? 'HIGH' : 'MEDIUM'
  const pct        = (reduction * 100).toFixed(1)
  const saved      = Math.round(price_previous - price)

  return {
    signal_type:    'price_reduction',
    severity,
    title:          `Redução de preço -${pct}%`,
    description:    `Preço desceu de €${price_previous.toLocaleString('pt-PT')} para €${price.toLocaleString('pt-PT')} (-${pct}%, -€${saved.toLocaleString('pt-PT')})`,
    metadata: {
      price_previous,
      price_current:   price,
      reduction_pct:   parseFloat(pct),
      reduction_eur:   saved,
    },
    priority_score: isHigh ? 90 : 72,
    revenue_impact: estimateRevenueImpact(price, isHigh ? 0.35 : 0.20),
    action_label:   'Contactar Proprietário',
  }
}

// ---------------------------------------------------------------------------
// Detect: stagnated listing (DOM > threshold)
// ---------------------------------------------------------------------------

function detectStaleListing(
  p:    SignalPropertyInput,
  zone: ZoneMarket,
): DetectedSignal | null {
  const { days_on_market } = p
  if (!days_on_market || days_on_market <= 0) return null

  const ratio = days_on_market / zone.dias_mercado
  if (ratio < DOM_STALE_RATIO) return null

  const isSevere   = ratio >= DOM_SEVERELY_STALE_RATIO
  const severity   = isSevere ? 'HIGH' : 'MEDIUM'

  return {
    signal_type:    'stagnated_listing',
    severity,
    title:          `${days_on_market} dias no mercado`,
    description:    `Imóvel há ${days_on_market} dias (mediana da zona: ${zone.dias_mercado} dias — ${ratio.toFixed(1)}× acima). Proprietário potencialmente motivado para negociar.`,
    metadata: {
      days_on_market,
      zone_median_dom:    zone.dias_mercado,
      dom_ratio:          parseFloat(ratio.toFixed(2)),
    },
    priority_score: isSevere ? 85 : 65,
    revenue_impact: estimateRevenueImpact(p.price, isSevere ? 0.30 : 0.15),
    action_label:   'Abordar Proprietário',
  }
}

// ---------------------------------------------------------------------------
// Detect: listed below AVM (motivated seller / underpriced opportunity)
// ---------------------------------------------------------------------------

function detectBelowAvm(
  p:    SignalPropertyInput,
  zone: ZoneMarket,
): DetectedSignal | null {
  const { price, avm_estimate, price_per_sqm, area_m2 } = p

  if (price <= 0) return null

  let discount = 0
  let referenceLabel = ''

  if (avm_estimate && avm_estimate > 0) {
    discount       = (avm_estimate - price) / avm_estimate
    referenceLabel = 'AVM'
  } else {
    // Fallback: compare price/m² vs zone pm2_trans
    let ppm2 = price_per_sqm
    if (!ppm2 && area_m2 && area_m2 > 0) ppm2 = price / area_m2
    if (!ppm2 || ppm2 <= 0) return null

    discount       = (zone.pm2_trans - ppm2) / zone.pm2_trans
    referenceLabel = `mediana da zona (€${zone.pm2_trans}/m²)`
  }

  if (discount < AVM_DISCOUNT_THRESHOLD) return null

  const isHigh   = discount >= AVM_DISCOUNT_HIGH
  const severity = isHigh ? 'HIGH' : 'MEDIUM'
  const pct      = (discount * 100).toFixed(1)

  return {
    signal_type:    'new_below_avm',
    severity,
    title:          `${pct}% abaixo do ${referenceLabel}`,
    description:    `Imóvel listado ${pct}% abaixo de ${referenceLabel}. Potencial de valorização imediata ou margem de negociação.`,
    metadata: {
      price,
      avm_or_zone_median: avm_estimate ?? (zone.pm2_trans * (area_m2 ?? 0)),
      discount_pct:       parseFloat(pct),
      reference:          referenceLabel,
    },
    priority_score: isHigh ? 95 : 75,
    revenue_impact: estimateRevenueImpact(price, isHigh ? 0.40 : 0.25),
    action_label:   'Gerar Deal Pack',
  }
}

// ---------------------------------------------------------------------------
// Detect: new listing in hot zone
// ---------------------------------------------------------------------------

function detectHotZoneNew(
  p:    SignalPropertyInput,
  zone: ZoneMarket,
): DetectedSignal | null {
  const { created_at, days_on_market } = p

  // Check if new listing
  const isNew = (() => {
    if (days_on_market !== null && days_on_market !== undefined && days_on_market <= NEW_LISTING_DAYS) return true
    if (created_at) {
      const age = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24)
      return age <= NEW_LISTING_DAYS
    }
    return false
  })()

  if (!isNew) return null
  if (zone.demanda < HOT_ZONE_DEMAND_MIN) return null

  const severity = zone.demanda >= 9 ? 'HIGH' : 'MEDIUM'

  return {
    signal_type:    'hot_zone_new',
    severity,
    title:          `Nova listagem — zona quente (demanda ${zone.demanda}/10)`,
    description:    `Novo imóvel em ${zone.region} (demanda ${zone.demanda}/10, ${zone.comp_int_pct}% compradores internacionais, absorção ${zone.abs_meses} meses). Actuar rapidamente.`,
    metadata: {
      zone_demand:          zone.demanda,
      zone_intl_pct:        zone.comp_int_pct,
      zone_absorption_months: zone.abs_meses,
      zone_dom_median:      zone.dias_mercado,
    },
    priority_score: severity === 'HIGH' ? 88 : 70,
    revenue_impact: estimateRevenueImpact(p.price, severity === 'HIGH' ? 0.30 : 0.20),
    action_label:   'Matchear Compradores',
  }
}

// ---------------------------------------------------------------------------
// Detect: listing removed / withdrawn (potential off-market negotiation)
// ---------------------------------------------------------------------------

function detectListingRemoved(
  p: SignalPropertyInput,
): DetectedSignal | null {
  if (p.status !== 'withdrawn' && p.status !== 'listing_removed') return null

  return {
    signal_type:    'listing_removed',
    severity:       'MEDIUM',
    title:          'Imóvel removido do mercado',
    description:    'Imóvel retirado do portal. Possível negociação directa em curso ou proprietário aberto a proposta privada.',
    metadata: {
      status: p.status,
    },
    priority_score: 60,
    revenue_impact: estimateRevenueImpact(p.price, 0.15),
    action_label:   'Contactar Proprietário',
  }
}

// ---------------------------------------------------------------------------
// Main export: detectSignals
// Returns all triggered signals for a property
// ---------------------------------------------------------------------------

export function detectSignals(property: SignalPropertyInput): DetectedSignal[] {
  const zone_key = resolvePropertyZone(property)
  const zone     = getZone(zone_key)

  const signals: DetectedSignal[] = []

  const priceReduction = detectPriceReduction(property)
  if (priceReduction) signals.push(priceReduction)

  const staleListing = detectStaleListing(property, zone)
  if (staleListing) signals.push(staleListing)

  const belowAvm = detectBelowAvm(property, zone)
  if (belowAvm) signals.push(belowAvm)

  const hotZoneNew = detectHotZoneNew(property, zone)
  if (hotZoneNew) signals.push(hotZoneNew)

  const removed = detectListingRemoved(property)
  if (removed) signals.push(removed)

  // Sort: HIGH first, then by priority_score desc
  return signals.sort((a, b) => {
    if (a.severity === b.severity) return b.priority_score - a.priority_score
    if (a.severity === 'HIGH')     return -1
    if (b.severity === 'HIGH')     return 1
    if (a.severity === 'MEDIUM')   return -1
    return 1
  })
}

// ---------------------------------------------------------------------------
// Export: build priority_items row from signal
// ---------------------------------------------------------------------------

export function signalToPriorityItem(
  propertyId:    string,
  agentEmail:    string,
  signal:        DetectedSignal,
  tenantId?:     string,
): Record<string, unknown> {
  const now     = new Date()
  const deadline = new Date(now.getTime() + 72 * 60 * 60 * 1000)  // 72h default

  return {
    owner_id:          agentEmail,
    entity_type:       'property',
    entity_id:         propertyId,
    priority_score:    signal.priority_score,
    priority_level:    signal.priority_score >= 80 ? 'HIGH' : signal.priority_score >= 60 ? 'MEDIUM' : 'LOW',
    title:             signal.title,
    description:       signal.description,
    action_required:   signal.action_label,
    revenue_impact:    signal.revenue_impact,
    deadline:          deadline.toISOString(),
    signal_type:       signal.signal_type,
    metadata:          signal.metadata,
    status:            'pending',
    tenant_id:         tenantId ?? null,
    created_at:        now.toISOString(),
    updated_at:        now.toISOString(),
  }
}
