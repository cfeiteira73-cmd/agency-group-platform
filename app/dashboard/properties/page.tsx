'use client'

// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// Dashboard: Property AI — submissions list with live intelligence scores

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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<StatusType, string> = {
  ingesting:  'bg-slate-800 text-slate-400 border-slate-700',
  analyzing:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  enriching:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  generating: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  reviewing:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  live:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  archived:   'bg-slate-800 text-slate-600 border-slate-700',
}

function StatusBadge({ status }: { status: StatusType }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[status]}`}>
      {status === 'live' && <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      {status}
    </span>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, color = 'blue' }: { score: number; color?: 'blue' | 'emerald' | 'amber' }) {
  const colors = {
    blue:    'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-500',
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors[color]}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right">{Math.round(score)}</span>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Live', value: 'live' },
  { label: 'Processing', value: 'analyzing' },
  { label: 'Reviewing', value: 'reviewing' },
  { label: 'Archived', value: 'archived' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const LIMIT = 20

  const fetchSubmissions = useCallback(async (status: string, off: number, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ org_id: 'agency-group', limit: String(LIMIT), offset: String(off) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/property-ai/submissions?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ListResponse
      setSubmissions((prev) => append ? [...prev, ...data.submissions] : data.submissions)
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
    const nextOffset = offset + LIMIT
    setOffset(nextOffset)
    void fetchSubmissions(statusFilter, nextOffset, true)
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

  const filtered = submissions.filter(s =>
    !search || (s.raw_description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.submission_id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100">
      {/* ── Header ── */}
      <div className="border-b border-slate-800 bg-[#0A0A0F]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/portal"
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors shrink-0 group"
            >
              <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Portal
            </Link>
            <div className="w-px h-4 bg-slate-800" />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Property AI Engine</span>
              </div>
              <h1 className="text-lg font-bold text-slate-100 leading-none">Properties</h1>
            </div>
          </div>
          <Link
            href="/dashboard/properties/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Property
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Properties', value: total, icon: '🏠' },
            { label: 'Live', value: submissions.filter(s => s.status === 'live').length, icon: '✅' },
            { label: 'Processing', value: submissions.filter(s => ['analyzing','enriching','generating'].includes(s.status)).length, icon: '⚡' },
            { label: 'Avg Readiness', value: submissions.length > 0 ? Math.round(submissions.reduce((a, s) => a + (s.intelligence?.listing_readiness_score ?? 0), 0) / submissions.length) + '%' : '—', icon: '📊' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-[#111118] border border-slate-800 p-4 flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-slate-100 font-bold text-lg leading-none">{stat.value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search properties…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#111118] border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 w-48 transition-colors"
          />
          <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                statusFilter === f.value
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-[#111118] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
          </div>
          <span className="ml-auto text-xs text-slate-600">{total} total</span>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Table ── */}
        {!error && (
          <div className="rounded-2xl bg-[#111118] border border-slate-800 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Property / ID</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Readiness</div>
              <div className="col-span-2">Demand</div>
              <div className="col-span-2">Updated</div>
            </div>

            {/* Rows */}
            {loading && submissions.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-600 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="text-slate-500 text-sm mb-3">No properties yet.</p>
                <Link
                  href="/dashboard/properties/new"
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Upload your first property →
                </Link>
              </div>
            ) : (
              filtered.map((sub) => (
                <Link
                  key={sub.submission_id}
                  href={`/dashboard/properties/${sub.submission_id}`}
                  className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors group"
                >
                  {/* Property */}
                  <div className="col-span-4 min-w-0">
                    <p className="text-slate-100 text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                      {sub.raw_description
                        ? sub.raw_description.slice(0, 60) + (sub.raw_description.length > 60 ? '…' : '')
                        : `Property ${sub.submission_id.slice(0, 8)}`}
                    </p>
                    <p className="text-slate-600 text-xs mt-0.5">
                      {sub.file_count} file{sub.file_count !== 1 ? 's' : ''} · {sub.agent_id}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center">
                    <StatusBadge status={sub.status} />
                  </div>

                  {/* Readiness */}
                  <div className="col-span-2 flex flex-col justify-center">
                    {sub.intelligence ? (
                      <ScoreBar score={sub.intelligence.listing_readiness_score} color="emerald" />
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </div>

                  {/* Demand */}
                  <div className="col-span-2 flex flex-col justify-center">
                    {sub.intelligence ? (
                      <ScoreBar score={sub.intelligence.demand_score} color="blue" />
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-slate-500 text-xs">{formatDate(sub.updated_at)}</span>
                  </div>
                </Link>
              ))
            )}

            {/* Load more */}
            {hasMore && (
              <div className="px-5 py-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 text-sm hover:border-slate-700 hover:text-slate-200 transition-colors disabled:opacity-40"
                >
                  {loading ? 'Loading…' : `Load more (${total - submissions.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
