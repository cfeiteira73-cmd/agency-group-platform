'use client'

// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// Property AI — submission detail view with full pipeline results

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetailResponse {
  submission_id: string
  status: string
  ready: boolean
  data: {
    analysis?: Record<string, unknown> | null
    listing?: Record<string, unknown> | null
    intelligence?: Record<string, unknown> | null
    copilot?: Record<string, unknown> | null
    distribution?: Record<string, unknown>[] | null
  }
  created_at: string
  updated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(eur: number | null | undefined): string {
  if (!eur) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-5">
      <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | number | undefined | null | boolean }) {
  const display = value === null || value === undefined ? '—' : String(value)
  return (
    <div className="rounded-xl bg-slate-900/60 p-3">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-slate-100 font-medium text-sm">{display}</p>
    </div>
  )
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 32
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#60a5fa' : score >= 40 ? '#fbbf24' : '#f87171'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="#1e293b" strokeWidth="7" />
        <circle cx="42" cy="42" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke={color} strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="text-center -mt-14 mb-10">
        <p className="text-2xl font-bold" style={{ color }}>{Math.round(score)}</p>
      </div>
      <p className="text-xs text-slate-500 text-center leading-tight">{label}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tracked, setTracked] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/property-ai/submissions/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const d = await res.json() as DetailResponse
        setData(d)
        setLoading(false)
        // Keep polling if still processing
        if (!d.ready) return
        clearInterval(interval)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setLoading(false)
        clearInterval(interval)
      }
    }

    void fetchDetail()
    // Poll every 5s while processing
    interval = setInterval(() => { void fetchDetail() }, 5000)
    return () => clearInterval(interval)
  }, [id])

  // Track view event (fire-and-forget, once)
  useEffect(() => {
    if (data?.ready && !tracked) {
      setTracked(true)
      void fetch('/api/property-ai/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: id,
          org_id: data.data.analysis ? 'agency-group' : 'agency-group',
          event_type: 'click',
          channel: 'homepage',
        }),
      })
    }
  }, [data?.ready, id, tracked, data])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading property…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <Link href="/dashboard/properties" className="text-blue-400 text-sm hover:text-blue-300 underline">← Back to Properties</Link>
        </div>
      </div>
    )
  }

  const d = data!
  const analysis    = d.data.analysis
  const listing     = d.data.listing
  const intel       = d.data.intelligence
  const copilot     = d.data.copilot
  const dist        = d.data.distribution ?? []

  const location = analysis?.location as Record<string, unknown> | undefined
  const titles   = listing?.titles as Record<string, Record<string, string>> | undefined
  const titlePt  = titles?.standard?.pt ?? titles?.premium?.pt ?? '—'
  const titleEn  = titles?.standard?.en ?? titles?.premium?.en ?? '—'

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#0A0A0F]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/properties" className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Property AI</p>
              <h1 className="text-lg font-bold text-slate-100 truncate max-w-sm">{titlePt}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${d.status === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              {d.status === 'live' && <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {d.status}
            </span>
            {d.ready && (
              <Link href={`/dashboard/properties/new`} className="px-3 py-1.5 rounded-lg text-xs bg-blue-500 hover:bg-blue-400 text-white font-medium transition-colors">
                + New Property
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Still processing */}
        {!d.ready && (
          <div className="rounded-2xl bg-[#111118] border border-slate-800 p-8 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
            <p className="text-slate-300 font-medium capitalize">{d.status}…</p>
            <p className="text-slate-600 text-sm">Refreshing every 5 seconds</p>
          </div>
        )}

        {d.ready && (
          <>
            {/* Intelligence scores */}
            {intel && (
              <div className="rounded-2xl bg-[#111118] border border-slate-800 p-5">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-5">Intelligence Scores</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ScoreRing score={Number(intel.listing_readiness_score ?? 0)} label="Readiness" />
                  <ScoreRing score={Number(intel.demand_score ?? 0)} label="Demand" />
                  <ScoreRing score={Number(intel.investor_attractiveness ?? 0)} label="Investor" />
                  <ScoreRing score={Number(intel.homepage_placement_score ?? 0)} label="Homepage" />
                </div>
              </div>
            )}

            {/* Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Analysis */}
              {analysis && (
                <Section title="AI Analysis">
                  <div className="grid grid-cols-2 gap-2">
                    <Fact label="Bedrooms" value={analysis.bedrooms as number} />
                    <Fact label="Bathrooms" value={analysis.bathrooms as number} />
                    <Fact label="Area" value={analysis.area_sqm ? `${analysis.area_sqm} m²` : null} />
                    <Fact label="Condition" value={analysis.condition as string} />
                    <Fact label="Energy Class" value={analysis.energy_class as string} />
                    <Fact label="Luxury Score" value={analysis.luxury_score ? `${analysis.luxury_score}/100` : null} />
                    <Fact label="City" value={location?.city as string} />
                    <Fact label="Confidence" value={analysis.confidence ? `${Math.round((analysis.confidence as number) * 100)}%` : null} />
                  </div>
                  <div className="flex gap-2 flex-wrap mt-3">
                    {(['has_pool','has_sea_view','has_garden','has_elevator','has_golf_view'] as const).map((k) => (
                      analysis[k] ? (
                        <span key={k} className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          {k.replace('has_', '').replace('_', ' ')}
                        </span>
                      ) : null
                    ))}
                  </div>
                </Section>
              )}

              {/* Copilot */}
              {copilot && (
                <Section title="AI Copilot">
                  <div className="space-y-2 mb-4">
                    <Fact label="Recommended Price" value={formatPrice(copilot.readiness_report as number)} />
                    <Fact label="Publish Window" value={copilot.publishing_strategy ? `${(copilot.publishing_strategy as Record<string, unknown>).target_day} ${(copilot.publishing_strategy as Record<string, unknown>).target_hour}:00` : null} />
                  </div>
                  {typeof copilot.ai_summary === 'string' && copilot.ai_summary && (
                    <p className="text-slate-400 text-sm leading-relaxed rounded-xl bg-slate-900/60 p-3">
                      {copilot.ai_summary}
                    </p>
                  )}
                  {Array.isArray(copilot.action_items) && copilot.action_items.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(copilot.action_items as string[]).map((item, i) => (
                        <div key={i} className="flex gap-2 text-sm text-slate-300">
                          <span className="text-blue-400 shrink-0">→</span>
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              )}
            </div>

            {/* Listing */}
            {listing && (
              <Section title="Generated Listing">
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-900/60 p-4">
                    <p className="text-xs text-slate-500 mb-1">PT</p>
                    <p className="text-slate-100 font-semibold">{titlePt}</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 p-4">
                    <p className="text-xs text-slate-500 mb-1">EN</p>
                    <p className="text-slate-200 font-medium">{titleEn}</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-xl bg-slate-900/60 p-3 flex-1">
                      <p className="text-xs text-slate-500 mb-0.5">Estimated Price</p>
                      <p className="text-emerald-400 font-bold">{formatPrice(listing.estimated_price_eur as number)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/60 p-3 flex-1">
                      <p className="text-xs text-slate-500 mb-0.5">Confidence</p>
                      <p className="text-slate-100 font-bold">{listing.confidence ? `${Math.round((listing.confidence as number) * 100)}%` : '—'}</p>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Distribution */}
            {dist.length > 0 && (
              <Section title="Distribution">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {dist.map((ch: Record<string, unknown>, i) => (
                    <div key={i} className={`rounded-xl border p-3 flex items-center justify-between ${
                      ch.status === 'sent' ? 'bg-emerald-500/5 border-emerald-500/20' :
                      ch.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                      'bg-slate-900/40 border-slate-800'
                    }`}>
                      <span className="text-sm text-slate-300 capitalize">{String(ch.channel)}</span>
                      <span className={`text-xs ${ch.status === 'sent' ? 'text-emerald-400' : ch.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                        {String(ch.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
