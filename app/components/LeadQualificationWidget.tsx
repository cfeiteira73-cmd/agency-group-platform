'use client'

import { useState } from 'react'

interface LeadQualificationWidgetProps {
  contactId?: string
  onComplete?: (data: QualificationData) => void
  onDismiss?: () => void
}

interface QualificationData {
  use_type: string
  budget_max: number
  timeline: string
}

const BUDGETS = [
  { label: '< €200K', min: 0, max: 200000 },
  { label: '€200K–€500K', min: 200000, max: 500000 },
  { label: '€500K–€1M', min: 500000, max: 1000000 },
  { label: '€1M–€3M', min: 1000000, max: 3000000 },
  { label: '€3M+', min: 3000000, max: 10000000 },
]

const TIMELINES = [
  { label: 'Urgente (< 3 meses)', value: 'urgent' },
  { label: 'Em breve (3–6 meses)', value: 'short' },
  { label: 'Este ano (6–12 meses)', value: 'medium' },
  { label: 'Longo prazo (1–2 anos)', value: 'long' },
  { label: 'Só a explorar', value: 'exploring' },
]

export default function LeadQualificationWidget({
  contactId,
  onComplete,
  onDismiss,
}: LeadQualificationWidgetProps) {
  const [step, setStep] = useState(0)
  const [useType, setUseType] = useState('')
  const [budget, setBudget] = useState<{ min: number; max: number } | null>(null)
  const [timeline, setTimeline] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const total = 3

  async function finish(tl: string) {
    if (!useType || !budget) return
    setSaving(true)

    const payload: QualificationData = {
      use_type: useType,
      budget_max: budget.max,
      timeline: tl,
    }

    try {
      if (contactId) {
        // Update existing contact
        await fetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            use_type: useType,
            budget_min: budget.min,
            budget_max: budget.max,
            timeline: tl,
          }),
        })
      }
      // Always call leads endpoint to upsert qualification data if we have it
      onComplete?.(payload)
      setDone(true)
    } catch {
      // Silent fail — never block UX on qualification
      onComplete?.(payload)
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div style={styles.card}>
        <div style={styles.doneIcon}>✓</div>
        <p style={styles.doneTitle}>Obrigado!</p>
        <p style={styles.doneText}>A sua informação ajuda-nos a encontrar o imóvel certo para si.</p>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      {/* Progress */}
      <div style={styles.progress}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.progressDot,
              background: i <= step ? '#c9a96e' : 'rgba(201,169,110,0.2)',
            }}
          />
        ))}
      </div>

      {/* Step 0 — Objetivo */}
      {step === 0 && (
        <>
          <p style={styles.question}>Qual o seu objectivo?</p>
          <div style={styles.options}>
            {[
              { label: 'Habitação própria', value: 'habitacao' },
              { label: 'Investimento / Renda', value: 'investimento' },
              { label: 'Residência secundária', value: 'secundaria' },
              { label: 'Golden Visa / NHR', value: 'golden_visa' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                style={{
                  ...styles.optBtn,
                  ...(useType === opt.value ? styles.optBtnActive : {}),
                }}
                onClick={() => {
                  setUseType(opt.value)
                  setStep(1)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 1 — Budget */}
      {step === 1 && (
        <>
          <p style={styles.question}>Qual o orçamento?</p>
          <div style={styles.options}>
            {BUDGETS.map(b => (
              <button
                key={b.label}
                type="button"
                style={{
                  ...styles.optBtn,
                  ...(budget?.max === b.max ? styles.optBtnActive : {}),
                }}
                onClick={() => {
                  setBudget({ min: b.min, max: b.max })
                  setStep(2)
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 2 — Timeline */}
      {step === 2 && (
        <>
          <p style={styles.question}>Quando pretende comprar?</p>
          <div style={styles.options}>
            {TIMELINES.map(t => (
              <button
                key={t.value}
                type="button"
                style={{
                  ...styles.optBtn,
                  ...(timeline === t.value ? styles.optBtnActive : {}),
                  opacity: saving ? 0.6 : 1,
                }}
                disabled={saving}
                onClick={() => {
                  setTimeline(t.value)
                  finish(t.value)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        style={styles.dismiss}
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative',
    background: '#fff',
    border: '1px solid rgba(201,169,110,0.25)',
    padding: '24px 28px',
    maxWidth: 380,
    boxShadow: '0 8px 32px rgba(12,31,21,0.12)',
  },
  progress: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    width: 28,
    height: 3,
    borderRadius: 2,
    transition: 'background 0.3s',
  },
  question: {
    fontFamily: "'Cormorant', serif",
    fontSize: '1.1rem',
    fontWeight: 300,
    color: '#0c1f15',
    lineHeight: 1.35,
    marginBottom: '1rem',
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  optBtn: {
    background: 'transparent',
    border: '1px solid rgba(14,14,13,0.15)',
    padding: '10px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
    fontSize: '0.82rem',
    fontWeight: 400,
    color: 'rgba(14,14,13,0.7)',
    transition: 'all 0.2s',
  },
  optBtnActive: {
    border: '1px solid #c9a96e',
    background: 'rgba(201,169,110,0.08)',
    color: '#0c1f15',
    fontWeight: 500,
  },
  dismiss: {
    position: 'absolute',
    top: 12,
    right: 16,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.2rem',
    color: 'rgba(14,14,13,0.3)',
    lineHeight: 1,
    padding: '2px 6px',
  },
  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(28,74,53,0.1)',
    border: '1px solid #1c4a35',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    color: '#1c4a35',
    marginBottom: '1rem',
  },
  doneTitle: {
    fontFamily: "'Cormorant', serif",
    fontSize: '1.2rem',
    fontWeight: 300,
    color: '#0c1f15',
    marginBottom: '0.5rem',
  },
  doneText: {
    fontSize: '0.82rem',
    color: 'rgba(14,14,13,0.6)',
    lineHeight: 1.6,
  },
}
