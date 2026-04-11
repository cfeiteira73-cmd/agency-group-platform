'use client'

import { useState } from 'react'

interface LeadCaptureFormProps {
  source?: string
  zona?: string
  propertyRef?: string
  placeholder?: string
  ctaLabel?: string
  showQualification?: boolean
  onSuccess?: (id: string) => void
  variant?: 'inline' | 'modal' | 'sidebar'
}

export default function LeadCaptureForm({
  source = 'website',
  zona,
  propertyRef,
  placeholder = 'O seu email ou telemóvel',
  ctaLabel = 'Receber Informações',
  variant = 'inline',
  onSuccess,
}: LeadCaptureFormProps) {
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<'form' | 'qualification' | 'done'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contactId, setContactId] = useState('')

  // Detect email vs phone
  const isEmail = value.includes('@')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return

    setLoading(true)
    setError('')

    try {
      const payload: Record<string, string | undefined> = {
        source,
        zona,
        property_ref: propertyRef,
        name: name || undefined,
      }

      if (isEmail) {
        payload.email = value.trim()
      } else {
        payload.phone = value.replace(/\s/g, '')
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError('Erro ao processar. Tente via WhatsApp.')
        return
      }

      setContactId(data.id || '')
      setStep('qualification')
      onSuccess?.(data.id || '')
    } catch {
      setError('Erro de ligação. Tente via WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div style={styles.done}>
        <span style={{ color: '#1c4a35', fontSize: '1.2rem' }}>✓</span>
        <p style={styles.doneText}>Recebemos o seu pedido. Respondemos em menos de 2h.</p>
        <a
          href="https://wa.me/351910000000"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.waBtn}
        >
          Falar no WhatsApp →
        </a>
      </div>
    )
  }

  if (step === 'qualification') {
    // Inline 3-step qualification
    return (
      <QualificationInline
        contactId={contactId}
        onComplete={() => setStep('done')}
        onSkip={() => setStep('done')}
      />
    )
  }

  const isInline = variant === 'inline'

  return (
    <form
      onSubmit={handleSubmit}
      style={isInline ? styles.inlineForm : styles.stackedForm}
      noValidate
    >
      {!isInline && (
        <input
          type="text"
          placeholder="Nome (opcional)"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ ...styles.input, marginBottom: 8 }}
          autoComplete="name"
        />
      )}
      <div style={isInline ? styles.inlineRow : styles.stackedRow}>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          required
          style={styles.input}
          autoComplete="email"
          inputMode={isEmail ? 'email' : 'tel'}
          aria-label="Email ou telemóvel"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          style={{
            ...styles.submitBtn,
            opacity: loading || !value.trim() ? 0.6 : 1,
            cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '...' : ctaLabel}
        </button>
      </div>
      {error && (
        <p style={styles.error}>{error}</p>
      )}
      <p style={styles.privacy}>
        Sem spam. Dados protegidos conforme RGPD. Pode cancelar a qualquer momento.
      </p>
    </form>
  )
}

// ─── Inline qualification (3 quick taps) ─────────────────────────────────────

interface QualInlineProps {
  contactId: string
  onComplete: () => void
  onSkip: () => void
}

function QualificationInline({ contactId, onComplete, onSkip }: QualInlineProps) {
  const [step, setStep] = useState(0)
  const [useType, setUseType] = useState('')
  const [budgetMax, setBudgetMax] = useState(0)

  async function save(timeline: string) {
    if (contactId) {
      fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_type: useType, budget_max: budgetMax, timeline }),
      }).catch(() => {})
    }
    onComplete()
  }

  const questions = [
    {
      q: 'Qual o seu objectivo?',
      opts: [
        { l: 'Habitação própria', v: 'habitacao' },
        { l: 'Investimento', v: 'investimento' },
        { l: 'Segunda residência', v: 'secundaria' },
        { l: 'Golden Visa', v: 'golden_visa' },
      ],
      onPick: (v: string) => { setUseType(v); setStep(1) },
    },
    {
      q: 'Orçamento?',
      opts: [
        { l: '< €200K', v: '200000' },
        { l: '€200K–€500K', v: '500000' },
        { l: '€500K–€1M', v: '1000000' },
        { l: '€1M+', v: '3000000' },
      ],
      onPick: (v: string) => { setBudgetMax(parseInt(v)); setStep(2) },
    },
    {
      q: 'Quando pretende comprar?',
      opts: [
        { l: 'Urgente (< 3m)', v: 'urgent' },
        { l: 'Em breve (3–6m)', v: 'short' },
        { l: 'Este ano', v: 'medium' },
        { l: 'Só a explorar', v: 'exploring' },
      ],
      onPick: (v: string) => save(v),
    },
  ]

  const current = questions[step]

  return (
    <div style={styles.qualBox}>
      <div style={styles.qualStep}>
        {step + 1}/{questions.length}
      </div>
      <p style={styles.qualQ}>{current.q}</p>
      <div style={styles.qualOpts}>
        {current.opts.map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => current.onPick(opt.v)}
            style={styles.qualBtn}
          >
            {opt.l}
          </button>
        ))}
      </div>
      <button type="button" onClick={onSkip} style={styles.skipBtn}>
        Saltar →
      </button>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  inlineForm: { width: '100%' },
  stackedForm: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  inlineRow: { display: 'flex', gap: 0, width: '100%' },
  stackedRow: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  input: {
    flex: 1,
    padding: '13px 16px',
    border: '1px solid rgba(14,14,13,0.18)',
    fontSize: '0.85rem',
    fontFamily: "'Jost', sans-serif",
    color: '#0e0e0d',
    background: '#fff',
    outline: 'none',
    minWidth: 0,
  },
  submitBtn: {
    background: '#1c4a35',
    color: '#f4f0e6',
    border: 'none',
    padding: '13px 20px',
    fontFamily: "'DM Mono', monospace",
    fontSize: '0.5rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 400,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  error: {
    fontSize: '0.75rem',
    color: '#c44',
    marginTop: 6,
    fontFamily: "'Jost', sans-serif",
  },
  privacy: {
    fontSize: '0.65rem',
    color: 'rgba(14,14,13,0.35)',
    marginTop: 8,
    fontFamily: "'Jost', sans-serif",
    lineHeight: 1.5,
  },
  done: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px 0',
  },
  doneText: {
    fontSize: '0.85rem',
    fontFamily: "'Jost', sans-serif",
    color: 'rgba(14,14,13,0.7)',
    lineHeight: 1.5,
  },
  waBtn: {
    display: 'inline-block',
    background: '#1c4a35',
    color: '#f4f0e6',
    padding: '10px 20px',
    textDecoration: 'none',
    fontFamily: "'DM Mono', monospace",
    fontSize: '0.5rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  qualBox: {
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  qualStep: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '0.45rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c9a96e',
  },
  qualQ: {
    fontFamily: "'Cormorant', serif",
    fontSize: '1.05rem',
    fontWeight: 300,
    color: '#0c1f15',
    margin: 0,
  },
  qualOpts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  qualBtn: {
    background: 'transparent',
    border: '1px solid rgba(14,14,13,0.2)',
    padding: '8px 14px',
    cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
    fontSize: '0.8rem',
    color: 'rgba(14,14,13,0.7)',
    transition: 'all 0.15s',
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
    fontSize: '0.45rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(14,14,13,0.3)',
    padding: 0,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
}
