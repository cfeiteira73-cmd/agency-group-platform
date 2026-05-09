'use client'
// =============================================================================
// Agency Group — Data Moat Score Page
// app/portal/analytics/moat/page.tsx
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

interface MoatDimensions {
  data_volume:       number
  data_quality:      number
  network_effects:   number
  proprietary_intel: number
  automation_depth:  number
}

interface MoatScore {
  overall_score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: MoatDimensions
  top_strengths: string[]
  top_risks: string[]
  computed_at: string
}

const DIMENSION_LABELS: Record<keyof MoatDimensions, { label: string; emoji: string; description: string; improve: string }> = {
  data_volume:       { label: 'Volume de Dados', emoji: '📦', description: 'Quantidade de contactos, leads e negócios no sistema', improve: 'Aumentar captação — mais leads = barreira de entrada mais alta' },
  data_quality:      { label: 'Qualidade de Dados', emoji: '✅', description: 'Completude e exactidão dos dados no CRM', improve: 'Preencher campos obrigatórios (email, budget, zona) em todos os contactos activos' },
  network_effects:   { label: 'Efeitos de Rede', emoji: '🕸️', description: 'Referências de clientes, parceiros institucionais e co-exclusivas', improve: 'Activar programa de referências — pedir referência no fechamento de cada deal' },
  proprietary_intel: { label: 'Intel Proprietário', emoji: '🧠', description: 'Eventos de aprendizagem, feedback de mercado e sinais off-market', improve: 'Registar mais feedback de negociação e sinais de mercado após cada visita' },
  automation_depth:  { label: 'Profundidade de Automação', emoji: '⚙️', description: 'Workflows n8n activos e execuções nos últimos 30 dias', improve: 'Activar workflows de follow-up automático e alerts de score no n8n' },
}

const GRADE_CONFIG = {
  A: { color: '#52b788', label: 'Excelente', bg: '#52b78815' },
  B: { color: '#8ecae6', label: 'Bom', bg: '#8ecae615' },
  C: { color: '#c9a96e', label: 'Médio', bg: '#c9a96e15' },
  D: { color: '#e07b39', label: 'Fraco', bg: '#e07b3915' },
  F: { color: '#e63946', label: 'Crítico', bg: '#e6394615' },
}

function DimensionBar({ dimKey, value }: { dimKey: keyof MoatDimensions; value: number }) {
  const cfg = DIMENSION_LABELS[dimKey]
  const color = value >= 75 ? '#52b788' : value >= 50 ? '#c9a96e' : value >= 25 ? '#e07b39' : '#e63946'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e0d0' }}>{cfg.label}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{cfg.description}</div>
          </div>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color, minWidth: 40, textAlign: 'right' }}>{value.toFixed(0)}</span>
      </div>
      <div style={{ height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: '100%', backgroundColor: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      {value < 40 && (
        <div style={{ fontSize: 11, color: '#e07b39', marginTop: 4 }}>
          💡 {cfg.improve}
        </div>
      )}
    </div>
  )
}

export default function MoatPage() {
  const [data, setData] = useState<MoatScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/moat')
      if (!res.ok) throw new Error('Acesso negado ou erro no servidor')
      const json = await res.json()
      setData(json.moat ?? json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#888', backgroundColor: '#0f0f0f', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
        <div>A calcular Data Moat Score...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: 32, color: '#e63946', textAlign: 'center', backgroundColor: '#0f0f0f', minHeight: '100vh' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
      <div>{error}</div>
      <button onClick={load} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid #e63946', background: 'none', color: '#e63946', cursor: 'pointer' }}>
        Tentar novamente
      </button>
    </div>
  )

  const d = data!
  const gradeCfg = GRADE_CONFIG[d.grade]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>Data Moat Score</h1>
        <p style={{ color: '#888', margin: '4px 0 0', fontSize: 14 }}>
          Defensibilidade competitiva · calculado {new Date(d.computed_at).toLocaleString('pt-PT')}
        </p>
      </div>

      {/* Central score */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <div style={{
          backgroundColor: gradeCfg.bg, border: `2px solid ${gradeCfg.color}44`,
          borderRadius: 20, padding: '32px 48px', textAlign: 'center',
          boxShadow: `0 0 40px ${gradeCfg.color}22`,
        }}>
          <div style={{ fontSize: 72, fontWeight: 900, color: gradeCfg.color, lineHeight: 1 }}>{d.overall_score}</div>
          <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>/ 100</div>
          <div style={{ marginTop: 12, display: 'inline-block', padding: '6px 20px', borderRadius: 99, backgroundColor: gradeCfg.color + '33', border: `1px solid ${gradeCfg.color}66` }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: gradeCfg.color }}>{d.grade}</span>
            <span style={{ fontSize: 14, color: gradeCfg.color, marginLeft: 8 }}>{gradeCfg.label}</span>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 32, marginBottom: 32 }}>
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 24, border: '1px solid #2a2a2a' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>📊 Dimensões</h3>
          {(Object.keys(d.dimensions) as Array<keyof MoatDimensions>).map(k => (
            <DimensionBar key={k} dimKey={k} value={d.dimensions[k]} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Strengths */}
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 24, border: '1px solid #2a2a2a', flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#52b788', marginTop: 0, marginBottom: 16 }}>💪 Pontos Fortes</h3>
            {d.top_strengths.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.top_strengths.map((s, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e8e0d0' }}>
                    <span style={{ color: '#52b788', fontSize: 16 }}>✓</span> {s}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>Ainda não há dimensões fortes — continua a construir!</div>
            )}
          </div>

          {/* Risks */}
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 24, border: '1px solid #2a2a2a', flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e63946', marginTop: 0, marginBottom: 16 }}>⚠️ Riscos</h3>
            {d.top_risks.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.top_risks.map((r, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e8e0d0' }}>
                    <span style={{ color: '#e63946', fontSize: 16 }}>!</span> {r}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#52b788', fontSize: 13 }}>✓ Sem riscos críticos identificados</div>
            )}
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 24, border: '1px solid #2a2a2a' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 12 }}>🎯 O que é o Data Moat?</h3>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.7, margin: 0 }}>
          O <strong style={{ color: '#c9a96e' }}>Data Moat</strong> mede a defensibilidade competitiva da Agency Group com base na acumulação de dados proprietários.
          Quanto mais alto o score, mais difícil é para concorrentes replicar o que fizemos.
          Um score ≥80 significa que o sistema é <strong style={{ color: '#52b788' }}>auto-reforçante</strong>:
          mais dados → melhores matches → mais negócios → mais dados.
          Abaixo de 40 há risco real de substituição por soluções genéricas.
        </p>
      </div>
    </div>
  )
}
