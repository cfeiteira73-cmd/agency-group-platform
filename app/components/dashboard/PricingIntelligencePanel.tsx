'use client'

// AGENCY GROUP — SH-ROS | PricingIntelligencePanel | AMI: 22506
// Inline styles only. Zero Tailwind. All text in Portuguese.
// =============================================================================

import { useEffect, useState } from 'react'
import type { PricingIntelligenceCard, PricingRisk, DemandLevel } from '@/lib/pricing-intelligence'
import type { PricingDecisionEngine } from '@/lib/pricing-intelligence/advancedPricingIntelligence'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimulationRow {
  delta_pct: number
  listing_price: number | null
  pricing_risk: PricingRisk
  overpricing_probability: number
  estimated_days_on_market: number
  inquiry_rate_estimate: number
  conversion_probability: number
  recommendation: string
}

interface PricingResponse {
  base: PricingIntelligenceCard
  advanced: PricingDecisionEngine
  simulations: SimulationRow[]
  computed_at: string
}

interface Props {
  submissionId: string
  listingPrice?: number | null
  areaSqm?: number | null
  bedrooms?: number | null
  city?: string | null
  zone?: string | null
  condition?: string | null
  luxuryScore?: number | null
  hasPool?: boolean
  hasSeaView?: boolean
  demandScore?: number | null
  daysOnMarket?: number | null
}

// ---------------------------------------------------------------------------
// AG Brand tokens
// ---------------------------------------------------------------------------

const C = {
  bg:          '#0c1f15',
  card:        '#111e16',
  cardDeep:    'rgba(12,31,21,0.6)',
  border:      'rgba(201,169,110,0.15)',
  goldBorder:  'rgba(201,169,110,0.22)',
  divider:     'rgba(201,169,110,0.08)',
  gold:        '#c9a96e',
  goldDim:     'rgba(201,169,110,0.12)',
  cream:       '#f4f0e6',
  cream55:     'rgba(244,240,230,0.55)',
  cream28:     'rgba(244,240,230,0.28)',
  green:       '#4ade80',
  greenDim:    'rgba(74,222,128,0.1)',
  greenBorder: 'rgba(74,222,128,0.25)',
  err:         '#f87171',
  errDim:      'rgba(248,113,113,0.1)',
  errBorder:   'rgba(248,113,113,0.25)',
  amber:       '#fbbf24',
  amberDim:    'rgba(251,191,36,0.1)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(eur: number | null | undefined): string {
  if (eur === null || eur === undefined) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(eur)
}

function fmtTs(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function riskLabel(r: PricingRisk): string {
  if (r === 'optimal')     return 'Óptimo'
  if (r === 'overpriced')  return 'Sobrevalorizado'
  if (r === 'underpriced') return 'Subvalorizado'
  return 'Desconhecido'
}

function riskColor(r: PricingRisk): string {
  if (r === 'optimal')     return C.green
  if (r === 'overpriced')  return C.err
  if (r === 'underpriced') return C.amber
  return C.cream28
}

function riskBg(r: PricingRisk): string {
  if (r === 'optimal')     return C.greenDim
  if (r === 'overpriced')  return C.errDim
  if (r === 'underpriced') return C.amberDim
  return C.cardDeep
}

function riskBorder(r: PricingRisk): string {
  if (r === 'optimal')     return C.greenBorder
  if (r === 'overpriced')  return C.errBorder
  if (r === 'underpriced') return 'rgba(251,191,36,0.25)'
  return C.border
}

function demandLabel(d: DemandLevel): string {
  if (d === 'hot')      return 'Muito Alta'
  if (d === 'strong')   return 'Alta'
  if (d === 'moderate') return 'Moderada'
  if (d === 'slow')     return 'Baixa'
  return 'Desconhecida'
}

function demandColor(d: DemandLevel): string {
  if (d === 'hot')      return C.green
  if (d === 'strong')   return C.gold
  if (d === 'moderate') return C.amber
  if (d === 'slow')     return C.err
  return C.cream28
}

function decayActionLabel(action: string): string {
  if (action === 'hold')       return 'Manter'
  if (action === 'reduce_5pct') return 'Reduzir 5%'
  if (action === 'reduce_8pct') return 'Reduzir 8%'
  if (action === 'relaunch')   return 'Relançar'
  if (action === 'withdraw')   return 'Retirar'
  return action
}

function decayActionColor(action: string): string {
  if (action === 'hold')       return C.green
  if (action === 'reduce_5pct') return C.amber
  if (action === 'reduce_8pct') return C.err
  if (action === 'relaunch')   return C.err
  return C.cream28
}

function competitorLabel(p: string): string {
  if (p === 'none')     return 'Nenhuma'
  if (p === 'mild')     return 'Ligeira'
  if (p === 'moderate') return 'Moderada'
  if (p === 'severe')   return 'Severa'
  return p
}

function competitorColor(p: string): string {
  if (p === 'none')     return C.green
  if (p === 'mild')     return C.gold
  if (p === 'moderate') return C.amber
  if (p === 'severe')   return C.err
  return C.cream28
}

// ---------------------------------------------------------------------------
// Shimmer Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: '24px 28px',
      }}
    >
      <style>{`
        @keyframes ag-shimmer {
          0%   { background-position: -600px 0 }
          100% { background-position: 600px 0 }
        }
      `}</style>
      {[80, 120, 200].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 20 : i === 1 ? 48 : 90,
            borderRadius: 8,
            marginBottom: i < 2 ? 16 : 0,
            width: `${w}%`.replace('80%', '45%').replace('120%', '80%').replace('200%', '100%'),
            background: `linear-gradient(90deg, ${C.cardDeep} 25%, rgba(201,169,110,0.06) 50%, ${C.cardDeep} 75%)`,
            backgroundSize: '600px 100%',
            animation: 'ag-shimmer 1.5s infinite linear',
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PricingIntelligencePanel({
  submissionId,
  listingPrice,
  areaSqm,
  bedrooms,
  city,
  zone,
  condition,
  luxuryScore,
  hasPool = false,
  hasSeaView = false,
  demandScore,
  daysOnMarket,
}: Props) {
  const [data, setData]     = useState<PricingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (listingPrice != null) params.set('listing_price', String(listingPrice))
    if (areaSqm      != null) params.set('area_sqm',      String(areaSqm))
    if (bedrooms     != null) params.set('bedrooms',      String(bedrooms))
    if (city)                  params.set('city',          city)
    if (zone)                  params.set('zone',          zone)
    if (condition)             params.set('condition',     condition)
    if (luxuryScore  != null) params.set('luxury_score',  String(luxuryScore))
    if (hasPool)               params.set('has_pool',      'true')
    if (hasSeaView)            params.set('has_sea_view',  'true')
    if (demandScore  != null) params.set('demand_score',  String(demandScore))
    if (daysOnMarket != null) params.set('days_on_market', String(daysOnMarket))

    fetch(`/api/pricing-intelligence?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<PricingResponse>
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar')
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])

  if (loading) return <Skeleton />

  if (error || !data) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.errBorder}`,
          borderRadius: 20,
          padding: '20px 24px',
          color: C.err,
          fontSize: 13,
          fontFamily: 'var(--font-jost, system-ui)',
        }}
      >
        Inteligência de preço indisponível: {error ?? 'sem dados'}
      </div>
    )
  }

  const { base, advanced, simulations, computed_at } = data

  // Best simulation row index (highest conversion_probability)
  const bestSimIdx = simulations.reduce(
    (best, row, i) => (row.conversion_probability > simulations[best].conversion_probability ? i : best),
    0,
  )

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: '24px 28px',
        fontFamily: 'var(--font-jost, system-ui)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 22,
            fontWeight: 400,
            color: C.gold,
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          Inteligência de Preço
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Confidence chip */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              borderRadius: 99,
              background: C.goldDim,
              border: `1px solid ${C.goldBorder}`,
              color: C.gold,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {base.price_confidence_label}
            <span style={{ color: C.cream28 }}>·</span>
            <span style={{ color: C.cream55 }}>{base.confidence}%</span>
          </span>
          {/* Timestamp */}
          <span style={{ color: C.cream28, fontSize: 11 }}>
            {fmtTs(computed_at)}
          </span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.divider}` }} />

      {/* ── 2. AVM 3-column KPI row ───────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
        }}
      >
        {/* AVM Mínimo */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '16px 18px',
            border: `1px solid ${C.greenBorder}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            AVM Mínimo
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 22,
              color: C.green,
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            {fmt(base.avm_low)}
          </p>
        </div>

        {/* AVM Base */}
        <div
          style={{
            background: C.goldDim,
            borderRadius: 12,
            padding: '16px 18px',
            border: `1px solid ${C.goldBorder}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            AVM Base
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 28,
              color: C.gold,
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            {fmt(base.avm_base)}
          </p>
        </div>

        {/* AVM Máximo */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '16px 18px',
            border: `1px solid rgba(251,191,36,0.25)`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            AVM Máximo
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 22,
              color: C.amber,
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            {fmt(base.avm_high)}
          </p>
        </div>
      </div>

      {/* ── 3. Pricing Risk bar ───────────────────────────────────────────── */}
      <div
        style={{
          background: C.cardDeep,
          borderRadius: 12,
          padding: '16px 18px',
          border: `1px solid ${riskBorder(base.pricing_risk)}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: C.cream28,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            Risco de Preço
          </p>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 99,
              background: riskBg(base.pricing_risk),
              border: `1px solid ${riskBorder(base.pricing_risk)}`,
              color: riskColor(base.pricing_risk),
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {riskLabel(base.pricing_risk)}
          </span>
        </div>

        {/* Overpricing probability bar */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 11, color: C.cream28 }}>Probabilidade de sobrevalorização</span>
            <span style={{ fontSize: 11, color: riskColor(base.pricing_risk), fontWeight: 600 }}>
              {base.overpricing_probability}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: C.border,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${base.overpricing_probability}%`,
                background: riskColor(base.pricing_risk),
                borderRadius: 3,
                transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 4. 4-metric grid ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 12,
        }}
      >
        {/* Dias Estimados no Mercado */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Dias no Mercado
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 24,
              color: C.cream,
              margin: 0,
            }}
          >
            {base.estimated_days_on_market}
          </p>
        </div>

        {/* Procura */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Procura
          </p>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 99,
              background: `${demandColor(base.demand_level)}18`,
              border: `1px solid ${demandColor(base.demand_level)}40`,
              color: demandColor(base.demand_level),
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {demandLabel(base.demand_level)}
          </span>
        </div>

        {/* Taxa de Inquéritos */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Inquéritos / semana
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 24,
              color: C.cream,
              margin: 0,
            }}
          >
            {base.inquiry_rate_estimate}
          </p>
        </div>

        {/* Probabilidade de Venda */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Prob. de Venda
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 24,
              color: base.conversion_probability >= 60 ? C.green : base.conversion_probability >= 40 ? C.gold : C.amber,
              margin: 0,
            }}
          >
            {base.conversion_probability}%
          </p>
        </div>
      </div>

      {/* ── 5. Elasticity + Decay row ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
        }}
      >
        {/* Elasticidade */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Elasticidade de Preço
          </p>
          <p
            style={{
              fontSize: 13,
              color: C.cream55,
              margin: 0,
              fontWeight: 500,
            }}
          >
            {advanced.elasticity.price_elasticity.toFixed(1)}
            <span style={{ color: C.cream28, fontSize: 11, marginLeft: 4 }}>por 1%</span>
          </p>
        </div>

        {/* Risco de Estagnação */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Risco de Estagnação
          </p>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 99,
              background: `${decayActionColor(advanced.decay.recommended_action)}18`,
              border: `1px solid ${decayActionColor(advanced.decay.recommended_action)}40`,
              color: decayActionColor(advanced.decay.recommended_action),
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {decayActionLabel(advanced.decay.recommended_action)}
          </span>
        </div>

        {/* Pressão Concorrencial */}
        <div
          style={{
            background: C.cardDeep,
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            Pressão Concorrencial
          </p>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 99,
              background: `${competitorColor(advanced.competitor_price_pressure)}18`,
              border: `1px solid ${competitorColor(advanced.competitor_price_pressure)}40`,
              color: competitorColor(advanced.competitor_price_pressure),
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {competitorLabel(advanced.competitor_price_pressure)}
          </span>
        </div>
      </div>

      {/* ── 6. Luxury Premium (conditional) ──────────────────────────────── */}
      {base.luxury_premium_potential > 0 && (
        <div
          style={{
            background: C.goldDim,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 12,
            padding: '16px 20px',
          }}
        >
          <p
            style={{
              color: C.cream28,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            Potencial Premium de Luxo
          </p>
          <p
            style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 22,
              color: C.gold,
              margin: '0 0 8px',
            }}
          >
            +{fmt(base.luxury_premium_potential)}
          </p>
          <p style={{ fontSize: 12, color: C.cream55, margin: 0, lineHeight: 1.6 }}>
            {base.recommendation}
          </p>
        </div>
      )}

      {/* ── 7. Price Simulation table ─────────────────────────────────────── */}
      <div>
        <p
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 18,
            color: C.cream,
            fontWeight: 400,
            margin: '0 0 12px',
            letterSpacing: '0.02em',
          }}
        >
          E se o preço mudar?
        </p>
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
              background: C.cardDeep,
              borderBottom: `1px solid ${C.border}`,
              padding: '10px 16px',
              gap: 8,
            }}
          >
            {['Variação', 'Novo Preço', 'Dias no Mercado', 'Prob. Conversão', 'Inquéritos/sem'].map((h) => (
              <p
                key={h}
                style={{
                  fontSize: 10,
                  color: C.cream28,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                {h}
              </p>
            ))}
          </div>

          {/* Table rows */}
          {simulations.map((row, i) => {
            const isBest = i === bestSimIdx
            const isHovered = hoveredRow === i
            const isNeg = row.delta_pct < 0
            const deltaColor = isNeg ? C.green : row.delta_pct > 0 ? C.amber : C.cream55

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                  padding: '12px 16px',
                  gap: 8,
                  borderBottom: i < simulations.length - 1 ? `1px solid ${C.divider}` : 'none',
                  background: isBest
                    ? C.goldDim
                    : isHovered
                    ? 'rgba(244,240,230,0.03)'
                    : 'transparent',
                  transition: 'background 0.15s',
                  cursor: 'default',
                  alignItems: 'center',
                }}
              >
                {/* Delta % */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: deltaColor,
                  }}
                >
                  {row.delta_pct > 0 ? '+' : ''}{row.delta_pct}%
                </span>

                {/* Novo Preço */}
                <span
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: 15,
                    color: C.cream,
                  }}
                >
                  {fmt(row.listing_price)}
                </span>

                {/* Dias no Mercado */}
                <span style={{ fontSize: 13, color: isNeg ? C.green : C.cream55 }}>
                  {row.estimated_days_on_market}d
                </span>

                {/* Prob. Conversão */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: row.conversion_probability >= 60 ? C.green : row.conversion_probability >= 40 ? C.gold : C.amber,
                    }}
                  >
                    {row.conversion_probability}%
                  </span>
                  {isBest && (
                    <span
                      style={{
                        fontSize: 9,
                        color: C.gold,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        border: `1px solid ${C.goldBorder}`,
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      Melhor
                    </span>
                  )}
                </div>

                {/* Inquéritos/sem */}
                <span style={{ fontSize: 13, color: C.cream55 }}>
                  {row.inquiry_rate_estimate}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 8. Recommendation box ─────────────────────────────────────────── */}
      <div
        style={{
          borderLeft: `3px solid ${C.gold}`,
          paddingLeft: 16,
          background: C.cardDeep,
          borderRadius: '0 10px 10px 0',
          padding: '14px 18px 14px 20px',
        }}
      >
        <p
          style={{
            fontSize: 10,
            color: C.cream28,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}
        >
          Recomendação
        </p>
        <p
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 16,
            color: C.cream55,
            fontStyle: 'italic',
            margin: 0,
            lineHeight: 1.7,
            letterSpacing: '0.01em',
          }}
        >
          {advanced.base_card.recommendation}
        </p>
      </div>
    </div>
  )
}
