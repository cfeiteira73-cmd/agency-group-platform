'use client'
import { useState, useMemo } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { useCRMStore } from '../stores/crmStore'

interface PortalAgendaProps {
  exportToICS: (events: { title: string; date: string; time?: string; description?: string }[]) => void
}

type AgendaView = 'lista' | 'calendario' | 'semana'

interface AgendaEvent {
  title: string
  date: string
  time?: string
  description?: string
  type: string
  id?: string
}

interface ManualEvent {
  id: string
  title: string
  date: string
  time?: string
  tipo: string
  description?: string
}

const TYPE_COLOR: Record<string, string> = {
  cpcv: '#c9a96e',
  escritura: '#1c4a35',
  followup: '#3b82f6',
  visita: '#4a9c7a',
  reuniao: '#8b5cf6',
  outro: '#6b7280',
}

const TYPE_LABEL: Record<string, string> = {
  cpcv: 'CPCV',
  escritura: 'ESCRITURA',
  followup: 'FOLLOW-UP',
  visita: 'VISITA',
  reuniao: 'REUNIÃO',
  outro: 'OUTRO',
}

const WEEK_DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const MOTIVATIONAL = [
  'O próximo negócio começa hoje.',
  'Consistência é a chave do elite.',
  'Cada contacto é uma oportunidade.',
  'O pipeline enche-se dia a dia.',
]

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Week starts on Monday (1), Sunday = 0 → offset 6
  const diff = (day === 0 ? 6 : day - 1)
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function CalendarGrid({
  year,
  month,
  events,
  today,
  selectedDay,
  onDayClick,
  darkMode,
}: {
  year: number
  month: number
  events: AgendaEvent[]
  today: string
  selectedDay: string | null
  onDayClick: (date: string) => void
  darkMode: boolean
}) {
  const firstDay = new Date(year, month, 1)
  // Monday-based: 0=Mon…6=Sun
  const startOffset = (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const eventsByDate: Record<string, AgendaEvent[]> = {}
  events.forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []
    eventsByDate[ev.date].push(ev)
  })

  const cells: (number | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    cells.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null)
  }

  return (
    <div>
      {/* Week day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
        {WEEK_DAYS_SHORT.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: "'DM Mono',monospace",
            fontSize: '.36rem',
            letterSpacing: '.08em',
            color: 'rgba(14,14,13,.35)',
            padding: '6px 0',
            textTransform: 'uppercase',
          }}>{d}</div>
        ))}
      </div>
      {/* Grid cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
        {cells.map((dayNum, idx) => {
          if (!dayNum) {
            return <div key={idx} style={{ minHeight: '64px' }} />
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDay
          const dayEvents = eventsByDate[dateStr] || []
          return (
            <div
              key={idx}
              onClick={() => onDayClick(dateStr)}
              style={{
                minHeight: '64px',
                padding: '6px',
                background: isToday
                  ? 'rgba(28,74,53,.12)'
                  : isSelected
                  ? 'rgba(201,169,110,.08)'
                  : darkMode ? 'rgba(244,240,230,.02)' : '#fff',
                border: `1px solid ${isToday ? 'rgba(28,74,53,.3)' : isSelected ? 'rgba(201,169,110,.3)' : 'rgba(14,14,13,.06)'}`,
                cursor: 'pointer',
                transition: 'background .15s',
              }}
            >
              <div style={{
                fontFamily: "'Cormorant',serif",
                fontWeight: isToday ? 600 : 300,
                fontSize: '1rem',
                color: isToday ? '#1c4a35' : darkMode ? 'rgba(244,240,230,.7)' : '#0e0e0d',
                lineHeight: 1,
                marginBottom: '4px',
              }}>{dayNum}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                {dayEvents.slice(0, 4).map((ev, ei) => (
                  <div key={ei} style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: TYPE_COLOR[ev.type] || TYPE_COLOR.outro,
                    flexShrink: 0,
                  }} title={ev.title} />
                ))}
                {dayEvents.length > 4 && (
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.28rem', color: 'rgba(14,14,13,.4)' }}>+{dayEvents.length - 4}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PortalAgenda({ exportToICS }: PortalAgendaProps) {
  const { darkMode } = useUIStore()
  const now = new Date()
  const { deals } = useDealStore()
  const { crmContacts, visitas } = useCRMStore()

  const [agendaView, setAgendaView] = useState<AgendaView>('lista')
  const [currentMonth, setCurrentMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(isoDate(now))
  const [formTime, setFormTime] = useState('')
  const [formTipo, setFormTipo] = useState('visita')
  const [formDesc, setFormDesc] = useState('')
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('ag_agenda_events') || '[]') as ManualEvent[]
    } catch { return [] }
  })

  const today = isoDate(now)

  // Build events from store sources
  const storeEvents = useMemo<AgendaEvent[]>(() => {
    const evs: AgendaEvent[] = []
    deals.forEach(d => {
      if (d.cpcvDate) evs.push({ title: `CPCV — ${d.imovel}`, date: d.cpcvDate, description: `${d.ref} · ${d.valor} · ${d.comprador}`, type: 'cpcv' })
      if (d.escrituraDate) evs.push({ title: `Escritura — ${d.imovel}`, date: d.escrituraDate, description: `${d.ref} · ${d.valor} · ${d.comprador}`, type: 'escritura' })
    })
    crmContacts.forEach(c => {
      if (c.nextFollowUp) evs.push({ title: `Follow-up — ${c.name}`, date: c.nextFollowUp, description: `${c.nationality} · ${c.phone}`, type: 'followup' })
    })
    visitas.forEach(v => {
      evs.push({ title: `Visita — ${v.propertyName}`, date: v.date, time: v.time, description: `Cliente: ${v.contactName} · ${v.notes}`, type: 'visita' })
    })
    return evs
  }, [deals, crmContacts, visitas])

  const allEvents = useMemo<AgendaEvent[]>(() => {
    const manual: AgendaEvent[] = manualEvents.map(e => ({
      title: e.title, date: e.date, time: e.time, description: e.description, type: e.tipo, id: e.id,
    }))
    return [...storeEvents, ...manual].sort((a, b) => a.date.localeCompare(b.date))
  }, [storeEvents, manualEvents])

  const upcoming = allEvents.filter(e => e.date >= today)
  const past = allEvents.filter(e => e.date < today)
  const todayEvents = allEvents.filter(e => e.date === today)
  const selectedDayEvents = selectedDay ? allEvents.filter(e => e.date === selectedDay) : []

  // Week events (Mon–Sun of current week)
  const weekStart = getStartOfWeek(now)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return isoDate(d)
  })
  const weekEventsByDay = weekDays.map(d => ({ date: d, events: allEvents.filter(e => e.date === d) }))

  // Next event after today
  const nextEvent = upcoming.find(e => e.date > today)
  const daysToNext = nextEvent
    ? Math.ceil((new Date(nextEvent.date).getTime() - new Date(today).getTime()) / 86400000)
    : null

  function saveManualEvent() {
    if (!formTitle || !formDate) return
    const ev: ManualEvent = {
      id: `manual_${Date.now()}`,
      title: formTitle,
      date: formDate,
      time: formTime || undefined,
      tipo: formTipo,
      description: formDesc || undefined,
    }
    const updated = [...manualEvents, ev]
    setManualEvents(updated)
    if (typeof window !== 'undefined') localStorage.setItem('ag_agenda_events', JSON.stringify(updated))
    setFormTitle('')
    setFormDate(isoDate(now))
    setFormTime('')
    setFormTipo('visita')
    setFormDesc('')
    setShowAddForm(false)
  }

  function prevMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
    setSelectedDay(null)
  }
  function nextMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
    setSelectedDay(null)
  }

  const col = darkMode ? '#f4f0e6' : '#0e0e0d'
  const cardBg = darkMode ? 'rgba(244,240,230,.03)' : '#fff'
  const borderCol = darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'

  function EventRow({ ev, compact = false }: { ev: AgendaEvent; compact?: boolean }) {
    const isToday = ev.date === today
    const daysUntil = Math.ceil((new Date(ev.date).getTime() - new Date(today).getTime()) / 86400000)
    return (
      <div style={{
        display: 'flex', gap: '14px', padding: compact ? '10px 12px' : '14px 16px',
        background: isToday ? 'rgba(201,169,110,.05)' : cardBg,
        border: `1px solid ${isToday ? 'rgba(201,169,110,.2)' : borderCol}`,
        borderLeft: `4px solid ${TYPE_COLOR[ev.type] || TYPE_COLOR.outro}`,
        marginBottom: '5px',
      }}>
        <div style={{ flexShrink: 0, minWidth: '56px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: compact ? '1.3rem' : '1.6rem', fontWeight: 300, color: isToday ? '#c9a96e' : col, lineHeight: 1 }}>
            {new Date(ev.date + 'T00:00:00').getDate()}
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase' }}>
            {new Date(ev.date + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' })}
          </div>
          {ev.time && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: TYPE_COLOR[ev.type] || TYPE_COLOR.outro, marginTop: '2px' }}>{ev.time}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: TYPE_COLOR[ev.type] || TYPE_COLOR.outro, background: `${TYPE_COLOR[ev.type] || TYPE_COLOR.outro}14`, padding: '1px 6px' }}>
              {TYPE_LABEL[ev.type] || 'EVENTO'}
            </span>
            {isToday && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: '#c9a96e', background: 'rgba(201,169,110,.1)', padding: '1px 6px' }}>HOJE</span>}
            {daysUntil > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: 'rgba(14,14,13,.3)' }}>em {daysUntil}d</span>}
          </div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', fontWeight: 500, color: col, marginBottom: '2px' }}>{ev.title}</div>
          {ev.description && !compact && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.37rem', color: 'rgba(14,14,13,.4)' }}>{ev.description}</div>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Calendário de Negócios</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: col }}>Agenda</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            style={{ padding: '7px 14px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}
            onClick={() => setShowAddForm(v => !v)}
          >+ Evento</button>
          <button
            className="p-btn"
            style={{ padding: '7px 14px' }}
            onClick={() => exportToICS(upcoming.map(e => ({ title: e.title, date: e.date, time: e.time, description: e.description })))}
          >Exportar .ICS</button>
        </div>
      </div>

      {/* Add Event Form */}
      {showAddForm && (
        <div style={{ marginBottom: '20px', padding: '18px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: '#1c4a35', marginBottom: '14px' }}>NOVO EVENTO</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>TÍTULO *</label>
              <input className="p-inp" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="ex: Visita ao apartamento" />
            </div>
            <div>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>DATA *</label>
              <input className="p-inp" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>HORA</label>
              <input className="p-inp" type="time" value={formTime} onChange={e => setFormTime(e.target.value)} />
            </div>
            <div>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>TIPO</label>
              <select className="p-sel" value={formTipo} onChange={e => setFormTipo(e.target.value)}>
                <option value="visita">Visita</option>
                <option value="reuniao">Reunião</option>
                <option value="cpcv">CPCV</option>
                <option value="escritura">Escritura</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>DESCRIÇÃO</label>
              <input className="p-inp" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Notas adicionais..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button className="p-btn" onClick={saveManualEvent} disabled={!formTitle || !formDate}>Guardar Evento</button>
            <button onClick={() => setShowAddForm(false)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', color: 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: `1px solid ${borderCol}` }}>
        {(['lista', 'calendario', 'semana'] as AgendaView[]).map(v => (
          <button
            key={v}
            className={`deal-tab${agendaView === v ? ' active' : ''}`}
            onClick={() => setAgendaView(v)}
          >
            {v === 'lista' ? 'Lista' : v === 'calendario' ? 'Calendário' : 'Esta Semana'}
          </button>
        ))}
      </div>

      {/* HOJE panel — always visible */}
      <div style={{ marginBottom: '20px', padding: '16px', background: todayEvents.length > 0 ? 'rgba(201,169,110,.06)' : 'rgba(28,74,53,.03)', border: `1px solid ${todayEvents.length > 0 ? 'rgba(201,169,110,.2)' : 'rgba(28,74,53,.1)'}` }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', color: todayEvents.length > 0 ? '#c9a96e' : '#1c4a35', marginBottom: todayEvents.length > 0 ? '10px' : '0' }}>
          HOJE · {new Date(today + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
        </div>
        {todayEvents.length > 0 ? (
          todayEvents.map((ev, i) => <EventRow key={i} ev={ev} compact />)
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: 'rgba(14,14,13,.4)', fontStyle: 'italic' }}>
              {MOTIVATIONAL[now.getDay() % MOTIVATIONAL.length]}
            </div>
            {daysToNext !== null && nextEvent && (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)' }}>
                Próximo evento em {daysToNext}d — {nextEvent.title}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(TYPE_LABEL).map(([type, label]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TYPE_COLOR[type] }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.45)', letterSpacing: '.06em' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── LISTA VIEW ── */}
      {agendaView === 'lista' && (
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>
            Próximos Eventos ({upcoming.length})
          </div>
          {upcoming.length === 0 && (
            <div className="p-card" style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: 'rgba(14,14,13,.35)' }}>Sem eventos futuros</div>
            </div>
          )}
          {upcoming.map((ev, i) => <EventRow key={i} ev={ev} />)}

          {past.length > 0 && (
            <div style={{ marginTop: '28px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.22)', marginBottom: '10px' }}>
                Eventos Passados ({past.length})
              </div>
              {past.slice(-5).reverse().map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', padding: '9px 14px', opacity: 0.45, borderLeft: `4px solid ${TYPE_COLOR[ev.type] || TYPE_COLOR.outro}`, marginBottom: '4px', background: darkMode ? 'rgba(244,240,230,.01)' : 'rgba(14,14,13,.02)' }}>
                  <div style={{ flexShrink: 0, minWidth: '50px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: 'rgba(14,14,13,.4)', lineHeight: 1 }}>{new Date(ev.date + 'T00:00:00').getDate()}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: 'rgba(14,14,13,.3)', textTransform: 'uppercase' }}>{new Date(ev.date + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: TYPE_COLOR[ev.type] || TYPE_COLOR.outro, marginBottom: '2px' }}>{TYPE_LABEL[ev.type] || 'EVENTO'}</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.5)' }}>{ev.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CALENDÁRIO VIEW ── */}
      {agendaView === 'calendario' && (
        <div>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button onClick={prevMonth} style={{ width: '32px', height: '32px', background: cardBg, border: `1px solid ${borderCol}`, cursor: 'pointer', color: col, fontFamily: "'DM Mono',monospace", fontSize: '.5rem' }}>‹</button>
            <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.3rem', color: col }}>
              {MONTHS_PT[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <button onClick={nextMonth} style={{ width: '32px', height: '32px', background: cardBg, border: `1px solid ${borderCol}`, cursor: 'pointer', color: col, fontFamily: "'DM Mono',monospace", fontSize: '.5rem' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 280px' : '1fr', gap: '20px' }}>
            <CalendarGrid
              year={currentMonth.getFullYear()}
              month={currentMonth.getMonth()}
              events={allEvents}
              today={today}
              selectedDay={selectedDay}
              onDayClick={(d) => setSelectedDay(prev => prev === d ? null : d)}
              darkMode={darkMode}
            />
            {selectedDay && (
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', color: '#1c4a35', marginBottom: '12px' }}>
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                </div>
                {selectedDayEvents.length === 0 ? (
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.35)', fontStyle: 'italic' }}>Sem eventos neste dia</div>
                ) : (
                  selectedDayEvents.map((ev, i) => <EventRow key={i} ev={ev} compact />)
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SEMANA VIEW ── */}
      {agendaView === 'semana' && (
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: 'rgba(14,14,13,.35)', marginBottom: '16px' }}>
            SEMANA {new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).toUpperCase()} — {new Date(weekDays[6] + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '8px' }}>
            {weekEventsByDay.map(({ date, events: dayEvs }, idx) => {
              const isToday = date === today
              const dayObj = new Date(date + 'T00:00:00')
              return (
                <div key={idx} style={{
                  minHeight: '120px',
                  padding: '10px 8px',
                  background: isToday ? 'rgba(28,74,53,.07)' : cardBg,
                  border: `1px solid ${isToday ? 'rgba(28,74,53,.25)' : borderCol}`,
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: isToday ? '#1c4a35' : 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {WEEK_DAYS_SHORT[idx]}
                    </div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontWeight: isToday ? 600 : 300, fontSize: '1.4rem', color: isToday ? '#1c4a35' : col, lineHeight: 1 }}>
                      {dayObj.getDate()}
                    </div>
                  </div>
                  {dayEvs.length === 0 ? (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: 'rgba(14,14,13,.2)' }}>—</div>
                  ) : (
                    dayEvs.map((ev, ei) => (
                      <div key={ei} style={{
                        padding: '4px 6px',
                        background: `${TYPE_COLOR[ev.type] || TYPE_COLOR.outro}12`,
                        borderLeft: `3px solid ${TYPE_COLOR[ev.type] || TYPE_COLOR.outro}`,
                        marginBottom: '4px',
                      }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: TYPE_COLOR[ev.type] || TYPE_COLOR.outro, marginBottom: '1px' }}>
                          {TYPE_LABEL[ev.type] || 'EVENTO'}{ev.time ? ` · ${ev.time}` : ''}
                        </div>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.72rem', color: col, lineHeight: 1.3 }}>{ev.title}</div>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
