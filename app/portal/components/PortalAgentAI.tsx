'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

interface AgentToolResult {
  tool: string
  input: Record<string, unknown>
  result: unknown
}

interface AgentResult {
  success: boolean
  iterations: number
  results: AgentToolResult[]
  summary?: Record<string, unknown>
}

const TASKS = [
  { value: 'analyze_stalled_deals', label: 'Analisar deals parados' },
  { value: 'score_all_leads', label: 'Pontuar todos os leads' },
  { value: 'generate_followups', label: 'Gerar follow-ups personalizados' },
  { value: 'match_properties_to_clients', label: 'Fazer match propriedades/clientes' },
]

// AG Design System tokens
const ag = {
  bgDark: '#0c1f15',
  bgMedium: '#1c4a35',
  bgPanel: 'rgba(28,74,53,0.4)',
  bgPanelLight: 'rgba(28,74,53,0.3)',
  gold: '#c9a96e',
  textPrimary: '#f4f0e6',
  textMuted: 'rgba(244,240,230,0.65)',
  textDim: 'rgba(244,240,230,0.4)',
  border: 'rgba(201,169,110,0.2)',
  borderStrong: 'rgba(201,169,110,0.4)',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
} as const

const s: Record<string, CSSProperties> = {
  card: {
    background: ag.bgPanel,
    border: `1px solid ${ag.border}`,
    borderRadius: 4,
    padding: '24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 4,
    background: `linear-gradient(135deg, ${ag.bgMedium}, #2d6b4f)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: `1px solid ${ag.border}`,
  },
  title: {
    fontFamily: 'Cormorant Garamond, serif',
    fontWeight: 700,
    fontSize: 18,
    color: ag.textPrimary,
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    color: ag.textMuted,
    margin: 0,
    marginTop: 2,
  },
  label: {
    display: 'block',
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    color: ag.textMuted,
    marginBottom: 8,
  },
  select: {
    width: '100%',
    borderRadius: 4,
    border: `1px solid ${ag.border}`,
    background: 'rgba(12,31,21,0.6)',
    color: ag.textPrimary,
    fontFamily: 'Jost, sans-serif',
    fontSize: 14,
    padding: '8px 12px',
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    background: ag.gold,
    color: ag.bgDark,
    border: 'none',
    borderRadius: 4,
    padding: '12px 16px',
    fontFamily: 'Jost, sans-serif',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.3s ease',
    letterSpacing: '0.02em',
  },
  errorBox: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    color: ag.red,
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 4,
    padding: '8px 12px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  statBox: {
    textAlign: 'center',
    padding: '12px',
    borderRadius: 4,
    border: `1px solid ${ag.border}`,
    background: ag.bgPanelLight,
  },
  statGreen: {
    textAlign: 'center',
    padding: '12px',
    borderRadius: 4,
    background: 'rgba(74,222,128,0.08)',
    border: '1px solid rgba(74,222,128,0.25)',
  },
  statGold: {
    textAlign: 'center',
    padding: '12px',
    borderRadius: 4,
    background: 'rgba(201,169,110,0.08)',
    border: '1px solid rgba(201,169,110,0.25)',
  },
  statForest: {
    textAlign: 'center',
    padding: '12px',
    borderRadius: 4,
    background: 'rgba(28,74,53,0.5)',
    border: `1px solid ${ag.border}`,
  },
  statAmber: {
    textAlign: 'center',
    padding: '12px',
    borderRadius: 4,
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.25)',
  },
  statBig: {
    fontFamily: 'DM Mono, monospace',
    fontWeight: 700,
    fontSize: 22,
    lineHeight: 1,
    margin: 0,
  },
  statLabel: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 11,
    color: ag.textDim,
    margin: 0,
    marginTop: 4,
  } as CSSProperties,
  summaryBox: {
    background: ag.bgPanelLight,
    border: `1px solid ${ag.border}`,
    borderRadius: 4,
    padding: '16px',
  },
  summaryTitle: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    color: ag.textMuted,
    margin: 0,
    marginBottom: 8,
  },
  summaryText: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    color: ag.textMuted,
    margin: 0,
  },
  details: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: ag.textDim,
  },
  detailsSummary: {
    cursor: 'pointer',
    fontWeight: 500,
    color: ag.textDim,
    fontFamily: 'Jost, sans-serif',
    fontSize: 12,
    padding: '4px 0',
  },
  logScroll: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 192,
    overflowY: 'auto',
  },
  logRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 0',
    borderBottom: `1px solid ${ag.border}`,
  },
  logTool: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: ag.gold,
    flexShrink: 0,
  },
  logArrow: {
    color: ag.textDim,
    fontSize: 12,
  },
  logResult: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: ag.textDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}

export function PortalAgentAI() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [error, setError] = useState('')
  const [task, setTask] = useState('analyze_stalled_deals')

  async function runAgent() {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/automation/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AgentResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setRunning(false)
    }
  }

  const tasksCreated = result?.results.filter(r => r.tool === 'create_task').length ?? 0
  const followupsGenerated = result?.results.filter(r => r.tool === 'generate_followup').length ?? 0

  return (
    <>
      <style>{`
        .ag-agent-select:focus {
          border-color: rgba(201,169,110,0.4) !important;
          box-shadow: 0 0 0 2px rgba(201,169,110,0.15);
        }
        .ag-agent-btn:hover:not(:disabled) {
          background: #a8843a !important;
        }
        .ag-agent-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ag-agent-details summary:hover {
          color: rgba(244,240,230,0.65) !important;
        }
      `}</style>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.iconWrap}>
            <svg
              width="20"
              height="20"
              fill="none"
              stroke={ag.gold}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"
              />
            </svg>
          </div>
          <div>
            <h2 style={s.title}>Sofia AI Agent</h2>
            <p style={s.subtitle}>Automacao CRM autonoma</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="agent-task" style={s.label}>
              Tarefa
            </label>
            <select
              id="agent-task"
              className="ag-agent-select"
              value={task}
              onChange={e => setTask(e.target.value)}
              style={s.select}
              disabled={running}
            >
              {TASKS.map(t => (
                <option key={t.value} value={t.value} style={{ background: ag.bgMedium, color: ag.textPrimary }}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="ag-agent-btn"
            onClick={runAgent}
            disabled={running}
            style={s.button}
            aria-busy={running}
          >
            {running ? (
              <>
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ animation: 'spin 1s linear infinite' }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    style={{ opacity: 0.25 }}
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    style={{ opacity: 0.75 }}
                  />
                </svg>
                Sofia a analisar CRM...
              </>
            ) : (
              'Executar Agent'
            )}
          </button>

          {error && (
            <p style={s.errorBox} role="alert">
              {error}
            </p>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <div style={s.statsGrid}>
                {/* Iterations */}
                <div style={s.statGreen}>
                  <p style={{ ...s.statBig, color: ag.green }}>{result.iterations}</p>
                  <p style={{ ...s.statLabel, color: 'rgba(74,222,128,0.7)' }}>Iteracoes</p>
                </div>
                {/* Actions */}
                <div style={s.statGold}>
                  <p style={{ ...s.statBig, color: ag.gold }}>{result.results.length}</p>
                  <p style={{ ...s.statLabel, color: 'rgba(201,169,110,0.7)' }}>Acoes</p>
                </div>
                {/* Tasks created */}
                <div style={s.statForest}>
                  <p style={{ ...s.statBig, color: ag.textPrimary }}>{tasksCreated}</p>
                  <p style={s.statLabel}>Tarefas criadas</p>
                </div>
              </div>

              {followupsGenerated > 0 && (
                <div style={s.statAmber}>
                  <p style={{ ...s.statBig, color: ag.amber }}>{followupsGenerated}</p>
                  <p style={{ ...s.statLabel, color: 'rgba(251,191,36,0.7)' }}>Follow-ups gerados</p>
                </div>
              )}

              {result.summary && (
                <div style={s.summaryBox}>
                  <h3 style={s.summaryTitle}>Resumo</h3>
                  <p style={s.summaryText}>
                    {String((result.summary as Record<string, unknown>).summary ?? '')}
                  </p>
                </div>
              )}

              <details className="ag-agent-details" style={s.details}>
                <summary style={s.detailsSummary}>
                  Ver log detalhado ({result.results.length} acoes)
                </summary>
                <div style={s.logScroll}>
                  {result.results.map((r, i) => (
                    <div key={i} style={s.logRow}>
                      <span style={s.logTool}>{r.tool}</span>
                      <span style={s.logArrow}>&#8594;</span>
                      <span style={s.logResult}>{JSON.stringify(r.result).slice(0, 80)}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
