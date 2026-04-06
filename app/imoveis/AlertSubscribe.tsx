'use client'
import { useState, type CSSProperties } from 'react'

interface AlertCriteria {
  email: string
  zona: string
  tipo: string
  precoMin: number
  precoMax: number
  quartosMin: number
  piscina: boolean
}

const ZONAS = ['Todas', 'Lisboa', 'Cascais', 'Comporta', 'Algarve', 'Porto', 'Sintra', 'Madeira', 'Açores']
const TIPOS = ['Todos', 'Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Cobertura', 'Quinta', 'Palacete']

export default function AlertSubscribe({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [criteria, setCriteria] = useState<AlertCriteria>({
    email: '',
    zona: 'Todas',
    tipo: 'Todos',
    precoMin: 0,
    precoMax: 10000000,
    quartosMin: 0,
    piscina: false,
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
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      })
      if (!res.ok) throw new Error('API error')
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
          background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1101,
        background: '#0a1a10',
        border: '1px solid rgba(201,169,110,.25)',
        width: '90vw', maxWidth: '520px',
        boxShadow: '0 24px 80px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid rgba(201,169,110,.12)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
              letterSpacing: '.18em', color: 'rgba(201,169,110,.6)',
              textTransform: 'uppercase', marginBottom: '6px',
            }}>Alertas de Imóveis</div>
            <div style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: '1.4rem', color: '#f4f0e6',
            }}>Seja o Primeiro a Saber</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(244,240,230,.35)', fontSize: '1.2rem',
          }}>✕</button>
        </div>

        <div style={{ padding: '24px 32px 32px' }}>
          {step === 'success' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✅</div>
              <div style={{
                fontFamily: "'Cormorant', serif", fontSize: '1.3rem',
                color: '#f4f0e6', marginBottom: '10px',
              }}>Alerta Criado com Sucesso!</div>
              <div style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
                color: 'rgba(244,240,230,.55)', lineHeight: 1.6,
              }}>
                Irá receber um email diário com os novos imóveis que correspondam ao seu perfil de pesquisa.
              </div>
              <button onClick={onClose} style={{
                marginTop: '24px',
                background: '#c9a96e', color: '#0c1f15',
                border: 'none', padding: '12px 32px',
                fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>Fechar</button>
            </div>
          ) : (
            <>
              <div style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
                color: 'rgba(244,240,230,.55)', marginBottom: '24px', lineHeight: 1.6,
              }}>
                Receba um email diário com novos imóveis que correspondam ao seu perfil.
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={criteria.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="o-seu@email.com"
                  style={inputStyle}
                />
              </div>

              {/* Zona + Tipo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Zona</label>
                  <select value={criteria.zona} onChange={e => update('zona', e.target.value)} style={inputStyle}>
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={criteria.tipo} onChange={e => update('tipo', e.target.value)} style={inputStyle}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Preço */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Preço Máximo</label>
                <select
                  value={criteria.precoMax}
                  onChange={e => update('precoMax', Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={500000}>Até €500.000</option>
                  <option value={1000000}>Até €1.000.000</option>
                  <option value={2000000}>Até €2.000.000</option>
                  <option value={3000000}>Até €3.000.000</option>
                  <option value={5000000}>Até €5.000.000</option>
                  <option value={10000000}>Sem limite</option>
                </select>
              </div>

              {/* Quartos */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Quartos Mínimos</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => update('quartosMin', n)}
                      style={{
                        flex: 1, padding: '8px 4px',
                        background: criteria.quartosMin === n ? '#c9a96e' : 'rgba(255,255,255,.04)',
                        border: `1px solid ${criteria.quartosMin === n ? '#c9a96e' : 'rgba(201,169,110,.2)'}`,
                        color: criteria.quartosMin === n ? '#0c1f15' : 'rgba(244,240,230,.6)',
                        fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                        cursor: 'pointer', fontWeight: criteria.quartosMin === n ? 700 : 400,
                      }}
                    >{n === 0 ? 'T+' : `T${n}+`}</button>
                  ))}
                </div>
              </div>

              {/* Piscina */}
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => update('piscina', !criteria.piscina)}
                  style={{
                    width: '20px', height: '20px',
                    background: criteria.piscina ? '#c9a96e' : 'rgba(255,255,255,.04)',
                    border: `1px solid ${criteria.piscina ? '#c9a96e' : 'rgba(201,169,110,.3)'}`,
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {criteria.piscina && <span style={{ color: '#0c1f15', fontSize: '.6rem', fontWeight: 700 }}>✓</span>}
                </button>
                <span style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
                  color: 'rgba(244,240,230,.65)',
                }}>Apenas imóveis com piscina</span>
              </div>

              {error && (
                <div style={{
                  color: '#e74c3c', fontFamily: "'Jost', sans-serif",
                  fontSize: '.62rem', marginBottom: '16px',
                }}>{error}</div>
              )}

              <button
                onClick={submit}
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? 'rgba(201,169,110,.3)' : '#c9a96e',
                  color: loading ? 'rgba(201,169,110,.4)' : '#0c1f15',
                  border: 'none', padding: '14px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                  fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all .2s',
                }}
              >
                {loading ? 'A guardar...' : 'Ativar Alertas Diários →'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
  letterSpacing: '.12em', color: 'rgba(201,169,110,.6)',
  textTransform: 'uppercase', marginBottom: '6px',
}

const inputStyle: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(201,169,110,.2)',
  color: '#f4f0e6', padding: '10px 12px',
  fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
  outline: 'none', boxSizing: 'border-box',
}
