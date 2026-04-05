'use client'
import { useState } from 'react'
import React from 'react'
import { exportToICS } from '../utils/export'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import { useUIStore } from '../stores/uiStore'
import { PORTAL_PROPERTIES } from './constants'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Visita {
  id: number
  propertyId: string
  propertyName: string
  contactId: number
  contactName: string
  date: string
  time: string
  status: 'agendada' | 'realizada' | 'cancelada'
  notes: string
  interestScore?: number
  feedback?: string
  aiSuggestion?: Record<string, unknown>
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PortalVisitas() {
  const crmContacts = useCRMStore(s => s.crmContacts)
  const setActiveCrmId = useCRMStore(s => s.setActiveCrmId)
  const setCrmProfileTab = useCRMStore(s => s.setCrmProfileTab)
  const deals = useDealStore(s => s.deals)
  const setSection = useUIStore(s => s.setSection)
  const imoveisList = PORTAL_PROPERTIES

  const [visitas, setVisitas] = useState<Visita[]>([])
  const [visitasTab, setVisitasTab] = useState<'lista' | 'agenda' | 'stats'>('lista')
  const [showNewVisita, setShowNewVisita] = useState(false)
  const [visitaFeedbackId, setVisitaFeedbackId] = useState<number | null>(null)
  const [visitaFeedback, setVisitaFeedback] = useState({ interesse: 5, observacoes: '', nextStep: '' })
  const [visitaAiLoading, setVisitaAiLoading] = useState(false)

  const today = new Date()
  const agendadas = visitas.filter(v => v.status === 'agendada')
  const realizadas = visitas.filter(v => v.status === 'realizada')
  const canceladas = visitas.filter(v => v.status === 'cancelada')
  const avgInterest = realizadas.filter(v => v.interestScore).reduce((s, v) => s + (v.interestScore || 0), 0) / Math.max(1, realizadas.filter(v => v.interestScore).length)

  const [newVisita, setNewVisita] = React.useState({
    propertyId: '', propertyName: '', contactId: 0, contactName: '', date: '', time: '10:00', notes: '',
  })

  const STATUS_V: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    agendada:  { label: 'Agendada',  bg: 'rgba(58,123,213,.08)',   color: '#3a7bd5', dot: '#3a7bd5' },
    realizada: { label: 'Realizada', bg: 'rgba(28,74,53,.08)',     color: '#1c4a35', dot: '#4a9c7a' },
    cancelada: { label: 'Cancelada', bg: 'rgba(136,136,136,.08)', color: '#888',    dot: '#ccc'    },
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#0e0e0d', letterSpacing: '-.01em' }}>Gestão de Visitas</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '4px' }}>Agendamento · Feedback · Follow-up IA</div>
        </div>
        <button className="p-btn p-btn-gold" style={{ fontSize: '.5rem', padding: '10px 22px' }} onClick={() => setShowNewVisita(true)}>+ Nova Visita</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Agendadas', value: agendadas.length, color: '#3a7bd5', icon: '📅' },
          { label: 'Realizadas', value: realizadas.length, color: '#1c4a35', icon: '✅' },
          { label: 'Canceladas', value: canceladas.length, color: '#888', icon: '✗' },
          { label: 'Interesse Médio', value: `${avgInterest.toFixed(1)}/5 ★`, color: '#c9a96e', icon: '⭐' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px 20px', border: '1px solid rgba(14,14,13,.08)', background: '#fff', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '1.4rem' }}>{s.icon}</span>
            <div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.6rem', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: '2px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid rgba(14,14,13,.08)' }}>
        {(['lista', 'agenda', 'stats'] as const).map(t => (
          <button key={t} onClick={() => setVisitasTab(t)}
            style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: `2px solid ${visitasTab === t ? '#1c4a35' : 'transparent'}`, color: visitasTab === t ? '#1c4a35' : 'rgba(14,14,13,.4)', cursor: 'pointer', transition: 'all .2s' }}>
            {t === 'lista' ? 'Lista' : t === 'agenda' ? 'Calendário' : 'Estatísticas'}
          </button>
        ))}
      </div>

      {/* LISTA */}
      {visitasTab === 'lista' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visitas.sort((a, b) => a.date.localeCompare(b.date)).map(v => {
            const cfg = STATUS_V[v.status]
            const visitDate = new Date(v.date)
            const isPast = visitDate < today
            void isPast
            const contact = crmContacts.find(c => c.id === v.contactId)
            return (
              <div key={v.id} style={{ background: '#fff', border: `1px solid ${cfg.color === '#3a7bd5' ? 'rgba(58,123,213,.15)' : cfg.color === '#1c4a35' ? 'rgba(28,74,53,.15)' : 'rgba(136,136,136,.1)'}`, borderLeft: `3px solid ${cfg.dot}`, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', padding: '3px 8px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, textTransform: 'uppercase', letterSpacing: '.06em' }}>{cfg.label}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.5)' }}>{visitDate.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · {v.time}</span>
                      {v.interestScore && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#c9a96e' }}>{'★'.repeat(v.interestScore)}{'☆'.repeat(5 - v.interestScore)}</span>}
                    </div>
                    <div style={{ fontSize: '.9rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '3px' }}>🏠 {v.propertyName}</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.55)' }}>
                      👤 {v.contactName}
                      {contact?.nationality && ` · ${String(contact.nationality).split(' ')[0]}`}
                      {contact?.phone && ` · ${contact.phone}`}
                    </div>
                    {v.notes && <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.5)', marginTop: '6px', fontStyle: 'italic' }}>{v.notes}</div>}
                    {v.feedback && <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.1)', fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.6 }}>{v.feedback}</div>}
                    {v.aiSuggestion && (
                      <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', borderLeft: '2px solid #c9a96e' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: '#c9a96e', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px' }}>✦ Sugestão IA</div>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.6 }}>{v.aiSuggestion.nextStep as string}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                    {v.status === 'agendada' && (
                      <>
                        <button className="p-btn" style={{ fontSize: '.4rem', padding: '5px 12px', whiteSpace: 'nowrap' }} onClick={() => {
                          setVisitas(vs => vs.map(vi => vi.id === v.id ? { ...vi, status: 'realizada' as const } : vi))
                          setVisitaFeedbackId(v.id)
                        }}>✓ Marcar Realizada</button>
                        <button style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', padding: '5px 12px', background: 'transparent', border: '1px solid rgba(136,136,136,.2)', color: '#888', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          onClick={() => setVisitas(vs => vs.map(vi => vi.id === v.id ? { ...vi, status: 'cancelada' as const } : vi))}>✗ Cancelar</button>
                      </>
                    )}
                    {v.status === 'realizada' && !v.aiSuggestion && (
                      <button className="p-btn p-btn-gold" style={{ fontSize: '.4rem', padding: '5px 12px', whiteSpace: 'nowrap' }} onClick={async () => {
                        setVisitaAiLoading(true)
                        try {
                          const res = await fetch('/api/visitas', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'suggest-feedback', visit: v, contact: crmContacts.find(c => c.id === v.contactId) }),
                          })
                          const d = await res.json()
                          if (d.nextStep) setVisitas(vs => vs.map(vi => vi.id === v.id ? { ...vi, aiSuggestion: d } : vi))
                        } finally { setVisitaAiLoading(false) }
                      }}>✦ Follow-up IA {visitaAiLoading && '...'}</button>
                    )}
                    {contact && <button style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', padding: '4px 10px', background: 'rgba(58,123,213,.07)', color: '#3a7bd5', border: '1px solid rgba(58,123,213,.2)', cursor: 'pointer' }}
                      onClick={() => { setSection('crm'); setActiveCrmId(v.contactId); setCrmProfileTab('overview') }}>→ CRM</button>}
                    <button style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', padding: '4px 8px', background: 'transparent', color: 'rgba(14,14,13,.3)', border: '1px solid rgba(14,14,13,.1)', cursor: 'pointer' }}
                      onClick={() => setVisitas(vs => vs.filter(vi => vi.id !== v.id))}>✕</button>
                  </div>
                </div>
              </div>
            )
          })}
          {visitas.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(14,14,13,.35)', fontFamily: "'Jost',sans-serif" }}>
              Sem visitas registadas. Clique em &quot;+ Nova Visita&quot; para começar.
            </div>
          )}
        </div>
      )}

      {/* AGENDA CALENDAR VIEW */}
      {visitasTab === 'agenda' && (
        <div>
          {(['agendada', 'realizada', 'cancelada'] as const).map(status => {
            const group = visitas.filter(v => v.status === status)
            if (!group.length) return null
            const cfg = STATUS_V[status]
            return (
              <div key={status} style={{ marginBottom: '24px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: cfg.color, marginBottom: '12px' }}>▸ {cfg.label}s ({group.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '10px' }}>
                  {group.sort((a, b) => a.date.localeCompare(b.date)).map(v => (
                    <div key={v.id} style={{ padding: '14px 16px', border: `1px solid ${cfg.color}33`, background: cfg.bg }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: cfg.color, marginBottom: '4px' }}>{new Date(v.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} · {v.time}</div>
                      <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '3px' }}>{v.propertyName}</div>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.5)' }}>{v.contactName}</div>
                      {v.interestScore && <div style={{ marginTop: '6px', color: '#c9a96e', fontSize: '.7rem' }}>{'★'.repeat(v.interestScore)}{'☆'.repeat(5 - v.interestScore)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* STATS */}
      {visitasTab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Conversion funnel */}
          <div style={{ padding: '20px', border: '1px solid rgba(14,14,13,.08)', background: '#fff' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '16px' }}>Funil de Conversão</div>
            {[
              { label: 'Total Visitas', n: visitas.length, pct: 100, color: '#3a7bd5' },
              { label: 'Realizadas', n: realizadas.length, pct: Math.round(realizadas.length / Math.max(1, visitas.length) * 100), color: '#4a9c7a' },
              { label: 'Interesse ≥ 4★', n: realizadas.filter(v => (v.interestScore || 0) >= 4).length, pct: Math.round(realizadas.filter(v => (v.interestScore || 0) >= 4).length / Math.max(1, visitas.length) * 100), color: '#c9a96e' },
              { label: 'Em Negociação', n: deals.length, pct: Math.round(deals.length / Math.max(1, visitas.length) * 100), color: '#1c4a35' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: '#0e0e0d' }}>{row.label}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: row.color, fontWeight: 600 }}>{row.n} · {row.pct}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(14,14,13,.06)', borderRadius: '1px' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Interest by property */}
          <div style={{ padding: '20px', border: '1px solid rgba(14,14,13,.08)', background: '#fff' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '16px' }}>Interesse por Imóvel</div>
            {Object.entries(realizadas.reduce((acc: Record<string, { total: number; count: number }>, v) => {
              if (!v.interestScore) return acc
              const key = v.propertyName.split('·')[0].trim()
              acc[key] = acc[key] || { total: 0, count: 0 }
              acc[key].total += v.interestScore
              acc[key].count++
              return acc
            }, {})).map(([name, { total, count }]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ flex: 1, fontSize: '.82rem', color: '#0e0e0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ flexShrink: 0, color: '#c9a96e', fontSize: '.75rem' }}>{'★'.repeat(Math.round(total / count))} {(total / count).toFixed(1)}</div>
              </div>
            ))}
            {realizadas.filter(v => v.interestScore).length === 0 && (
              <div style={{ color: 'rgba(14,14,13,.3)', fontSize: '.85rem', fontFamily: "'Jost',sans-serif" }}>Sem dados de interesse ainda.</div>
            )}
          </div>
        </div>
      )}

      {/* ICS export */}
      <div style={{ marginTop: '24px', padding: '16px 20px', border: '1px dashed rgba(14,14,13,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)' }}>Exportar visitas agendadas para Google Calendar, Apple Calendar ou Outlook</div>
        <button className="p-btn" style={{ fontSize: '.44rem', padding: '8px 16px' }}
          onClick={() => exportToICS(agendadas.map(v => ({ title: `🏠 Visita: ${v.propertyName}`, date: v.date, time: v.time, description: `Cliente: ${v.contactName} | ${v.notes}` })))}>
          📅 Exportar Visitas (.ics)
        </button>
      </div>

      {/* New Visit Modal */}
      {showNewVisita && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(12,31,21,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowNewVisita(false)}>
          <div style={{ width: '500px', maxWidth: '95vw', background: '#fff', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '20px' }}>Nova Visita</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '5px' }}>Imóvel</label>
                <select className="p-inp" value={newVisita.propertyId}
                  onChange={e => {
                    const p = imoveisList.find(im => im.id === e.target.value)
                    setNewVisita(nv => ({ ...nv, propertyId: e.target.value, propertyName: p ? String(p.nome) : e.target.value }))
                  }}>
                  <option value="">Seleccionar imóvel...</option>
                  {imoveisList.map(p => <option key={String(p.id)} value={String(p.id)}>{String(p.nome)} · {String(p.zona)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '5px' }}>Cliente</label>
                <select className="p-inp" value={newVisita.contactId}
                  onChange={e => {
                    const c = crmContacts.find(co => co.id === Number(e.target.value))
                    setNewVisita(nv => ({ ...nv, contactId: Number(e.target.value), contactName: c?.name || '' }))
                  }}>
                  <option value={0}>Seleccionar cliente...</option>
                  {crmContacts.map(c => <option key={c.id} value={c.id}>{c.name} · {c.status.toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '5px' }}>Data</label>
                  <input type="date" className="p-inp" value={newVisita.date} onChange={e => setNewVisita(nv => ({ ...nv, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '5px' }}>Hora</label>
                  <input type="time" className="p-inp" value={newVisita.time} onChange={e => setNewVisita(nv => ({ ...nv, time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '5px' }}>Notas</label>
                <textarea className="p-inp" rows={2} value={newVisita.notes}
                  onChange={e => setNewVisita(nv => ({ ...nv, notes: e.target.value }))}
                  placeholder="Preparação, documentos, preferências do cliente..."
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="p-btn" style={{ background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.6)' }} onClick={() => setShowNewVisita(false)}>Cancelar</button>
              <button className="p-btn p-btn-gold" onClick={() => {
                if (!newVisita.propertyId || !newVisita.contactId || !newVisita.date) return
                const v: Visita = { id: Date.now(), ...newVisita, status: 'agendada' }
                setVisitas(vs => [...vs, v])
                setShowNewVisita(false)
                setNewVisita({ propertyId: '', propertyName: '', contactId: 0, contactName: '', date: '', time: '10:00', notes: '' })
              }}>Agendar Visita</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {visitaFeedbackId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(12,31,21,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setVisitaFeedbackId(null)}>
          <div style={{ width: '460px', maxWidth: '95vw', background: '#fff', padding: '28px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '16px' }}>Feedback da Visita</div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px' }}>Interesse do Cliente</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setVisitaFeedback(f => ({ ...f, interesse: n }))}
                    style={{ width: '44px', height: '44px', background: visitaFeedback.interesse >= n ? 'rgba(201,169,110,.15)' : 'rgba(14,14,13,.04)', border: `1px solid ${visitaFeedback.interesse >= n ? '#c9a96e' : 'rgba(14,14,13,.1)'}`, cursor: 'pointer', fontSize: '1.1rem', color: visitaFeedback.interesse >= n ? '#c9a96e' : '#ccc' }}>★</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '5px' }}>Observações</div>
              <textarea className="p-inp" rows={3} value={visitaFeedback.observacoes}
                onChange={e => setVisitaFeedback(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Reacção do cliente, objecções, perguntas..."
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '5px' }}>Próximo Passo</div>
              <input className="p-inp" value={visitaFeedback.nextStep}
                onChange={e => setVisitaFeedback(f => ({ ...f, nextStep: e.target.value }))}
                placeholder="Ex: Enviar proposta, Segunda visita, Aguarda decisão..." />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="p-btn" style={{ background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.6)' }} onClick={() => setVisitaFeedbackId(null)}>Cancelar</button>
              <button className="p-btn p-btn-gold" onClick={() => {
                setVisitas(vs => vs.map(v => v.id === visitaFeedbackId ? {
                  ...v,
                  interestScore: visitaFeedback.interesse,
                  feedback: visitaFeedback.observacoes,
                  notes: v.notes + (visitaFeedback.nextStep ? ` | Próximo: ${visitaFeedback.nextStep}` : ''),
                } : v))
                setVisitaFeedbackId(null)
                setVisitaFeedback({ interesse: 3, observacoes: '', nextStep: '' })
              }}>Guardar Feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// React import needed for useState in this file
import React from 'react'
