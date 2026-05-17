'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// Executive Revenue Dashboard — world-class C-suite intelligence interface
// AG brand: dark forest green + gold. All styles inline. Cormorant + Jost.
// =============================================================================

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { RadarSignal } from '@/lib/executive/opportunityRadar'

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:          '#0c1f15',
  card:        '#111e16',
  cardHover:   '#162a1c',
  border:      'rgba(201,169,110,0.15)',
  borderHov:   'rgba(201,169,110,0.35)',
  divider:     'rgba(201,169,110,0.08)',
  gold:        '#c9a96e',
  goldDim:     'rgba(201,169,110,0.12)',
  goldBorder:  'rgba(201,169,110,0.22)',
  goldGrad:    'linear-gradient(135deg,rgba(201,169,110,0.18) 0%,rgba(201,169,110,0.06) 100%)',
  cream:       '#f4f0e6',
  cream55:     'rgba(244,240,230,0.55)',
  cream28:     'rgba(244,240,230,0.28)',
  cream10:     'rgba(244,240,230,0.08)',
  red:         'rgba(248,113,113,0.9)',
  redBg:       'rgba(176,58,46,0.1)',
  redBorder:   'rgba(176,58,46,0.3)',
  green:       '#4ade80',
  greenBg:     'rgba(45,106,79,0.2)',
  greenBorder: 'rgba(45,106,79,0.5)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Revenue intelligence types (mirrors lib/executive-revenue-v2, kept local to avoid 'use client' crossing server lib)

interface RevenueLeakageItem {
  property_id: string
  leakage_type: 'overpriced' | 'underpriced' | 'stale' | 'low_demand' | 'missing_photos'
  estimated_leakage_eur: number
  priority: 'critical' | 'high' | 'medium'
  action_required: string
}

interface AgentRankEntry {
  agent_id: string
  rank: number
  revenue_score: number
  total_commission_eur: number
  efficiency_score: number
  performance_label: 'elite' | 'strong' | 'developing' | 'needs_support'
}

interface DashboardData {
  pipeline_value_eur: number
  commission_estimate_eur: number
  live_listings: number
  processing_listings: number
  total_submissions: number
  avg_demand_score: number
  homepage_ready: number
  contacts_total: number
  hot_leads: number
  deals_active: number
  deals_value_eur: number
  revenue_this_month_eur: number
  opportunities: RadarSignal[]
  narrative: string
  generated_at: string
  // ── Revenue intelligence extensions ──────────────────────────────────────
  leakage_items?: RevenueLeakageItem[]
  total_leakage_monthly_eur?: number
  snapshot_narrative?: string
  agent_rankings?: AgentRankEntry[]
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n === 0) return '€0'
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `€${(m % 1 === 0 ? m.toFixed(0) : m.toFixed(1))}M`
  }
  return `€${new Intl.NumberFormat('pt-PT').format(Math.round(n))}`
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: 'short',
  }).format(new Date(iso))
}

// ─── Urgency badge ────────────────────────────────────────────────────────────

const URGENCY_META: Record<RadarSignal['urgency'], { label: string; bg: string; color: string; border: string }> = {
  immediate: { label: 'Imediato',      bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  today:     { label: 'Hoje',          bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  this_week: { label: 'Esta Semana',   bg: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: 'rgba(201,169,110,0.3)' },
  this_month:{ label: 'Este Mês',      bg: 'rgba(74,222,128,0.1)',   color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
}

function UrgencyBadge({ urgency }: { urgency: RadarSignal['urgency'] }) {
  const m = URGENCY_META[urgency]
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 99,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
      textTransform: 'uppercase', fontFamily: 'var(--font-jost,system-ui)',
      whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: string
  label: string
  value: string
  sub?: string
  isGold?: boolean
}

function KpiCard({ icon, label, value, sub, isGold = false }: KpiCardProps) {
  return (
    <div style={{
      background: isGold ? C.goldGrad : C.card,
      border: `1px solid ${isGold ? C.goldBorder : C.border}`,
      borderRadius: 18,
      padding: '22px 24px',
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      {isGold && (
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(201,169,110,0.06)',
          pointerEvents: 'none',
        }} />
      )}
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: isGold ? 'rgba(201,169,110,0.18)' : C.goldDim,
        border: `1px solid ${C.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Value */}
      <div>
        <p style={{
          fontFamily: 'var(--font-cormorant,serif)',
          fontSize: 34, fontWeight: 600, lineHeight: 1,
          color: isGold ? C.gold : C.cream,
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>
          {value}
        </p>
        {sub && (
          <p style={{
            color: isGold ? 'rgba(201,169,110,0.6)' : C.cream28,
            fontSize: 11, marginTop: 3, letterSpacing: '0.04em',
            fontFamily: 'var(--font-jost,system-ui)',
          }}>
            {sub}
          </p>
        )}
      </div>

      {/* Label */}
      <p style={{
        color: isGold ? 'rgba(201,169,110,0.7)' : C.cream28,
        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        fontWeight: 600, fontFamily: 'var(--font-jost,system-ui)', margin: 0,
        marginTop: 'auto',
      }}>
        {label}
      </p>
    </div>
  )
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OpportunityCard({ signal, index }: { signal: RadarSignal; index: number }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${C.gold}`,
      borderRadius: '0 14px 14px 0',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color 0.2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: C.goldDim, border: `1px solid ${C.goldBorder}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: C.gold, fontWeight: 700, flexShrink: 0,
            fontFamily: 'var(--font-jost,system-ui)',
          }}>
            {index + 1}
          </span>
          <span style={{
            color: C.cream, fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-jost,system-ui)', lineHeight: 1.3,
          }}>
            {signal.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <UrgencyBadge urgency={signal.urgency} />
          <span style={{
            fontFamily: 'var(--font-cormorant,serif)',
            fontSize: 18, fontWeight: 600, color: C.gold,
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            {fmtCurrency(signal.expected_value_eur)}
          </span>
        </div>
      </div>

      {/* Description */}
      <p style={{
        color: C.cream55, fontSize: 12, lineHeight: 1.6,
        fontFamily: 'var(--font-jost,system-ui)', margin: 0,
      }}>
        {signal.description}
      </p>

      {/* Recommended action */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        background: 'rgba(201,169,110,0.05)',
        border: `1px solid ${C.divider}`,
        borderRadius: 8, padding: '8px 12px',
      }}>
        <span style={{ color: C.gold, fontSize: 12, flexShrink: 0, marginTop: 1 }}>→</span>
        <p style={{
          color: C.cream55, fontSize: 12, margin: 0, lineHeight: 1.5,
          fontFamily: 'var(--font-jost,system-ui)',
        }}>
          {signal.recommended_action}
        </p>
      </div>

      {/* Probability bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          color: C.cream28, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'var(--font-jost,system-ui)', whiteSpace: 'nowrap',
        }}>
          Prob. {Math.round(signal.probability * 100)}%
        </span>
        <div style={{ flex: 1, height: 2, background: C.cream10, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: C.gold, borderRadius: 99,
            width: `${Math.round(signal.probability * 100)}%`,
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── Copilot Section ──────────────────────────────────────────────────────────

function CopilotSection() {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAsk = async () => {
    const q = question.trim()
    if (!q || asking) return
    setAsking(true)
    setResponse(null)

    try {
      const res = await fetch('/api/executive/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, org_id: 'agency-group', user_role: 'executive' }),
      })

      if (res.ok) {
        const data = await res.json() as { message?: string; response?: string }
        setResponse(data.message ?? data.response ?? 'Resposta recebida.')
      } else {
        // Fallback: copilot not deployed — generate a local placeholder
        setResponse(buildLocalResponse(q))
      }
    } catch {
      setResponse(buildLocalResponse(q))
    } finally {
      setAsking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleAsk()
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.goldBorder}`,
      borderRadius: 20,
      padding: '28px 28px',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: C.goldDim, border: `1px solid ${C.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          ✦
        </div>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-cormorant,serif)',
            fontSize: 22, fontWeight: 400, color: C.cream,
            margin: 0, letterSpacing: '0.02em',
          }}>
            Revenue <span style={{ color: C.gold, fontStyle: 'italic' }}>Copilot</span>
          </h3>
          <p style={{
            color: C.cream28, fontSize: 11, margin: 0, marginTop: 2,
            fontFamily: 'var(--font-jost,system-ui)', letterSpacing: '0.04em',
          }}>
            Inteligência executiva · AMI 22506
          </p>
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Faça uma pergunta ao Revenue Copilot…"
          style={{
            flex: 1, background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 16px',
            color: C.cream, fontSize: 13, outline: 'none',
            fontFamily: 'var(--font-jost,system-ui)',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = C.goldBorder)}
          onBlur={e => (e.target.style.borderColor = C.border)}
          disabled={asking}
        />
        <button
          type="button"
          onClick={() => void handleAsk()}
          disabled={asking || !question.trim()}
          style={{
            padding: '12px 22px', borderRadius: 10,
            background: asking ? 'rgba(201,169,110,0.4)' : C.gold,
            color: '#0c1f15', border: 'none',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            cursor: asking || !question.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-jost,system-ui)',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
            opacity: !question.trim() ? 0.5 : 1,
            boxShadow: asking ? 'none' : '0 4px 14px rgba(201,169,110,0.2)',
          }}
        >
          {asking ? '…' : 'Perguntar'}
        </button>
      </div>

      {/* Response block */}
      {(asking || response) && (
        <div style={{
          marginTop: 16,
          background: 'rgba(201,169,110,0.04)',
          border: `1px solid ${C.divider}`,
          borderRadius: 12, padding: '18px 20px',
          minHeight: 56,
        }}>
          {asking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `2px solid ${C.border}`, borderTopColor: C.gold,
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <span style={{ color: C.cream28, fontSize: 12, fontFamily: 'var(--font-jost,system-ui)' }}>
                Copilot a processar…
              </span>
            </div>
          ) : (
            <p style={{
              fontFamily: 'var(--font-cormorant,serif)',
              fontSize: 17, lineHeight: 1.7, color: C.cream,
              margin: 0, whiteSpace: 'pre-wrap',
              fontStyle: 'normal',
            }}>
              {response}
            </p>
          )}
        </div>
      )}

      {/* Suggested prompts */}
      {!response && !asking && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {[
            'Qual é o estado da receita este mês?',
            'Quais são os top riscos do pipeline?',
            'Qual é o forecast a 90 dias?',
            'Mostra as oportunidades prioritárias.',
          ].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setQuestion(p); inputRef.current?.focus() }}
              style={{
                padding: '5px 12px', borderRadius: 99,
                background: C.cream10, border: `1px solid ${C.border}`,
                color: C.cream55, fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-jost,system-ui)',
                transition: 'all 0.15s', letterSpacing: '0.02em',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Local copilot fallback (when endpoint not deployed) ──────────────────────

function buildLocalResponse(question: string): string {
  const q = question.toLowerCase()

  if (q.includes('receita') || q.includes('revenue') || q.includes('comissão') || q.includes('commission')) {
    return 'O sistema de receita está operacional. Para dados em tempo real, consulte os KPI cards acima. A comissão estimada reflecte 5% sobre o valor total do pipeline de imóveis live.'
  }
  if (q.includes('risco') || q.includes('risk') || q.includes('pipeline')) {
    return 'O pipeline está activo. Deals sem actividade há 14+ dias representam risco de perda — o radar de oportunidades assinala estes casos como "Stale Deal". Recomenda-se re-engagement com nova proposta de valor.'
  }
  if (q.includes('forecast') || q.includes('previsão') || q.includes('90 dias')) {
    return 'Mercado Portugal 2026: €3.076/m² mediana, +17.6% YoY, 169.812 transacções. Janela de fecho médio: 210 dias. Segmento core €500K–€3M em crescimento. Perspectiva base: manutenção de comissionamento com potencial de upside em Cascais e Algarve.'
  }
  if (q.includes('oportunidade') || q.includes('opportunity') || q.includes('lead')) {
    return 'As oportunidades prioritárias estão visíveis na secção "Radar de Oportunidades" acima. Foque-se nos sinais com urgência "Imediato" ou "Hoje" para maximizar conversão este mês.'
  }

  return (
    'Revenue Copilot disponível. Posso ajudar com: estado de receita, saúde do pipeline, ' +
    'oportunidades prioritárias, riscos, forecast a 30/90/180 dias, e inteligência de mercado Portugal.\n\n' +
    'Experimente: "Qual é o forecast a 90 dias?" ou "Quais são os top riscos?"'
  )
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

function GoldSpinner() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '40vh', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: `2px solid rgba(201,169,110,0.15)`,
        borderTopColor: C.gold,
        animation: 'spin 0.9s linear infinite',
      }} />
      <p style={{
        color: C.cream28, fontSize: 12,
        fontFamily: 'var(--font-jost,system-ui)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        Carregando dados executivos…
      </p>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: C.goldDim, border: `1px solid ${C.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-cormorant,serif)',
          fontSize: 22, fontWeight: 400, color: C.cream,
          margin: 0, letterSpacing: '0.02em',
        }}>
          {title}
        </h2>
        {sub && (
          <p style={{
            color: C.cream28, fontSize: 11, margin: 0, marginTop: 2,
            fontFamily: 'var(--font-jost,system-ui)', letterSpacing: '0.04em',
          }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Leakage type label (PT) ──────────────────────────────────────────────────

const LEAKAGE_LABELS: Record<RevenueLeakageItem['leakage_type'], string> = {
  overpriced:     'Preço acima do mercado',
  underpriced:    'Preço abaixo do mercado',
  stale:          'Imóvel estagnado',
  low_demand:     'Procura baixa',
  missing_photos: 'Sem fotografias',
}

const PRIORITY_META: Record<RevenueLeakageItem['priority'], { label: string; bg: string; color: string; border: string }> = {
  critical: { label: 'Crítico', bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  high:     { label: 'Alto',    bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  medium:   { label: 'Médio',   bg: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: 'rgba(201,169,110,0.3)' },
}

// ─── Revenue Leakage Section ──────────────────────────────────────────────────

function RevenueLeakageSection({
  items,
  totalLeakage,
}: {
  items: RevenueLeakageItem[]
  totalLeakage: number
}) {
  const visible = items.slice(0, 5)

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: C.redBg, border: `1px solid ${C.redBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          ⚠
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{
            fontFamily: 'var(--font-cormorant,serif)',
            fontSize: 22, fontWeight: 400, color: C.cream,
            margin: 0, letterSpacing: '0.02em',
          }}>
            Receita em Risco
          </h2>
          {/* Pulsing red dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: C.red, display: 'inline-block',
            animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />
        </div>
      </div>

      {/* Total leakage card */}
      <div style={{
        background: C.redBg,
        border: `1px solid ${C.redBorder}`,
        borderRadius: 16, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 20,
        marginBottom: 14,
      }}>
        <div>
          <p style={{
            color: 'rgba(248,113,113,0.6)', fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            fontWeight: 600, fontFamily: 'var(--font-jost,system-ui)',
            margin: '0 0 4px',
          }}>
            Fuga Total Estimada
          </p>
          <p style={{
            fontFamily: 'var(--font-cormorant,serif)',
            fontSize: 42, fontWeight: 600, lineHeight: 1,
            color: C.red, margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtCurrency(totalLeakage)}
            <span style={{
              fontFamily: 'var(--font-jost,system-ui)',
              fontSize: 14, fontWeight: 400, color: 'rgba(248,113,113,0.6)',
              marginLeft: 6,
            }}>
              /mês
            </span>
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{
            color: 'rgba(248,113,113,0.5)', fontSize: 11,
            fontFamily: 'var(--font-jost,system-ui)', margin: 0,
          }}>
            {items.length} {items.length === 1 ? 'imóvel afectado' : 'imóveis afectados'}
          </p>
        </div>
      </div>

      {/* Leakage list */}
      {visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(item => {
            const pm = PRIORITY_META[item.priority]
            return (
              <div key={`${item.property_id}-${item.leakage_type}`} style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${pm.color}`,
                borderRadius: '0 12px 12px 0',
                padding: '14px 18px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                {/* Left: property + type */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      color: C.cream28, fontSize: 10,
                      fontFamily: 'var(--font-jost,system-ui)',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      {item.property_id.slice(0, 8)}…
                    </span>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: 99,
                      background: pm.bg, color: pm.color, border: `1px solid ${pm.border}`,
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
                      textTransform: 'uppercase', fontFamily: 'var(--font-jost,system-ui)',
                    }}>
                      {pm.label}
                    </span>
                  </div>
                  <p style={{
                    color: C.cream, fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-jost,system-ui)', margin: '0 0 4px',
                  }}>
                    {LEAKAGE_LABELS[item.leakage_type]}
                  </p>
                  <p style={{
                    color: C.cream28, fontSize: 11, lineHeight: 1.5,
                    fontFamily: 'var(--font-jost,system-ui)', margin: 0,
                  }}>
                    {item.action_required}
                  </p>
                </div>

                {/* Right: leakage EUR */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <p style={{
                    fontFamily: 'var(--font-cormorant,serif)',
                    fontSize: 22, fontWeight: 600, color: C.red,
                    margin: 0, fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}>
                    {fmtCurrency(item.estimated_leakage_eur)}
                  </p>
                  <p style={{
                    color: 'rgba(248,113,113,0.5)', fontSize: 10,
                    fontFamily: 'var(--font-jost,system-ui)', margin: '2px 0 0',
                  }}>
                    /mês
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {visible.length === 0 && (
        <div style={{
          background: C.greenBg, border: `1px solid ${C.greenBorder}`,
          borderRadius: 12, padding: '16px 20px',
          color: C.green, fontSize: 13,
          fontFamily: 'var(--font-jost,system-ui)',
        }}>
          Nenhuma fuga de receita detectada — portfólio saudável.
        </div>
      )}
    </div>
  )
}

// ─── Executive AI Narrative Section ───────────────────────────────────────────

function ExecutiveAINarrative({ narrative }: { narrative: string }) {
  const text = narrative.trim()

  return (
    <div style={{
      background: C.card,
      border: `2px solid ${C.gold}`,
      borderRadius: 20, padding: '28px 32px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative corner */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: 'rgba(201,169,110,0.05)', pointerEvents: 'none',
      }} />

      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ color: C.gold, fontSize: 16 }}>✦</span>
        <span style={{
          color: C.cream28, fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', fontWeight: 600,
          fontFamily: 'var(--font-jost,system-ui)',
        }}>
          Análise Executiva IA
        </span>
      </div>

      {/* Narrative text */}
      {text ? (
        <p style={{
          fontFamily: 'var(--font-cormorant,serif)',
          fontSize: 21, fontWeight: 400, lineHeight: 1.7,
          color: C.cream, margin: 0, fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}>
          {text}
        </p>
      ) : (
        <p style={{
          fontFamily: 'var(--font-cormorant,serif)',
          fontSize: 18, fontWeight: 400, lineHeight: 1.65,
          color: C.cream55, margin: 0, fontStyle: 'italic',
        }}>
          Análise executiva a carregar — adicione imóveis live ao portfólio para activar o motor de inteligência de receita.
        </p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/executive/dashboard', { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as DashboardData
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{
      minHeight: '100%', background: C.bg,
      fontFamily: 'var(--font-jost,system-ui)', color: C.cream,
    }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .exec-kpi-card { transition: transform 0.2s, box-shadow 0.2s; }
        .exec-kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(201,169,110,0.1) !important; }
        .exec-opp-card:hover { border-left-color: rgba(201,169,110,0.8) !important; }
        .exec-prompt-chip:hover { background: rgba(244,240,230,0.08) !important; border-color: rgba(201,169,110,0.3) !important; color: #f4f0e6 !important; }
        .exec-ask-btn:hover:not(:disabled) { background: #b8955a !important; transform: translateY(-1px); }
      `}</style>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg,#0c1f15 0%,rgba(12,31,21,0.97) 100%)`,
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 4 }}>
            <Link href="/dashboard" style={{
              color: C.cream28, fontSize: 11, textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color 0.15s',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              Portal
            </Link>
            <span style={{ color: C.cream28, fontSize: 11 }}>/</span>
            <span style={{ color: C.gold, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
              Executive Revenue
            </span>
          </div>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20, gap: 24 }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-cormorant,serif)',
                fontSize: 40, fontWeight: 300, letterSpacing: '0.01em',
                color: C.cream, lineHeight: 1, margin: 0,
              }}>
                Executive{' '}
                <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 500 }}>Revenue</span>
              </h1>
              <p style={{
                color: C.cream28, fontSize: 12, marginTop: 7,
                letterSpacing: '0.06em', fontFamily: 'var(--font-jost,system-ui)',
              }}>
                Inteligência de Receita · Tempo Real
              </p>
            </div>

            {/* Last updated */}
            {data && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                  color: C.cream28, fontSize: 10, letterSpacing: '0.06em',
                  textTransform: 'uppercase', fontFamily: 'var(--font-jost,system-ui)',
                  margin: 0,
                }}>
                  Actualizado
                </p>
                <p style={{
                  color: 'rgba(244,240,230,0.2)', fontSize: 11, margin: '2px 0 0',
                  fontFamily: 'var(--font-jost,system-ui)', letterSpacing: '0.02em',
                }}>
                  {fmtTime(data.generated_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Loading */}
        {loading && <GoldSpinner />}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            borderRadius: 16, padding: '28px 32px', textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--font-cormorant,serif)',
              fontSize: 26, fontWeight: 300, color: C.red,
              margin: '0 0 8px', fontStyle: 'italic',
            }}>
              Sistema executivo temporariamente indisponível
            </p>
            <p style={{ color: 'rgba(248,113,113,0.6)', fontSize: 12, margin: 0, fontFamily: 'var(--font-jost,system-ui)' }}>
              {error} — tente novamente em instantes
            </p>
          </div>
        )}

        {/* Dashboard */}
        {!loading && !error && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, animation: 'fadeUp 0.4s ease-out' }}>

            {/* ── KPI Grid 3×2 ────────────────────────────────────────────── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 16,
            }}>
              {/* 1. Pipeline */}
              <div className="exec-kpi-card">
                <KpiCard
                  icon="💰"
                  label="Pipeline Total"
                  value={fmtCurrency(data.pipeline_value_eur)}
                  sub={`${data.live_listings} imóvel${data.live_listings !== 1 ? 'is' : ''} live`}
                />
              </div>

              {/* 2. Comissão — gold card */}
              <div className="exec-kpi-card">
                <KpiCard
                  icon="✦"
                  label="Comissão Estimada"
                  value={fmtCurrency(data.commission_estimate_eur)}
                  sub="5% AG commission"
                  isGold={true}
                />
              </div>

              {/* 3. Imóveis Live */}
              <div className="exec-kpi-card">
                <KpiCard
                  icon="🏠"
                  label="Imóveis Live"
                  value={String(data.live_listings)}
                  sub={`${data.processing_listings} em processamento`}
                />
              </div>

              {/* 4. Leads Quentes */}
              <div className="exec-kpi-card">
                <KpiCard
                  icon="🔥"
                  label="Leads Quentes"
                  value={String(data.hot_leads)}
                  sub={`de ${data.contacts_total} contactos totais`}
                />
              </div>

              {/* 5. Deals Activos */}
              <div className="exec-kpi-card">
                <KpiCard
                  icon="📋"
                  label="Deals Activos"
                  value={String(data.deals_active)}
                  sub={data.deals_value_eur > 0 ? fmtCurrency(data.deals_value_eur) + ' em negociação' : 'a aguardar pipeline'}
                />
              </div>

              {/* 6. Score Médio */}
              <div className="exec-kpi-card">
                <KpiCard
                  icon="📊"
                  label="Score Médio"
                  value={`${data.avg_demand_score}/100`}
                  sub={`${data.homepage_ready} prontos para homepage`}
                />
              </div>
            </div>

            {/* ── Executive AI Narrative (full-width, gold border) ──────────── */}
            <ExecutiveAINarrative narrative={data.snapshot_narrative ?? ''} />

            {/* ── Revenue Leakage Section ───────────────────────────────────── */}
            <RevenueLeakageSection
              items={data.leakage_items ?? []}
              totalLeakage={data.total_leakage_monthly_eur ?? 0}
            />

            {/* ── Revenue This Month strip ─────────────────────────────────── */}
            {data.revenue_this_month_eur > 0 && (
              <div style={{
                background: C.greenBg,
                border: `1px solid ${C.greenBorder}`,
                borderRadius: 14, padding: '16px 24px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: C.green,
                  animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                  flexShrink: 0,
                }} />
                <span style={{
                  color: C.cream55, fontSize: 12,
                  fontFamily: 'var(--font-jost,system-ui)',
                  letterSpacing: '0.04em',
                }}>
                  Receita Comissionada Este Mês
                </span>
                <span style={{
                  fontFamily: 'var(--font-cormorant,serif)',
                  fontSize: 22, fontWeight: 600, color: C.green,
                  marginLeft: 'auto', fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtCurrency(data.revenue_this_month_eur)}
                </span>
              </div>
            )}

            {/* ── Revenue Narrative ─────────────────────────────────────────── */}
            <div style={{
              background: C.card,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 20, padding: '28px 32px',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Decorative corner */}
              <div style={{
                position: 'absolute', top: -30, right: -30,
                width: 120, height: 120, borderRadius: '50%',
                background: 'rgba(201,169,110,0.04)', pointerEvents: 'none',
              }} />

              {/* Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ color: C.gold, fontSize: 14 }}>✦</span>
                <span style={{
                  color: C.cream28, fontSize: 10, letterSpacing: '0.12em',
                  textTransform: 'uppercase', fontWeight: 600,
                  fontFamily: 'var(--font-jost,system-ui)',
                }}>
                  IA — Análise de Receita
                </span>
              </div>

              {/* Narrative text */}
              <p style={{
                fontFamily: 'var(--font-cormorant,serif)',
                fontSize: 22, fontWeight: 400, lineHeight: 1.65,
                color: C.cream, margin: 0, fontStyle: 'italic',
                letterSpacing: '0.01em',
              }}>
                {data.narrative}
              </p>
            </div>

            {/* ── Opportunities ─────────────────────────────────────────────── */}
            {data.opportunities.length > 0 && (
              <div>
                <SectionHeading
                  icon="⚡"
                  title="Radar de Oportunidades"
                  sub={`${data.opportunities.length} sinais detectados · Ordenados por score`}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.opportunities.map((signal, i) => (
                    <div key={signal.signal_id} className="exec-opp-card" style={{ transition: 'all 0.15s' }}>
                      <OpportunityCard signal={signal} index={i} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── AI Copilot ────────────────────────────────────────────────── */}
            <CopilotSection />

            {/* ── Footer metadata ───────────────────────────────────────────── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: `1px solid ${C.divider}`, paddingTop: 20,
              flexWrap: 'wrap', gap: 8,
            }}>
              <span style={{
                color: C.cream28, fontSize: 10, letterSpacing: '0.06em',
                textTransform: 'uppercase', fontFamily: 'var(--font-jost,system-ui)',
              }}>
                Agency Group · AMI 22506 · Portugal 2026
              </span>
              <span style={{
                color: 'rgba(244,240,230,0.18)', fontSize: 10,
                fontFamily: 'var(--font-jost,system-ui)',
              }}>
                {data.total_submissions} submissões totais · {data.homepage_ready} homepage-ready
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
