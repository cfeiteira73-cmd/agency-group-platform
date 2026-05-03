'use client'
// =============================================================================
// PortalFunnelCRO — Phase 5: Conversion Funnel + Attribution Dashboard
// =============================================================================
// Tabs: funnel | attribution | grades | campaigns
// API: GET /api/analytics/portal-funnel?days={7|30|90}
// Auth: Bearer email (portal magic-link pattern)
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelStage {
  stage:          string
  count:          number
  conversion_pct: number | null
  drop_pct:       number | null
}

interface FunnelReport {
  stages:             FunnelStage[]
  overall_close_rate: number | null
  top_drop_stage:     string | null
}

interface GradeRow {
  grade:            string
  distributed:      number
  closed:           number
  close_rate_pct:   number | null
  avg_commission:   number | null
}

interface SourceRow {
  source:               string
  leads:                number
  active:               number
  conversion_rate_pct:  number
  avg_score:            number
}

interface CampaignRow {
  name:       string
  status:     string
  type:       string
  opens:      number
  clicks:     number
  bounces:    number
  sent_at:    string | null
  created_at: string
}

interface CampaignSummary {
  total:         number
  sent:          number
  avg_open_rate: number | null
  recent:        CampaignRow[]
}

interface FunnelData {
  period_days:        number
  since:              string
  funnel:             FunnelReport
  grade_conversions:  GradeRow[]
  source_attribution: SourceRow[]
  campaigns:          CampaignSummary
  raw_counts:         Record<string, number>
  generated_at:       string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

function fmtEur(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Stage emoji map
const STAGE_ICONS: Record<string, string> = {
  Ingested:    '📥',
  Scored:      '🎯',
  Distributed: '📤',
  Opened:      '👁',
  Replied:     '💬',
  Meetings:    '📅',
  Offers:      '📋',
  Closed:      '🏆',
}

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#f59e0b',
  D: '#ef4444',
  unknown: '#6b7280',
}

type TabKey = 'funnel' | 'attribution' | 'grades' | 'campaigns'
type PeriodDays = 7 | 30 | 90

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, dark,
}: {
  label: string; value: string; sub?: string; accent?: boolean; dark: boolean
}) {
  return (
    <div style={{
      background: accent
        ? 'linear-gradient(135deg, #1c4a35, #2d6a4f)'
        : dark ? '#0c1f15' : '#fff',
      border: `1px solid ${dark ? '#1c4a35' : '#e5e5e3'}`,
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, color: accent ? '#c9a96e' : dark ? '#c9a96e' : '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? '#c9a96e' : dark ? '#f4f0e6' : '#1c4a35', fontFamily: 'var(--font-cormorant), serif' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: accent ? '#c9a96e99' : dark ? '#888' : '#aaa', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function FunnelBar({
  stage, dark, maxCount, isTopDrop,
}: {
  stage: FunnelStage; dark: boolean; maxCount: number; isTopDrop: boolean
}) {
  const pct    = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
  const icon   = STAGE_ICONS[stage.stage] ?? '•'
  const dropBad = (stage.drop_pct ?? 0) > 50

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: `1px solid ${dark ? '#1c4a3530' : '#f0f0ee'}`,
    }}>
      {/* Stage label */}
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: isTopDrop ? '#ef4444' : dark ? '#f4f0e6' : '#1c4a35',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {icon} {stage.stage}
          {isTopDrop && <span title="Biggest drop-off" style={{ fontSize: 10, color: '#ef4444' }}>⚠</span>}
        </div>
      </div>

      {/* Bar */}
      <div style={{ flex: 1, height: 20, background: dark ? '#0c1f15' : '#f4f0e6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isTopDrop
            ? 'linear-gradient(90deg, #ef4444, #f97316)'
            : 'linear-gradient(90deg, #1c4a35, #c9a96e)',
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Count */}
      <div style={{ width: 60, textAlign: 'right', fontSize: 14, fontWeight: 700, color: dark ? '#f4f0e6' : '#1c4a35' }}>
        {stage.count.toLocaleString('pt-PT')}
      </div>

      {/* Conversion from previous */}
      <div style={{ width: 64, textAlign: 'right' }}>
        {stage.conversion_pct != null ? (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: dropBad ? '#ef4444' : stage.conversion_pct >= 70 ? '#22c55e' : '#f59e0b',
          }}>
            {fmtPct(stage.conversion_pct)} ↓
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#888' }}>—</span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortalFunnelCRO() {
  const dark = useUIStore(s => s.darkMode)

  const [tab,     setTab]     = useState<TabKey>('funnel')
  const [period,  setPeriod]  = useState<PeriodDays>(30)
  const [data,    setData]    = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/analytics/portal-funnel?days=${period}`,
        { headers: getAuthHeaders() },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card = {
    background:   dark ? '#0c1f15' : '#fff',
    border:       `1px solid ${dark ? '#1c4a35' : '#e5e5e3'}`,
    borderRadius: 12,
    padding:      24,
  }

  const tabBtn = (t: TabKey) => ({
    padding:      '7px 14px',
    fontSize:     12,
    fontWeight:   600,
    border:       'none',
    cursor:       'pointer',
    borderRadius: 6,
    background:   tab === t ? '#c9a96e' : 'transparent',
    color:        tab === t ? '#0e0e0d' : dark ? '#888' : '#666',
  })

  const periodBtn = (p: PeriodDays) => ({
    padding:      '5px 12px',
    fontSize:     11,
    fontWeight:   600,
    border:       `1px solid ${period === p ? '#c9a96e' : dark ? '#1c4a35' : '#e5e5e3'}`,
    borderRadius: 6,
    cursor:       'pointer',
    background:   period === p ? '#c9a96e20' : 'transparent',
    color:        period === p ? '#c9a96e' : dark ? '#888' : '#666',
  })

  // ── KPI bar ────────────────────────────────────────────────────────────────
  const funnelStages   = data?.funnel.stages ?? []
  const maxCount       = funnelStages[0]?.count ?? 1
  const topDrop        = data?.funnel.top_drop_stage
  const overallClose   = data?.funnel.overall_close_rate
  const totalLeads     = data?.raw_counts?.ingested ?? 0
  const totalClosed    = data?.raw_counts?.closed ?? 0
  const topSource      = data?.source_attribution?.[0]
  const campaignCount  = data?.campaigns?.total ?? 0
  const avgOpenRate    = data?.campaigns?.avg_open_rate

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'var(--font-jost), sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: dark ? '#f4f0e6' : '#1c4a35', fontFamily: 'var(--font-cormorant), serif' }}>
            📊 Conversion Funnel & CRO
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: dark ? '#888' : '#666' }}>
            Lead-to-close pipeline • Source attribution • Campaign performance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Period */}
          <div style={{ display: 'flex', gap: 4 }}>
            {([7, 30, 90] as PeriodDays[]).map(p => (
              <button key={p} style={periodBtn(p)} onClick={() => setPeriod(p)}>
                {p}d
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none',
              borderRadius: 6, cursor: 'pointer',
              background: '#1c4a35', color: '#c9a96e', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '⟳' : '↺ Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 12, color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
          ⚠ {error} — <button onClick={load} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Total Leads" value={loading ? '…' : totalLeads.toLocaleString('pt-PT')} sub={`Last ${period} days`} dark={dark} />
        <KpiCard label="Deals Closed" value={loading ? '…' : totalClosed.toLocaleString('pt-PT')} dark={dark} />
        <KpiCard label="Close Rate" value={loading ? '…' : fmtPct(overallClose ?? null)} accent dark={dark} />
        <KpiCard label="Top Drop" value={loading ? '…' : topDrop ?? '—'} sub="Biggest leakage stage" dark={dark} />
        <KpiCard label="Top Source" value={loading ? '…' : topSource?.source ?? '—'} sub={topSource ? `${topSource.leads} leads` : undefined} dark={dark} />
        <KpiCard label="Campaigns" value={loading ? '…' : String(campaignCount)} sub={avgOpenRate != null ? `${fmtPct(avgOpenRate)} avg open` : undefined} dark={dark} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: dark ? '#0c1f1580' : '#f4f0e680', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {(['funnel', 'attribution', 'grades', 'campaigns'] as TabKey[]).map(t => (
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>
            {t === 'funnel' ? '🏗 Funnel' : t === 'attribution' ? '🔗 Attribution' : t === 'grades' ? '🎓 Grades' : '📧 Campaigns'}
          </button>
        ))}
      </div>

      {/* ── TAB: Funnel ── */}
      {tab === 'funnel' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35', marginBottom: 16 }}>
            8-Stage Conversion Pipeline
          </div>
          {loading ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>Loading funnel…</div>
          ) : funnelStages.length === 0 ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>No funnel data for this period.</div>
          ) : (
            <div>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8, borderBottom: `2px solid ${dark ? '#1c4a35' : '#e5e5e3'}`, marginBottom: 4 }}>
                <div style={{ width: 100, fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Stage</div>
                <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Volume</div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Count</div>
                <div style={{ width: 64, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Conv %</div>
              </div>
              {funnelStages.map(s => (
                <FunnelBar
                  key={s.stage}
                  stage={s}
                  dark={dark}
                  maxCount={maxCount}
                  isTopDrop={s.stage === topDrop}
                />
              ))}

              {/* CRO recommendation */}
              {topDrop && (
                <div style={{
                  marginTop: 20, padding: '12px 16px',
                  background: '#ef444415', border: '1px solid #ef444440',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                    ⚠ CRO Alert — {topDrop} is your biggest drop-off stage
                  </div>
                  <div style={{ fontSize: 12, color: dark ? '#ccc' : '#555' }}>
                    {topDrop === 'Scored' && 'Review scoring criteria — many leads may be filtered before reaching distribution.'}
                    {topDrop === 'Distributed' && 'Improve distribution targeting — leads are scored but not reaching the right investors.'}
                    {topDrop === 'Opened' && 'Improve deal pack subject lines and preview text — recipients are not opening materials.'}
                    {topDrop === 'Replied' && 'Optimize deal pack content and CTA — recipients open but do not respond.'}
                    {topDrop === 'Meetings' && 'Follow up more aggressively post-reply — conversions to meeting are low.'}
                    {topDrop === 'Offers' && 'Address objections earlier — meetings are not converting to formal offers.'}
                    {topDrop === 'Closed' && 'Review offer terms and legal friction — offers are not converting to closings.'}
                    {!['Scored','Distributed','Opened','Replied','Meetings','Offers','Closed'].includes(topDrop) && 'Investigate this stage for process gaps.'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Attribution ── */}
      {tab === 'attribution' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35', marginBottom: 16 }}>
            Lead Source Attribution — Last {period} days
          </div>
          {loading ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>Loading attribution…</div>
          ) : (data?.source_attribution ?? []).length === 0 ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>No leads with source data in this period.</div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px',
                gap: 8, padding: '8px 12px',
                background: dark ? '#0e0e0d40' : '#f9f8f6',
                borderRadius: '6px 6px 0 0',
                fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <div>Source</div>
                <div style={{ textAlign: 'right' }}>Leads</div>
                <div style={{ textAlign: 'right' }}>Active</div>
                <div style={{ textAlign: 'right' }}>Conv Rate</div>
                <div style={{ textAlign: 'right' }}>Avg Score</div>
              </div>

              {(data?.source_attribution ?? []).map((row, i) => {
                const maxLeads = (data?.source_attribution ?? [])[0]?.leads ?? 1
                const barPct   = (row.leads / maxLeads) * 100
                const isTop    = i === 0
                return (
                  <div key={row.source} style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px',
                    gap: 8, padding: '10px 12px',
                    background: isTop
                      ? dark ? '#1c4a3520' : '#1c4a3508'
                      : i % 2 === 0 ? 'transparent' : dark ? '#0e0e0d20' : '#fafaf9',
                    alignItems: 'center',
                    fontSize: 13,
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: `${Math.max(barPct, 4)}%`, height: 4,
                          background: isTop ? '#c9a96e' : dark ? '#1c4a35' : '#ddd',
                          borderRadius: 2, flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: isTop ? 700 : 400, color: dark ? '#f4f0e6' : '#1c4a35' }}>
                          {row.source || 'direct'}
                          {isTop && <span style={{ marginLeft: 6, fontSize: 10, color: '#c9a96e', background: '#c9a96e20', padding: '1px 6px', borderRadius: 3 }}>TOP</span>}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: dark ? '#f4f0e6' : '#1c4a35' }}>{row.leads}</div>
                    <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>{row.active}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        color: row.conversion_rate_pct >= 40 ? '#22c55e' : row.conversion_rate_pct >= 20 ? '#f59e0b' : '#ef4444',
                        fontWeight: 600,
                      }}>
                        {fmtPct(row.conversion_rate_pct)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>
                      {row.avg_score > 0 ? row.avg_score.toFixed(0) : '—'}
                    </div>
                  </div>
                )
              })}

              {/* UTM note */}
              <div style={{ marginTop: 16, padding: '10px 12px', background: dark ? '#0c1f15' : '#f4f0e6', borderRadius: 6, fontSize: 11, color: dark ? '#888' : '#666' }}>
                💡 <strong>UTM Tip:</strong> Use <code>?utm_source=meta&utm_medium=paid&utm_campaign=algarve</code> on all paid links to improve attribution accuracy. First-touch wins for source/medium; last-touch wins for campaign.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Grades ── */}
      {tab === 'grades' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35', marginBottom: 16 }}>
            Score Grade Conversion Matrix
          </div>
          {loading ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>Loading grade data…</div>
          ) : (data?.grade_conversions ?? []).length === 0 ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>No grade conversion data yet. This populates as deals close.</div>
          ) : (
            <div>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px 100px 130px',
                gap: 8, padding: '8px 12px',
                background: dark ? '#0e0e0d40' : '#f9f8f6',
                borderRadius: '6px 6px 0 0',
                fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <div>Grade</div>
                <div>Close Rate</div>
                <div style={{ textAlign: 'right' }}>Distributed</div>
                <div style={{ textAlign: 'right' }}>Closed</div>
                <div style={{ textAlign: 'right' }}>Close %</div>
                <div style={{ textAlign: 'right' }}>Avg Commission</div>
              </div>

              {(data?.grade_conversions ?? [])
                .sort((a, b) => (b.close_rate_pct ?? 0) - (a.close_rate_pct ?? 0))
                .map(row => {
                  const color = GRADE_COLORS[row.grade] ?? GRADE_COLORS.unknown
                  const barPct = row.close_rate_pct ?? 0
                  return (
                    <div key={row.grade} style={{
                      display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px 100px 130px',
                      gap: 8, padding: '12px',
                      borderBottom: `1px solid ${dark ? '#1c4a3520' : '#f0f0ee'}`,
                      alignItems: 'center', fontSize: 13,
                    }}>
                      <div>
                        <span style={{
                          background: `${color}25`, color, border: `1px solid ${color}60`,
                          borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 13,
                        }}>
                          {row.grade.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: dark ? '#0c1f15' : '#f4f0e6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 40 }}>{fmtPct(row.close_rate_pct)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>{row.distributed}</div>
                      <div style={{ textAlign: 'right', fontWeight: 600, color: dark ? '#f4f0e6' : '#1c4a35' }}>{row.closed}</div>
                      <div style={{ textAlign: 'right', fontWeight: 700, color }}>{fmtPct(row.close_rate_pct)}</div>
                      <div style={{ textAlign: 'right', color: '#c9a96e', fontWeight: 600 }}>{fmtEur(row.avg_commission)}</div>
                    </div>
                  )
                })}

              <div style={{ padding: '12px', fontSize: 11, color: dark ? '#888' : '#666' }}>
                Grade A ≥80 · Grade B 60–79 · Grade C 40–59 · Grade D &lt;40
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Campaigns ── */}
      {tab === 'campaigns' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35' }}>
              Campaign Performance — Last {period} days
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: dark ? '#f4f0e6' : '#1c4a35', fontFamily: 'var(--font-cormorant), serif' }}>
                  {loading ? '…' : data?.campaigns?.total ?? 0}
                </div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Total</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-cormorant), serif' }}>
                  {loading ? '…' : data?.campaigns?.sent ?? 0}
                </div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Sent</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#c9a96e', fontFamily: 'var(--font-cormorant), serif' }}>
                  {loading ? '…' : fmtPct(data?.campaigns?.avg_open_rate ?? null)}
                </div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Avg Open</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>Loading campaigns…</div>
          ) : (data?.campaigns?.recent ?? []).length === 0 ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>No campaigns in this period. Create one in Campanhas.</div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 70px 60px 60px 100px',
                gap: 8, padding: '8px 12px',
                background: dark ? '#0e0e0d40' : '#f9f8f6',
                borderRadius: '6px 6px 0 0',
                fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <div>Campaign</div>
                <div>Status</div>
                <div style={{ textAlign: 'right' }}>Opens</div>
                <div style={{ textAlign: 'right' }}>Clicks</div>
                <div style={{ textAlign: 'right' }}>Bounces</div>
                <div style={{ textAlign: 'right' }}>Sent At</div>
              </div>

              {(data?.campaigns?.recent ?? []).map((c, i) => {
                const statusColor: Record<string, string> = {
                  sent: '#22c55e', draft: '#f59e0b', scheduled: '#3b82f6', cancelled: '#ef4444',
                }
                const sc = statusColor[c.status] ?? '#888'
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 70px 60px 60px 100px',
                    gap: 8, padding: '10px 12px',
                    borderBottom: `1px solid ${dark ? '#1c4a3520' : '#f0f0ee'}`,
                    alignItems: 'center', fontSize: 13,
                  }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500, color: dark ? '#f4f0e6' : '#1c4a35' }}>{c.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#888' }}>{c.type}</span>
                    </div>
                    <div>
                      <span style={{ background: `${sc}20`, color: sc, borderRadius: 3, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                        {c.status}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>{c.opens || '—'}</div>
                    <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>{c.clicks || '—'}</div>
                    <div style={{ textAlign: 'right', color: c.bounces > 0 ? '#ef4444' : dark ? '#ccc' : '#555' }}>{c.bounces || '—'}</div>
                    <div style={{ textAlign: 'right', color: dark ? '#888' : '#999', fontSize: 12 }}>{fmtDate(c.sent_at)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {data && (
        <div style={{ marginTop: 16, textAlign: 'right', fontSize: 11, color: dark ? '#444' : '#bbb' }}>
          Last updated {new Date(data.generated_at).toLocaleTimeString('pt-PT')} · Period: last {data.period_days} days
        </div>
      )}
    </div>
  )
}
