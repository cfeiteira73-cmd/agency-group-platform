'use client'

// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// Dashboard: Property AI — submissions list · AG brand design

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusType = 'ingesting' | 'analyzing' | 'enriching' | 'generating' | 'reviewing' | 'live' | 'archived'

interface Intelligence {
  demand_score: number
  homepage_placement_score: number
  listing_readiness_score: number
  investor_attractiveness: number
}

interface Submission {
  submission_id: string
  org_id: string
  agent_id: string
  status: StatusType
  file_count: number
  raw_description?: string
  created_at: string
  updated_at: string
  intelligence?: Intelligence | null
}

interface ListResponse {
  submissions: Submission[]
  total: number
  has_more: boolean
}

// ─── AG brand tokens ─────────────────────────────────────────────────────────

const C = {
  bg:         '#0c1f15',
  card:       '#111e16',
  cardHover:  '#162a1c',
  border:     'rgba(201,169,110,0.15)',
  borderHov:  'rgba(201,169,110,0.35)',
  divider:    'rgba(201,169,110,0.08)',
  gold:       '#c9a96e',
  goldDim:    'rgba(201,169,110,0.12)',
  goldBorder: 'rgba(201,169,110,0.22)',
  cream:      '#f4f0e6',
  cream55:    'rgba(244,240,230,0.55)',
  cream28:    'rgba(244,240,230,0.28)',
  cream10:    'rgba(244,240,230,0.08)',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<StatusType, { label: string; bg: string; text: string; border: string; dot?: string }> = {
  ingesting:  { label: 'Ingesting',  bg: 'rgba(28,74,53,0.4)',   text: 'rgba(244,240,230,0.45)', border: 'rgba(44,90,68,0.5)', },
  analyzing:  { label: 'Analyzing',  bg: 'rgba(201,169,110,0.1)',text: '#c9a96e',                border: 'rgba(201,169,110,0.3)', dot: '#c9a96e' },
  enriching:  { label: 'Enriching',  bg: 'rgba(201,169,110,0.1)',text: '#c9a96e',                border: 'rgba(201,169,110,0.3)', dot: '#c9a96e' },
  generating: { label: 'Generating', bg: 'rgba(201,169,110,0.1)',text: '#c9a96e',                border: 'rgba(201,169,110,0.3)', dot: '#c9a96e' },
  reviewing:  { label: 'Reviewing',  bg: 'rgba(180,130,20,0.1)', text: '#d4a843',                border: 'rgba(180,130,20,0.3)', },
  live:       { label: 'Live',       bg: 'rgba(45,106,79,0.2)',  text: '#4ade80',                border: 'rgba(45,106,79,0.5)', dot: '#4ade80' },
  archived:   { label: 'Archived',   bg: 'rgba(28,74,53,0.2)',   text: 'rgba(244,240,230,0.28)', border: 'rgba(44,90,68,0.3)', },
}

function StatusBadge({ status }: { status: StatusType }) {
  const m = STATUS_META[status]
  const isAnimated = ['analyzing','enriching','generating','live'].includes(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: m.bg, color: m.text,
      border: `1px solid ${m.border}`,
      fontSize: 11, fontWeight: 500, letterSpacing: '0.02em',
      fontFamily: 'var(--font-jost, system-ui)',
      whiteSpace: 'nowrap',
    }}>
      {m.dot && (
        <span style={{
          display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
          background: m.dot,
          animation: isAnimated ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
        }} />
      )}
      {m.label}
    </span>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, color = 'gold' }: { score: number; color?: 'gold' | 'green' }) {
  const fill = color === 'gold' ? '#c9a96e' : '#4ade80'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(201,169,110,0.1)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, background: fill,
          width: `${Math.min(score, 100)}%`,
          transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
      <span style={{ fontSize: 11, color: C.cream55, width: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(score)}
      </span>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Live',       value: 'live' },
  { label: 'Processing', value: 'analyzing' },
  { label: 'Reviewing',  value: 'reviewing' },
  { label: 'Archived',   value: 'archived' },
]

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: '20px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: C.goldDim, border: `1px solid ${C.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ color: C.gold, fontWeight: 700, fontSize: 22, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-cormorant, serif)' }}>
          {value}
        </p>
        <p style={{ color: C.cream28, fontSize: 11, marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-jost, system-ui)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]           = useState('')
  const [offset, setOffset]           = useState(0)
  const [hasMore, setHasMore]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const LIMIT = 20

  const fetchSubmissions = useCallback(async (status: string, off: number, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ org_id: 'agency-group', limit: String(LIMIT), offset: String(off) })
      if (status) params.set('status', status)
      const res  = await fetch(`/api/property-ai/submissions?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ListResponse
      setSubmissions(prev => append ? [...prev, ...data.submissions] : data.submissions)
      setTotal(data.total)
      setHasMore(data.has_more)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setOffset(0)
    void fetchSubmissions(statusFilter, 0)
  }, [statusFilter, fetchSubmissions])

  const handleLoadMore = () => {
    const next = offset + LIMIT
    setOffset(next)
    void fetchSubmissions(statusFilter, next, true)
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

  const filtered = submissions.filter(s =>
    !search.trim() ||
    (s.raw_description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.submission_id.toLowerCase().includes(search.toLowerCase())
  )

  const liveCount       = submissions.filter(s => s.status === 'live').length
  const processingCount = submissions.filter(s => ['analyzing','enriching','generating'].includes(s.status)).length
  const avgReadiness    = submissions.length > 0
    ? Math.round(submissions.reduce((a, s) => a + (s.intelligence?.listing_readiness_score ?? 0), 0) / submissions.length)
    : 0

  return (
    <div style={{ minHeight: '100%', background: C.bg, fontFamily: 'var(--font-jost, system-ui)', color: C.cream }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        .ag-row:hover { background: rgba(201,169,110,0.04) !important; }
        .ag-filter:hover { border-color: rgba(201,169,110,0.3) !important; color: #f4f0e6 !important; }
        .ag-upload-btn:hover { background: #b8955a !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,169,110,0.25) !important; }
        .ag-portal-link:hover { color: #c9a96e !important; }
        .ag-loadmore:hover { border-color: rgba(201,169,110,0.35) !important; color: #f4f0e6 !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, #0c1f15 0%, rgba(12,31,21,0.95) 100%)`,
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 4 }}>
            <Link href="/dashboard" className="ag-portal-link" style={{
              color: C.cream28, fontSize: 11, textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontWeight: 500, transition: 'color 0.15s',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Portal
            </Link>
            <span style={{ color: C.cream28, fontSize: 11 }}>/</span>
            <span style={{ color: C.gold, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
              Properties
            </span>
          </div>

          {/* Main header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20, gap: 24 }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-cormorant, serif)',
                fontSize: 36, fontWeight: 300, letterSpacing: '0.02em',
                color: C.cream, lineHeight: 1, margin: 0,
              }}>
                Property <span style={{ color: C.gold, fontStyle: 'italic' }}>AI Engine</span>
              </h1>
              <p style={{ color: C.cream28, fontSize: 12, marginTop: 6, letterSpacing: '0.04em' }}>
                AMI 22506 · Agency Group Portugal
              </p>
            </div>

            <Link href="/dashboard/properties/new" className="ag-upload-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', borderRadius: 10,
              background: C.gold, color: '#0c1f15',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
              textDecoration: 'none', transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(201,169,110,0.18)',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v16m8-8H4"/>
              </svg>
              Upload Property
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── KPI Stats ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard icon="🏛" label="Total Properties" value={total} />
          <KpiCard icon="✦"  label="Live Listings"   value={liveCount} />
          <KpiCard icon="⟳"  label="Processing"      value={processingCount} />
          <KpiCard icon="◈"  label="Avg Readiness"   value={submissions.length > 0 ? `${avgReadiness}%` : '—'} />
        </div>

        {/* ── Filters ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.cream28 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search properties…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '8px 12px 8px 34px',
                color: C.cream, fontSize: 12, width: 200,
                outline: 'none', fontFamily: 'var(--font-jost, system-ui)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(201,169,110,0.5)')}
              onBlur={e => (e.target.style.borderColor = C.border)}
            />
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.value
              return (
                <button key={f.value} type="button" className={active ? '' : 'ag-filter'}
                  onClick={() => setStatusFilter(f.value)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: active ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
                    background: active ? C.goldDim : C.card,
                    color: active ? C.gold : C.cream55,
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'var(--font-jost, system-ui)',
                  }}>
                  {f.label}
                </button>
              )
            })}
          </div>

          <span style={{ marginLeft: 'auto', color: C.cream28, fontSize: 11, letterSpacing: '0.06em' }}>
            {total} {total === 1 ? 'PROPERTY' : 'PROPERTIES'}
          </span>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: 'rgba(176,58,46,0.1)', border: '1px solid rgba(176,58,46,0.3)',
            borderRadius: 12, padding: '14px 20px', color: '#f87171', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        {!error && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 160px 160px 110px',
              padding: '12px 24px', borderBottom: `1px solid ${C.divider}`,
              gap: 16,
            }}>
              {['Property', 'Status', 'Readiness', 'Demand', 'Updated'].map(col => (
                <div key={col} style={{
                  fontSize: 10, color: C.cream28, textTransform: 'uppercase',
                  letterSpacing: '0.1em', fontWeight: 600,
                }}>
                  {col}
                </div>
              ))}
            </div>

            {/* Rows */}
            {loading && submissions.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: C.cream28, fontSize: 13 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `2px solid ${C.border}`, borderTopColor: C.gold,
                  animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                Loading properties…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '72px 24px', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, margin: '0 auto 16px',
                }}>
                  🏛
                </div>
                <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 22, fontWeight: 300, color: C.cream, marginBottom: 8, fontStyle: 'italic' }}>
                  {search ? 'No properties match your search' : 'No properties yet'}
                </p>
                <p style={{ color: C.cream28, fontSize: 12, marginBottom: 20 }}>
                  {search ? 'Try a different search term' : 'Upload your first property to get started'}
                </p>
                {!search && (
                  <Link href="/dashboard/properties/new" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 8,
                    background: C.goldDim, color: C.gold,
                    border: `1px solid ${C.goldBorder}`,
                    fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  }}>
                    Upload Property →
                  </Link>
                )}
              </div>
            ) : (
              filtered.map((sub, i) => (
                <Link
                  key={sub.submission_id}
                  href={`/dashboard/properties/${sub.submission_id}`}
                  className="ag-row"
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 160px 160px 110px',
                    padding: '16px 24px', gap: 16,
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.divider}` : 'none',
                    textDecoration: 'none', transition: 'background 0.15s',
                    alignItems: 'center',
                  }}
                >
                  {/* Property */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        🏠
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          color: C.cream, fontSize: 13, fontWeight: 500, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {sub.raw_description
                            ? sub.raw_description.slice(0, 55) + (sub.raw_description.length > 55 ? '…' : '')
                            : `Property ${sub.submission_id.slice(0, 8).toUpperCase()}`}
                        </p>
                        <p style={{ color: C.cream28, fontSize: 11, margin: '2px 0 0', letterSpacing: '0.03em' }}>
                          {sub.file_count} file{sub.file_count !== 1 ? 's' : ''} · {sub.agent_id}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div><StatusBadge status={sub.status} /></div>

                  {/* Readiness */}
                  <div>
                    {sub.intelligence
                      ? <ScoreBar score={sub.intelligence.listing_readiness_score} color="green" />
                      : <span style={{ color: C.cream28, fontSize: 12 }}>—</span>}
                  </div>

                  {/* Demand */}
                  <div>
                    {sub.intelligence
                      ? <ScoreBar score={sub.intelligence.demand_score} color="gold" />
                      : <span style={{ color: C.cream28, fontSize: 12 }}>—</span>}
                  </div>

                  {/* Date */}
                  <div>
                    <span style={{ color: C.cream28, fontSize: 11, letterSpacing: '0.02em' }}>
                      {formatDate(sub.updated_at)}
                    </span>
                  </div>
                </Link>
              ))
            )}

            {/* Load more */}
            {hasMore && (
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.divider}` }}>
                <button type="button" onClick={handleLoadMore} disabled={loading} className="ag-loadmore"
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10,
                    border: `1px solid ${C.border}`, background: 'transparent',
                    color: C.cream55, fontSize: 12, cursor: 'pointer',
                    fontFamily: 'var(--font-jost, system-ui)', transition: 'all 0.15s',
                    opacity: loading ? 0.4 : 1,
                  }}>
                  {loading ? 'Loading…' : `Show more · ${total - submissions.length} remaining`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
