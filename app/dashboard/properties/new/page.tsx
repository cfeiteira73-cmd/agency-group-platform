'use client'

// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// Dashboard: Upload & AI Analysis — AG brand design

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'analyzing' | 'enriching' | 'generating' | 'ready' | 'error'

interface AnalysisResult {
  bedrooms?: number
  bathrooms?: number
  area_sqm?: number
  luxury_score: number
  has_sea_view: boolean
  has_pool: boolean
  condition: string
  location?: string
  confidence: number
}

interface ReadinessResult {
  score: number
  grade: string
  ready_to_publish: boolean
  blocking_issues: string[]
}

interface ListingResult {
  title_pt: string
  title_en: string
  description_pt: string
  description_en: string
  estimated_price: number
}

interface CopilotResult {
  recommended_price: number
  publish_time: string
  primary_audience: string
  action_items: string[]
}

interface UploadState {
  status: UploadStatus
  files: File[]
  rawText: string
  rawUrl: string
  progress: number
  analysis?: AnalysisResult
  readiness?: ReadinessResult
  listing?: ListingResult
  copilot?: CopilotResult
  error?: string
  processing_time_ms?: number
}

// ─── AG brand tokens ─────────────────────────────────────────────────────────

const C = {
  bg:         '#0c1f15',
  card:       '#111e16',
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
}

// ─── API mappers ──────────────────────────────────────────────────────────────

function mapAnalysis(pipeline: Record<string, unknown>): AnalysisResult {
  const ing      = (pipeline.ingestion as Record<string, unknown>) ?? {}
  const analysis = (ing.analysis    as Record<string, unknown>) ?? {}
  const loc      = analysis.location as Record<string, unknown> | undefined
  return {
    bedrooms:     typeof analysis.bedrooms    === 'number' ? analysis.bedrooms    : undefined,
    bathrooms:    typeof analysis.bathrooms   === 'number' ? analysis.bathrooms   : undefined,
    area_sqm:     typeof analysis.area_sqm    === 'number' ? analysis.area_sqm    : undefined,
    luxury_score: typeof analysis.luxury_score=== 'number' ? analysis.luxury_score: 0,
    has_sea_view: Boolean(analysis.has_sea_view),
    has_pool:     Boolean(analysis.has_pool),
    condition:    typeof analysis.condition   === 'string' ? analysis.condition   : 'unknown',
    location:     loc?.city ? `${loc.city}${loc.neighborhood ? `, ${loc.neighborhood}` : ''}` : undefined,
    confidence:   typeof ing.confidence === 'number' ? ing.confidence : 0.5,
  }
}

function mapReadiness(pipeline: Record<string, unknown>): ReadinessResult {
  const cop     = (pipeline.copilot as Record<string, unknown>) ?? {}
  const score   = typeof cop.readiness_score === 'number' ? cop.readiness_score : 50
  const grade   = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F'
  const items   = Array.isArray(cop.action_items) ? (cop.action_items as string[]) : []
  const blocking= items.filter(i => i.toLowerCase().startsWith('⚠') || i.toLowerCase().startsWith('block'))
  return { score, grade, ready_to_publish: Boolean(cop.ready_to_publish), blocking_issues: blocking }
}

function mapListing(pipeline: Record<string, unknown>): ListingResult {
  const list    = (pipeline.listing  as Record<string, unknown>) ?? {}
  const titles  = (list.title        as Record<string, unknown>) ?? {}
  const cop     = (pipeline.copilot  as Record<string, unknown>) ?? {}
  const standard= (titles.standard   as Record<string, string>)  ?? {}
  const premium = (titles.premium    as Record<string, string>)  ?? {}
  return {
    title_pt:        standard.pt ?? premium.pt ?? '',
    title_en:        standard.en ?? premium.en ?? '',
    description_pt:  '',
    description_en:  '',
    estimated_price: typeof cop.optimal_price === 'number' ? cop.optimal_price : 0,
  }
}

function mapCopilot(pipeline: Record<string, unknown>): CopilotResult {
  const cop   = (pipeline.copilot as Record<string, unknown>) ?? {}
  const items = Array.isArray(cop.action_items) ? (cop.action_items as string[]) : []
  return {
    recommended_price: typeof cop.optimal_price === 'number' ? cop.optimal_price : 0,
    publish_time:      'Wednesday 10:00',
    primary_audience:  typeof cop.ai_summary === 'string' ? cop.ai_summary : '',
    action_items:      items.slice(0, 5),
  }
}

function formatPrice(eur: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur)
}

// ─── Progress Stepper ─────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Analyse', 'Generate', 'Ready'] as const

function ProgressStepper({ status }: { status: UploadStatus }) {
  const activeIndex =
    status === 'idle' || status === 'uploading' ? 0
    : status === 'analyzing' || status === 'enriching' ? 1
    : status === 'generating' ? 2
    : status === 'ready' ? 3 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: 480, margin: '0 auto 32px', gap: 0 }}>
      {STEPS.map((step, idx) => {
        const done   = idx < activeIndex
        const active = idx === activeIndex
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `2px solid ${done ? C.gold : active ? C.gold : C.border}`,
                background: done ? C.gold : active ? C.goldDim : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: done ? C.bg : active ? C.gold : C.cream28,
                animation: active ? 'pulse 2s ease-in-out infinite' : 'none',
                transition: 'all 0.5s',
              }}>
                {done ? '✓' : idx + 1}
              </div>
              <span style={{
                fontSize: 10, marginTop: 6, fontWeight: 500, letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: done ? C.gold : active ? C.gold : C.cream28,
                fontFamily: 'var(--font-jost, system-ui)',
              }}>
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                height: 1, flex: 1, marginTop: -18,
                background: done ? C.gold : C.border,
                transition: 'background 0.7s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Drag & Drop Zone ─────────────────────────────────────────────────────────

function DragDropZone({ files, onFiles, disabled }: { files: File[]; onFiles: (f: File[]) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    if (disabled) return
    onFiles(Array.from(e.dataTransfer.files))
  }, [disabled, onFiles])

  const hasFiles = files.length > 0

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        borderRadius: 20,
        border: `2px dashed ${dragging ? C.gold : hasFiles ? 'rgba(74,222,128,0.4)' : C.border}`,
        background: dragging ? C.goldDim : hasFiles ? C.greenDim : 'transparent',
        minHeight: 220, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, transition: 'all 0.3s', opacity: disabled ? 0.4 : 1,
        transform: dragging ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      <input ref={inputRef} type="file" multiple accept="image/*,video/*,.pdf,audio/*"
        style={{ display: 'none' }} onChange={e => e.target.files && onFiles(Array.from(e.target.files))} disabled={disabled} />

      {!hasFiles ? (
        <>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: C.goldDim, border: `1px solid ${C.goldBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="28" height="28" fill="none" stroke={C.gold} viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
            </svg>
          </div>
          <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 22, fontWeight: 300, color: C.cream, marginBottom: 8, fontStyle: 'italic' }}>
            Drop property files here
          </p>
          <p style={{ color: C.cream28, fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
            Photos · Videos · PDFs · Voice memos — up to 50 files.<br/>AI extracts everything automatically.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 }}>
            {['JPG / PNG', 'MP4 / MOV', 'PDF', 'M4A / MP3'].map(t => (
              <span key={t} style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 10,
                background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                color: C.gold, letterSpacing: '0.06em', fontWeight: 500,
              }}>{t}</span>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: C.greenDim, border: `1px solid ${C.greenBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="28" height="28" fill="none" stroke={C.green} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 22, color: C.green, fontWeight: 300, fontStyle: 'italic', marginBottom: 8 }}>
            {files.length} file{files.length !== 1 ? 's' : ''} ready
          </p>
          <p style={{ color: C.cream28, fontSize: 12, marginBottom: 16 }}>Click to add more</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 420 }}>
            {files.slice(0, 6).map((f, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11,
                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                color: C.cream55, maxWidth: 150,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{f.name}</span>
            ))}
            {files.length > 6 && (
              <span style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11,
                background: C.goldDim, border: `1px solid ${C.goldBorder}`, color: C.cream28,
              }}>+{files.length - 6} more</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Processing Overlay ───────────────────────────────────────────────────────

function ProcessingOverlay({ status, progress }: { status: UploadStatus; progress: number }) {
  const messages: Record<string, string> = {
    uploading:  'Uploading files to secure storage…',
    analyzing:  'Claude Vision analysing rooms, features & location…',
    enriching:  'Enriching with geo-intelligence & market data…',
    generating: 'Generating multilingual listings in 6 languages…',
  }
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 20, padding: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    }}>
      {/* Spinner */}
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${C.border}`,
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${C.gold}`, borderTopColor: 'transparent',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 12, borderRadius: '50%',
          background: C.goldDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: C.cream, fontWeight: 500, fontSize: 15, marginBottom: 6 }}>
          {messages[status] ?? 'Processing…'}
        </p>
        <p style={{ color: C.cream28, fontSize: 12 }}>Average: 45–90 seconds end-to-end</p>
      </div>
      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: C.cream28, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progress</span>
          <span style={{ color: C.gold, fontSize: 11, fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ width: '100%', height: 3, background: C.border, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: C.gold, borderRadius: 99,
            width: `${progress}%`, transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }`}</style>
    </div>
  )
}

// ─── Analysis Card ────────────────────────────────────────────────────────────

function AnalysisCard({ analysis }: { analysis: AnalysisResult }) {
  const facts = [
    { label: 'Bedrooms',     value: analysis.bedrooms  ?? '—', icon: '🛏' },
    { label: 'Bathrooms',    value: analysis.bathrooms  ?? '—', icon: '🚿' },
    { label: 'Area',         value: analysis.area_sqm ? `${analysis.area_sqm} m²` : '—', icon: '📐' },
    { label: 'Location',     value: analysis.location   ?? '—', icon: '📍' },
    { label: 'Condition',    value: analysis.condition,          icon: '🏠' },
    { label: 'Luxury Score', value: `${analysis.luxury_score}/100`, icon: '✦' },
  ]
  const features = [
    { label: 'Vista Mar', active: analysis.has_sea_view },
    { label: 'Piscina',   active: analysis.has_pool },
  ]
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ color: C.cream55, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-jost, system-ui)' }}>
          AI Analysis
        </h3>
        <span style={{ fontSize: 11, color: C.cream28, background: 'rgba(201,169,110,0.08)', border: `1px solid ${C.border}`, padding: '3px 10px', borderRadius: 99 }}>
          {Math.round(analysis.confidence * 100)}% confidence
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {facts.map(f => (
          <div key={f.label} style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.icon} {f.label}</p>
            <p style={{ color: C.cream, fontWeight: 500, fontSize: 13, textTransform: 'capitalize' }}>{String(f.value)}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {features.map(feat => (
          <span key={feat.label} style={{
            padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 500,
            background: feat.active ? C.greenDim : 'rgba(12,31,21,0.5)',
            border: `1px solid ${feat.active ? C.greenBorder : C.border}`,
            color: feat.active ? C.green : C.cream28,
            textDecoration: feat.active ? 'none' : 'line-through',
          }}>{feat.label}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Readiness Gauge ──────────────────────────────────────────────────────────

function ReadinessGauge({ readiness }: { readiness: ReadinessResult }) {
  const radius       = 40
  const circumference= 2 * Math.PI * radius
  const offset       = circumference - (readiness.score / 100) * circumference
  const gradeColor   = readiness.grade === 'A' ? C.green : readiness.grade === 'B' ? C.gold : readiness.grade === 'C' ? '#f59e0b' : '#f87171'

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ color: C.cream55, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20, alignSelf: 'flex-start', fontFamily: 'var(--font-jost, system-ui)' }}>
        Listing Readiness
      </h3>
      <div style={{ position: 'relative', width: 112, height: 112, marginBottom: 12 }}>
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke={C.border} strokeWidth="7" />
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="7"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            stroke={gradeColor} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 32, fontWeight: 400, color: gradeColor, lineHeight: 1 }}>{readiness.grade}</span>
          <span style={{ fontSize: 10, color: C.cream28, marginTop: 2 }}>{readiness.score}/100</span>
        </div>
      </div>
      {readiness.ready_to_publish ? (
        <span style={{
          padding: '4px 14px', borderRadius: 99, fontSize: 11,
          background: C.greenDim, border: `1px solid ${C.greenBorder}`, color: C.green, fontWeight: 500,
        }}>Ready to publish ✓</span>
      ) : (
        <div style={{ width: '100%' }}>
          {readiness.blocking_issues.map((issue, i) => (
            <p key={i} style={{ fontSize: 11, color: C.err, display: 'flex', gap: 6, marginTop: 6 }}>
              <span>⚠</span>{issue}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Copilot Panel ────────────────────────────────────────────────────────────

function CopilotPanel({ copilot }: { copilot: CopilotResult }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: C.goldDim, border: `1px solid ${C.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>✦</div>
        <h3 style={{ color: C.cream55, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-jost, system-ui)' }}>
          AI Copilot
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recommended Price</p>
          <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 22, fontWeight: 400, color: C.gold }}>{formatPrice(copilot.recommended_price)}</p>
        </div>
        <div style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Best Publish Time</p>
          <p style={{ color: C.cream, fontWeight: 600, fontSize: 15 }}>{copilot.publish_time}</p>
        </div>
      </div>
      <div style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
        <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Primary Audience</p>
        <p style={{ color: C.cream55, fontSize: 13, lineHeight: 1.6 }}>{copilot.primary_audience}</p>
      </div>
      <div>
        <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Action Items</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {copilot.action_items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: C.cream55 }}>
              <span style={{ color: C.gold, flexShrink: 0 }}>→</span>{item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Listing Preview ──────────────────────────────────────────────────────────

function ListingPreview({ listing }: { listing: ListingResult }) {
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ color: C.cream55, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-jost, system-ui)' }}>
          Generated Listing
        </h3>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          {(['pt','en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', cursor: 'pointer', border: 'none',
              background: lang === l ? C.gold : C.card,
              color: lang === l ? C.bg : C.cream55,
              transition: 'all 0.15s', fontFamily: 'var(--font-jost, system-ui)',
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Title</p>
          <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 18, fontWeight: 400, color: C.cream, fontStyle: 'italic' }}>
            {lang === 'pt' ? listing.title_pt : listing.title_en}
          </p>
        </div>
        {(lang === 'pt' ? listing.description_pt : listing.description_en) && (
          <div style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</p>
            <p style={{ color: C.cream55, fontSize: 13, lineHeight: 1.7 }}>
              {lang === 'pt' ? listing.description_pt : listing.description_en}
            </p>
          </div>
        )}
        <div style={{ background: 'rgba(12,31,21,0.6)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Estimated Price</p>
            <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 26, fontWeight: 400, color: C.gold }}>{formatPrice(listing.estimated_price)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: C.cream28, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Price / m²</p>
            <p style={{ color: C.cream55, fontWeight: 600, fontSize: 14 }}>{formatPrice(Math.round(listing.estimated_price / 145))}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Publish Button ───────────────────────────────────────────────────────────

const CHANNELS = [
  { id: 'website',    label: 'Agency Group Website' },
  { id: 'idealista',  label: 'idealista.pt' },
  { id: 'imovirtual', label: 'imovirtual.com' },
  { id: 'instagram',  label: 'Instagram' },
  { id: 'linkedin',   label: 'LinkedIn' },
  { id: 'email',      label: 'Investor Email List' },
]

function PublishButton({ readiness, onPublish }: { readiness: ReadinessResult; onPublish: (ch: string[]) => void }) {
  const [selected, setSelected] = useState(['website','idealista','instagram'])
  const [published, setPublished] = useState(false)
  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
      <h3 style={{ color: C.cream55, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: 'var(--font-jost, system-ui)' }}>
        Publish Channels
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {CHANNELS.map(ch => {
          const active = selected.includes(ch.id)
          return (
            <label key={ch.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
              background: active ? C.goldDim : 'rgba(12,31,21,0.5)',
              border: `1px solid ${active ? C.goldBorder : C.border}`,
              transition: 'all 0.15s',
            }}>
              <input type="checkbox" checked={active} onChange={() => toggle(ch.id)}
                style={{ width: 14, height: 14, accentColor: C.gold, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: active ? C.cream : C.cream55 }}>{ch.label}</span>
            </label>
          )
        })}
      </div>
      {published ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.greenDim, border: `1px solid ${C.greenBorder}`,
          borderRadius: 12, padding: '16px 20px',
        }}>
          <svg width="20" height="20" fill="none" stroke={C.green} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>Published to {selected.length} channel{selected.length !== 1 ? 's' : ''}</p>
            <p style={{ color: C.cream28, fontSize: 11, marginTop: 3 }}>Distribution in progress — check Control Tower for status</p>
          </div>
        </div>
      ) : (
        <button type="button"
          onClick={() => { onPublish(selected); setPublished(true) }}
          disabled={selected.length === 0 || !readiness.ready_to_publish}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: selected.length > 0 && readiness.ready_to_publish ? C.gold : C.border,
            color: selected.length > 0 && readiness.ready_to_publish ? C.bg : C.cream28,
            fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            border: 'none', cursor: selected.length > 0 && readiness.ready_to_publish ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', fontFamily: 'var(--font-jost, system-ui)',
          }}>
          Approve &amp; Publish to {selected.length} channel{selected.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewPropertyPage() {
  const [state, setState] = useState<UploadState>({ status: 'idle', files: [], rawText: '', rawUrl: '', progress: 0 })

  const handleFiles = useCallback((newFiles: File[]) => {
    setState(s => ({ ...s, files: [...s.files, ...newFiles] }))
  }, [])

  const handleStart = useCallback(async () => {
    if (state.files.length === 0 && !state.rawText && !state.rawUrl) return
    const submissionId = crypto.randomUUID()
    setState(s => ({ ...s, status: 'uploading', progress: 10 }))

    let inputFiles: Array<{ file_id: string; url: string; type: string; mime_type?: string; size_bytes?: number; name?: string }> = []

    if (state.files.length > 0) {
      try {
        const form = new FormData()
        form.append('submission_id', submissionId)
        for (const file of state.files) form.append('file', file)
        const upRes = await fetch('/api/property-ai/upload', { method: 'POST', body: form })
        if (upRes.ok) {
          const upData = await upRes.json() as { files: typeof inputFiles }
          inputFiles = upData.files ?? []
        }
      } catch (err) { console.error('[property-ai/upload] error', err) }
    }

    setState(s => ({ ...s, status: 'analyzing', progress: 30 }))

    const progressInterval = setInterval(() => {
      setState(s => {
        if (s.progress >= 85 || s.status === 'ready' || s.status === 'error') return s
        const next = s.progress < 40 ? s.progress + 8 : s.progress < 65 ? s.progress + 5 : s.progress + 2
        const nextStatus: UploadStatus = next < 45 ? 'analyzing' : next < 65 ? 'enriching' : 'generating'
        return { ...s, progress: Math.min(next, 85), status: nextStatus }
      })
    }, 2500)

    try {
      const res = await fetch('/api/property-ai/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId, org_id: 'agency-group', agent_id: 'agent-dashboard',
          input_files: inputFiles,
          raw_description: state.rawText || undefined,
          raw_url: state.rawUrl || undefined,
        }),
        signal: AbortSignal.timeout(90_000),
      })
      clearInterval(progressInterval)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string }
        setState(s => ({ ...s, status: 'error', error: err.message ?? `HTTP ${res.status}` }))
        return
      }
      const data = await res.json() as { submission_id: string; status: string; pipeline: Record<string, unknown>; processing_time_ms: number }
      const pipeline = data.pipeline ?? {}
      setState(s => ({
        ...s, status: 'ready', progress: 100,
        analysis:  mapAnalysis(pipeline),
        readiness: mapReadiness(pipeline),
        listing:   mapListing(pipeline),
        copilot:   mapCopilot(pipeline),
        processing_time_ms: data.processing_time_ms,
      }))
    } catch (err) {
      clearInterval(progressInterval)
      setState(s => ({ ...s, status: 'error', error: err instanceof Error ? err.message : 'Pipeline failed' }))
    }
  }, [state.files, state.rawText, state.rawUrl])

  const handleReset = () => setState({ status: 'idle', files: [], rawText: '', rawUrl: '', progress: 0 })

  const isProcessing = ['uploading','analyzing','enriching','generating'].includes(state.status)
  const isReady      = state.status === 'ready'
  const canStart     = state.status === 'idle' && (state.files.length > 0 || state.rawText.trim() !== '' || state.rawUrl.trim() !== '')

  return (
    <div style={{ minHeight: '100%', background: C.bg, fontFamily: 'var(--font-jost, system-ui)', color: C.cream }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .ag-back:hover { color: #c9a96e !important; }
        .ag-start:hover:not(:disabled) { background: #b8955a !important; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(201,169,110,0.3) !important; }
        .ag-reset:hover { border-color: rgba(201,169,110,0.35) !important; color: #f4f0e6 !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: 'linear-gradient(180deg, #0c1f15 0%, rgba(12,31,21,0.95) 100%)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 4 }}>
            <Link href="/portal" className="ag-back" style={{
              color: C.cream28, fontSize: 11, textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Portal
            </Link>
            <span style={{ color: C.cream28, fontSize: 11 }}>/</span>
            <Link href="/dashboard/properties" className="ag-back" style={{
              color: C.cream28, fontSize: 11, textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
              transition: 'color 0.15s',
            }}>Properties</Link>
            <span style={{ color: C.cream28, fontSize: 11 }}>/</span>
            <span style={{ color: C.gold, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>New</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20, gap: 24 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 34, fontWeight: 300, color: C.cream, lineHeight: 1, margin: 0, letterSpacing: '0.02em' }}>
                Upload <span style={{ color: C.gold, fontStyle: 'italic' }}>New Property</span>
              </h1>
              <p style={{ color: C.cream28, fontSize: 12, marginTop: 6, letterSpacing: '0.04em' }}>AI pipeline · ~60–90 seconds · AMI 22506</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isReady && (
                <button type="button" onClick={handleReset} className="ag-reset" style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.cream55, cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'var(--font-jost, system-ui)',
                }}>Upload Another</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {state.status !== 'idle' && <ProgressStepper status={state.status} />}

        {/* Upload form */}
        {!isProcessing && !isReady && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DragDropZone files={state.files} onFiles={handleFiles} disabled={false} />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  URL — Instagram, website, listing
                </label>
                <input type="url" placeholder="https://www.instagram.com/p/…"
                  value={state.rawUrl}
                  onChange={e => setState(s => ({ ...s, rawUrl: e.target.value }))}
                  style={{
                    width: '100%', background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: '11px 14px', color: C.cream,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'var(--font-jost, system-ui)', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(201,169,110,0.5)')}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: C.cream28, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Raw description / agent notes (optional)
              </label>
              <textarea rows={3} placeholder="Paste any raw description, agent notes, seller comments…"
                value={state.rawText}
                onChange={e => setState(s => ({ ...s, rawText: e.target.value }))}
                style={{
                  width: '100%', background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '11px 14px', color: C.cream,
                  fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box',
                  fontFamily: 'var(--font-jost, system-ui)', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(201,169,110,0.5)')}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            <button type="button" onClick={() => { void handleStart() }} disabled={!canStart}
              className={canStart ? 'ag-start' : ''}
              style={{
                width: '100%', padding: '16px', borderRadius: 12, fontSize: 14,
                fontWeight: 700, letterSpacing: '0.04em', border: 'none',
                background: canStart ? C.gold : C.border,
                color: canStart ? C.bg : C.cream28,
                cursor: canStart ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s', boxShadow: canStart ? '0 4px 20px rgba(201,169,110,0.2)' : 'none',
                fontFamily: 'var(--font-jost, system-ui)',
              }}>
              Analyse with AI
              {canStart && <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 400, fontSize: 12 }}>~60–90 seconds</span>}
            </button>

            {!canStart && (
              <p style={{ textAlign: 'center', color: C.cream28, fontSize: 11, letterSpacing: '0.04em' }}>
                Drop files or enter a URL / description to get started
              </p>
            )}
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ProcessingOverlay status={state.status} progress={state.progress} />
            {state.analysis && <AnalysisCard analysis={state.analysis} />}
          </div>
        )}

        {/* Results */}
        {isReady && state.analysis && state.readiness && state.listing && state.copilot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Success banner */}
            <div style={{
              background: C.greenDim, border: `1px solid ${C.greenBorder}`,
              borderRadius: 16, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <svg width="20" height="20" fill="none" stroke={C.green} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <p style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>
                  Listing generated{state.processing_time_ms ? ` in ${(state.processing_time_ms / 1000).toFixed(1)}s` : ''}
                </p>
                <p style={{ color: C.cream28, fontSize: 11, marginTop: 3 }}>
                  6 languages ready · 10 distribution channels available · Review and approve below
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <AnalysisCard analysis={state.analysis} />
              <ReadinessGauge readiness={state.readiness} />
            </div>

            <CopilotPanel copilot={state.copilot} />
            <ListingPreview listing={state.listing} />
            <PublishButton readiness={state.readiness} onPublish={channels => { console.log('Publishing to:', channels) }} />
          </div>
        )}

        {/* Error */}
        {state.status === 'error' && (
          <div style={{
            background: C.errDim, border: `1px solid ${C.errBorder}`,
            borderRadius: 16, padding: '28px 24px', textAlign: 'center',
          }}>
            <p style={{ color: C.err, fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Analysis failed</p>
            <p style={{ color: C.cream28, fontSize: 13, marginBottom: 20 }}>
              {state.error ?? 'An unexpected error occurred. Please try again.'}
            </p>
            <button type="button" onClick={handleReset} style={{
              padding: '9px 20px', borderRadius: 8,
              background: C.errDim, border: `1px solid ${C.errBorder}`,
              color: C.err, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-jost, system-ui)',
            }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
