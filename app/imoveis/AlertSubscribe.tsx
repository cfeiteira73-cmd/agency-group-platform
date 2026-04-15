'use client'
import { useState, type CSSProperties } from 'react'
import { track } from '@/lib/gtm'

interface AlertCriteria {
  email: string
  zona: string
  tipo: string
  precoMin: number
  precoMax: number
  quartosMin: number
  piscina: boolean
  purpose: string
  keyword: string
}

const ZONAS = ['Todas', 'Lisboa', 'Cascais', 'Comporta', 'Porto', 'Algarve', 'Sintra', 'Madeira', 'Açores', 'Ericeira', 'Arrábida']
const TIPOS = ['Todos', 'Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Cobertura', 'Quinta', 'Palacete']
const PRECO_OPTIONS = [
  { label: 'Qualquer preço', value: 10000000 },
  { label: 'Até €500K', value: 500000 },
  { label: 'Até €1M', value: 1000000 },
  { label: 'Até €2M', value: 2000000 },
  { label: 'Até €3M', value: 3000000 },
  { label: 'Até €5M', value: 5000000 },
]
const PURPOSE_OPTIONS = [
  { label: 'Habitação Própria', value: 'buy' },
  { label: 'Investimento', value: 'invest' },
  { label: 'Ambos', value: 'both' },
]

interface AlertSubscribeProps {
  onClose: () => void
  /** Pre-populate with current search filters */
  initialCriteria?: Partial<AlertCriteria>
  source?: string
}

export default function AlertSubscribe({ onClose, initialCriteria, source = 'imoveis_page' }: AlertSubscribeProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [criteria, setCriteria] = useState<AlertCriteria>({
    email: '',
    zona: initialCriteria?.zona || 'Todas',
    tipo: initialCriteria?.tipo || 'Todos',
    precoMin: initialCriteria?.precoMin || 0,
    precoMax: initialCriteria?.precoMax || 10000000,
    quartosMin: initialCriteria?.quartosMin || 0,
    piscina: initialCriteria?.piscina || false,
    purpose: initialCriteria?.purpose || 'buy',
    keyword: initialCriteria?.keyword || '',
  })

  const update = <K extends keyof AlertCriteria>(k: K, v: AlertCriteria[K]) =>
    setCriteria(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (!criteria.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Por favor insira um email válido.')
      return
    }
    setLoading(true)
    setError('')

    // Track submission attempt
    track('saved_search_submitted', {
      zona: criteria.zona,
      tipo: criteria.tipo,
      preco_max: criteria.precoMax,
      quartos_min: criteria.quartosMin,
      purpose: criteria.purpose,
      source,
    })

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...criteria, source }),
      })
      if (!res.ok) throw new Error('API error')

      // Track success
      track('saved_search_success', {
        zona: criteria.zona,
        tipo: criteria.tipo,
        purpose: criteria.purpose,
        source,
      })
      track('alert_optin', { email_domain: criteria.email.split('@')[1], source })

      setStep('success')
    } catch {
      setError('Erro ao guardar. Por favor tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-label="Guardar Pesquisa" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1101,
        background: '#0a1a10',
        border: '1px solid rgba(201,169,110,.3)',
        width: '92vw', maxWidth: '540px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 32px 100px rgba(0,0,0,.7)',
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 20px',
          borderBottom: '1px solid rgba(201,169,110,.12)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 0, background: '#0a1a10', zIndex: 2,
        }}>
          <div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
              letterSpacing: '.2em', color: 'rgba(201,169,110,.55)',
              textTransform: 'uppercase', marginBottom: '6px',
            }}>Alertas Exclusivos · Agency Group</div>
            <div style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: '1.5rem', color: '#f4f0e6', lineHeight: 1.15,
            }}>Seja o Primeiro a Saber</div>
            <div style={{
              fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
              color: 'rgba(244,240,230,.4)', marginTop: '4px',
            }}>Alertas imediatos quando surgir o imóvel certo.</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(244,240,230,.4)', fontSize: '1.1rem',
              padding: '4px', lineHeight: 1,
            }}>✕</button>
        </div>

        <div style={{ padding: '24px 32px 32px' }}>
          {step === 'success' ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'rgba(28,74,53,.4)', border: '1px solid rgba(201,169,110,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: '1.4rem',
              }}>✓</div>
              <div style={{
                fontFamily: "'Cormorant', serif", fontSize: '1.4rem',
                color: '#f4f0e6', marginBottom: '10px', fontWeight: 300,
              }}>Alerta Ativado</div>
              <div style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.7rem',
                color: 'rgba(244,240,230,.5)', lineHeight: 1.7, marginBottom: '24px',
              }}>
                Será notificado imediatamente quando surgir um imóvel que corresponda ao seu perfil.
                Verifique o seu email para confirmação.
              </div>
              <button onClick={onClose} style={{
                background: '#c9a96e', color: '#0c1f15',
                border: 'none', padding: '13px 36px',
                fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>Ver Imóveis Agora →</button>
            </div>
          ) : (
            <>
              {/* Zona + Tipo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Zona <span style={{ opacity: .5, fontSize: '.85em' }}>(opcional)</span></label>
                  <select value={criteria.zona} onChange={e => update('zona', e.target.value)} style={inputStyle}>
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo <span style={{ opacity: .5, fontSize: '.85em' }}>(opcional)</span></label>
                  <select value={criteria.tipo} onChange={e => update('tipo', e.target.value)} style={inputStyle}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Preço Max */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Preço Máximo</label>
                <select value={criteria.precoMax} onChange={e => update('precoMax', Number(e.target.value))} style={inputStyle}>
                  {PRECO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Quartos */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Quartos Mínimos</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n} type="button"
                      onClick={() => update('quartosMin', n)}
                      style={{
                        flex: 1, padding: '9px 4px',
                        background: criteria.quartosMin === n ? '#c9a96e' : 'rgba(255,255,255,.04)',
                        border: `1px solid ${criteria.quartosMin === n ? '#c9a96e' : 'rgba(201,169,110,.18)'}`,
                        color: criteria.quartosMin === n ? '#0c1f15' : 'rgba(244,240,230,.55)',
                        fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                        cursor: 'pointer', fontWeight: criteria.quartosMin === n ? 700 : 400,
                        transition: 'all .15s',
                      }}
                    >{n === 0 ? 'T+' : `T${n}+`}</button>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Objetivo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PURPOSE_OPTIONS.map(o => (
                    <button
                      key={o.value} type="button"
                      onClick={() => update('purpose', o.value)}
                      style={{
                        flex: 1, padding: '9px 6px',
                        background: criteria.purpose === o.value ? '#1c4a35' : 'rgba(255,255,255,.03)',
                        border: `1px solid ${criteria.purpose === o.value ? 'rgba(201,169,110,.4)' : 'rgba(201,169,110,.14)'}`,
                        color: criteria.purpose === o.value ? '#c9a96e' : 'rgba(244,240,230,.45)',
                        fontFamily: "'Jost', sans-serif", fontSize: '.58rem',
                        cursor: 'pointer', transition: 'all .15s', letterSpacing: '.04em',
                      }}
                    >{o.label}</button>
                  ))}
                </div>
              </div>

              {/* Piscina + Keyword row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => update('piscina', !criteria.piscina)}
                    style={{
                      width: '20px', height: '20px',
                      background: criteria.piscina ? '#c9a96e' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${criteria.piscina ? '#c9a96e' : 'rgba(201,169,110,.25)'}`,
                      cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}
                  >
                    {criteria.piscina && <span style={{ color: '#0c1f15', fontSize: '.55rem', fontWeight: 700 }}>✓</span>}
                  </button>
                  <span style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                    color: 'rgba(244,240,230,.55)', whiteSpace: 'nowrap',
                  }}>Piscina</span>
                </div>
                <div>
                  <label style={labelStyle}>Palavra-chave (opcional)</label>
                  <input
                    type="text"
                    value={criteria.keyword}
                    onChange={e => update('keyword', e.target.value)}
                    placeholder='Ex: "frente mar", "golf", "off-market"'
                    maxLength={120}
                    style={{ ...inputStyle, fontSize: '.65rem' }}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={criteria.email}
                  onChange={e => update('email', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="o-seu@email.com"
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{
                  color: '#e74c3c', fontFamily: "'Jost', sans-serif",
                  fontSize: '.62rem', marginBottom: '14px',
                }}>{error}</div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? 'rgba(201,169,110,.25)' : '#c9a96e',
                  color: loading ? 'rgba(201,169,110,.35)' : '#0c1f15',
                  border: 'none', padding: '15px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                  fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all .2s',
                }}
              >
                {loading ? 'A guardar...' : 'Ativar Alertas Gratuitos →'}
              </button>

              <div style={{
                marginTop: '12px', textAlign: 'center',
                fontFamily: "'Jost', sans-serif", fontSize: '.58rem',
                color: 'rgba(244,240,230,.25)', lineHeight: 1.6,
              }}>
                Zero spam. Cancelar a qualquer momento.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
  letterSpacing: '.14em', color: 'rgba(201,169,110,.55)',
  textTransform: 'uppercase', marginBottom: '6px',
}

const inputStyle: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(201,169,110,.18)',
  color: '#f4f0e6', padding: '10px 12px',
  fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .15s',
}
