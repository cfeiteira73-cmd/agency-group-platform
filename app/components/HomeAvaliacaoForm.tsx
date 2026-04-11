'use client'

import { useState } from 'react'

// ─── Avaliação Privada form — salva lead no CRM antes de abrir WhatsApp ────────

export default function HomeAvaliacaoForm() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submitAvaliacao() {
    const nome = (document.getElementById('avalNome') as HTMLInputElement)?.value?.trim() || ''
    const tel  = (document.getElementById('avalTel')  as HTMLInputElement)?.value?.trim() || ''
    const zona = (document.getElementById('avalZona') as HTMLInputElement)?.value?.trim() || ''

    if (!nome || !tel) {
      window.dispatchEvent(new CustomEvent('ag:toast', {
        detail: { msg: 'Por favor preenche o nome e telefone.', type: 'error' }
      }))
      return
    }

    setLoading(true)

    // Save to CRM first (fire-and-forget — never block UX)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    nome,
          phone:   tel.replace(/\s/g, ''),
          source:  'avaliacao_privada',
          zona:    zona || undefined,
          message: `Pedido de avaliação privada · ${zona || 'zona não indicada'}`,
        }),
      })
    } catch { /* silent — never block the WA redirect */ }

    setSent(true)
    setLoading(false)

    // Open WhatsApp with context
    window.open(
      `https://wa.me/351919948986?text=${encodeURIComponent(
        `Pedido de avaliação privada:\nNome: ${nome}\nTelefone: ${tel}${zona ? `\nZona: ${zona}` : ''}`
      )}`,
      '_blank'
    )
  }

  if (sent) {
    return (
      <div style={{
        marginTop: '8px',
        padding: '14px 18px',
        background: 'rgba(28,74,53,0.08)',
        border: '1px solid rgba(28,74,53,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ color: '#1c4a35', fontSize: '1rem' }}>✓</span>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '.52rem',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: '#1c4a35',
        }}>
          Pedido recebido — respondemos em menos de 2h
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={submitAvaliacao}
      disabled={loading}
      style={{
        marginTop: '8px',
        padding: '14px',
        background: loading ? 'rgba(28,74,53,0.6)' : '#1c4a35',
        color: '#f4f0e6',
        border: 'none',
        fontFamily: "'DM Mono', monospace",
        fontSize: '.52rem',
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontWeight: 400,
        transition: 'background .25s, transform .2s',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!loading) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
          ;(e.currentTarget as HTMLButtonElement).style.background = '#16382a'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLButtonElement).style.background = loading ? 'rgba(28,74,53,0.6)' : '#1c4a35'
      }}
    >
      {loading ? 'A processar...' : 'Pedir Avaliação Privada →'}
    </button>
  )
}
