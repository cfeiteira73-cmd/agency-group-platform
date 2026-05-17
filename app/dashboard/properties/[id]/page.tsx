'use client'

// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// Property detail + full inline editing — AG brand design

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetailResponse {
  submission_id: string
  status: string
  ready: boolean
  data: {
    analysis?: Record<string, unknown> | null
    listing?:  Record<string, unknown> | null
    intelligence?: Record<string, unknown> | null
    copilot?:  Record<string, unknown> | null
    distribution?: Array<Record<string, unknown>> | null
  }
  created_at: string
  updated_at: string
}

// ─── AG brand tokens ──────────────────────────────────────────────────────────

const C = {
  bg:         '#0c1f15',
  card:       '#111e16',
  cardDeep:   'rgba(12,31,21,0.6)',
  border:     'rgba(201,169,110,0.15)',
  goldBorder: 'rgba(201,169,110,0.22)',
  divider:    'rgba(201,169,110,0.08)',
  gold:       '#c9a96e',
  goldDim:    'rgba(201,169,110,0.12)',
  cream:      '#f4f0e6',
  cream55:    'rgba(244,240,230,0.55)',
  cream28:    'rgba(244,240,230,0.28)',
  green:      '#4ade80',
  greenDim:   'rgba(74,222,128,0.1)',
  greenBorder:'rgba(74,222,128,0.25)',
  err:        '#f87171',
  errDim:     'rgba(248,113,113,0.1)',
  errBorder:  'rgba(248,113,113,0.25)',
  amber:      '#fbbf24',
  amberDim:   'rgba(251,191,36,0.1)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(eur: number | null | undefined): string {
  if (!eur) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur)
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r    = 30
  const circ = 2 * Math.PI * r
  const off  = circ - (Math.min(score, 100) / 100) * circ
  const col  = score >= 80 ? C.green : score >= 60 ? C.gold : score >= 40 ? C.amber : C.err

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 76, height: 76 }}>
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 76 76">
          <circle cx="38" cy="38" r={r} fill="none" stroke={C.border} strokeWidth="6" />
          <circle cx="38" cy="38" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={off} stroke={col}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 18, fontWeight: 400, color: col }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
        {label}
      </p>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { bg: string; text: string; border: string; dot?: string }> = {
  ingesting:  { bg: C.cardDeep,     text: C.cream28, border: C.border },
  analyzing:  { bg: C.goldDim,      text: C.gold,    border: C.goldBorder, dot: C.gold },
  enriching:  { bg: C.goldDim,      text: C.gold,    border: C.goldBorder, dot: C.gold },
  generating: { bg: C.goldDim,      text: C.gold,    border: C.goldBorder, dot: C.gold },
  reviewing:  { bg: C.amberDim,     text: C.amber,   border: 'rgba(251,191,36,0.3)' },
  live:       { bg: C.greenDim,     text: C.green,   border: C.greenBorder, dot: C.green },
  archived:   { bg: C.cardDeep,     text: C.cream28, border: C.border },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.archived
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 99,
      background: m.bg, color: m.text, border: `1px solid ${m.border}`,
      fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
      fontFamily: 'var(--font-jost, system-ui)',
    }}>
      {m.dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.dot, animation: ['analyzing','enriching','generating','live'].includes(status) ? 'pulse 2s ease-in-out infinite' : 'none', display: 'inline-block' }} />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Editable Field ───────────────────────────────────────────────────────────

function EditField({
  label, value, onChange, multiline = false, type = 'text', unit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  type?: string
  unit?: string
}) {
  const [focused, setFocused] = useState(false)
  const commonStyle = {
    width: '100%', background: focused ? 'rgba(12,31,21,0.8)' : C.cardDeep,
    border: `1px solid ${focused ? C.goldBorder : C.border}`,
    borderRadius: 8, padding: unit ? '9px 36px 9px 12px' : '9px 12px',
    color: C.cream, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'var(--font-jost, system-ui)', transition: 'all 0.15s', resize: 'none' as const,
  }
  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-jost, system-ui)' }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={commonStyle}
        />
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={commonStyle}
          />
          {unit && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.cream28, fontSize: 11 }}>{unit}</span>}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [remote, setRemote]   = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [saving,   setSaving]   = useState(false)
  const [saveOk,   setSaveOk]   = useState(false)
  const [saveErr,  setSaveErr]  = useState<string | null>(null)
  const [isDirty,  setIsDirty]  = useState(false)

  // Listing editable fields
  const [price,    setPrice]    = useState('')
  const [titlePt,  setTitlePt]  = useState('')
  const [titleEn,  setTitleEn]  = useState('')
  const [titleFr,  setTitleFr]  = useState('')
  const [titleEs,  setTitleEs]  = useState('')
  const [descPt,   setDescPt]   = useState('')
  const [descEn,   setDescEn]   = useState('')

  // Analysis editable fields
  const [bedrooms,  setBedrooms]  = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [areaSqm,   setAreaSqm]   = useState('')
  const [condition, setCondition] = useState('')
  const [luxScore,  setLuxScore]  = useState('')

  // Status
  const [status, setStatus] = useState('')

  // Lang tab
  const [langTab, setLangTab] = useState<'pt' | 'en' | 'fr' | 'es'>('pt')

  // Mark dirty on any field change
  const dirty = useCallback((setter: (v: string) => void) => (v: string) => {
    setter(v); setIsDirty(true); setSaveOk(false); setSaveErr(null)
  }, [])

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const populate = useCallback((d: DetailResponse) => {
    const listing  = d.data.listing  as Record<string, unknown> | null | undefined
    const analysis = d.data.analysis as Record<string, unknown> | null | undefined
    const titles   = listing?.titles as Record<string, Record<string, string>> | undefined
    const descs    = listing?.descriptions as Record<string, string> | undefined

    setPrice(   String(listing?.estimated_price_eur ?? ''))
    setTitlePt( titles?.standard?.pt ?? titles?.premium?.pt ?? '')
    setTitleEn( titles?.standard?.en ?? titles?.premium?.en ?? '')
    setTitleFr( titles?.standard?.fr ?? titles?.premium?.fr ?? '')
    setTitleEs( titles?.standard?.es ?? titles?.premium?.es ?? '')
    setDescPt(  descs?.pt ?? '')
    setDescEn(  descs?.en ?? '')
    setBedrooms( String(analysis?.bedrooms  ?? ''))
    setBathrooms(String(analysis?.bathrooms ?? ''))
    setAreaSqm(  String(analysis?.area_sqm  ?? ''))
    setCondition(String(analysis?.condition ?? ''))
    setLuxScore( String(analysis?.luxury_score ?? ''))
    setStatus(   d.status)
    setIsDirty(false)
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/property-ai/submissions/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const d = await res.json() as DetailResponse
        setRemote(d)
        setLoading(false)
        populate(d)
        if (d.ready) clearInterval(interval)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setLoading(false)
        clearInterval(interval)
      }
    }
    void fetchDetail()
    interval = setInterval(() => { void fetchDetail() }, 5000)
    return () => clearInterval(interval)
  }, [id, populate])

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true); setSaveOk(false); setSaveErr(null)
    try {
      const body: Record<string, unknown> = {
        listing: {
          titles: { standard: { pt: titlePt, en: titleEn, fr: titleFr, es: titleEs } },
          descriptions: { pt: descPt, en: descEn },
          estimated_price_eur: price ? Number(price) : undefined,
        },
        analysis: {
          bedrooms:    bedrooms    ? bedrooms    : undefined,
          bathrooms:   bathrooms   ? bathrooms   : undefined,
          area_sqm:    areaSqm     ? areaSqm     : undefined,
          condition:   condition   ? condition   : undefined,
          luxury_score:luxScore    ? luxScore    : undefined,
        },
      }
      if (status !== remote?.status) body.status = status

      const res = await fetch(`/api/property-ai/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Save failed' })) as { error: string }
        throw new Error(e.error)
      }
      setSaveOk(true); setIsDirty(false)
      setTimeout(() => setSaveOk(false), 3000)
      // If archived, go back to list
      if (status === 'archived') router.push('/dashboard/properties')
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jost, system-ui)' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.gold, animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: C.cream28, fontSize: 13 }}>Loading property…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jost, system-ui)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.err, marginBottom: 16, fontSize: 14 }}>{error}</p>
          <Link href="/dashboard/properties" style={{ color: C.gold, fontSize: 13, textDecoration: 'none' }}>← Back to Properties</Link>
        </div>
      </div>
    )
  }

  const d    = remote!
  const intel = d.data.intelligence as Record<string, unknown> | null | undefined
  const copilot = d.data.copilot   as Record<string, unknown> | null | undefined
  const dist = (d.data.distribution ?? []) as Array<Record<string, unknown>>
  const loc  = (d.data.analysis as Record<string, unknown> | null | undefined)?.location as Record<string, unknown> | undefined

  const displayTitle = titlePt || titleEn || `Property ${id.slice(0, 8).toUpperCase()}`

  return (
    <div style={{ minHeight: '100%', background: C.bg, fontFamily: 'var(--font-jost, system-ui)', color: C.cream }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
        .ag-back:hover    { color: ${C.gold} !important; }
        .ag-save:hover:not(:disabled) { background: #b8955a !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,169,110,0.3) !important; }
        .ag-tab:hover     { color: ${C.cream55} !important; }
        .ag-new:hover     { border-color: ${C.goldBorder} !important; color: ${C.cream} !important; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: 'linear-gradient(180deg, #0c1f15 0%, rgba(12,31,21,0.95) 100%)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 4 }}>
            <Link href="/portal" className="ag-back" style={{ color: C.cream28, fontSize: 11, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Portal
            </Link>
            <span style={{ color: C.cream28, fontSize: 11 }}>/</span>
            <Link href="/dashboard/properties" className="ag-back" style={{ color: C.cream28, fontSize: 11, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, transition: 'color 0.15s' }}>
              Properties
            </Link>
            <span style={{ color: C.cream28, fontSize: 11 }}>/</span>
            <span style={{ color: C.gold, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
              {id.slice(0, 8).toUpperCase()}
            </span>
          </div>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 18, gap: 24 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{
                fontFamily: 'var(--font-cormorant, serif)', fontSize: 30, fontWeight: 300,
                color: C.cream, lineHeight: 1.2, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayTitle}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <StatusBadge status={status} />
                <span style={{ color: C.cream28, fontSize: 11 }}>
                  Updated {fmtDate(d.updated_at)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {isDirty && !saving && (
                <span style={{ fontSize: 11, color: C.amber, letterSpacing: '0.04em' }}>
                  ● Unsaved changes
                </span>
              )}
              {saveOk && (
                <span style={{ fontSize: 11, color: C.green, letterSpacing: '0.04em' }}>
                  ✓ Saved
                </span>
              )}
              {saveErr && (
                <span style={{ fontSize: 11, color: C.err, letterSpacing: '0.04em' }}>
                  ✗ {saveErr}
                </span>
              )}
              <button
                type="button"
                onClick={() => { void handleSave() }}
                disabled={!isDirty || saving}
                className={isDirty && !saving ? 'ag-save' : ''}
                style={{
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.04em', border: 'none', cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
                  background: isDirty && !saving ? C.gold : C.border,
                  color: isDirty && !saving ? C.bg : C.cream28,
                  transition: 'all 0.2s', fontFamily: 'var(--font-jost, system-ui)',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <Link href="/dashboard/properties/new" className="ag-new" style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                border: `1px solid ${C.border}`, background: 'transparent',
                color: C.cream55, textDecoration: 'none', transition: 'all 0.15s',
              }}>
                + New
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>

        {/* Processing state */}
        {!d.ready && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
            padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.gold, animation: 'spin 0.9s linear infinite' }} />
            <p style={{ color: C.cream55, fontWeight: 500, textTransform: 'capitalize', fontSize: 15 }}>{d.status}…</p>
            <p style={{ color: C.cream28, fontSize: 12 }}>Refreshing every 5 seconds</p>
          </div>
        )}

        {d.ready && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Intelligence scores ─────────────────────────────────────── */}
            {intel && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '24px 28px' }}>
                <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 20 }}>Intelligence Scores</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                  <ScoreRing score={Number(intel.listing_readiness_score  ?? 0)} label="Readiness" />
                  <ScoreRing score={Number(intel.demand_score             ?? 0)} label="Demand" />
                  <ScoreRing score={Number(intel.investor_attractiveness  ?? 0)} label="Investor" />
                  <ScoreRing score={Number(intel.homepage_placement_score ?? 0)} label="Homepage" />
                </div>
              </div>
            )}

            {/* ── Two columns: Edit Listing + Analysis ───────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* LEFT — Listing / Edit */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Listing</p>
                    {/* Lang tabs */}
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      {(['pt','en','fr','es'] as const).map(l => (
                        <button key={l} type="button"
                          onClick={() => setLangTab(l)}
                          style={{
                            padding: '4px 10px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.06em', cursor: 'pointer', border: 'none',
                            background: langTab === l ? C.gold : C.card,
                            color: langTab === l ? C.bg : C.cream55,
                            transition: 'all 0.15s', fontFamily: 'var(--font-jost, system-ui)',
                          }}>{l}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {langTab === 'pt' && <>
                      <EditField label="Title PT" value={titlePt} onChange={dirty(setTitlePt)} />
                      <EditField label="Description PT" value={descPt} onChange={dirty(setDescPt)} multiline />
                    </>}
                    {langTab === 'en' && <>
                      <EditField label="Title EN" value={titleEn} onChange={dirty(setTitleEn)} />
                      <EditField label="Description EN" value={descEn} onChange={dirty(setDescEn)} multiline />
                    </>}
                    {langTab === 'fr' && <>
                      <EditField label="Title FR" value={titleFr} onChange={dirty(setTitleFr)} />
                      <p style={{ color: C.cream28, fontSize: 12 }}>Description FR — not yet generated</p>
                    </>}
                    {langTab === 'es' && <>
                      <EditField label="Title ES" value={titleEs} onChange={dirty(setTitleEs)} />
                      <p style={{ color: C.cream28, fontSize: 12 }}>Description ES — not yet generated</p>
                    </>}
                  </div>
                </div>

                {/* Price card */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                  <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16 }}>Pricing</p>
                  <EditField label="Listing Price (€)" value={price} onChange={dirty(setPrice)} type="number" unit="€" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                    <div style={{ background: C.cardDeep, borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current Value</p>
                      <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 20, color: C.gold }}>{fmt(Number(price) || undefined)}</p>
                    </div>
                    <div style={{ background: C.cardDeep, borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Price / m²</p>
                      <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 20, color: C.cream55 }}>
                        {price && areaSqm ? fmt(Math.round(Number(price) / Number(areaSqm))) : '—'}
                      </p>
                    </div>
                  </div>
                  {copilot && typeof copilot.pricing_advice === 'string' && copilot.pricing_advice && (
                    <p style={{ color: C.cream28, fontSize: 12, marginTop: 12, lineHeight: 1.6, padding: '10px 14px', background: C.cardDeep, borderRadius: 8, borderLeft: `2px solid ${C.goldBorder}` }}>
                      💡 {copilot.pricing_advice}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT — Analysis (editable) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                  <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 20 }}>Property Details</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <EditField label="Bedrooms"    value={bedrooms}  onChange={dirty(setBedrooms)}  type="number" />
                    <EditField label="Bathrooms"   value={bathrooms} onChange={dirty(setBathrooms)} type="number" />
                    <EditField label="Area (m²)"   value={areaSqm}   onChange={dirty(setAreaSqm)}   type="number" unit="m²" />
                    <EditField label="Luxury Score (0-100)" value={luxScore} onChange={dirty(setLuxScore)} type="number" />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: 'block', fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={e => { setCondition(e.target.value); setIsDirty(true) }}
                      style={{
                        width: '100%', background: C.cardDeep, border: `1px solid ${C.border}`,
                        borderRadius: 8, padding: '9px 12px', color: C.cream,
                        fontSize: 13, outline: 'none', fontFamily: 'var(--font-jost, system-ui)',
                        appearance: 'none', cursor: 'pointer',
                      }}
                    >
                      {['new','excellent','good','fair','needs_renovation','unknown'].map(v => (
                        <option key={v} value={v} style={{ background: '#111e16' }}>
                          {v.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location */}
                  {loc && (
                    <div style={{ marginTop: 16, padding: '12px 14px', background: C.cardDeep, borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[['City', String(loc.city ?? '—')], ['Neighborhood', String(loc.neighborhood ?? '—')], ['District', String(loc.district ?? '—')], ['Country', String(loc.country ?? '—')]].map(([label, value]) => (
                        <div key={label}>
                          <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
                          <p style={{ color: C.cream, fontSize: 13 }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status editor */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                  <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16 }}>Status & Workflow</p>
                  <select
                    value={status}
                    onChange={e => { setStatus(e.target.value); setIsDirty(true) }}
                    style={{
                      width: '100%', background: C.cardDeep, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '9px 12px', color: C.cream,
                      fontSize: 13, outline: 'none', fontFamily: 'var(--font-jost, system-ui)',
                      appearance: 'none', cursor: 'pointer', marginBottom: 12,
                    }}
                  >
                    {['reviewing','live','archived'].map(v => (
                      <option key={v} value={v} style={{ background: '#111e16' }}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: status === 'live' ? C.greenDim : status === 'archived' ? C.errDim : C.amberDim,
                    border: `1px solid ${status === 'live' ? C.greenBorder : status === 'archived' ? C.errBorder : 'rgba(251,191,36,0.25)'}`,
                  }}>
                    <p style={{
                      fontSize: 12,
                      color: status === 'live' ? C.green : status === 'archived' ? C.err : C.amber,
                    }}>
                      {status === 'live'     ? '✓ Published · Visible on homepage and portals' :
                       status === 'archived' ? '⊘ Archived · Hidden from all channels' :
                                              '◎ Under review · Not yet published'}
                    </p>
                  </div>
                </div>

                {/* Copilot */}
                {copilot && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: C.goldDim, border: `1px solid ${C.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✦</div>
                      <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>AI Copilot</p>
                    </div>
                    {typeof copilot.ai_summary === 'string' && copilot.ai_summary && (
                      <p style={{ color: C.cream55, fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>{copilot.ai_summary}</p>
                    )}
                    {Array.isArray(copilot.action_items) && (copilot.action_items as string[]).length > 0 && (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(copilot.action_items as string[]).map((item, i) => (
                          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: C.cream55 }}>
                            <span style={{ color: C.gold, flexShrink: 0 }}>→</span>{item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Distribution ─────────────────────────────────────────────── */}
            {dist.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                <p style={{ fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16 }}>Distribution Channels</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {dist.map((ch, i) => {
                    const sent   = ch.status === 'sent'
                    const failed = ch.status === 'failed'
                    return (
                      <div key={i} style={{
                        borderRadius: 12, padding: '12px 16px',
                        background: sent ? C.greenDim : failed ? C.errDim : C.cardDeep,
                        border: `1px solid ${sent ? C.greenBorder : failed ? C.errBorder : C.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 12, color: C.cream55, textTransform: 'capitalize' }}>{String(ch.channel)}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: sent ? C.green : failed ? C.err : C.amber }}>
                          {sent ? '✓ sent' : failed ? '✗ failed' : '⏳ pending'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Bottom save bar ───────────────────────────────────────────── */}
            {isDirty && (
              <div style={{
                position: 'sticky', bottom: 24, zIndex: 20,
                background: C.card, border: `1px solid ${C.goldBorder}`,
                borderRadius: 16, padding: '16px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,169,110,0.1)',
              }}>
                <p style={{ color: C.cream55, fontSize: 13 }}>
                  <span style={{ color: C.amber }}>●</span> You have unsaved changes
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => remote && populate(remote)} style={{
                    padding: '9px 18px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${C.border}`, background: 'transparent',
                    color: C.cream55, cursor: 'pointer', fontFamily: 'var(--font-jost, system-ui)',
                  }}>Discard</button>
                  <button type="button" onClick={() => { void handleSave() }} disabled={saving}
                    className={!saving ? 'ag-save' : ''}
                    style={{
                      padding: '9px 22px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                      background: C.gold, color: C.bg, border: 'none',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s', fontFamily: 'var(--font-jost, system-ui)',
                      boxShadow: '0 4px 14px rgba(201,169,110,0.25)',
                      opacity: saving ? 0.6 : 1,
                    }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
