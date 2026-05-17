'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// /dashboard/onboarding — Agent Activation Wizard
// 6 steps · <15 minutes · viral invite loop
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  ONBOARDING_STEPS,
  type OnboardingProgress,
  type OnboardingStep,
} from '@/lib/distribution-engine'

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:         '#0c1f15',
  card:       '#111e16',
  border:     'rgba(201,169,110,0.15)',
  goldBorder: 'rgba(201,169,110,0.28)',
  divider:    'rgba(201,169,110,0.08)',
  gold:       '#c9a96e',
  goldDim:    'rgba(201,169,110,0.12)',
  cream:      '#f4f0e6',
  cream55:    'rgba(244,240,230,0.55)',
  cream28:    'rgba(244,240,230,0.28)',
  green:      '#4ade80',
  greenDim:   'rgba(74,222,128,0.08)',
  greenBorder:'rgba(74,222,128,0.25)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  progress: OnboardingProgress
  is_new?: boolean
  success?: boolean
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  status,
  onAction,
  loading,
}: {
  step: typeof ONBOARDING_STEPS[number]
  status: 'completed' | 'current' | 'locked'
  onAction: (s: OnboardingStep) => void
  loading: boolean
}) {
  const isCurrent = status === 'current'
  const isDone    = status === 'completed'
  const isLocked  = status === 'locked'

  return (
    <div style={{
      background: isCurrent
        ? 'linear-gradient(135deg, rgba(201,169,110,0.08) 0%, #111e16 100%)'
        : C.card,
      border: `1px solid ${isCurrent ? C.goldBorder : isDone ? 'rgba(74,222,128,0.2)' : C.border}`,
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 18,
      transition: 'border-color 0.2s',
      opacity: isLocked ? 0.45 : 1,
    }}>
      {/* Step number / status icon */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: isDone ? C.greenDim : isCurrent ? C.goldDim : 'rgba(244,240,230,0.04)',
        border: `1px solid ${isDone ? C.greenBorder : isCurrent ? C.goldBorder : C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        flexShrink: 0,
        fontWeight: 700,
        color: isDone ? C.green : isCurrent ? C.gold : C.cream28,
        fontFamily: 'var(--font-jost, system-ui)',
      }}>
        {isDone ? '✓' : step.number}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 15,
            fontWeight: 700,
            color: isDone ? C.cream55 : isCurrent ? C.cream : C.cream28,
            margin: 0,
          }}>
            {step.title}
          </h3>
          <span style={{
            fontSize: 10,
            color: C.cream28,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
          }}>
            {step.estimated_minutes} min
          </span>
        </div>

        <p style={{
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 13,
          color: C.cream55,
          margin: '6px 0 10px',
          lineHeight: 1.5,
        }}>
          {step.description}
        </p>

        {/* Revenue unlock chip */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: C.goldDim,
          border: `1px solid ${C.goldBorder}`,
          borderRadius: 6,
          padding: '3px 9px',
          fontSize: 11,
          color: C.gold,
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          ✦ {step.revenue_unlock}
        </div>
      </div>

      {/* CTA */}
      {isCurrent && (
        <button
          type="button"
          disabled={loading}
          onClick={() => onAction(step.step)}
          style={{
            background: C.gold,
            border: 'none',
            borderRadius: 9,
            padding: '10px 20px',
            color: '#0c1f15',
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            alignSelf: 'center',
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? '…' : step.cta}
        </button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const DEMO_AGENT_ID = 'demo-agent-001'

  const [progress, setProgress]   = useState<OnboardingProgress | null>(null)
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setAL]    = useState(false)
  const [copied, setCopied]       = useState(false)

  // Fetch current progress
  const fetchProgress = useCallback(() => {
    setLoading(true)
    fetch(`/api/distribution/onboard?agent_id=${DEMO_AGENT_ID}`)
      .then(r => r.ok ? r.json() as Promise<ApiResponse> : Promise.reject())
      .then(data => setProgress(data.progress))
      .catch(() => {
        // Fallback: create fresh progress locally
        setProgress({
          agent_id: DEMO_AGENT_ID,
          email: '',
          steps_completed: [],
          current_step: 'account',
          completion_pct: 0,
          is_activated: false,
          invite_code: 'AG2026AB',
          started_at: new Date(),
        })
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  // Advance a step
  const handleAction = (step: OnboardingStep) => {
    if (!progress) return
    setAL(true)

    fetch('/api/distribution/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: progress.agent_id,
        email: progress.email || 'agent@agencygroup.pt',
        completed_step: step,
      }),
    })
      .then(r => r.ok ? r.json() as Promise<ApiResponse> : Promise.reject())
      .then(data => setProgress(data.progress))
      .catch(() => {
        // Optimistic local update
        const updated = {
          ...progress,
          steps_completed: [...progress.steps_completed, step],
          completion_pct: Math.round(((progress.steps_completed.length + 1) / 6) * 100),
          current_step: step,
        } as OnboardingProgress
        setProgress(updated)
      })
      .finally(() => setAL(false))
  }

  // Copy invite code
  const copyInvite = () => {
    if (!progress?.invite_code) return
    const url = `${window.location.origin}/dashboard/onboarding?invite=${progress.invite_code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const completedCount = progress?.steps_completed.length ?? 0
  const totalMinutesLeft = ONBOARDING_STEPS
    .filter(s => !progress?.steps_completed.includes(s.step))
    .reduce((sum, s) => sum + s.estimated_minutes, 0)

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg }}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: C.bg,
          borderBottom: `1px solid ${C.divider}`,
          padding: '18px 32px 16px',
        }}>
          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 11,
            color: C.cream28,
            margin: '0 0 4px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Dashboard → Activação de Agente
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 30,
              fontWeight: 600,
              color: C.cream,
              margin: 0,
            }}>
              Activação em{' '}
              <em style={{ color: C.gold }}>15 Minutos</em>
            </h1>

            {/* Progress bar */}
            {!loading && progress && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 12,
                    color: C.cream55,
                  }}>
                    {completedCount}/6 passos · {totalMinutesLeft} min restantes
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.gold,
                  }}>
                    {progress.completion_pct}%
                  </span>
                </div>
                <div style={{
                  height: 6,
                  background: C.goldDim,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progress.completion_pct}%`,
                    height: '100%',
                    background: progress.is_activated
                      ? C.green
                      : `linear-gradient(90deg, ${C.gold}, rgba(201,169,110,0.7))`,
                    borderRadius: 3,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '28px 32px 64px',
          animation: 'fadeUp 0.35s ease',
        }}>
          {/* Activated banner */}
          {progress?.is_activated && (
            <div style={{
              background: C.greenDim,
              border: `1px solid ${C.greenBorder}`,
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <span style={{ fontSize: 24 }}>✓</span>
              <div>
                <p style={{
                  fontFamily: 'var(--font-jost, system-ui)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.green,
                  margin: '0 0 2px',
                }}>
                  Sistema SH-ROS Totalmente Activo
                </p>
                <p style={{
                  fontFamily: 'var(--font-jost, system-ui)',
                  fontSize: 12,
                  color: C.cream55,
                  margin: 0,
                }}>
                  {progress.time_to_activate_minutes
                    ? `Activado em ${progress.time_to_activate_minutes} minutos. `
                    : ''}
                  Receita autónoma activada — dirija-se ao Brief Diário para as primeiras acções.
                </p>
              </div>
              <a href="/dashboard/daily-brief" style={{
                marginLeft: 'auto',
                background: C.gold,
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                color: '#0c1f15',
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                Brief Diário →
              </a>
            </div>
          )}

          {/* Steps */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  height: 100,
                  background: C.card,
                  borderRadius: 14,
                  animation: 'pulse 1.8s ease infinite',
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ONBOARDING_STEPS.map((stepDef) => {
                const isDone = progress?.steps_completed.includes(stepDef.step) ?? false
                const isCurrent = progress?.current_step === stepDef.step && !isDone
                const status = isDone ? 'completed' : isCurrent ? 'current' : 'locked'
                return (
                  <StepCard
                    key={stepDef.step}
                    step={stepDef}
                    status={status}
                    onAction={handleAction}
                    loading={actionLoading}
                  />
                )
              })}
            </div>
          )}

          {/* Viral invite panel */}
          {!loading && progress && (
            <div style={{
              marginTop: 32,
              background: 'linear-gradient(135deg, rgba(201,169,110,0.1) 0%, #111e16 100%)',
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 14,
              padding: '22px 24px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 10,
                    color: C.gold,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    margin: '0 0 6px',
                    fontWeight: 700,
                  }}>
                    Programa de Referência
                  </p>
                  <h2 style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: C.cream,
                    margin: '0 0 8px',
                  }}>
                    Ganhe até 5% extra por comissão
                  </h2>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 12,
                    color: C.cream55,
                    margin: '0 0 16px',
                    lineHeight: 1.6,
                  }}>
                    Cada agente que activar com o seu link ganha-lhe +1% de comissão extra em todos os negócios desse agente. Máximo de 5 referências activas (= +5%).
                  </p>

                  {/* Invite code + copy */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{
                      background: 'rgba(12,31,21,0.8)',
                      border: `1px solid ${C.goldBorder}`,
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontFamily: 'monospace',
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.gold,
                      letterSpacing: '0.1em',
                    }}>
                      {progress.invite_code}
                    </div>
                    <button
                      type="button"
                      onClick={copyInvite}
                      style={{
                        background: copied ? C.greenDim : C.goldDim,
                        border: `1px solid ${copied ? C.greenBorder : C.goldBorder}`,
                        borderRadius: 8,
                        padding: '8px 16px',
                        color: copied ? C.green : C.gold,
                        fontFamily: 'var(--font-jost, system-ui)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {copied ? '✓ Copiado!' : 'Copiar Link'}
                    </button>
                  </div>
                </div>

                {/* Bonus tracker */}
                <div style={{
                  background: 'rgba(12,31,21,0.6)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  minWidth: 160,
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: 40,
                    fontWeight: 700,
                    color: C.gold,
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    0%
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 11,
                    color: C.cream28,
                    margin: '6px 0 0',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    Bónus activo
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 10,
                    color: C.cream28,
                    margin: '4px 0 0',
                  }}>
                    0/5 referências
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
