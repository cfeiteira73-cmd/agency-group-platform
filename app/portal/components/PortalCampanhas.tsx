'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useCRMStore } from '../stores/crmStore'

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg:     '#f4f0e6',
  green:  '#1c4a35',
  gold:   '#c9a96e',
  text:   '#0e0e0d',
  muted:  '#7a7167',
  card:   '#ffffff',
  border: 'rgba(28,74,53,.1)',
  red:    '#e05454',
  blue:   '#3b6fd4',
  purple: '#7c5cbf',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CampaignType = 'email' | 'whatsapp' | 'linkedin' | 'sms' | 'multichannel'
type CampaignStatus = 'sending' | 'sent' | 'scheduled' | 'draft' | 'paused'
type AudienceSegment = 'premium' | 'investors' | 'cold' | 'previous' | 'nationality' | 'budget'
type TemplateCategory = 'captacao' | 'nurture' | 'investidores' | 'pos-venda' | 'mercado' | 'urgente'
type TabId = 'criar' | 'activas' | 'analytics' | 'templates'

interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  segments: AudienceSegment[]
  sent: number
  total: number
  openRate: number
  clickRate: number
  replyRate: number
  subject: string
  scheduledAt?: string
  createdAt: string
  channel: CampaignType
}

interface CampaignTemplate {
  id: string
  name: string
  category: TemplateCategory
  channel: CampaignType
  preview: string
  lastUsed: string
  useCount: number
  subject?: string
}

interface ABVariant {
  subject: string
  openRate?: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1', name: 'Compradores Premium Abril', type: 'email', status: 'sent',
    segments: ['premium'], sent: 234, total: 234, openRate: 48.7, clickRate: 12.3, replyRate: 4.1,
    subject: 'Imóveis exclusivos seleccionados para si — Abril 2026', createdAt: '2026-04-01T10:00:00Z', channel: 'email',
  },
  {
    id: 'c2', name: 'WA Broadcast Investidores', type: 'whatsapp', status: 'sending',
    segments: ['investors'], sent: 87, total: 142, openRate: 91.2, clickRate: 34.5, replyRate: 18.3,
    subject: 'Oportunidade yield 6.2% — Porto centro', createdAt: '2026-04-04T09:00:00Z', channel: 'whatsapp',
  },
  {
    id: 'c3', name: 'LinkedIn HNWI Q2', type: 'linkedin', status: 'scheduled',
    segments: ['investors', 'premium'], sent: 0, total: 67, openRate: 0, clickRate: 0, replyRate: 0,
    subject: 'Portugal Real Estate — Private Opportunities Q2 2026', scheduledAt: '2026-04-07T14:00:00Z',
    createdAt: '2026-04-03T15:30:00Z', channel: 'linkedin',
  },
  {
    id: 'c4', name: 'Reactivação Leads Frios', type: 'email', status: 'draft',
    segments: ['cold'], sent: 0, total: 312, openRate: 0, clickRate: 0, replyRate: 0,
    subject: 'Ainda está à procura do seu imóvel ideal?', createdAt: '2026-04-02T11:00:00Z', channel: 'email',
  },
  {
    id: 'c5', name: 'SMS Visita Cascais', type: 'sms', status: 'sent',
    segments: ['premium', 'previous'], sent: 45, total: 45, openRate: 98.0, clickRate: 52.1, replyRate: 23.4,
    subject: 'Visita exclusiva — Villa Cascais Mar — Sáb 10h', createdAt: '2026-03-28T08:00:00Z', channel: 'sms',
  },
  {
    id: 'c6', name: 'Multichannel Lançamento Algarve', type: 'multichannel', status: 'paused',
    segments: ['investors', 'premium', 'nationality'], sent: 156, total: 289, openRate: 41.3, clickRate: 9.8, replyRate: 3.2,
    subject: 'Lançamento Exclusivo — Quinta do Lago Estate', createdAt: '2026-03-25T12:00:00Z', channel: 'multichannel',
  },
  {
    id: 'c7', name: 'Clientes Anteriores Pós-Venda', type: 'email', status: 'sent',
    segments: ['previous'], sent: 89, total: 89, openRate: 63.4, clickRate: 21.8, replyRate: 9.7,
    subject: 'Como está no seu novo imóvel? — Agency Group', createdAt: '2026-03-20T10:00:00Z', channel: 'email',
  },
  {
    id: 'c8', name: 'LinkedIn Franceses Budget 1M+', type: 'linkedin', status: 'sent',
    segments: ['nationality', 'budget'], sent: 38, total: 38, openRate: 55.2, clickRate: 18.7, replyRate: 7.9,
    subject: 'Propriétés exclusives au Portugal — Sélection Printemps', createdAt: '2026-03-15T09:00:00Z', channel: 'linkedin',
  },
]

const MOCK_TEMPLATES: CampaignTemplate[] = [
  { id: 't1',  name: 'Apresentação Imóvel Premium',    category: 'captacao',    channel: 'email',        preview: 'Apresentamos uma oportunidade única no mercado de luxo português...', lastUsed: '2026-04-01', useCount: 23, subject: 'Imóvel exclusivo seleccionado para si' },
  { id: 't2',  name: 'Follow-Up Visita',               category: 'nurture',     channel: 'email',        preview: 'Foi um prazer mostrar-lhe este imóvel. Partilhamos os detalhes...', lastUsed: '2026-04-03', useCount: 41, subject: 'A pensar em si — Agency Group' },
  { id: 't3',  name: 'Pitch Yield Investidor',         category: 'investidores', channel: 'email',       preview: 'Oportunidade de investimento com yield bruto de 6.2% em Porto...', lastUsed: '2026-03-28', useCount: 17, subject: 'Investimento imobiliário — Yield 6.2%' },
  { id: 't4',  name: 'Boas-Vindas Pós-Escritura',     category: 'pos-venda',   channel: 'email',        preview: 'Bem-vindo ao seu novo imóvel! Estamos disponíveis para...', lastUsed: '2026-03-15', useCount: 12, subject: 'Bem-vindo ao seu novo lar' },
  { id: 't5',  name: 'Market Update Mensal',           category: 'mercado',     channel: 'email',        preview: 'O mercado imobiliário português continua a valorizar. Em Abril...', lastUsed: '2026-04-01', useCount: 8,  subject: 'Mercado imobiliário — Abril 2026' },
  { id: 't6',  name: 'Urgente — Última Unidade',       category: 'urgente',     channel: 'whatsapp',     preview: 'URGENTE: Última unidade disponível em Lisboa Oriente. Preço...', lastUsed: '2026-04-04', useCount: 6,  },
  { id: 't7',  name: 'WA Contacto Inicial',            category: 'captacao',    channel: 'whatsapp',     preview: 'Olá! Sou Carlos da Agency Group. Vi o seu interesse em...', lastUsed: '2026-04-02', useCount: 56, },
  { id: 't8',  name: 'LinkedIn HNWI Intro',            category: 'investidores', channel: 'linkedin',    preview: 'Portugal ranks top 5 globally for luxury real estate returns...', lastUsed: '2026-03-20', useCount: 9,  },
  { id: 't9',  name: 'SMS Confirmação Visita',         category: 'nurture',     channel: 'sms',          preview: 'AG: Confirmamos visita amanhã às 10h — Quinta das Pedras, Cascais.', lastUsed: '2026-04-03', useCount: 34, },
  { id: 't10', name: 'Email Proposta Formal',          category: 'captacao',    channel: 'email',        preview: 'Conforme acordado, enviamos a proposta formal para análise...', lastUsed: '2026-03-30', useCount: 19, subject: 'Proposta formal — Agency Group AMI 22506' },
  { id: 't11', name: 'Reactivação 90 Dias',            category: 'nurture',     channel: 'email',        preview: 'Passaram alguns meses desde o nosso último contacto. O mercado...', lastUsed: '2026-03-10', useCount: 7,  subject: 'Ainda está à procura?' },
  { id: 't12', name: 'Multichannel Lançamento',        category: 'urgente',     channel: 'multichannel', preview: 'Lançamento exclusivo: apenas 8 unidades disponíveis. Acesso...', lastUsed: '2026-03-25', useCount: 4,  },
]

const AI_SUBJECT_SUGGESTIONS = [
  'Imóvel exclusivo seleccionado especialmente para si — Agency Group',
  'Uma oportunidade que não pode perder em Portugal',
  'O imóvel dos seus sonhos está disponível agora',
]

const SEGMENT_COUNTS: Record<AudienceSegment, number> = {
  premium: 47,
  investors: 83,
  cold: 312,
  previous: 89,
  nationality: 156,
  budget: 201,
}

const SEGMENT_LABELS: Record<AudienceSegment, string> = {
  premium:     'Compradores Premium',
  investors:   'Investidores',
  cold:        'Leads Frios',
  previous:    'Clientes Anteriores',
  nationality: 'Por Nacionalidade',
  budget:      'Por Budget',
}

const CHANNEL_LABELS: Record<CampaignType, string> = {
  email:        'Email',
  whatsapp:     'WhatsApp',
  linkedin:     'LinkedIn',
  sms:          'SMS',
  multichannel: 'Multi-Channel',
}

const CHANNEL_COLORS: Record<CampaignType, string> = {
  email:        C.green,
  whatsapp:     '#25D366',
  linkedin:     '#0077B5',
  sms:          C.gold,
  multichannel: C.purple,
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  sending:   'A Enviar',
  sent:      'Enviada',
  scheduled: 'Agendada',
  draft:     'Rascunho',
  paused:    'Pausada',
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  sending:   '#3b6fd4',
  sent:      C.green,
  scheduled: C.gold,
  draft:     C.muted,
  paused:    C.red,
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  captacao:    'Captação',
  nurture:     'Nurture',
  investidores:'Investidores',
  'pos-venda': 'Pós-Venda',
  mercado:     'Mercado',
  urgente:     'Urgente',
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  captacao:    C.green,
  nurture:     C.blue,
  investidores:'#7c5cbf',
  'pos-venda': C.gold,
  mercado:     '#3b8a7a',
  urgente:     C.red,
}

// ─── Analytics mock data ──────────────────────────────────────────────────────
const OPENS_7D = [22, 34, 41, 28, 53, 61, 48]
const CLICKS_7D = [8, 13, 17, 11, 24, 29, 19]
const DAYS_7D = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const CHANNEL_PERF = [
  { channel: 'Email',    openRate: 42, clickRate: 12 },
  { channel: 'WhatsApp', openRate: 91, clickRate: 38 },
  { channel: 'LinkedIn', openRate: 55, clickRate: 19 },
  { channel: 'SMS',      openRate: 97, clickRate: 51 },
]

const SEGMENT_DONUT = [
  { label: 'Premium',   value: 47,  color: C.green },
  { label: 'Investors', value: 83,  color: '#7c5cbf' },
  { label: 'Cold',      value: 312, color: C.muted },
  { label: 'Previous',  value: 89,  color: C.gold },
]

const TOP_SUBJECTS = [
  { subject: 'Imóvel exclusivo seleccionado para si',    openRate: 63.4, clicks: 21, sent: 89  },
  { subject: 'Urgente — Última unidade disponível',      openRate: 58.1, clicks: 34, sent: 45  },
  { subject: 'O mercado valorizou 17.6% — veja porquê', openRate: 51.7, clicks: 18, sent: 234 },
  { subject: 'Análise personalizada do seu perfil',      openRate: 48.9, clicks: 15, sent: 142 },
  { subject: 'Novo imóvel em Cascais disponível agora',  openRate: 44.2, clicks: 11, sent: 67  },
]

// Heatmap: 7 days × 12 time slots (8h–20h, every hour)
const HEATMAP_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HEATMAP_HOURS = ['8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h']
const HEATMAP_DATA: number[][] = [
  [12,28,45,52,38,21,15,22,31,19,14,8,5],
  [10,32,51,61,42,19,13,25,38,22,11,7,4],
  [8, 24,43,58,39,18,12,28,44,26,13,6,3],
  [11,29,47,55,41,20,14,21,33,20,12,8,4],
  [14,35,53,62,45,23,16,19,27,17,10,6,3],
  [5, 12,22,31,28,24,21,32,41,38,29,18,9],
  [3, 8, 14,19,22,20,18,28,37,34,26,15,7],
]

// ─── SVG Charts ───────────────────────────────────────────────────────────────

function LineChart({ opens, clicks, days }: { opens: number[]; clicks: number[]; days: string[] }) {
  const w = 520; const h = 160; const pad = 32
  const maxVal = Math.max(...opens, ...clicks, 1)
  const xStep = (w - pad * 2) / (opens.length - 1)
  const yScale = (v: number) => h - pad - ((v / maxVal) * (h - pad * 1.5))
  const pts = (arr: number[]) =>
    arr.map((v, i) => `${pad + i * xStep},${yScale(v)}`).join(' ')
  const poly = (arr: number[], col: string) => {
    const bottom = h - pad
    const first = `${pad},${bottom}`
    const last = `${pad + (arr.length - 1) * xStep},${bottom}`
    return (
      <polygon
        points={`${first} ${pts(arr)} ${last}`}
        fill={col} fillOpacity={0.12} stroke="none"
      />
    )
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 160 }}>
      {/* Grid lines */}
      {[0,25,50,75,100].map(pct => {
        const y = h - pad - (pct / 100) * (h - pad * 1.5)
        return <line key={pct} x1={pad} x2={w - pad} y1={y} y2={y} stroke={C.border} strokeWidth={1} />
      })}
      {/* Area fills */}
      {poly(opens, C.green)}
      {poly(clicks, C.gold)}
      {/* Lines */}
      <polyline points={pts(opens)} fill="none" stroke={C.green} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts(clicks)} fill="none" stroke={C.gold} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {opens.map((v, i) => (
        <circle key={i} cx={pad + i * xStep} cy={yScale(v)} r={3.5} fill={C.green} />
      ))}
      {clicks.map((v, i) => (
        <circle key={i} cx={pad + i * xStep} cy={yScale(v)} r={3} fill={C.gold} />
      ))}
      {/* X labels */}
      {days.map((d, i) => (
        <text key={i} x={pad + i * xStep} y={h - 6} textAnchor="middle" fontSize={10} fill={C.muted} fontFamily="DM Mono">{d}</text>
      ))}
    </svg>
  )
}

function BarChart({ data }: { data: typeof CHANNEL_PERF }) {
  const w = 420; const h = 160; const pad = 32
  const barW = 28; const gap = (w - pad * 2) / data.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 160 }}>
      {[0, 25, 50, 75, 100].map(v => {
        const y = pad + (1 - v / 100) * (h - pad * 2)
        return <line key={v} x1={pad} x2={w - pad} y1={y} y2={y} stroke={C.border} strokeWidth={1} />
      })}
      {data.map((d, i) => {
        const cx = pad + i * gap + gap / 2
        const openH = (d.openRate / 100) * (h - pad * 2)
        const clickH = (d.clickRate / 100) * (h - pad * 2)
        const openY = h - pad - openH
        const clickY = h - pad - clickH
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={openY} width={barW} height={openH} fill={C.green} rx={3} fillOpacity={0.85} />
            <rect x={cx + 2} y={clickY} width={barW} height={clickH} fill={C.gold} rx={3} fillOpacity={0.85} />
            <text x={cx} y={h - 4} textAnchor="middle" fontSize={11} fill={C.muted} fontFamily="DM Mono">{d.channel}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ data }: { data: typeof SEGMENT_DONUT }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  const r = 60; const cx = 90; const cy = 80
  let cumAngle = -Math.PI / 2
  const arcs = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumAngle)
    const y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle)
    const y2 = cy + r * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    return { ...d, x1, y1, x2, y2, large, pct: Math.round((d.value / total) * 100) }
  })
  return (
    <svg viewBox="0 0 260 160" className="w-full" style={{ height: 160 }}>
      {arcs.map((a, i) => (
        <path
          key={i}
          d={`M ${cx} ${cy} L ${a.x1} ${a.y1} A ${r} ${r} 0 ${a.large} 1 ${a.x2} ${a.y2} Z`}
          fill={a.color} stroke="#fff" strokeWidth={2}
        />
      ))}
      <circle cx={cx} cy={cy} r={38} fill="#fff" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fill={C.muted} fontFamily="DM Mono">Total</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={16} fontWeight="bold" fill={C.text} fontFamily="Cormorant">{total}</text>
      {arcs.map((a, i) => (
        <g key={i}>
          <rect x={185} y={18 + i * 34} width={10} height={10} rx={2} fill={a.color} />
          <text x={200} y={28 + i * 34} fontSize={10} fill={C.text} fontFamily="DM Mono">{a.label}</text>
          <text x={200} y={40 + i * 34} fontSize={11} fill={C.muted} fontFamily="DM Mono">{a.pct}%</text>
        </g>
      ))}
    </svg>
  )
}

function HeatmapGrid() {
  const maxVal = Math.max(...HEATMAP_DATA.flat())
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${HEATMAP_HOURS.length}, 1fr)`, gap: 3, minWidth: 600 }}>
        {/* Header */}
        <div />
        {HEATMAP_HOURS.map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: 11, color: C.muted, fontFamily: 'var(--font-dm-mono),monospace', paddingBottom: 4 }}>{h}</div>
        ))}
        {/* Rows */}
        {HEATMAP_DAYS.map((day, di) => (
          <>
            <div key={`d${di}`} style={{ fontSize: 10, color: C.muted, fontFamily: 'var(--font-dm-mono),monospace', display: 'flex', alignItems: 'center' }}>{day}</div>
            {HEATMAP_DATA[di].map((val, hi) => {
              const intensity = val / maxVal
              const bg = intensity > 0.75 ? C.green : intensity > 0.5 ? '#2d7a57' : intensity > 0.25 ? '#5a9e7e' : intensity > 0.1 ? '#a8d4bc' : '#e8f4ee'
              return (
                <div
                  key={`${di}-${hi}`}
                  title={`${day} ${HEATMAP_HOURS[hi]}: ${val}% engagement`}
                  style={{
                    backgroundColor: bg, borderRadius: 3, height: 22,
                    opacity: 0.85, cursor: 'default', transition: 'opacity .15s',
                  }}
                />
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span style={{
      background: STATUS_COLORS[status] + '18',
      color: STATUS_COLORS[status],
      border: `1px solid ${STATUS_COLORS[status]}40`,
      fontSize: 10, fontFamily: 'var(--font-dm-mono),monospace', fontWeight: 600,
      padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
    }}>
      {status === 'sending' && <span style={{ display: 'inline-block', width: 6, height: 6, background: STATUS_COLORS[status], borderRadius: '50%', marginRight: 5, animation: 'pulse 1.2s infinite' }} />}
      {STATUS_LABELS[status]}
    </span>
  )
}

function ChannelPill({ type }: { type: CampaignType }) {
  const icons: Record<CampaignType, string> = {
    email: '✉', whatsapp: '💬', linkedin: '💼', sms: '📱', multichannel: '🔀',
  }
  return (
    <span style={{
      background: CHANNEL_COLORS[type] + '18',
      color: CHANNEL_COLORS[type],
      fontSize: 10, fontFamily: 'var(--font-dm-mono),monospace',
      padding: '2px 8px', borderRadius: 99,
    }}>
      {icons[type]} {CHANNEL_LABELS[type]}
    </span>
  )
}

function ProgressBar({ sent, total, color = C.green }: { sent: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono),monospace', color: C.muted }}>{sent}/{total} envios</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono),monospace', color }}>{pct}%</span>
      </div>
      <div style={{ background: C.border, borderRadius: 99, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function MetricChip({ label, value, color = C.green }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'var(--font-cormorant),serif' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: 'var(--font-dm-mono),monospace', marginTop: 1 }}>{label}</div>
    </div>
  )
}

// ─── Tab: Criar Campanha ──────────────────────────────────────────────────────
function TabCriar({ campaigns, setCampaigns }: { campaigns: Campaign[]; setCampaigns: (c: Campaign[]) => void }) {
  const [type, setType] = useState<CampaignType>('email')
  const [segments, setSegments] = useState<Set<AudienceSegment>>(new Set())
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'imediato' | 'agendar'>('imediato')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('10:00')
  const [abEnabled, setAbEnabled] = useState(false)
  const [subjectA, setSubjectA] = useState('')
  const [subjectB, setSubjectB] = useState('')
  const [showAISuggestions, setShowAISuggestions] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)

  const totalContacts = Array.from(segments).reduce((sum, seg) => sum + SEGMENT_COUNTS[seg], 0)

  const selectedTemplate = MOCK_TEMPLATES.find(t => t.id === templateId) ?? null

  // Auto-generate campaign name
  useEffect(() => {
    if (segments.size > 0) {
      const seg = Array.from(segments)[0]
      const date = new Date().toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })
      setCampaignName(`${CHANNEL_LABELS[type]} — ${SEGMENT_LABELS[seg]} — ${date}`)
    }
  }, [type, segments])

  const toggleSegment = (s: AudienceSegment) => {
    const n = new Set(segments)
    if (n.has(s)) n.delete(s); else n.add(s)
    setSegments(n)
  }

  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)

  const handleLaunch = async () => {
    if (segments.size === 0) return
    setLaunching(true)
    setSendError(null)
    setSendResult(null)

    const subject = subjectA || (selectedTemplate?.subject ?? 'Agency Group — Nova Campanha')
    const html = selectedTemplate?.preview
      ? `<p>${selectedTemplate.preview}</p><p style="margin-top:24px;font-size:12px;color:#888">Agency Group AMI 22506 · Portugal</p>`
      : `<p>Campanha: ${campaignName || 'Nova Campanha'}</p><p style="margin-top:24px;font-size:12px;color:#888">Agency Group AMI 22506 · Portugal</p>`

    let realSent = 0
    let realFailed = 0

    // Only send via Resend for email campaigns — other channels simulated
    if (type === 'email') {
      try {
        // Build recipient list from segment counts (real CRM would provide emails)
        // For now, send a test email to verify Resend is wired up
        const payload = {
          to: ['noreply@agencygroup.pt'], // placeholder — real impl would pull emails from CRM
          subject,
          html,
          campaignId: `c${Date.now()}`,
        }
        const res = await fetch('/api/campanhas/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        realSent = result.sent ?? 0
        realFailed = result.failed ?? 0
        if (!result.success && result.error) {
          setSendError(result.error as string)
        } else {
          setSendResult({ sent: realSent, failed: realFailed })
        }
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Erro ao enviar campanha')
      }
    }

    const newCamp: Campaign = {
      id: `c${Date.now()}`,
      name: campaignName || 'Nova Campanha',
      type, channel: type,
      status: scheduleMode === 'agendar' ? 'scheduled' : (type === 'email' && realFailed === 0 ? 'sent' : 'sending'),
      segments: Array.from(segments),
      sent: type === 'email' ? realSent : 0, total: totalContacts,
      openRate: 0, clickRate: 0, replyRate: 0,
      subject,
      scheduledAt: scheduleMode === 'agendar' ? `${scheduleDate}T${scheduleTime}:00Z` : undefined,
      createdAt: new Date().toISOString(),
    }
    setCampaigns([newCamp, ...campaigns])
    setLaunching(false)
    setLaunched(true)
    setTimeout(() => setLaunched(false), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Campaign name */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Nome da Campanha</label>
        <input
          className="p-inp"
          value={campaignName}
          onChange={e => setCampaignName(e.target.value)}
          placeholder="Gerado automaticamente..."
          style={{ width: '100%' }}
        />
      </div>

      {/* Type selector */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: 10 }}>Tipo de Campanha</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['email','whatsapp','linkedin','sms','multichannel'] as CampaignType[]).map(t => {
            const icons: Record<CampaignType, string> = { email: '✉', whatsapp: '💬', linkedin: '💼', sms: '📱', multichannel: '🔀' }
            const active = type === t
            return (
              <button type="button"
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 13, cursor: 'pointer',
                  border: `2px solid ${active ? CHANNEL_COLORS[t] : C.border}`,
                  background: active ? CHANNEL_COLORS[t] + '15' : 'transparent',
                  color: active ? CHANNEL_COLORS[t] : C.muted,
                  fontWeight: active ? 700 : 400,
                  transition: 'all .15s',
                }}
              >
                {icons[t]} {CHANNEL_LABELS[t]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Audience builder */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: 10 }}>Audiência Alvo</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {(Object.keys(SEGMENT_LABELS) as AudienceSegment[]).map(seg => {
            const active = segments.has(seg)
            return (
              <button type="button"
                key={seg}
                onClick={() => toggleSegment(seg)}
                style={{
                  padding: '6px 14px', borderRadius: 99, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, cursor: 'pointer',
                  border: `1.5px solid ${active ? C.green : C.border}`,
                  background: active ? C.green : 'transparent',
                  color: active ? '#fff' : C.muted,
                  transition: 'all .15s',
                }}
              >
                {SEGMENT_LABELS[seg]}
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 10 }}>({SEGMENT_COUNTS[seg]})</span>
              </button>
            )
          })}
        </div>
        {totalContacts > 0 && (
          <div style={{
            background: C.green + '0f', border: `1px solid ${C.green}30`,
            borderRadius: 8, padding: '10px 16px',
            fontFamily: 'var(--font-dm-mono),monospace', fontSize: 13, color: C.green,
          }}>
            Esta campanha chegará a <strong>~{totalContacts} contactos</strong>
          </div>
        )}
      </div>

      {/* Template selector */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: 10 }}>Template</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {MOCK_TEMPLATES.filter(t => type === 'multichannel' || t.channel === type).map(tpl => {
            const active = templateId === tpl.id
            return (
              <button type="button"
                key={tpl.id}
                onClick={() => setTemplateId(active ? null : tpl.id)}
                style={{
                  textAlign: 'left', padding: 12, borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${active ? C.green : C.border}`,
                  background: active ? C.green + '08' : '#fff',
                  transition: 'all .15s',
                }}
              >
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, fontWeight: 600, color: active ? C.green : C.text, marginBottom: 4 }}>{tpl.name}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{tpl.preview.slice(0, 60)}...</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    background: CATEGORY_COLORS[tpl.category] + '18', color: CATEGORY_COLORS[tpl.category],
                    fontSize: 11, fontFamily: 'var(--font-dm-mono),monospace', padding: '2px 6px', borderRadius: 99,
                  }}>
                    {CATEGORY_LABELS[tpl.category]}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        {/* Template preview */}
        {selectedTemplate && (
          <div style={{
            marginTop: 12, padding: 16, borderRadius: 10,
            border: `1.5px solid ${C.green}30`, background: '#fff',
          }}>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted, marginBottom: 4 }}>PREVIEW — {selectedTemplate.name}</div>
            {selectedTemplate.subject && (
              <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 8 }}>
                Assunto: {selectedTemplate.subject}
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
              {selectedTemplate.preview}
              <br /><br />
              [Conteúdo personalizado do template será inserido aqui com os dados do contacto, incluindo nome, imóvel de interesse, budget e histórico de interacções.]
              <br /><br />
              Com os melhores cumprimentos,<br />
              <strong>Carlos Rodrigues</strong><br />
              Agency Group · AMI 22506<br />
              +351 900 000 000
            </div>
          </div>
        )}
      </div>

      {/* Subject line */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label className="p-label">Assunto / Mensagem Principal</label>
          <button type="button"
            onClick={() => setShowAISuggestions(!showAISuggestions)}
            style={{
              fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.gold,
              background: C.gold + '15', border: `1px solid ${C.gold}40`,
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ✦ Sugestões IA
          </button>
        </div>
        <input
          className="p-inp"
          value={subjectA}
          onChange={e => setSubjectA(e.target.value)}
          placeholder={selectedTemplate?.subject ?? 'Escreva o assunto da campanha...'}
          style={{ width: '100%', marginBottom: showAISuggestions ? 8 : 0 }}
        />
        {showAISuggestions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {AI_SUBJECT_SUGGESTIONS.map((s, i) => (
              <button type="button"
                key={i}
                onClick={() => { setSubjectA(s); setShowAISuggestions(false) }}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${C.gold}40`, background: C.gold + '08',
                  fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: C.text, cursor: 'pointer',
                }}
              >
                <span style={{ color: C.gold, marginRight: 8, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10 }}>#{i + 1}</span>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* A/B test toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button"
          onClick={() => setAbEnabled(!abEnabled)}
          style={{
            width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
            background: abEnabled ? C.green : C.border,
            position: 'relative', transition: 'background .2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: abEnabled ? 22 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left .2s',
          }} />
        </button>
        <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, color: C.text }}>Teste A/B</span>
      </div>
      {abEnabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Variante A (assunto acima)</label>
            <input className="p-inp" value={subjectA} onChange={e => setSubjectA(e.target.value)} placeholder="Variante A..." style={{ width: '100%' }} />
          </div>
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Variante B</label>
            <input className="p-inp" value={subjectB} onChange={e => setSubjectB(e.target.value)} placeholder="Variante B..." style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: 10 }}>Envio</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['imediato', 'agendar'] as const).map(m => (
            <button type="button"
              key={m}
              onClick={() => setScheduleMode(m)}
              style={{
                padding: '8px 20px', borderRadius: 8, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, cursor: 'pointer',
                border: `2px solid ${scheduleMode === m ? C.green : C.border}`,
                background: scheduleMode === m ? C.green + '12' : 'transparent',
                color: scheduleMode === m ? C.green : C.muted,
                fontWeight: scheduleMode === m ? 700 : 400,
                transition: 'all .2s',
              }}
            >
              {m === 'imediato' ? '⚡ Imediato' : '🗓 Agendar'}
            </button>
          ))}
        </div>
        {scheduleMode === 'agendar' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <input type="date" className="p-inp" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ flex: 1 }} />
            <input type="time" className="p-inp" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ width: 120 }} />
          </div>
        )}
      </div>

      {/* Send feedback */}
      {sendError && (
        <div style={{ background: '#fff0f0', border: '1px solid #f8b4b4', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.red }}>
          Erro ao enviar: {sendError}
        </div>
      )}
      {sendResult && !sendError && (
        <div style={{ background: '#f0faf4', border: '1px solid #a3d9b1', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.green }}>
          Enviado via Resend: {sendResult.sent} mensagens {sendResult.failed > 0 ? `· ${sendResult.failed} falhas` : ''}
        </div>
      )}

      {/* Launch button */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button"
          className="p-btn-gold"
          onClick={handleLaunch}
          disabled={segments.size === 0 || launching}
          style={{ flex: 1, padding: '14px 24px', fontSize: 15, fontWeight: 700, opacity: segments.size === 0 ? 0.5 : 1 }}
        >
          {launching ? 'A enviar...' : launched ? '✓ Campanha lançada!' : scheduleMode === 'agendar' ? '🗓 Agendar Campanha' : '🚀 Lançar Campanha'}
        </button>
        <button type="button" className="p-btn" style={{ padding: '14px 20px', fontSize: 14 }}>
          Guardar Rascunho
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Campanhas Activas ───────────────────────────────────────────────────
function TabActivas({ campaigns, setCampaigns }: { campaigns: Campaign[]; setCampaigns: (c: Campaign[]) => void }) {
  const [viewingId, setViewingId] = useState<string | null>(null)

  const thisMonth = campaigns.filter(c => c.status === 'sent' || c.status === 'sending')
  const totalSentMonth = thisMonth.reduce((s, c) => s + c.sent, 0)
  const avgOpenRate = thisMonth.length > 0
    ? (thisMonth.reduce((s, c) => s + c.openRate, 0) / thisMonth.length).toFixed(1)
    : '0'
  const best = [...campaigns].sort((a, b) => b.openRate - a.openRate)[0]

  const pauseToggle = (id: string) => {
    setCampaigns(campaigns.map(c =>
      c.id === id ? { ...c, status: c.status === 'paused' ? 'sending' : 'paused' } : c
    ))
  }

  const duplicate = (camp: Campaign) => {
    const dup: Campaign = { ...camp, id: `c${Date.now()}`, name: camp.name + ' (Cópia)', status: 'draft', sent: 0, createdAt: new Date().toISOString() }
    setCampaigns([dup, ...campaigns])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="p-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 28, fontWeight: 700, color: C.green }}>{totalSentMonth.toLocaleString('pt-PT')}</div>
          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>ENVIOS ESTE MÊS</div>
        </div>
        <div className="p-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 28, fontWeight: 700, color: C.gold }}>{avgOpenRate}%</div>
          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>TAXA ABERTURA MÉDIA</div>
        </div>
        <div className="p-card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{best?.name ?? '—'}</div>
          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.muted, marginTop: 4 }}>MELHOR CAMPANHA ({best?.openRate ?? 0}% open)</div>
        </div>
      </div>

      {/* Campaign list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {campaigns.map(camp => (
          <div
            key={camp.id}
            className="p-card"
            style={{ padding: '20px', border: viewingId === camp.id ? `1.5px solid ${C.green}50` : undefined }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-jost),sans-serif', fontWeight: 600, fontSize: 15, color: C.text }}>{camp.name}</span>
                  <StatusBadge status={camp.status} />
                  <ChannelPill type={camp.type} />
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted }}>{camp.subject}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button"
                  onClick={() => pauseToggle(camp.id)}
                  style={{
                    fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, transition: 'all .2s',
                  }}
                >
                  {camp.status === 'paused' ? '▶ Retomar' : '⏸ Pausar'}
                </button>
                <button type="button"
                  onClick={() => setViewingId(viewingId === camp.id ? null : camp.id)}
                  style={{
                    fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${C.green}40`, background: C.green + '0a', color: C.green, transition: 'all .2s',
                  }}
                >
                  Ver Resultados
                </button>
                <button type="button"
                  onClick={() => duplicate(camp)}
                  style={{
                    fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${C.gold}40`, background: C.gold + '0a', color: C.gold, transition: 'all .2s',
                  }}
                >
                  Duplicar
                </button>
              </div>
            </div>

            <ProgressBar sent={camp.sent} total={camp.total} />

            {camp.status !== 'draft' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
                <MetricChip label="ABERTURA" value={`${camp.openRate}%`} color={C.green} />
                <MetricChip label="CLIQUES" value={`${camp.clickRate}%`} color={C.gold} />
                <MetricChip label="RESPOSTAS" value={`${camp.replyRate}%`} color={C.blue} />
              </div>
            )}

            {camp.scheduledAt && (
              <div style={{ marginTop: 10, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted }}>
                📅 Agendada: {new Date(camp.scheduledAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {/* Expanded results */}
            {viewingId === camp.id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { l: 'Enviados', v: camp.sent },
                    { l: 'Abertos', v: Math.round(camp.sent * camp.openRate / 100) },
                    { l: 'Clicados', v: Math.round(camp.sent * camp.clickRate / 100) },
                    { l: 'Respondidos', v: Math.round(camp.sent * camp.replyRate / 100) },
                  ].map(m => (
                    <div key={m.l} style={{ textAlign: 'center', padding: 12, background: C.bg, borderRadius: 8 }}>
                      <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 700, color: C.text }}>{m.v}</div>
                      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted }}>{m.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: C.muted }}>
                  Campanha criada em {new Date(camp.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────
function TabAnalytics({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id ?? '')
  const sentCampaigns = campaigns.filter(c => c.sent > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Campaign selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label className="p-label">Campanha:</label>
        <select
          className="p-sel"
          value={selectedCampaignId}
          onChange={e => setSelectedCampaignId(e.target.value)}
          style={{ minWidth: 240 }}
        >
          {sentCampaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Line chart */}
      <div className="p-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: C.text, margin: 0 }}>Aberturas & Cliques — 7 dias</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.green }}>
              <div style={{ width: 12, height: 3, background: C.green, borderRadius: 99 }} /> Aberturas
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.gold }}>
              <div style={{ width: 12, height: 3, background: C.gold, borderRadius: 99 }} /> Cliques
            </div>
          </div>
        </div>
        <LineChart opens={OPENS_7D} clicks={CLICKS_7D} days={DAYS_7D} />
      </div>

      {/* Bar chart + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="p-card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: C.text, margin: '0 0 16px' }}>Performance por Canal</h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.green }}>
              <div style={{ width: 10, height: 10, background: C.green, borderRadius: 2 }} /> Abertura
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.gold }}>
              <div style={{ width: 10, height: 10, background: C.gold, borderRadius: 2 }} /> Cliques
            </div>
          </div>
          <BarChart data={CHANNEL_PERF} />
        </div>
        <div className="p-card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: C.text, margin: '0 0 16px' }}>Segmentos de Audiência</h3>
          <DonutChart data={SEGMENT_DONUT} />
        </div>
      </div>

      {/* Top subjects */}
      <div className="p-card" style={{ padding: '20px' }}>
        <h3 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: C.text, margin: '0 0 16px' }}>Melhores Assuntos por Taxa de Abertura</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {TOP_SUBJECTS.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: i < TOP_SUBJECTS.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted, width: 20, textAlign: 'right' }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: C.text }}>{s.subject}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
                  {s.sent} enviados · {s.clicks} cliques
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 14, fontWeight: 700, color: C.green }}>{s.openRate}%</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted }}>abertura</div>
              </div>
              <div style={{ width: 80 }}>
                <div style={{ background: C.border, borderRadius: 99, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${s.openRate}%`, height: '100%', background: C.green, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="p-card" style={{ padding: '20px' }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: C.text, margin: '0 0 4px' }}>Melhor Hora para Enviar</h3>
          <p style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: C.muted, margin: 0 }}>Engagement por dia da semana e hora — mais escuro = mais interacções</p>
        </div>
        <HeatmapGrid />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Baixo', color: '#e8f4ee' },
            { label: '', color: '#a8d4bc' },
            { label: '', color: '#5a9e7e' },
            { label: '', color: '#2d7a57' },
            { label: 'Alto', color: C.green },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 14, height: 14, background: item.color, borderRadius: 3 }} />
              {item.label && <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.muted }}>{item.label}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Templates ───────────────────────────────────────────────────────────
function TabTemplates() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>(MOCK_TEMPLATES)
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'all'>('all')
  const [filterChannel, setFilterChannel] = useState<CampaignType | 'all'>('all')
  const [generating, setGenerating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTplName, setNewTplName] = useState('')
  const [newTplCategory, setNewTplCategory] = useState<TemplateCategory>('captacao')
  const [newTplChannel, setNewTplChannel] = useState<CampaignType>('email')
  const [newTplPrompt, setNewTplPrompt] = useState('')
  const [generatedPreview, setGeneratedPreview] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const filtered = templates.filter(t =>
    (filterCategory === 'all' || t.category === filterCategory) &&
    (filterChannel === 'all' || t.channel === filterChannel)
  )

  const handleGenerate = async () => {
    if (!newTplPrompt) return
    setGenerating(true)

    // Map TemplateCategory → SignalType (closest semantic equivalent)
    const categoryToSignalType: Record<TemplateCategory, string> = {
      captacao:     'manual',
      nurture:      'tempo_mercado',
      investidores: 'multiplos_imoveis',
      'pos-venda':  'manual',
      mercado:      'preco_reduzido',
      urgente:      'preco_reduzido',
    }

    // Map CampaignType → MessageType (API only accepts carta | email | whatsapp)
    const channelToMessageType: Record<CampaignType, string> = {
      email:        'email',
      whatsapp:     'whatsapp',
      linkedin:     'email',
      sms:          'whatsapp',
      multichannel: 'email',
    }

    try {
      const res = await fetch('/api/outbound/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address:     newTplPrompt,           // use the AI instruction as context address
          signalType:  categoryToSignalType[newTplCategory],
          messageType: channelToMessageType[newTplChannel],
          tone:        'profissional',
          language:    'PT',
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json() as { message?: string; subject?: string; messageType?: string }
      const preview = data.subject
        ? `ASSUNTO: ${data.subject}\n\n${data.message ?? ''}`
        : (data.message ?? '')
      setGeneratedPreview(preview)
    } catch {
      // Mock response
      setGeneratedPreview(
        `[TEMPLATE GERADO POR IA]\n\nAssunto: ${newTplName || 'Nova Campanha Agency Group'}\n\n` +
        `Olá {nome},\n\nBase: ${newTplPrompt}\n\n` +
        `Portugal continua a ser o destino preferido para investimento imobiliário em 2026. ` +
        `Com valorizações de 17,6% e o mercado de luxo em Lisboa no top 5 mundial, ` +
        `esta é uma oportunidade que não pode ignorar.\n\n` +
        `[Conteúdo personalizado gerado com base no seu perfil e histórico]\n\n` +
        `Com os melhores cumprimentos,\nCarlos Rodrigues · Agency Group · AMI 22506`
      )
    }
    setGenerating(false)
  }

  const handleSaveTemplate = () => {
    if (!newTplName || !generatedPreview) return
    const tpl: CampaignTemplate = {
      id: `t${Date.now()}`,
      name: newTplName,
      category: newTplCategory,
      channel: newTplChannel,
      preview: generatedPreview.slice(0, 120),
      lastUsed: '—',
      useCount: 0,
    }
    setTemplates([tpl, ...templates])
    setShowCreateModal(false)
    setNewTplName(''); setNewTplPrompt(''); setGeneratedPreview('')
  }

  const deleteTemplate = (id: string) => setTemplates(templates.filter(t => t.id !== id))

  const duplicateTemplate = (tpl: CampaignTemplate) => {
    setTemplates([{ ...tpl, id: `t${Date.now()}`, name: tpl.name + ' (Cópia)', useCount: 0 }, ...templates])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="p-sel" value={filterCategory} onChange={e => setFilterCategory(e.target.value as TemplateCategory | 'all')}>
            <option value="all">Todas as categorias</option>
            {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select className="p-sel" value={filterChannel} onChange={e => setFilterChannel(e.target.value as CampaignType | 'all')}>
            <option value="all">Todos os canais</option>
            {(Object.keys(CHANNEL_LABELS) as CampaignType[]).map(c => (
              <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <button type="button"
          className="p-btn-gold"
          onClick={() => setShowCreateModal(true)}
          style={{ padding: '9px 20px', fontSize: 13 }}
        >
          ✦ Criar Template com IA
        </button>
      </div>

      {/* Template grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {filtered.map(tpl => (
          <div
            key={tpl.id}
            className="p-card"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, border: editingId === tpl.id ? `1.5px solid ${C.green}` : undefined }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 4 }}>{tpl.name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    background: CATEGORY_COLORS[tpl.category] + '18', color: CATEGORY_COLORS[tpl.category],
                    fontSize: 11, fontFamily: 'var(--font-dm-mono),monospace', padding: '2px 7px', borderRadius: 99,
                  }}>{CATEGORY_LABELS[tpl.category]}</span>
                  <span style={{
                    background: CHANNEL_COLORS[tpl.channel] + '18', color: CHANNEL_COLORS[tpl.channel],
                    fontSize: 11, fontFamily: 'var(--font-dm-mono),monospace', padding: '2px 7px', borderRadius: 99,
                  }}>{CHANNEL_LABELS[tpl.channel]}</span>
                </div>
              </div>
            </div>

            <p style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, color: C.muted, lineHeight: 1.5, margin: 0, flexGrow: 1 }}>
              {tpl.preview.slice(0, 80)}...
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: C.muted }}>
                {tpl.useCount}× usado · {tpl.lastUsed !== '—' ? new Date(tpl.lastUsed).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : '—'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button"
                  onClick={() => setEditingId(editingId === tpl.id ? null : tpl.id)}
                  style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', transition: 'all .2s' }}
                >Editar</button>
                <button type="button"
                  onClick={() => duplicateTemplate(tpl)}
                  style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.gold}40`, background: C.gold + '0a', color: C.gold, cursor: 'pointer', transition: 'all .2s' }}
                >Dup.</button>
                <button type="button"
                  onClick={() => deleteTemplate(tpl.id)}
                  style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.red}40`, background: C.red + '0a', color: C.red, cursor: 'pointer', transition: 'all .2s' }}
                >Del.</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(14,14,13,.6)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(14,14,13,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 300, color: C.text, margin: 0 }}>
                ✦ Criar Template com IA
              </h2>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Nome do Template</label>
                <input className="p-inp" value={newTplName} onChange={e => setNewTplName(e.target.value)} placeholder="Ex: Follow-Up Investidor HNWI" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Categoria</label>
                  <select className="p-sel" value={newTplCategory} onChange={e => setNewTplCategory(e.target.value as TemplateCategory)} style={{ width: '100%' }}>
                    {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Canal</label>
                  <select className="p-sel" value={newTplChannel} onChange={e => setNewTplChannel(e.target.value as CampaignType)} style={{ width: '100%' }}>
                    {(Object.keys(CHANNEL_LABELS) as CampaignType[]).map(c => (
                      <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Instrução para a IA</label>
                <textarea
                  className="p-inp"
                  value={newTplPrompt}
                  onChange={e => setNewTplPrompt(e.target.value)}
                  placeholder="Ex: Template para investidores americanos interessados em yield acima de 5% em Lisboa. Tom profissional mas directo. Mencionar NHR e vantagens fiscais."
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <button type="button"
                className="p-btn"
                onClick={handleGenerate}
                disabled={generating || !newTplPrompt}
                style={{ padding: '10px', opacity: !newTplPrompt ? 0.5 : 1 }}
              >
                {generating ? 'A gerar com IA...' : '✦ Gerar Template'}
              </button>
              {generatedPreview && (
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>Preview Gerado</label>
                  <textarea
                    className="p-inp"
                    value={generatedPreview}
                    onChange={e => setGeneratedPreview(e.target.value)}
                    rows={8}
                    style={{ width: '100%', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, resize: 'vertical' }}
                  />
                  <button type="button"
                    className="p-btn-gold"
                    onClick={handleSaveTemplate}
                    style={{ marginTop: 12, width: '100%', padding: '12px' }}
                  >
                    Guardar Template
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalCampanhas() {
  const [activeTab, setActiveTab] = useState<TabId>('criar')
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    if (typeof window === 'undefined') return MOCK_CAMPAIGNS
    try {
      const stored = localStorage.getItem('ag_campaigns')
      return stored ? (JSON.parse(stored) as Campaign[]) : MOCK_CAMPAIGNS
    } catch { return MOCK_CAMPAIGNS }
  })

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem('ag_campaigns', JSON.stringify(campaigns)) } catch {}
  }, [campaigns])

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'criar',     label: 'Criar Campanha' },
    { id: 'activas',   label: 'Campanhas Activas', count: campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length },
    { id: 'analytics', label: 'Analytics' },
    { id: 'templates', label: 'Templates' },
  ]

  return (
    <div style={{ fontFamily: 'var(--font-jost),sans-serif', color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 32, fontWeight: 300, color: C.text, margin: '0 0 6px' }}>
          Campanhas
        </h1>
        <p style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, color: C.muted, margin: 0 }}>
          Motor de campanhas multi-canal · Agency Group AMI 22506
        </p>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#fff', borderRadius: 12, padding: 4,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
      }}>
        {TABS.map(tab => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? C.green : 'transparent',
              color: activeTab === tab.id ? '#fff' : C.muted,
              fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 400,
              transition: 'all .2s', position: 'relative',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                background: activeTab === tab.id ? C.gold : C.green,
                color: '#fff', fontSize: 11, fontFamily: 'var(--font-dm-mono),monospace', fontWeight: 700,
                width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'criar'     && <TabCriar campaigns={campaigns} setCampaigns={setCampaigns} />}
        {activeTab === 'activas'   && <TabActivas campaigns={campaigns} setCampaigns={setCampaigns} />}
        {activeTab === 'analytics' && <TabAnalytics campaigns={campaigns} />}
        {activeTab === 'templates' && <TabTemplates />}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .p-card { background: #fff; border: 1px solid #e5e0d5; border-radius: 12px; box-shadow: 0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04); }
      `}</style>
    </div>
  )
}
