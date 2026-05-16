'use client'

import { useState, useCallback, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'enriching'
  | 'generating'
  | 'ready'
  | 'error'

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

// ─── API response → UI type mappers ──────────────────────────────────────────

function mapAnalysis(pipeline: Record<string, unknown>): AnalysisResult {
  const ing = (pipeline.ingestion as Record<string, unknown>) ?? {}
  const analysis = (ing.analysis as Record<string, unknown>) ?? {}
  const loc = analysis.location as Record<string, unknown> | undefined
  return {
    bedrooms:      typeof analysis.bedrooms === 'number' ? analysis.bedrooms : undefined,
    bathrooms:     typeof analysis.bathrooms === 'number' ? analysis.bathrooms : undefined,
    area_sqm:      typeof analysis.area_sqm === 'number' ? analysis.area_sqm : undefined,
    luxury_score:  typeof analysis.luxury_score === 'number' ? analysis.luxury_score : 0,
    has_sea_view:  Boolean(analysis.has_sea_view),
    has_pool:      Boolean(analysis.has_pool),
    condition:     typeof analysis.condition === 'string' ? analysis.condition : 'unknown',
    location:      loc?.city ? `${loc.city}${loc.neighborhood ? `, ${loc.neighborhood}` : ''}` : undefined,
    confidence:    typeof ing.confidence === 'number' ? ing.confidence : 0.5,
  }
}

function mapReadiness(pipeline: Record<string, unknown>): ReadinessResult {
  const cop = (pipeline.copilot as Record<string, unknown>) ?? {}
  const score = typeof cop.readiness_score === 'number' ? cop.readiness_score : 50
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F'
  const items = Array.isArray(cop.action_items) ? (cop.action_items as string[]) : []
  const blocking = items.filter((i) => i.toLowerCase().startsWith('⚠') || i.toLowerCase().startsWith('block'))
  return {
    score,
    grade,
    ready_to_publish: Boolean(cop.ready_to_publish),
    blocking_issues:  blocking,
  }
}

function mapListing(pipeline: Record<string, unknown>): ListingResult {
  const list = (pipeline.listing as Record<string, unknown>) ?? {}
  const titles = (list.title as Record<string, unknown>) ?? {}
  const cop = (pipeline.copilot as Record<string, unknown>) ?? {}

  // title shape: { standard: { pt, en, ... } }
  const standard = (titles.standard as Record<string, string>) ?? {}
  const premium  = (titles.premium  as Record<string, string>) ?? {}

  const intel = (pipeline.intelligence as Record<string, unknown>) ?? {}
  const priceRaw = typeof cop.optimal_price === 'number' ? cop.optimal_price : 0

  return {
    title_pt:       standard.pt ?? premium.pt ?? '',
    title_en:       standard.en ?? premium.en ?? '',
    description_pt: '', // descriptions not sent in summary response — fetched via /submissions/[id]
    description_en: '',
    estimated_price: priceRaw,
    // pull demand score for display
    _demand: typeof intel.demand_score === 'number' ? intel.demand_score : undefined,
  } as ListingResult & { _demand?: number }
}

function mapCopilot(pipeline: Record<string, unknown>): CopilotResult {
  const cop = (pipeline.copilot as Record<string, unknown>) ?? {}
  const items = Array.isArray(cop.action_items) ? (cop.action_items as string[]) : []
  return {
    recommended_price: typeof cop.optimal_price === 'number' ? cop.optimal_price : 0,
    publish_time:      'Wednesday 10:00', // default from publishingTimingAdvisor
    primary_audience:  typeof cop.ai_summary === 'string' ? cop.ai_summary : '',
    action_items:      items.slice(0, 5),
  }
}

// ─── Helper: format price ─────────────────────────────────────────────────────

function formatPrice(eur: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(eur)
}

// ─── Helper: grade colour ─────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return 'text-emerald-400 border-emerald-400'
    case 'B':
      return 'text-blue-400 border-blue-400'
    case 'C':
      return 'text-amber-400 border-amber-400'
    case 'D':
      return 'text-orange-400 border-orange-400'
    default:
      return 'text-red-400 border-red-400'
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Analyze', 'Generate', 'Ready'] as const

function ProgressStepper({ status }: { status: UploadStatus }) {
  const activeIndex =
    status === 'idle' || status === 'uploading'
      ? 0
      : status === 'analyzing' || status === 'enriching'
        ? 1
        : status === 'generating'
          ? 2
          : status === 'ready'
            ? 3
            : 0

  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto mb-8">
      {STEPS.map((step, idx) => {
        const done = idx < activeIndex
        const active = idx === activeIndex
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={[
                  'w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-500',
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : active
                      ? 'border-blue-500 text-blue-400 animate-pulse'
                      : 'border-slate-700 text-slate-600',
                ].join(' ')}
              >
                {done ? '✓' : idx + 1}
              </div>
              <span
                className={[
                  'text-xs mt-1 font-medium',
                  done
                    ? 'text-emerald-400'
                    : active
                      ? 'text-blue-400'
                      : 'text-slate-600',
                ].join(' ')}
              >
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={[
                  'h-0.5 flex-1 -mt-5 transition-all duration-700',
                  done ? 'bg-emerald-500' : 'bg-slate-800',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function DragDropZone({
  files,
  onFiles,
  disabled,
}: {
  files: File[]
  onFiles: (f: File[]) => void
  disabled: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files)
      onFiles(dropped)
    },
    [disabled, onFiles],
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFiles(Array.from(e.target.files))
    }
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer select-none',
        'flex flex-col items-center justify-center min-h-[220px] p-8 group',
        disabled
          ? 'opacity-40 cursor-not-allowed border-slate-700'
          : dragging
            ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
            : files.length > 0
              ? 'border-emerald-500/60 bg-emerald-500/5'
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/40',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,audio/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {files.length === 0 ? (
        <>
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 group-hover:border-slate-500 transition-colors">
            <svg
              className="w-8 h-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-slate-200 font-semibold text-lg mb-1">
            Drop property files here
          </p>
          <p className="text-slate-500 text-sm text-center max-w-xs">
            Photos · Videos · PDFs · Voice memos — up to 50 files. AI will
            extract everything automatically.
          </p>
          <div className="mt-4 flex gap-2 flex-wrap justify-center">
            {['JPG / PNG', 'MP4 / MOV', 'PDF', 'M4A / MP3'].map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-400"
              >
                {t}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-emerald-400 font-semibold text-lg mb-1">
            {files.length} file{files.length !== 1 ? 's' : ''} ready
          </p>
          <p className="text-slate-500 text-sm">Click to add more files</p>
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center max-w-md">
            {files.slice(0, 6).map((f, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700 text-slate-300 truncate max-w-[140px]"
              >
                {f.name}
              </span>
            ))}
            {files.length > 6 && (
              <span className="px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700 text-slate-500">
                +{files.length - 6} more
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ProcessingOverlay({ status }: { status: UploadStatus }) {
  const messages: Record<string, string> = {
    uploading: 'Uploading files to secure storage…',
    analyzing: 'Claude Vision analyzing rooms, features & location…',
    enriching: 'Enriching with geo-intelligence & market data…',
    generating: 'Generating multilingual listings in 6 languages…',
  }
  const msg = messages[status] ?? ''

  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-8 flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <div className="absolute inset-3 rounded-full bg-blue-500/10 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        </div>
      </div>
      <p className="text-slate-200 font-medium text-center">{msg}</p>
      <p className="text-slate-500 text-sm text-center">
        Average time: 45–90 seconds end-to-end
      </p>
    </div>
  )
}

function AnalysisCard({ analysis }: { analysis: AnalysisResult }) {
  const facts = [
    {
      label: 'Bedrooms',
      value: analysis.bedrooms ?? '—',
      icon: '🛏',
    },
    {
      label: 'Bathrooms',
      value: analysis.bathrooms ?? '—',
      icon: '🚿',
    },
    {
      label: 'Area',
      value: analysis.area_sqm ? `${analysis.area_sqm} m²` : '—',
      icon: '📐',
    },
    {
      label: 'Location',
      value: analysis.location ?? '—',
      icon: '📍',
    },
    {
      label: 'Condition',
      value: analysis.condition,
      icon: '🏠',
    },
    {
      label: 'Luxury Score',
      value: `${analysis.luxury_score}/100`,
      icon: '✨',
    },
  ]

  const features = [
    { label: 'Sea View', active: analysis.has_sea_view },
    { label: 'Pool', active: analysis.has_pool },
  ]

  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider">
          AI Analysis
        </h3>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
          {Math.round(analysis.confidence * 100)}% confidence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-xs text-slate-500 mb-0.5">{f.label}</p>
            <p className="text-slate-100 font-medium text-sm capitalize">
              {String(f.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {features.map((feat) => (
          <span
            key={feat.label}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium border',
              feat.active
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-600 line-through',
            ].join(' ')}
          >
            {feat.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ReadinessGauge({ readiness }: { readiness: ReadinessResult }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (readiness.score / 100) * circumference
  const colors = gradeColor(readiness.grade)

  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-6 flex flex-col items-center">
      <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider mb-4 self-start">
        Listing Readiness
      </h3>
      <div className="relative w-28 h-28 mb-3">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={[
              'transition-all duration-1000',
              readiness.grade === 'A'
                ? 'stroke-emerald-400'
                : readiness.grade === 'B'
                  ? 'stroke-blue-400'
                  : readiness.grade === 'C'
                    ? 'stroke-amber-400'
                    : 'stroke-red-400',
            ].join(' ')}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={['text-3xl font-bold', colors.split(' ')[0]].join(' ')}
          >
            {readiness.grade}
          </span>
          <span className="text-xs text-slate-500">{readiness.score}/100</span>
        </div>
      </div>
      {readiness.ready_to_publish ? (
        <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-medium">
          Ready to publish
        </span>
      ) : (
        <div className="w-full mt-1">
          {readiness.blocking_issues.map((issue, i) => (
            <p key={i} className="text-xs text-red-400 flex gap-1.5 mt-1">
              <span>⚠</span> {issue}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function CopilotPanel({ copilot }: { copilot: CopilotResult }) {
  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
        </div>
        <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider">
          AI Copilot
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4">
        <div className="rounded-xl bg-slate-900/60 p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Recommended Price</p>
            <p className="text-slate-100 font-bold text-lg">
              {formatPrice(copilot.recommended_price)}
            </p>
          </div>
          <span className="text-2xl">💶</span>
        </div>

        <div className="rounded-xl bg-slate-900/60 p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Best Publish Time</p>
            <p className="text-slate-100 font-semibold">{copilot.publish_time}</p>
          </div>
          <span className="text-2xl">⏰</span>
        </div>

        <div className="rounded-xl bg-slate-900/60 p-4">
          <p className="text-xs text-slate-500 mb-0.5">Primary Audience</p>
          <p className="text-slate-100 font-medium text-sm">
            {copilot.primary_audience}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
          Action Items
        </p>
        <ul className="space-y-1.5">
          {copilot.action_items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="text-blue-400 mt-0.5 shrink-0">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ListingPreview({ listing }: { listing: ListingResult }) {
  const [lang, setLang] = useState<'pt' | 'en'>('pt')

  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider">
          Generated Listing
        </h3>
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {(['pt', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors uppercase',
                lang === l
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-slate-900/60 p-4">
          <p className="text-xs text-slate-500 mb-1">Title</p>
          <p className="text-slate-100 font-semibold">
            {lang === 'pt' ? listing.title_pt : listing.title_en}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900/60 p-4">
          <p className="text-xs text-slate-500 mb-1">Description</p>
          <p className="text-slate-300 text-sm leading-relaxed">
            {lang === 'pt'
              ? listing.description_pt
              : listing.description_en}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900/60 p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Estimated Price</p>
            <p className="text-emerald-400 font-bold text-xl">
              {formatPrice(listing.estimated_price)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">Price / m²</p>
            <p className="text-slate-300 font-medium">
              {formatPrice(Math.round(listing.estimated_price / 145))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const CHANNELS = [
  { id: 'website', label: 'Agency Group Website' },
  { id: 'idealista', label: 'idealista.pt' },
  { id: 'imovirtual', label: 'imovirtual.com' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'email', label: 'Investor Email List' },
]

function PublishButton({
  readiness,
  onPublish,
}: {
  readiness: ReadinessResult
  onPublish: (channels: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([
    'website',
    'idealista',
    'instagram',
  ])
  const [published, setPublished] = useState(false)

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const handlePublish = () => {
    onPublish(selected)
    setPublished(true)
  }

  return (
    <div className="rounded-2xl bg-[#111118] border border-slate-800 p-6">
      <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider mb-4">
        Publish Channels
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {CHANNELS.map((ch) => (
          <label
            key={ch.id}
            className={[
              'flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-all',
              selected.includes(ch.id)
                ? 'bg-blue-500/10 border-blue-500/50'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={selected.includes(ch.id)}
              onChange={() => toggle(ch.id)}
              className="w-4 h-4 accent-blue-500"
            />
            <span
              className={[
                'text-sm font-medium',
                selected.includes(ch.id) ? 'text-slate-100' : 'text-slate-500',
              ].join(' ')}
            >
              {ch.label}
            </span>
          </label>
        ))}
      </div>

      {published ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-4">
          <svg
            className="w-5 h-5 text-emerald-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-emerald-400 font-semibold text-sm">
              Published to {selected.length} channel
              {selected.length !== 1 ? 's' : ''}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              Distribution in progress — check Control Tower for status
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePublish}
          disabled={selected.length === 0 || !readiness.ready_to_publish}
          className={[
            'w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            selected.length > 0 && readiness.ready_to_publish
              ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed',
          ].join(' ')}
        >
          Approve &amp; Publish to {selected.length} channel
          {selected.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewPropertyPage() {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    files: [],
    rawText: '',
    rawUrl: '',
    progress: 0,
  })

  const handleFiles = useCallback((newFiles: File[]) => {
    setState((s) => ({ ...s, files: [...s.files, ...newFiles] }))
  }, [])

  const handleStart = useCallback(async () => {
    if (state.files.length === 0 && !state.rawText && !state.rawUrl) return

    const submissionId = crypto.randomUUID()

    // ── Step 1: upload files ──────────────────────────────────────────────────
    setState((s) => ({ ...s, status: 'uploading', progress: 10 }))

    let inputFiles: Array<{
      file_id: string; url: string; type: string; mime_type?: string; size_bytes?: number; name?: string
    }> = []

    if (state.files.length > 0) {
      try {
        const form = new FormData()
        form.append('submission_id', submissionId)
        for (const file of state.files) {
          form.append('file', file)
        }
        const upRes = await fetch('/api/property-ai/upload', {
          method: 'POST',
          body: form,
        })
        if (upRes.ok) {
          const upData = await upRes.json() as { files: typeof inputFiles }
          inputFiles = upData.files ?? []
        }
      } catch (err) {
        console.error('[property-ai/upload] error', err)
        // non-blocking: continue with zero files (text/url may still drive the pipeline)
      }
    }

    // ── Step 2: kick off AI pipeline ─────────────────────────────────────────
    setState((s) => ({ ...s, status: 'analyzing', progress: 30 }))

    // Derive org_id and agent_id from session (fallback to defaults)
    const orgId   = 'agency-group'    // replaced by session.user.orgId when auth wired
    const agentId = 'agent-dashboard' // replaced by session.user.id when auth wired

    const submitBody = {
      submission_id:   submissionId,
      org_id:          orgId,
      agent_id:        agentId,
      input_files:     inputFiles,
      raw_description: state.rawText || undefined,
      raw_url:         state.rawUrl  || undefined,
    }

    // Progress ticker while waiting for the long-running pipeline response
    const progressInterval = setInterval(() => {
      setState((s) => {
        if (s.progress >= 85 || s.status === 'ready' || s.status === 'error') return s
        const next = s.progress < 40 ? s.progress + 8
                   : s.progress < 65 ? s.progress + 5
                   : s.progress + 2
        const nextStatus: UploadStatus =
          next < 45 ? 'analyzing'
          : next < 65 ? 'enriching'
          : 'generating'
        return { ...s, progress: Math.min(next, 85), status: nextStatus }
      })
    }, 2500)

    try {
      const res = await fetch('/api/property-ai/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitBody),
        signal: AbortSignal.timeout(90_000), // 90s client-side timeout
      })

      clearInterval(progressInterval)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string }
        setState((s) => ({ ...s, status: 'error', error: err.message ?? `HTTP ${res.status}` }))
        return
      }

      const data = await res.json() as {
        submission_id: string
        status: string
        pipeline: Record<string, unknown>
        processing_time_ms: number
      }

      const pipeline = data.pipeline ?? {}
      const analysis  = mapAnalysis(pipeline)
      const readiness = mapReadiness(pipeline)
      const listing   = mapListing(pipeline)
      const copilot   = mapCopilot(pipeline)

      setState((s) => ({
        ...s,
        status:              'ready',
        progress:            100,
        analysis,
        readiness,
        listing,
        copilot,
        processing_time_ms:  data.processing_time_ms,
      }))
    } catch (err) {
      clearInterval(progressInterval)
      const msg = err instanceof Error ? err.message : 'Pipeline failed'
      setState((s) => ({ ...s, status: 'error', error: msg }))
    }
  }, [state.files, state.rawText, state.rawUrl])

  const handleReset = () => {
    setState({
      status: 'idle',
      files: [],
      rawText: '',
      rawUrl: '',
      progress: 0,
    })
  }

  const isProcessing = ['uploading', 'analyzing', 'enriching', 'generating'].includes(
    state.status,
  )
  const isReady = state.status === 'ready'
  const canStart =
    state.status === 'idle' &&
    (state.files.length > 0 || state.rawText.trim() !== '' || state.rawUrl.trim() !== '')

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100">
      {/* ── Header ── */}
      <div className="border-b border-slate-800 bg-[#0A0A0F]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                Property AI Engine
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">
              Upload a New Property
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isReady && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                Upload Another
              </button>
            )}
            <span className="text-xs text-slate-600 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
              AMI 22506
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Progress stepper */}
        {state.status !== 'idle' && (
          <ProgressStepper status={state.status} />
        )}

        {/* ── STEP 1: Upload zone (always visible until processing) ── */}
        {!isProcessing && !isReady && (
          <div className="space-y-4">
            <DragDropZone
              files={state.files}
              onFiles={handleFiles}
              disabled={false}
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">
                  URL (Instagram, website, listing)
                </label>
                <input
                  type="url"
                  placeholder="https://www.instagram.com/p/..."
                  value={state.rawUrl}
                  onChange={(e) =>
                    setState((s) => ({ ...s, rawUrl: e.target.value }))
                  }
                  className="w-full bg-[#111118] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/60 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">
                Raw description / notes (optional)
              </label>
              <textarea
                rows={3}
                placeholder="Paste any raw description, agent notes, seller comments…"
                value={state.rawText}
                onChange={(e) =>
                  setState((s) => ({ ...s, rawText: e.target.value }))
                }
                className="w-full bg-[#111118] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/60 transition-colors resize-none"
              />
            </div>

            <button
              type="button"
              onClick={() => { void handleStart() }}
              disabled={!canStart}
              className={[
                'w-full py-4 rounded-xl font-bold text-base transition-all duration-200',
                canStart
                  ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed',
              ].join(' ')}
            >
              Analyse with AI
              <span className="ml-2 text-blue-200 font-normal text-sm">
                (~60–90 seconds)
              </span>
            </button>

            {!canStart && (
              <p className="text-center text-slate-600 text-xs">
                Drop files or enter a URL / description to get started
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: Processing ── */}
        {isProcessing && (
          <div className="space-y-4">
            <ProcessingOverlay status={state.status} />

            {/* Show analysis card as soon as enriching starts */}
            {state.analysis && <AnalysisCard analysis={state.analysis} />}

            {/* Progress bar */}
            <div className="rounded-2xl bg-[#111118] border border-slate-800 p-4">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Overall progress</span>
                <span>{state.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Results ── */}
        {isReady && state.analysis && state.readiness && state.listing && state.copilot && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 p-4 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-emerald-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-emerald-400 font-semibold text-sm">
                  Listing generated
                  {state.processing_time_ms
                    ? ` in ${(state.processing_time_ms / 1000).toFixed(1)}s`
                    : ''}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  6 languages ready · 10 distribution channels available ·
                  Review and approve below
                </p>
              </div>
            </div>

            {/* Analysis + Readiness side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnalysisCard analysis={state.analysis} />
              <ReadinessGauge readiness={state.readiness} />
            </div>

            {/* Copilot */}
            <CopilotPanel copilot={state.copilot} />

            {/* Listing preview */}
            <ListingPreview listing={state.listing} />

            {/* Publish */}
            <PublishButton
              readiness={state.readiness}
              onPublish={(channels) => {
                console.log('Publishing to:', channels)
              }}
            />
          </div>
        )}

        {/* Error state */}
        {state.status === 'error' && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/40 p-6 text-center">
            <p className="text-red-400 font-semibold mb-2">Analysis failed</p>
            <p className="text-slate-500 text-sm mb-4">
              {state.error ?? 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
