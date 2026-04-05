'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo à AgencyGroup.App',
    subtitle: 'A plataforma de imobiliário de luxo mais avançada de Portugal',
    content: 'welcome',
  },
  {
    id: 'profile',
    title: 'Configura o teu perfil',
    subtitle: 'Informa-nos sobre ti para personalizar a experiência',
    content: 'profile',
  },
  {
    id: 'features',
    title: 'As tuas ferramentas',
    subtitle: 'Tudo o que precisas para fechar negócios premium',
    content: 'features',
  },
  {
    id: 'first-deal',
    title: 'Cria o teu primeiro deal',
    subtitle: 'Leva menos de 60 segundos',
    content: 'first-deal',
  },
]

const FEATURES = [
  { icon: '🏠', name: 'AVM', description: 'Avaliação automática em 80+ zonas de Portugal' },
  { icon: '🎯', name: 'Deal Radar', description: 'Busca de oportunidades em tempo real' },
  { icon: '📊', name: 'CRM Pipeline', description: '8 etapas, checklists, análise de risco' },
  { icon: '✨', name: 'Marketing AI', description: 'Conteúdo em 8 formatos e 6 línguas' },
  { icon: '👤', name: 'Sofia IA', description: 'A tua assistente digital de luxo' },
  { icon: '⚖️', name: 'NHR Analyzer', description: 'Análise fiscal para compradores internacionais' },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({ name: '', phone: '', zone: 'Lisboa' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const current = STEPS[step]

  const handleComplete = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      router.push('/portal')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c1f15',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', background: '#1e3a28' }}>
        <div style={{
          height: '100%',
          background: '#c9a96e',
          width: `${((step + 1) / STEPS.length) * 100}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ maxWidth: '560px', width: '100%', padding: '40px 24px' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              width: i === step ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: i <= step ? '#c9a96e' : '#1e3a28',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            color: '#f5f0e8',
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: '36px',
            margin: '0 0 12px',
            fontWeight: 400,
          }}>
            {current.title}
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '16px', margin: 0 }}>
            {current.subtitle}
          </p>
        </div>

        {/* Step content */}
        {current.content === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '80px', marginBottom: '24px' }}>🏛️</div>
            <p style={{ color: '#d1d5db', lineHeight: 1.6, fontSize: '15px', margin: 0 }}>
              Acesso à plataforma exclusiva da Agency Group — AMI 22506.
              Valuações automáticas, pipeline de negócios, marketing com IA,
              e muito mais.
            </p>
          </div>
        )}

        {current.content === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {([
              { label: 'Nome completo', key: 'name', type: 'text', placeholder: 'Carlos Silva' },
              { label: 'Telemóvel', key: 'phone', type: 'tel', placeholder: '+351 9xx xxx xxx' },
            ] as const).map(field => (
              <div key={field.key}>
                <label style={{
                  color: '#9ca3af',
                  fontSize: '12px',
                  letterSpacing: '1px',
                  display: 'block',
                  marginBottom: '6px',
                }}>
                  {field.label.toUpperCase()}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={profile[field.key]}
                  onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{
                    width: '100%',
                    background: '#0f2a1a',
                    border: '1px solid #2d5a3d',
                    color: '#f5f0e8',
                    padding: '12px 16px',
                    fontSize: '15px',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {current.content === 'features' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {FEATURES.map(f => (
              <div key={f.name} style={{
                background: '#0f2a1a',
                border: '1px solid #1e3a28',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{f.icon}</div>
                <div style={{ color: '#c9a96e', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{f.name}</div>
                <div style={{ color: '#6b7280', fontSize: '11px', lineHeight: 1.4 }}>{f.description}</div>
              </div>
            ))}
          </div>
        )}

        {current.content === 'first-deal' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎯</div>
            <p style={{ color: '#d1d5db', lineHeight: 1.6, marginBottom: '24px' }}>
              O teu portal está pronto. Começa por adicionar o teu primeiro imóvel
              ao pipeline ou faz uma avaliação com o AVM.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '40px', justifyContent: 'center' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={loading}
              style={{
                background: 'transparent',
                color: '#9ca3af',
                border: '1px solid #374151',
                padding: '12px 24px',
                fontSize: '13px',
                letterSpacing: '1px',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              ANTERIOR
            </button>
          )}
          <button
            onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleComplete}
            disabled={loading}
            style={{
              background: loading ? '#8a7040' : '#c9a96e',
              color: '#0c1f15',
              border: 'none',
              padding: '12px 32px',
              fontSize: '13px',
              letterSpacing: '1px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              borderRadius: '4px',
              minWidth: '160px',
              transition: 'background 0.2s ease',
            }}
          >
            {loading ? 'A entrar...' : step < STEPS.length - 1 ? 'CONTINUAR →' : 'ENTRAR NO PORTAL →'}
          </button>
        </div>
      </div>
    </div>
  )
}
