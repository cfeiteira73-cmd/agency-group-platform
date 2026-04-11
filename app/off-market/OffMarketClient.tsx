'use client'

// =============================================================================
// OFF-MARKET CLIENT — Agency Group
// Invite-only feel. Lead capture → CRM → WhatsApp handoff
// NEVER shows listings. Exclusive access form only.
// =============================================================================

import { useState } from 'react'

const STATS = [
  { value: '€2.4M', label: 'Valor médio\ntransaccionado' },
  { value: '72h', label: 'Tempo médio\nde proposta' },
  { value: '100%', label: 'Discrição\ngarantida' },
]

const TYPES = [
  { id: 'comprador', label: 'Procuro imóvel exclusivo' },
  { id: 'vendedor', label: 'Quero vender discretamente' },
  { id: 'investidor', label: 'Procuro oportunidade de investimento' },
]

const BUDGETS = [
  { id: '500-1m', label: '€500K – €1M' },
  { id: '1m-3m', label: '€1M – €3M' },
  { id: '3m-10m', label: '€3M – €10M' },
  { id: '10m+', label: '€10M+' },
]

export default function OffMarketClient() {
  const [step, setStep] = useState<'form' | 'sent'>('form')
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState('')
  const [budget, setBudget] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [zona, setZona] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !tipo) return

    setLoading(true)

    const budgetMap: Record<string, number> = {
      '500-1m': 1_000_000,
      '1m-3m': 3_000_000,
      '3m-10m': 10_000_000,
      '10m+': 50_000_000,
    }

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim().replace(/\s/g, ''),
          source: 'off_market_page',
          zona: zona.trim() || undefined,
          budget_max: budget ? budgetMap[budget] : undefined,
          use_type: tipo,
          message: `Off-market: ${TYPES.find(t => t.id === tipo)?.label}${budget ? ` · ${budget}` : ''}${zona ? ` · ${zona}` : ''}`,
        }),
      })
    } catch { /* silent — never block redirect */ }

    setStep('sent')
    setLoading(false)
  }

  function openWhatsApp() {
    const budgetLabel = BUDGETS.find(b => b.id === budget)?.label || ''
    const tipoLabel = TYPES.find(t => t.id === tipo)?.label || ''
    const text = `Pedido de acesso off-market:\nNome: ${name}\nTelefone: ${phone}${tipoLabel ? `\nPerfil: ${tipoLabel}` : ''}${budgetLabel ? `\nOrçamento: ${budgetLabel}` : ''}${zona ? `\nZona: ${zona}` : ''}`
    window.open(`https://wa.me/351919948986?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#0c1f15',
      color: '#f4f0e6',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Nav strip */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 40px',
        borderBottom: '1px solid rgba(201,169,110,0.1)',
      }}>
        <a href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textDecoration: 'none',
        }}>
          <span style={{ color: '#c9a96e', fontSize: '1rem', letterSpacing: '0.08em', fontWeight: 600 }}>Agency</span>
          <span style={{ color: '#f4f0e6', fontSize: '1rem', letterSpacing: '0.08em', fontWeight: 400 }}>Group</span>
        </a>
        <a href="/imoveis" style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.6rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(244,240,230,0.45)',
          textDecoration: 'none',
        }}>
          Ver Imóveis Públicos →
        </a>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        maxWidth: 680,
        margin: '0 auto',
        width: '100%',
      }}>

        {/* Label */}
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.55rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#c9a96e',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ display: 'inline-block', width: 28, height: 1, background: '#c9a96e', opacity: 0.6 }} />
          Acesso Reservado
          <span style={{ display: 'inline-block', width: 28, height: 1, background: '#c9a96e', opacity: 0.6 }} />
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          fontWeight: 400,
          lineHeight: 1.15,
          textAlign: 'center',
          marginBottom: 20,
          letterSpacing: '-0.01em',
        }}>
          Imóveis que nunca<br />
          <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>chegam ao mercado.</em>
        </h1>

        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.7rem',
          lineHeight: 1.7,
          color: 'rgba(244,240,230,0.55)',
          textAlign: 'center',
          maxWidth: 480,
          marginBottom: 48,
          letterSpacing: '0.03em',
        }}>
          Transacções privadas entre compradores seleccionados e proprietários discretos.
          Sem anúncios. Sem intermediários. Apenas resultados.
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 40,
          marginBottom: 56,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {STATS.map(s => (
            <div key={s.value} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                fontWeight: 600,
                color: '#c9a96e',
                lineHeight: 1,
                marginBottom: 6,
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(244,240,230,0.35)',
                whiteSpace: 'pre-line',
                lineHeight: 1.4,
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Form or Confirmation */}
        {step === 'sent' ? (
          <div style={{
            width: '100%',
            background: 'rgba(28,74,53,0.12)',
            border: '1px solid rgba(201,169,110,0.2)',
            padding: '40px 32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 16, color: '#c9a96e' }}>✓</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 400, marginBottom: 12 }}>
              Pedido recebido
            </h2>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.65rem',
              color: 'rgba(244,240,230,0.5)',
              letterSpacing: '0.06em',
              marginBottom: 28,
              lineHeight: 1.7,
            }}>
              O Carlos Gomes entrará em contacto em menos de 2 horas.<br />
              Para acesso imediato, fale directamente via WhatsApp.
            </p>
            <button
              type="button"
              onClick={openWhatsApp}
              style={{
                background: '#1c4a35',
                color: '#f4f0e6',
                border: '1px solid rgba(201,169,110,0.3)',
                padding: '14px 32px',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              WhatsApp Directo →
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(201,169,110,0.12)',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.6rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(244,240,230,0.35)',
              marginBottom: 4,
            }}>
              Solicitar Acesso
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(244,240,230,0.4)',
              }}>
                Perfil *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipo(t.id)}
                    style={{
                      background: tipo === t.id ? 'rgba(28,74,53,0.4)' : 'transparent',
                      border: `1px solid ${tipo === t.id ? 'rgba(201,169,110,0.4)' : 'rgba(244,240,230,0.1)'}`,
                      color: tipo === t.id ? '#f4f0e6' : 'rgba(244,240,230,0.55)',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '0.62rem',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(244,240,230,0.4)',
              }}>
                Orçamento / Valor
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
              }}>
                {BUDGETS.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudget(b.id)}
                    style={{
                      background: budget === b.id ? 'rgba(28,74,53,0.4)' : 'transparent',
                      border: `1px solid ${budget === b.id ? 'rgba(201,169,110,0.4)' : 'rgba(244,240,230,0.1)'}`,
                      color: budget === b.id ? '#f4f0e6' : 'rgba(244,240,230,0.55)',
                      padding: '10px 12px',
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '0.6rem',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zona */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                htmlFor="om-zona"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.55rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(244,240,230,0.4)',
                }}
              >
                Zona preferida
              </label>
              <input
                id="om-zona"
                type="text"
                placeholder="Lisboa, Cascais, Comporta..."
                value={zona}
                onChange={e => setZona(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(244,240,230,0.12)',
                  color: '#f4f0e6',
                  padding: '12px 16px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.65rem',
                  letterSpacing: '0.04em',
                  outline: 'none',
                }}
              />
            </div>

            {/* Name + Phone row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  htmlFor="om-name"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.55rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(244,240,230,0.4)',
                  }}
                >
                  Nome *
                </label>
                <input
                  id="om-name"
                  type="text"
                  placeholder="O seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(244,240,230,0.12)',
                    color: '#f4f0e6',
                    padding: '12px 16px',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.65rem',
                    letterSpacing: '0.04em',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  htmlFor="om-phone"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.55rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(244,240,230,0.4)',
                  }}
                >
                  Telefone *
                </label>
                <input
                  id="om-phone"
                  type="tel"
                  placeholder="+351 9XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(244,240,230,0.12)',
                    color: '#f4f0e6',
                    padding: '12px 16px',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.65rem',
                    letterSpacing: '0.04em',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !name.trim() || !phone.trim() || !tipo}
              style={{
                marginTop: 8,
                background: loading || !name.trim() || !phone.trim() || !tipo
                  ? 'rgba(28,74,53,0.4)'
                  : '#1c4a35',
                color: '#f4f0e6',
                border: '1px solid rgba(201,169,110,0.25)',
                padding: '16px',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                cursor: loading || !name.trim() || !phone.trim() || !tipo ? 'not-allowed' : 'pointer',
                transition: 'background 0.25s',
              }}
            >
              {loading ? 'A processar...' : 'Solicitar Acesso Privado →'}
            </button>

            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.5rem',
              color: 'rgba(244,240,230,0.22)',
              textAlign: 'center',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
            }}>
              Informação tratada com total discrição. AMI 22506.<br />
              Não partilhamos dados com terceiros.
            </p>
          </form>
        )}

        {/* Bottom note */}
        <div style={{
          marginTop: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          opacity: 0.35,
        }}>
          <span style={{ width: 40, height: 1, background: '#c9a96e', display: 'inline-block' }} />
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '0.5rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c9a96e',
          }}>
            Agency Group · AMI 22506 · Mediação Imobiliária
          </span>
          <span style={{ width: 40, height: 1, background: '#c9a96e', display: 'inline-block' }} />
        </div>
      </section>
    </main>
  )
}
