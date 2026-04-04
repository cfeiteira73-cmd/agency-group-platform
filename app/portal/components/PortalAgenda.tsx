'use client'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { useCRMStore } from '../stores/crmStore'

interface PortalAgendaProps {
  exportToICS: (events: { title: string; date: string; time?: string; description?: string }[]) => void
}

export default function PortalAgenda({ exportToICS }: PortalAgendaProps) {
  const { darkMode } = useUIStore()
  const now = new Date()
  const { deals } = useDealStore()
  const { crmContacts, visitas } = useCRMStore()

  // Build events from deals, follow-ups and visitas
  const events: { title: string; date: string; time?: string; description?: string; type: string }[] = []

  deals.forEach(d => {
    if (d.cpcvDate) events.push({ title: `CPCV — ${d.imovel}`, date: d.cpcvDate, description: `${d.ref} · ${d.valor} · ${d.comprador}`, type: 'cpcv' })
    if (d.escrituraDate) events.push({ title: `Escritura — ${d.imovel}`, date: d.escrituraDate, description: `${d.ref} · ${d.valor} · ${d.comprador}`, type: 'escritura' })
  })

  crmContacts.forEach(c => {
    if (c.nextFollowUp) events.push({ title: `Follow-up — ${c.name}`, date: c.nextFollowUp, description: `${c.nationality} · ${c.phone}`, type: 'followup' })
  })

  visitas.forEach(v => {
    events.push({ title: `Visita — ${v.propertyName}`, date: v.date, time: v.time, description: `Cliente: ${v.contactName} · ${v.notes}`, type: 'visita' })
  })

  const sortedEvents = events.sort((a, b) => a.date.localeCompare(b.date))
  const today = now.toISOString().split('T')[0]
  const upcoming = sortedEvents.filter(e => e.date >= today)
  const past = sortedEvents.filter(e => e.date < today)

  const TYPE_COLOR: Record<string, string> = {
    cpcv: '#c9a96e',
    escritura: '#1c4a35',
    followup: '#3b82f6',
    visita: '#4a9c7a',
  }

  const TYPE_LABEL: Record<string, string> = {
    cpcv: 'CPCV',
    escritura: 'ESCRITURA',
    followup: 'FOLLOW-UP',
    visita: 'VISITA',
  }

  return (
    <div>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Calendário de Negócios</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Agenda Semanal</div>
        </div>
        <button
          className="p-btn"
          style={{ padding: '8px 16px' }}
          onClick={() => exportToICS(upcoming.map(e => ({ title: e.title, date: e.date, time: e.time, description: e.description })))}
        >
          📅 Exportar .ICS
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(TYPE_LABEL).map(([type, label]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: TYPE_COLOR[type] }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.5)', letterSpacing: '.06em' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '14px' }}>
          Próximos Eventos ({upcoming.length})
        </div>

        {upcoming.length === 0 && (
          <div className="p-card" style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: 'rgba(14,14,13,.35)' }}>Sem eventos futuros</div>
          </div>
        )}

        {upcoming.map((ev, i) => {
          const isToday = ev.date === today
          const daysUntil = Math.ceil((new Date(ev.date).getTime() - new Date(today).getTime()) / 86400000)
          return (
            <div key={i} style={{ display: 'flex', gap: '16px', padding: '14px 16px', background: isToday ? (darkMode ? 'rgba(201,169,110,.08)' : 'rgba(201,169,110,.05)') : (darkMode ? 'rgba(244,240,230,.02)' : '#fff'), border: `1px solid ${isToday ? 'rgba(201,169,110,.25)' : darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'}`, marginBottom: '6px', borderLeft: `4px solid ${TYPE_COLOR[ev.type]}` }}>
              <div style={{ flexShrink: 0, minWidth: '64px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.6rem', fontWeight: 300, color: isToday ? '#c9a96e' : darkMode ? 'rgba(244,240,230,.6)' : '#0e0e0d', lineHeight: 1 }}>
                  {new Date(ev.date + 'T00:00:00').getDate()}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {new Date(ev.date + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' })}
                </div>
                {ev.time && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: TYPE_COLOR[ev.type], marginTop: '2px' }}>{ev.time}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: TYPE_COLOR[ev.type], background: `${TYPE_COLOR[ev.type]}14`, padding: '1px 6px', letterSpacing: '.06em' }}>{TYPE_LABEL[ev.type]}</span>
                  {isToday && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: '#c9a96e', background: 'rgba(201,169,110,.1)', padding: '1px 6px' }}>HOJE</span>}
                  {daysUntil > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: 'rgba(14,14,13,.3)' }}>em {daysUntil}d</span>}
                </div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d', marginBottom: '2px' }}>{ev.title}</div>
                {ev.description && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>{ev.description}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Past events */}
      {past.length > 0 && (
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.25)', marginBottom: '14px' }}>
            Eventos Passados ({past.length})
          </div>
          {past.slice(-5).reverse().map((ev, i) => (
            <div key={i} style={{ display: 'flex', gap: '16px', padding: '10px 16px', opacity: 0.5, borderLeft: `4px solid ${TYPE_COLOR[ev.type]}`, marginBottom: '4px', background: darkMode ? 'rgba(244,240,230,.01)' : 'rgba(14,14,13,.02)' }}>
              <div style={{ flexShrink: 0, minWidth: '64px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: 'rgba(14,14,13,.4)', lineHeight: 1 }}>{new Date(ev.date + 'T00:00:00').getDate()}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.3)', textTransform: 'uppercase' }}>{new Date(ev.date + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' })}</div>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: TYPE_COLOR[ev.type], marginBottom: '2px' }}>{TYPE_LABEL[ev.type]}</div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.5)' }}>{ev.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
