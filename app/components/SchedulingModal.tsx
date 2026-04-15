'use client'
import { useState, type CSSProperties } from 'react'

interface SchedulingModalProps {
  propertyRef: string
  propertyName: string
  propertyPreco: string
  onClose: () => void
}

const TIME_SLOTS = ['09:00', '10:30', '12:00', '14:30', '16:00', '17:30']
const VISIT_TYPES = [
  { key: 'presencial', label: 'Visita Presencial', icon: '🏠' },
  { key: 'virtual', label: 'Tour Virtual', icon: '💻' },
]

function getNext14Days() {
  const days = []
  const today = new Date()
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push({
      date: d,
      dayName: weekDays[d.getDay()],
      dayNum: d.getDate(),
      month: months[d.getMonth()],
      disabled: d.getDay() === 0, // Sundays disabled
    })
  }
  return days
}

export default function SchedulingModal({ propertyRef, propertyName, propertyPreco, onClose }: SchedulingModalProps) {
  const [step, setStep] = useState(1)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [visitType, setVisitType] = useState('presencial')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)

  const days = getNext14Days()
  const selectedDayObj = selectedDay !== null ? days[selectedDay] : null

  const inputStyle: CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,169,110,.2)',
    color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
    outline: 'none', boxSizing: 'border-box',
  }

  function handleConfirm() {
    const dayLabel = selectedDayObj ? `${selectedDayObj.dayName} ${selectedDayObj.dayNum} ${selectedDayObj.month}` : ''
    const msg = `Olá, quero agendar uma visita ao imóvel ${propertyRef} — ${propertyName} (${propertyPreco}).\n\nData: ${dayLabel}\nHora: ${selectedTime}\nTipo: ${visitType === 'presencial' ? 'Visita Presencial' : 'Tour Virtual'}\nNome: ${nome}\nContacto: ${telefone}`
    // Open WhatsApp
    window.open(`https://wa.me/351919948986?text=${encodeURIComponent(msg)}`, '_blank')
    // Fire email confirmation (fire-and-forget)
    fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome, telefone, email: email || undefined,
        propertyRef, propertyName, propertyPreco,
        date: dayLabel, time: selectedTime, visitType,
      }),
    }).catch(err => console.error('[SchedulingModal] booking POST failed:', err?.message ?? err))
    setSuccess(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{ background: '#060d08', border: '1px solid rgba(201,169,110,.25)', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid rgba(201,169,110,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '6px' }}>{propertyRef}</div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.5rem', color: '#f4f0e6', margin: '0 0 4px' }}>Agendar Visita Privada</h2>
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.35)' }}>{propertyName} · {propertyPreco}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(244,240,230,.4)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', padding: '16px 32px', gap: '8px', alignItems: 'center' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step >= s ? '#c9a96e' : 'rgba(201,169,110,.1)',
                color: step >= s ? '#060d08' : 'rgba(201,169,110,.5)',
                fontFamily: "'DM Mono', monospace", fontSize: '.5rem', fontWeight: 700,
              }}>{s}</div>
              <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', color: step >= s ? 'rgba(244,240,230,.7)' : 'rgba(244,240,230,.25)' }}>
                {s === 1 ? 'Data' : s === 2 ? 'Hora' : 'Dados'}
              </span>
              {s < 3 && <div style={{ width: '20px', height: '1px', background: 'rgba(201,169,110,.2)' }} />}
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 32px 32px' }}>

          {success ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
              <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.8rem', color: '#f4f0e6', margin: '0 0 8px' }}>Pedido Enviado!</h3>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.45)', margin: '0 0 24px' }}>A nossa equipa confirma o agendamento via WhatsApp em menos de 2 horas.</p>
              <button onClick={onClose} style={{ background: '#c9a96e', color: '#060d08', border: 'none', padding: '12px 32px', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Fechar</button>
            </div>
          ) : step === 1 ? (
            <>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.18em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Escolher Data</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {days.map((d, i) => (
                  <button key={i} disabled={d.disabled}
                    onClick={() => { setSelectedDay(i); setStep(2) }}
                    style={{
                      background: selectedDay === i ? '#c9a96e' : d.disabled ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${selectedDay === i ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                      color: selectedDay === i ? '#060d08' : d.disabled ? 'rgba(255,255,255,.15)' : '#f4f0e6',
                      padding: '8px 4px', cursor: d.disabled ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', opacity: .7 }}>{d.dayName}</span>
                    <span style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', fontWeight: 300 }}>{d.dayNum}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', opacity: .6 }}>{d.month}</span>
                  </button>
                ))}
              </div>
            </>
          ) : step === 2 ? (
            <>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.18em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '6px' }}>Escolher Hora</div>
              {selectedDayObj && <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.45)', marginBottom: '16px' }}>{selectedDayObj.dayName}, {selectedDayObj.dayNum} de {selectedDayObj.month}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {TIME_SLOTS.map(t => (
                  <button key={t} onClick={() => { setSelectedTime(t); setStep(3) }}
                    style={{
                      background: selectedTime === t ? '#c9a96e' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${selectedTime === t ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                      color: selectedTime === t ? '#060d08' : '#f4f0e6',
                      padding: '14px', cursor: 'pointer',
                      fontFamily: "'Cormorant', serif", fontSize: '1.1rem', fontWeight: 300,
                    }}>{t}</button>
                ))}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '10px' }}>Tipo de Visita</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {VISIT_TYPES.map(vt => (
                    <button key={vt.key} onClick={() => setVisitType(vt.key)}
                      style={{
                        flex: 1, padding: '12px', cursor: 'pointer',
                        background: visitType === vt.key ? 'rgba(201,169,110,.12)' : 'rgba(255,255,255,.03)',
                        border: `1px solid ${visitType === vt.key ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                        color: visitType === vt.key ? '#c9a96e' : 'rgba(244,240,230,.55)',
                        fontFamily: "'Jost', sans-serif", fontSize: '.72rem', letterSpacing: '.08em',
                      }}>{vt.icon} {vt.label}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'rgba(201,169,110,.5)', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>← Voltar</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.18em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Os seus dados</div>
              <div style={{ background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.12)', padding: '14px', marginBottom: '20px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.7)' }}>
                📅 {selectedDayObj?.dayName} {selectedDayObj?.dayNum} {selectedDayObj?.month} · {selectedTime} · {visitType === 'presencial' ? 'Presencial' : 'Virtual'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <input placeholder="O seu nome completo" value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} />
                <input placeholder="WhatsApp / Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
                <input placeholder="Email (para confirmação — opcional)" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} type="email" />
              </div>
              <button
                onClick={handleConfirm}
                disabled={!nome || !telefone}
                style={{
                  width: '100%', background: nome && telefone ? '#c9a96e' : 'rgba(201,169,110,.3)',
                  color: nome && telefone ? '#060d08' : 'rgba(6,13,8,.5)',
                  border: 'none', padding: '16px', cursor: nome && telefone ? 'pointer' : 'not-allowed',
                  fontFamily: "'Jost', sans-serif", fontSize: '.68rem', fontWeight: 700,
                  letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: '10px',
                }}>Confirmar Agendamento →</button>
              <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'rgba(201,169,110,.5)', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>← Voltar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
