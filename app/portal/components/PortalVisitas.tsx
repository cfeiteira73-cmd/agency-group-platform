'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type VisitStatus = 'confirmada' | 'pendente' | 'cancelada' | 'realizada'
type VisitType   = 'Presencial' | 'Virtual' | 'Drive-by'
type VisitDuration = 30 | 60 | 90 | 120
type FeedbackNextAction = 'Segunda visita' | 'Fazer proposta' | 'Enviar alternativas' | 'Encerrar interesse'

interface Visit {
  id: string
  propertyId: string
  propertyName: string
  propertyAddress: string
  buyerName: string
  buyerNationality: string
  date: string        // YYYY-MM-DD
  time: string        // HH:MM
  duration: VisitDuration
  status: VisitStatus
  type: VisitType
  consultant: string
  notes: string
  remindWA: boolean
  remindEmail: boolean
  notifyOwner: boolean
  feedbackInterest?: number   // 1-5
  feedbackObjections?: string[]
  feedbackNextAction?: FeedbackNextAction
  feedbackNotes?: string
  feedbackSaved?: boolean
}

type VisitTab = 'calendario' | 'proximas' | 'agendar' | 'feedback'
type ProximasFilter = 'hoje' | 'semana' | 'todas'

// ─── Mock data ────────────────────────────────────────────────────────────────

const TODAY = new Date()

const fmtDate = (d: Date) => d.toISOString().split('T')[0]

const addDays = (d: Date, n: number) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const MOCK_PROPERTIES = [
  { id: 'p1',  name: 'Apartamento T3', address: 'Rua Dom Pedro V, 45 — Príncipe Real, Lisboa' },
  { id: 'p2',  name: 'Moradia V4',     address: 'Rua da Eira, 12 — Cascais' },
  { id: 'p3',  name: 'Penthouse T4',   address: 'Av. da Liberdade, 230 — Lisboa' },
  { id: 'p4',  name: 'Apartamento T2', address: 'Rua Garrett, 88 — Chiado, Lisboa' },
  { id: 'p5',  name: 'Moradia V5',     address: 'Quinta da Beloura, Lote 14 — Sintra' },
  { id: 'p6',  name: 'Loft T1+1',      address: 'Rua de Mouzinho da Silveira, 9 — Porto' },
  { id: 'p7',  name: 'Apartamento T3', address: 'Rua Castilho, 54 — Marquês, Lisboa' },
  { id: 'p8',  name: 'Moradia V3',     address: 'Praia do Guincho, Cascais' },
  { id: 'p9',  name: 'Apartamento T4', address: 'Av. Sidónio Pais, 18 — Lisboa' },
  { id: 'p10', name: 'Villa V6',       address: 'Vale do Lobo, Lote 88 — Algarve' },
]

const MOCK_BUYERS = [
  { id: 'b1',  name: 'James & Sarah Thornton', nationality: '🇬🇧' },
  { id: 'b2',  name: 'Jean-Pierre Moreau',      nationality: '🇫🇷' },
  { id: 'b3',  name: 'Dr. Kai Schmidt',         nationality: '🇩🇪' },
  { id: 'b4',  name: 'Ana Beatriz Oliveira',     nationality: '🇧🇷' },
  { id: 'b5',  name: 'Mohammed Al-Farsi',        nationality: '🇦🇪' },
  { id: 'b6',  name: 'David & Lisa Chen',        nationality: '🇨🇳' },
  { id: 'b7',  name: 'Robert Johnson III',       nationality: '🇺🇸' },
  { id: 'b8',  name: 'Isabel Rodrigues',         nationality: '🇵🇹' },
]

const CONSULTANTS = ['Sofia Mendes', 'Carlos Azevedo', 'Ana Pinheiro', 'Ricardo Lopes']

const OBJECTIONS = ['Preço', 'Localização', 'Dimensão', 'Estado', 'Orientação', 'Piso', 'Sem elevador', 'Obras necessárias']

const INITIAL_VISITS: Visit[] = [
  { id: 'v1', propertyId: 'p1', propertyName: 'Apartamento T3 — Príncipe Real', propertyAddress: 'Rua Dom Pedro V, 45 — Lisboa', buyerName: 'James & Sarah Thornton', buyerNationality: '🇬🇧', date: fmtDate(TODAY), time: '10:00', duration: 60, status: 'confirmada', type: 'Presencial', consultant: 'Sofia Mendes', notes: 'Casal britânico, budget €1.2M, interesse em PT5', remindWA: true, remindEmail: true, notifyOwner: true },
  { id: 'v2', propertyId: 'p3', propertyName: 'Penthouse T4 — Av. Liberdade', propertyAddress: 'Av. da Liberdade, 230 — Lisboa', buyerName: 'Jean-Pierre Moreau', buyerNationality: '🇫🇷', date: fmtDate(TODAY), time: '14:30', duration: 90, status: 'confirmada', type: 'Presencial', consultant: 'Carlos Azevedo', notes: 'Executivo francês, relocação Lisboa Q3 2026', remindWA: true, remindEmail: false, notifyOwner: false },
  { id: 'v3', propertyId: 'p2', propertyName: 'Moradia V4 — Cascais', propertyAddress: 'Rua da Eira, 12 — Cascais', buyerName: 'Dr. Kai Schmidt', buyerNationality: '🇩🇪', date: fmtDate(TODAY), time: '17:00', duration: 60, status: 'pendente', type: 'Presencial', consultant: 'Sofia Mendes', notes: 'Família alemã, procura moradia para habitar', remindWA: false, remindEmail: true, notifyOwner: true },
  { id: 'v4', propertyId: 'p5', propertyName: 'Moradia V5 — Quinta Beloura', propertyAddress: 'Quinta da Beloura, Lote 14 — Sintra', buyerName: 'Mohammed Al-Farsi', buyerNationality: '🇦🇪', date: fmtDate(addDays(TODAY, 1)), time: '11:00', duration: 120, status: 'confirmada', type: 'Presencial', consultant: 'Ricardo Lopes', notes: 'Cliente VIP, family office Dubai — Golden Visa', remindWA: true, remindEmail: true, notifyOwner: true },
  { id: 'v5', propertyId: 'p4', propertyName: 'Apartamento T2 — Chiado', propertyAddress: 'Rua Garrett, 88 — Lisboa', buyerName: 'Ana Beatriz Oliveira', buyerNationality: '🇧🇷', date: fmtDate(addDays(TODAY, 2)), time: '10:30', duration: 60, status: 'confirmada', type: 'Presencial', consultant: 'Ana Pinheiro', notes: 'Investidora, interesse em AL licence', remindWA: true, remindEmail: false, notifyOwner: false },
  { id: 'v6', propertyId: 'p9', propertyName: 'Apartamento T4 — Sidónio Pais', propertyAddress: 'Av. Sidónio Pais, 18 — Lisboa', buyerName: 'Robert Johnson III', buyerNationality: '🇺🇸', date: fmtDate(addDays(TODAY, 3)), time: '16:00', duration: 60, status: 'pendente', type: 'Virtual', consultant: 'Sofia Mendes', notes: 'Americano, visita virtual antes de viajar', remindWA: false, remindEmail: true, notifyOwner: false },
  { id: 'v7', propertyId: 'p7', propertyName: 'Apartamento T3 — Marquês', propertyAddress: 'Rua Castilho, 54 — Lisboa', buyerName: 'David & Lisa Chen', buyerNationality: '🇨🇳', date: fmtDate(addDays(TODAY, 4)), time: '13:00', duration: 90, status: 'confirmada', type: 'Presencial', consultant: 'Carlos Azevedo', notes: 'Casal chinês, segunda visita', remindWA: true, remindEmail: true, notifyOwner: true },
  { id: 'v8', propertyId: 'p10', propertyName: 'Villa V6 — Vale do Lobo', propertyAddress: 'Vale do Lobo, Lote 88 — Algarve', buyerName: 'Mohammed Al-Farsi', buyerNationality: '🇦🇪', date: fmtDate(addDays(TODAY, 5)), time: '11:30', duration: 120, status: 'confirmada', type: 'Presencial', consultant: 'Ricardo Lopes', notes: 'Segunda opção Algarve — budget €3.5M', remindWA: true, remindEmail: true, notifyOwner: true },
  // Past visits needing feedback
  { id: 'v9',  propertyId: 'p6', propertyName: 'Loft T1+1 — Porto', propertyAddress: 'Rua Mouzinho da Silveira, 9 — Porto', buyerName: 'Isabel Rodrigues', buyerNationality: '🇵🇹', date: fmtDate(addDays(TODAY, -2)), time: '15:00', duration: 60, status: 'realizada', type: 'Presencial', consultant: 'Ana Pinheiro', notes: '', remindWA: false, remindEmail: false, notifyOwner: false },
  { id: 'v10', propertyId: 'p8', propertyName: 'Moradia V3 — Guincho', propertyAddress: 'Praia do Guincho, Cascais', buyerName: 'Jean-Pierre Moreau', buyerNationality: '🇫🇷', date: fmtDate(addDays(TODAY, -3)), time: '10:00', duration: 90, status: 'realizada', type: 'Presencial', consultant: 'Carlos Azevedo', notes: '', remindWA: false, remindEmail: false, notifyOwner: false },
  { id: 'v11', propertyId: 'p2', propertyName: 'Moradia V4 — Cascais', propertyAddress: 'Rua da Eira, 12 — Cascais', buyerName: 'Dr. Kai Schmidt', buyerNationality: '🇩🇪', date: fmtDate(addDays(TODAY, -5)), time: '14:00', duration: 60, status: 'realizada', type: 'Presencial', consultant: 'Sofia Mendes', notes: '', remindWA: false, remindEmail: false, notifyOwner: false, feedbackInterest: 4, feedbackObjections: ['Preço'], feedbackNextAction: 'Segunda visita', feedbackNotes: 'Muito interessado mas preço acima do budget', feedbackSaved: true },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<VisitStatus, { label: string; bg: string; color: string; dot: string; border: string }> = {
  confirmada: { label: 'Confirmada', bg: 'rgba(28,74,53,.08)',    color: '#1c4a35', dot: '#1c4a35', border: 'rgba(28,74,53,.2)' },
  pendente:   { label: 'Pendente',   bg: 'rgba(201,169,110,.1)',  color: '#a07a38', dot: '#c9a96e', border: 'rgba(201,169,110,.25)' },
  cancelada:  { label: 'Cancelada',  bg: 'rgba(220,38,38,.07)',   color: '#dc2626', dot: '#dc2626', border: 'rgba(220,38,38,.15)' },
  realizada:  { label: 'Realizada',  bg: 'rgba(99,102,241,.07)',  color: '#6366f1', dot: '#6366f1', border: 'rgba(99,102,241,.15)' },
}

const TYPE_CFG: Record<VisitType, { icon: string; color: string }> = {
  Presencial: { icon: '◉', color: '#1c4a35' },
  Virtual:    { icon: '◎', color: '#6366f1' },
  'Drive-by': { icon: '◈', color: '#c9a96e' },
}

const isSameWeek = (dateStr: string, ref: Date) => {
  const d = new Date(dateStr)
  const startOfWeek = new Date(ref)
  const day = ref.getDay()
  startOfWeek.setDate(ref.getDate() - (day === 0 ? 6 : day - 1))
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = addDays(startOfWeek, 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return d >= startOfWeek && d <= endOfWeek
}

const isToday = (dateStr: string, ref: Date) => {
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
}

const getWeekStart = (ref: Date) => {
  const d = new Date(ref)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

const PT_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const PT_MONTHS   = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconMapPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
)

const IconStar = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#c9a96e' : 'none'} stroke={filled ? '#c9a96e' : 'rgba(14,14,13,.2)'} strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
)

// ─── Week Calendar ────────────────────────────────────────────────────────────

function WeekCalendar({
  visits,
  weekStart,
  onSlotClick,
}: {
  visits: Visit[]
  weekStart: Date
  onSlotClick: (date: string, time: string) => void
}) {
  // Hours 08:00 – 20:00 in 30min slots => 24 rows
  const HOUR_START = 8
  const HOUR_END   = 20
  const SLOT_H     = 28 // px per 30min slot
  const COL_W      = 120
  const LABEL_W    = 50
  const TOTAL_ROWS = (HOUR_END - HOUR_START) * 2
  const SVG_H      = TOTAL_ROWS * SLOT_H + 2
  const SVG_W      = LABEL_W + 7 * COL_W + 2

  const timeToRow = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    return (h - HOUR_START) * 2 + (m >= 30 ? 1 : 0)
  }

  const durationToRows = (mins: number) => mins / 30

  const now = new Date()
  const nowRow = (now.getHours() - HOUR_START) * 2 + (now.getMinutes() >= 30 ? 1 : 0)
  const todayColIdx = (() => {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      if (isToday(fmtDate(d), now)) return i
    }
    return -1
  })()

  return (
    <div style={{ overflowX: 'auto', border: '1px solid rgba(14,14,13,.08)' }}>
      {/* Day headers */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.08)', background: 'rgba(14,14,13,.02)' }}>
        <div style={{ width: `${LABEL_W}px`, flexShrink: 0 }} />
        {Array.from({ length: 7 }).map((_, i) => {
          const d = addDays(weekStart, i)
          const isT = isToday(fmtDate(d), new Date())
          return (
            <div
              key={i}
              style={{
                width: `${COL_W}px`, flexShrink: 0, padding: '8px 4px', textAlign: 'center',
                background: isT ? 'rgba(28,74,53,.05)' : 'transparent',
                borderLeft: '1px solid rgba(14,14,13,.05)',
              }}
            >
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {PT_WEEKDAYS[i]}
              </div>
              <div style={{
                fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: isT ? 600 : 300,
                color: isT ? '#1c4a35' : '#0e0e0d', marginTop: '2px',
              }}>
                {d.getDate()}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>
                {PT_MONTHS[d.getMonth()]}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid SVG */}
      <div style={{ position: 'relative' }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          style={{ display: 'block', cursor: 'crosshair' }}
          onClick={e => {
            const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
            const x = e.clientX - rect.left - LABEL_W
            const y = e.clientY - rect.top
            if (x < 0) return
            const colIdx = Math.floor(x / COL_W)
            const rowIdx = Math.floor(y / SLOT_H)
            if (colIdx < 0 || colIdx > 6 || rowIdx < 0 || rowIdx >= TOTAL_ROWS) return
            const d = addDays(weekStart, colIdx)
            const hh = HOUR_START + Math.floor(rowIdx / 2)
            const mm = rowIdx % 2 === 0 ? '00' : '30'
            onSlotClick(fmtDate(d), `${String(hh).padStart(2, '0')}:${mm}`)
          }}
        >
          {/* Hour lines */}
          {Array.from({ length: TOTAL_ROWS + 1 }).map((_, r) => (
            <line
              key={r}
              x1={LABEL_W}
              y1={r * SLOT_H}
              x2={SVG_W}
              y2={r * SLOT_H}
              stroke={r % 2 === 0 ? 'rgba(14,14,13,.1)' : 'rgba(14,14,13,.04)'}
              strokeWidth="1"
            />
          ))}

          {/* Column lines */}
          {Array.from({ length: 7 }).map((_, c) => (
            <line
              key={c}
              x1={LABEL_W + c * COL_W}
              y1={0}
              x2={LABEL_W + c * COL_W}
              y2={SVG_H}
              stroke="rgba(14,14,13,.06)"
              strokeWidth="1"
            />
          ))}

          {/* Today column highlight */}
          {todayColIdx >= 0 && (
            <rect
              x={LABEL_W + todayColIdx * COL_W}
              y={0}
              width={COL_W}
              height={SVG_H}
              fill="rgba(28,74,53,.03)"
            />
          )}

          {/* Time labels */}
          {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
            <text
              key={i}
              x={LABEL_W - 6}
              y={i * 2 * SLOT_H + 5}
              textAnchor="end"
              style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', fill: 'rgba(14,14,13,.35)' }}
            >
              {String(HOUR_START + i).padStart(2, '0')}h
            </text>
          ))}

          {/* Visit blocks */}
          {visits.map(v => {
            const vDate = v.date
            const colIdx = (() => {
              for (let i = 0; i < 7; i++) {
                if (fmtDate(addDays(weekStart, i)) === vDate) return i
              }
              return -1
            })()
            if (colIdx < 0) return null
            const row    = timeToRow(v.time)
            const rows   = durationToRows(v.duration)
            const cfg    = STATUS_CFG[v.status]
            const x      = LABEL_W + colIdx * COL_W + 3
            const y      = row * SLOT_H + 2
            const w      = COL_W - 6
            const h      = rows * SLOT_H - 4

            return (
              <g key={v.id}>
                <rect
                  x={x} y={y} width={w} height={Math.max(h, SLOT_H - 4)}
                  fill={cfg.bg} stroke={cfg.dot} strokeWidth="1.5" rx="2"
                />
                <text x={x + 5} y={y + 11} style={{ fontFamily: "'DM Mono',monospace", fontSize: '8px', fill: cfg.color, fontWeight: 600 }}>
                  {v.time}
                </text>
                {h >= 24 && (
                  <text x={x + 5} y={y + 22} style={{ fontFamily: "'Jost',sans-serif", fontSize: '9px', fill: cfg.color }}>
                    {v.buyerName.split(' ')[0]}
                  </text>
                )}
              </g>
            )
          })}

          {/* Current time line */}
          {todayColIdx >= 0 && nowRow >= 0 && nowRow < TOTAL_ROWS && (
            <g>
              <circle cx={LABEL_W + todayColIdx * COL_W} cy={nowRow * SLOT_H} r={4} fill="#dc2626" />
              <line
                x1={LABEL_W + todayColIdx * COL_W}
                y1={nowRow * SLOT_H}
                x2={LABEL_W + (todayColIdx + 1) * COL_W}
                y2={nowRow * SLOT_H}
                stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({
  visit,
  onConfirm,
  onReschedule,
  onCancel,
}: {
  visit: Visit
  onConfirm: (id: string) => void
  onReschedule: (id: string) => void
  onCancel: (id: string) => void
}) {
  const cfg  = STATUS_CFG[visit.status]
  const tCfg = TYPE_CFG[visit.type]
  const vDate = new Date(visit.date + 'T12:00:00')
  const dateLabel = vDate.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })

  const initials = visit.propertyName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(visit.propertyAddress)}`

  return (
    <div style={{
      border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.dot}`,
      background: '#fff', padding: '16px 18px', transition: 'box-shadow .2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.06)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Property thumbnail */}
        <div style={{
          width: '52px', height: '52px', flexShrink: 0, background: `${cfg.dot}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${cfg.dot}30`,
        }}>
          <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: cfg.dot, fontWeight: 600 }}>
            {initials}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', background: cfg.bg, color: cfg.color, fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', textTransform: 'uppercase', border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: tCfg.color, letterSpacing: '.04em' }}>
              {tCfg.icon} {visit.type}
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginLeft: 'auto' }}>
              {visit.consultant}
            </span>
          </div>

          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.86rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '2px', lineHeight: 1.2 }}>
            {visit.propertyName}
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '6px' }}>
            {visit.propertyAddress}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Buyer */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.6)' }}>
              <span style={{ fontSize: '.9rem' }}>{visit.buyerNationality}</span>
              {visit.buyerName}
            </span>

            {/* Time */}
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', fontWeight: 600 }}>
              {dateLabel} · {visit.time} · {visit.duration}min
            </span>
          </div>

          {visit.notes && (
            <div style={{ marginTop: '6px', fontFamily: "'Jost',sans-serif", fontSize: '.75rem', color: 'rgba(14,14,13,.45)', fontStyle: 'italic', lineHeight: 1.5 }}>
              {visit.notes}
            </div>
          )}

          {/* Toggles */}
          <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { label: 'WA lembrete', active: visit.remindWA },
              { label: 'Email briefing', active: visit.remindEmail },
              { label: 'Notif. proprietário', active: visit.notifyOwner },
            ].map(t => (
              <span key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: t.active ? '#1c4a35' : 'rgba(14,14,13,.25)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '5px', background: t.active ? '#1c4a35' : 'rgba(14,14,13,.12)', display: 'inline-block', flexShrink: 0 }} />
                {t.label}
              </span>
            ))}
          </div>

          {/* Feedback status */}
          {visit.status === 'realizada' && (
            <div style={{ marginTop: '6px' }}>
              {visit.feedbackSaved ? (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#6366f1', background: 'rgba(99,102,241,.08)', padding: '2px 8px', letterSpacing: '.04em' }}>
                  Feedback recebido
                </span>
              ) : (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#a07a38', background: 'rgba(201,169,110,.1)', padding: '2px 8px', letterSpacing: '.04em' }}>
                  Aguarda feedback
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.12)', color: '#1c4a35', textDecoration: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.04em' }}
          >
            <IconMapPin />Rota
          </a>
          {visit.status === 'pendente' && (
            <button
              style={{ padding: '5px 10px', background: '#1c4a35', border: 'none', color: '#f4f0e6', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.04em', cursor: 'pointer' }}
              onClick={() => onConfirm(visit.id)}
            >
              Confirmar
            </button>
          )}
          {(visit.status === 'confirmada' || visit.status === 'pendente') && (
            <>
              <button
                style={{ padding: '5px 10px', background: 'transparent', border: '1px solid rgba(201,169,110,.3)', color: '#a07a38', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer' }}
                onClick={() => onReschedule(visit.id)}
              >
                Remarcar
              </button>
              <button
                style={{ padding: '5px 10px', background: 'transparent', border: '1px solid rgba(220,38,38,.2)', color: '#dc2626', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer' }}
                onClick={() => onCancel(visit.id)}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalVisitas() {
  const [visits, setVisits] = useState<Visit[]>(INITIAL_VISITS)
  const [activeTab, setActiveTab] = useState<VisitTab>('proximas')
  const [proximasFilter, setProximasFilter] = useState<ProximasFilter>('hoje')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [quickSlot, setQuickSlot] = useState<{ date: string; time: string } | null>(null)

  // Schedule form
  const [schedProp,  setSchedProp]  = useState('')
  const [schedBuyer, setSchedBuyer] = useState('')
  const [schedDate,  setSchedDate]  = useState(fmtDate(new Date()))
  const [schedTime,  setSchedTime]  = useState('10:00')
  const [schedDur,   setSchedDur]   = useState<VisitDuration>(60)
  const [schedType,  setSchedType]  = useState<VisitType>('Presencial')
  const [schedCons,  setSchedCons]  = useState(CONSULTANTS[0])
  const [schedNotes, setSchedNotes] = useState('')
  const [schedWA,    setSchedWA]    = useState(true)
  const [schedEmail, setSchedEmail] = useState(true)
  const [schedOwner, setSchedOwner] = useState(false)
  const [schedSuccess, setSchedSuccess] = useState(false)
  const [conflictWarn, setConflictWarn] = useState(false)

  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState<Record<string, {
    interest: number; objections: string[]; nextAction: FeedbackNextAction | ''; notes: string
  }>>({})

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ag_visits')
      if (saved) {
        const parsed = JSON.parse(saved) as Visit[]
        if (Array.isArray(parsed)) setVisits(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  const saveVisits = (v: Visit[]) => {
    setVisits(v)
    try { localStorage.setItem('ag_visits', JSON.stringify(v)) } catch { /* ignore */ }
  }

  const confirmVisit = useCallback((id: string) => {
    saveVisits(visits.map(v => v.id === id ? { ...v, status: 'confirmada' as VisitStatus } : v))
  }, [visits])

  const cancelVisit = useCallback((id: string) => {
    saveVisits(visits.map(v => v.id === id ? { ...v, status: 'cancelada' as VisitStatus } : v))
  }, [visits])

  const rescheduleVisit = useCallback((id: string) => {
    saveVisits(visits.map(v => v.id === id ? { ...v, status: 'pendente' as VisitStatus } : v))
  }, [visits])

  const checkConflict = (date: string, time: string, dur: VisitDuration) => {
    const [sh, sm] = time.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin   = startMin + dur
    return visits.some(v => {
      if (v.date !== date || v.status === 'cancelada') return false
      const [vh, vm] = v.time.split(':').map(Number)
      const vs = vh * 60 + vm
      const ve = vs + v.duration
      return startMin < ve && endMin > vs
    })
  }

  const handleSchedule = () => {
    if (!schedProp || !schedBuyer) return
    const prop  = MOCK_PROPERTIES.find(p => p.id === schedProp)
    const buyer = MOCK_BUYERS.find(b => b.id === schedBuyer)
    if (!prop || !buyer) return

    const conflict = checkConflict(schedDate, schedTime, schedDur)
    setConflictWarn(conflict)

    const newVisit: Visit = {
      id: `v${Date.now()}`,
      propertyId: schedProp,
      propertyName: prop.name,
      propertyAddress: prop.address,
      buyerName: buyer.name,
      buyerNationality: buyer.nationality,
      date: schedDate,
      time: schedTime,
      duration: schedDur,
      status: 'pendente',
      type: schedType,
      consultant: schedCons,
      notes: schedNotes,
      remindWA: schedWA,
      remindEmail: schedEmail,
      notifyOwner: schedOwner,
    }

    saveVisits([...visits, newVisit])
    setSchedSuccess(true)
    setTimeout(() => setSchedSuccess(false), 3000)

    // Reset form
    setSchedProp(''); setSchedBuyer(''); setSchedNotes(''); setConflictWarn(false)
  }

  const saveFeedback = (visitId: string) => {
    const fb = feedbackMap[visitId]
    if (!fb) return
    saveVisits(visits.map(v => v.id === visitId ? {
      ...v,
      feedbackInterest: fb.interest,
      feedbackObjections: fb.objections,
      feedbackNextAction: fb.nextAction as FeedbackNextAction,
      feedbackNotes: fb.notes,
      feedbackSaved: true,
      status: 'realizada' as VisitStatus,
    } : v))
  }

  const updateFeedback = (visitId: string, field: string, value: unknown) => {
    setFeedbackMap(prev => ({
      ...prev,
      [visitId]: { ...(prev[visitId] ?? { interest: 3, objections: [] as string[], nextAction: '', notes: '' }), [field]: value },
    }))
  }

  const toggleObjection = (visitId: string, obj: string) => {
    const current = feedbackMap[visitId]?.objections || []
    const next = current.includes(obj) ? current.filter(o => o !== obj) : [...current, obj]
    updateFeedback(visitId, 'objections', next)
  }

  // Stats
  const todayVisits   = visits.filter(v => isToday(v.date, TODAY) && v.status !== 'cancelada')
  const weekVisits    = visits.filter(v => isSameWeek(v.date, TODAY) && v.status !== 'cancelada')
  const confirmed     = visits.filter(v => v.status === 'confirmada').length
  const realised      = visits.filter(v => v.status === 'realizada')
  const realisedWithFeedback = realised.filter(v => v.feedbackInterest)
  const avgInterest = realisedWithFeedback.length
    ? realisedWithFeedback.reduce((s, v) => s + (v.feedbackInterest || 0), 0) / realisedWithFeedback.length
    : 0

  const proximas = (() => {
    if (proximasFilter === 'hoje') return visits.filter(v => isToday(v.date, TODAY) && v.status !== 'cancelada')
    if (proximasFilter === 'semana') return visits.filter(v => isSameWeek(v.date, TODAY) && v.status !== 'cancelada')
    return visits.filter(v => v.status !== 'cancelada')
  })().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  const awaitingFeedback = visits.filter(v => v.status === 'realizada' && !v.feedbackSaved)

  // Top objection
  const allObjections = realised.flatMap(v => v.feedbackObjections || [])
  const topObj = allObjections.length
    ? Object.entries(allObjections.reduce((acc: Record<string, number>, o) => { acc[o] = (acc[o] || 0) + 1; return acc }, {}))
        .sort(([, a], [, b]) => b - a)[0]?.[0]
    : null

  const TABS: { id: VisitTab; label: string; count?: number }[] = [
    { id: 'calendario', label: 'Calendário' },
    { id: 'proximas',   label: 'Visitas', count: todayVisits.length },
    { id: 'agendar',    label: 'Agendar' },
    { id: 'feedback',   label: 'Feedback', count: awaitingFeedback.length },
  ]

  return (
    <div style={{ maxWidth: '1040px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>
            Gestão de Visitas
          </div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.9rem', color: '#0e0e0d', lineHeight: 1.1 }}>
            Visitas & <em style={{ color: '#1c4a35' }}>Follow-up</em>
          </div>
        </div>
        <button
          className="p-btn p-btn-gold"
          style={{ fontSize: '.52rem', padding: '9px 20px' }}
          onClick={() => setActiveTab('agendar')}
        >
          + Nova Visita
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: 'Hoje',          value: todayVisits.length,                              color: '#1c4a35', sub: 'visitas' },
          { label: 'Esta semana',   value: weekVisits.length,                               color: '#c9a96e', sub: 'visitas' },
          { label: 'Confirmadas',   value: confirmed,                                        color: '#1c4a35', sub: 'total' },
          { label: 'Interesse Méd.', value: avgInterest > 0 ? avgInterest.toFixed(1) : '—',  color: '#c9a96e', sub: '/ 5 estrelas' },
        ].map(kpi => (
          <div key={kpi.label} style={{ padding: '14px 16px', border: '1px solid rgba(14,14,13,.08)', background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>{kpi.label}</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 600, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', marginTop: '3px' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '24px' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === t.id ? '#1c4a35' : 'transparent'}`,
              color: activeTab === t.id ? '#1c4a35' : 'rgba(14,14,13,.4)',
              fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'all .15s', marginBottom: '-1px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ padding: '1px 6px', background: activeTab === t.id ? '#1c4a35' : 'rgba(14,14,13,.08)', color: activeTab === t.id ? '#fff' : 'rgba(14,14,13,.5)', borderRadius: '10px', fontSize: '.52rem' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: CALENDÁRIO ───────────────────────────────────────────────────── */}
      {activeTab === 'calendario' && (
        <div>
          {/* Week navigation */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', transition: 'all .2s', borderRadius: '6px' }}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ← Anterior
            </button>
            <button
              style={{ padding: '7px 14px', background: 'rgba(28,74,53,.07)', border: '1px solid rgba(28,74,53,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', cursor: 'pointer', letterSpacing: '.06em', transition: 'all .2s', borderRadius: '6px' }}
              onClick={() => setWeekStart(getWeekStart(TODAY))}
            >
              Esta Semana
            </button>
            <button
              style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', transition: 'all .2s', borderRadius: '6px' }}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Seguinte →
            </button>
            <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#0e0e0d', marginLeft: 'auto', fontWeight: 300 }}>
              {weekStart.getDate()} {PT_MONTHS[weekStart.getMonth()]} — {addDays(weekStart, 6).getDate()} {PT_MONTHS[addDays(weekStart, 6).getMonth()]} {weekStart.getFullYear()}
            </span>
          </div>

          <WeekCalendar
            visits={visits.filter(v => {
              const ws = fmtDate(weekStart)
              const we = fmtDate(addDays(weekStart, 6))
              return v.date >= ws && v.date <= we
            })}
            weekStart={weekStart}
            onSlotClick={(date, time) => {
              setQuickSlot({ date, time })
              setSchedDate(date)
              setSchedTime(time)
              setActiveTab('agendar')
            }}
          />

          <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_CFG).map(([status, cfg]) => (
              <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: cfg.bg, border: `1px solid ${cfg.dot}`, display: 'inline-block' }} />
                {cfg.label}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>
              <span style={{ width: '10px', height: '2px', background: '#dc2626', display: 'inline-block' }} />
              Hora actual
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', marginLeft: 'auto' }}>
              Clique num slot vazio para agendar
            </span>
          </div>
        </div>
      )}

      {/* ── TAB: VISITAS HOJE / PRÓXIMAS ─────────────────────────────────────── */}
      {activeTab === 'proximas' && (
        <div>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '20px', border: '1px solid rgba(14,14,13,.1)', alignSelf: 'flex-start', width: 'fit-content' }}>
            {([
              { id: 'hoje',  label: `Hoje (${visits.filter(v => isToday(v.date, TODAY) && v.status !== 'cancelada').length})` },
              { id: 'semana', label: `Esta Semana (${visits.filter(v => isSameWeek(v.date, TODAY) && v.status !== 'cancelada').length})` },
              { id: 'todas', label: 'Todas' },
            ] as { id: ProximasFilter; label: string }[]).map(f => (
              <button
                key={f.id}
                onClick={() => setProximasFilter(f.id)}
                style={{
                  padding: '8px 18px', background: proximasFilter === f.id ? '#1c4a35' : 'transparent',
                  border: 'none', borderRight: '1px solid rgba(14,14,13,.1)',
                  color: proximasFilter === f.id ? '#f4f0e6' : 'rgba(14,14,13,.5)',
                  fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Visit list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {proximas.map(v => (
              <VisitCard
                key={v.id}
                visit={v}
                onConfirm={confirmVisit}
                onCancel={cancelVisit}
                onReschedule={rescheduleVisit}
              />
            ))}
            {proximas.length === 0 && (
              <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(14,14,13,.3)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem' }}>
                Sem visitas para este período.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: AGENDAR VISITA ───────────────────────────────────────────────── */}
      {activeTab === 'agendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>
          {/* Form */}
          <div>
            {quickSlot && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(28,74,53,.07)', border: '1px solid rgba(28,74,53,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35' }}>
                Slot pré-seleccionado: {quickSlot.date} às {quickSlot.time}
              </div>
            )}

            {conflictWarn && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#dc2626', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                Conflito de horário detectado — confirma mesmo assim?
              </div>
            )}

            {schedSuccess && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(28,74,53,.07)', border: '1px solid rgba(28,74,53,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#1c4a35" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                Visita agendada com sucesso!
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Imóvel</label>
                <select className="p-sel" value={schedProp} onChange={e => setSchedProp(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Seleccionar imóvel...</option>
                  {MOCK_PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name} — {p.address.split('—')[1]?.trim() || ''}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Comprador / Buyer</label>
                <select className="p-sel" value={schedBuyer} onChange={e => setSchedBuyer(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Seleccionar cliente...</option>
                  {MOCK_BUYERS.map(b => <option key={b.id} value={b.id}>{b.nationality} {b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Data</label>
                <input type="date" className="p-inp" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Hora</label>
                <input type="time" className="p-inp" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Duração</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {([30, 60, 90, 120] as VisitDuration[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setSchedDur(d)}
                      style={{
                        flex: 1, padding: '7px 4px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                        cursor: 'pointer', border: '1px solid', transition: 'all .15s',
                        background: schedDur === d ? '#1c4a35' : 'transparent',
                        color: schedDur === d ? '#fff' : 'rgba(14,14,13,.5)',
                        borderColor: schedDur === d ? '#1c4a35' : 'rgba(14,14,13,.15)',
                      }}
                    >
                      {d}min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Tipo</label>
                <select className="p-sel" value={schedType} onChange={e => setSchedType(e.target.value as VisitType)} style={{ width: '100%' }}>
                  <option value="Presencial">Presencial</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Drive-by">Drive-by</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Consultor</label>
                <select className="p-sel" value={schedCons} onChange={e => setSchedCons(e.target.value)} style={{ width: '100%' }}>
                  {CONSULTANTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Notas</label>
                <textarea
                  className="p-inp"
                  rows={3}
                  value={schedNotes}
                  onChange={e => setSchedNotes(e.target.value)}
                  placeholder="Preferências do cliente, documentos a levar, acesso ao imóvel..."
                  style={{ resize: 'vertical', width: '100%' }}
                />
              </div>
            </div>

            {/* Auto-actions */}
            <div style={{ marginTop: '18px', padding: '14px 16px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)', borderRadius: '10px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>
                Acções automáticas ao agendar
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Enviar confirmação WhatsApp (24h + 2h antes)',  val: schedWA,    set: setSchedWA },
                  { label: 'Enviar briefing email ao comprador',            val: schedEmail, set: setSchedEmail },
                  { label: 'Notificar proprietário',                        val: schedOwner, set: setSchedOwner },
                ].map(toggle => (
                  <div
                    key={toggle.label}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => toggle.set(!toggle.val)}
                  >
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.65)' }}>{toggle.label}</span>
                    <div style={{
                      width: '36px', height: '20px', borderRadius: '10px',
                      background: toggle.val ? '#1c4a35' : 'rgba(14,14,13,.15)',
                      position: 'relative', transition: 'background .2s', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: '3px',
                        left: toggle.val ? '19px' : '3px',
                        width: '14px', height: '14px', borderRadius: '7px',
                        background: '#fff', transition: 'left .2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="p-btn"
              style={{ marginTop: '16px', width: '100%', background: '#1c4a35', color: '#f4f0e6', padding: '12px', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', borderRadius: '6px', transition: 'all .2s' }}
              onClick={handleSchedule}
              disabled={!schedProp || !schedBuyer}
            >
              Agendar Visita
            </button>
          </div>

          {/* Right: upcoming mini list */}
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '12px' }}>
              Próximas visitas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {visits
                .filter(v => v.date >= fmtDate(TODAY) && v.status !== 'cancelada')
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                .slice(0, 6)
                .map(v => {
                  const cfg = STATUS_CFG[v.status]
                  return (
                    <div key={v.id} style={{ padding: '10px 12px', border: `1px solid ${cfg.border}`, borderLeft: `2px solid ${cfg.dot}`, background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: cfg.color, marginBottom: '3px' }}>
                        {v.date === fmtDate(TODAY) ? 'Hoje' : new Date(v.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · {v.time}
                      </div>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', fontWeight: 500, color: '#0e0e0d', lineHeight: 1.2 }}>
                        {v.propertyName}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>
                        {v.buyerNationality} {v.buyerName.split(' ')[0]}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: FEEDBACK ────────────────────────────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              { label: 'Visitas esta semana', value: weekVisits.length,                 sub: 'realizadas' },
              { label: 'Interesse médio',     value: avgInterest > 0 ? `${avgInterest.toFixed(1)}★` : '—', sub: 'escala 1–5' },
              { label: 'Top objecção',        value: topObj || '—',                    sub: 'mais frequente' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 16px', border: '1px solid rgba(14,14,13,.08)', background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: '#1c4a35', fontWeight: 300 }}>{s.value}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', marginTop: '2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* SVG Funnel */}
          <div style={{ marginBottom: '24px', padding: '16px 20px', border: '1px solid rgba(14,14,13,.08)', background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '14px' }}>
              Funil de Conversão
            </div>
            {(() => {
              const total     = visits.length
              const realised2 = visits.filter(v => v.status === 'realizada').length
              const highInt   = visits.filter(v => (v.feedbackInterest || 0) >= 4).length
              const proposals = Math.round(highInt * 0.6)
              const cpcvs     = Math.round(proposals * 0.4)
              const funnel = [
                { label: 'Total Visitas',    n: total,     color: '#3a7bd5' },
                { label: 'Realizadas',        n: realised2, color: '#1c4a35' },
                { label: 'Interesse Alto (4-5★)', n: highInt, color: '#c9a96e' },
                { label: 'Proposta enviada', n: proposals, color: '#a07a38' },
                { label: 'CPCV',             n: cpcvs,     color: '#6366f1' },
              ]
              const svgW = 500
              const barH = 28
              const gap  = 10
              const svgH = funnel.length * (barH + gap)
              return (
                <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', maxWidth: '600px' }}>
                  {funnel.map((f, i) => {
                    const pct = total > 0 ? f.n / total : 0
                    const w = Math.max(4, pct * (svgW - 100))
                    const y = i * (barH + gap)
                    return (
                      <g key={f.label}>
                        <text x={0} y={y + barH - 8} style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', fill: 'rgba(14,14,13,.45)' }}>
                          {f.label}
                        </text>
                        <rect x={0} y={y + barH} width={svgW - 60} height={6} fill="rgba(14,14,13,.05)" rx="2" />
                        <rect x={0} y={y + barH} width={w} height={6} fill={f.color} rx="2" />
                        <text x={w + 6} y={y + barH + 5} style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', fill: f.color, fontWeight: 600 }}>
                          {f.n} · {Math.round(pct * 100)}%
                        </text>
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
          </div>

          {/* Feedback forms */}
          {awaitingFeedback.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(14,14,13,.3)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem', border: '1px dashed rgba(14,14,13,.1)' }}>
              Sem visitas a aguardar feedback nos últimos 7 dias.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {awaitingFeedback.map(v => {
                const fb = feedbackMap[v.id] || { interest: 3, objections: [], nextAction: '', notes: '' }
                return (
                  <div key={v.id} className="p-card">
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid rgba(14,14,13,.07)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.88rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '3px' }}>
                          {v.propertyName}
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>
                          {v.buyerNationality} {v.buyerName} · {new Date(v.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} às {v.time}
                        </div>
                      </div>
                      <span style={{ padding: '2px 8px', background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#a07a38', letterSpacing: '.04em' }}>
                        Aguarda feedback
                      </span>
                    </div>

                    {/* Interest stars */}
                    <div style={{ marginBottom: '16px' }}>
                      <div className="p-label" style={{ marginBottom: '8px', display: 'block' }}>Nível de interesse</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => updateFeedback(v.id, 'interest', n)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                          >
                            <IconStar filled={fb.interest >= n} />
                          </button>
                        ))}
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', alignSelf: 'center', marginLeft: '6px' }}>
                          {fb.interest}/5
                        </span>
                      </div>
                    </div>

                    {/* Objections */}
                    <div style={{ marginBottom: '16px' }}>
                      <div className="p-label" style={{ marginBottom: '8px', display: 'block' }}>Objecções (selecciona todas as que se aplicam)</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {OBJECTIONS.map(obj => {
                          const selected = fb.objections.includes(obj)
                          return (
                            <button
                              key={obj}
                              onClick={() => toggleObjection(v.id, obj)}
                              style={{
                                padding: '4px 12px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                                cursor: 'pointer', border: '1px solid', transition: 'all .15s', letterSpacing: '.04em',
                                background: selected ? 'rgba(220,38,38,.06)' : 'transparent',
                                color: selected ? '#dc2626' : 'rgba(14,14,13,.45)',
                                borderColor: selected ? 'rgba(220,38,38,.3)' : 'rgba(14,14,13,.12)',
                              }}
                            >
                              {obj}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Next action */}
                    <div style={{ marginBottom: '14px' }}>
                      <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Próxima acção</label>
                      <select
                        className="p-sel"
                        value={fb.nextAction}
                        onChange={e => updateFeedback(v.id, 'nextAction', e.target.value)}
                        style={{ width: '100%', maxWidth: '320px' }}
                      >
                        <option value="">Seleccionar...</option>
                        {(['Segunda visita', 'Fazer proposta', 'Enviar alternativas', 'Encerrar interesse'] as FeedbackNextAction[]).map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '16px' }}>
                      <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Notas</label>
                      <textarea
                        className="p-inp"
                        rows={2}
                        value={fb.notes}
                        onChange={e => updateFeedback(v.id, 'notes', e.target.value)}
                        placeholder="Reacção do cliente, objecções específicas, pontos positivos..."
                        style={{ resize: 'vertical', width: '100%' }}
                      />
                    </div>

                    <button
                      className="p-btn p-btn-gold"
                      style={{ fontSize: '.52rem', padding: '9px 22px' }}
                      onClick={() => saveFeedback(v.id)}
                      disabled={!fb.nextAction}
                    >
                      Guardar Feedback
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
