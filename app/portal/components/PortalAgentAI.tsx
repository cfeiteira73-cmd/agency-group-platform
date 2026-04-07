'use client'

import { useState } from 'react'

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
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c4a35] to-[#2d6b4f] flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
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
          <h2 className="text-lg font-semibold text-gray-900">Sofia AI Agent</h2>
          <p className="text-sm text-gray-500">Automacao CRM autonoma</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="agent-task" className="block text-sm font-medium text-gray-700 mb-2">
            Tarefa
          </label>
          <select
            id="agent-task"
            value={task}
            onChange={e => setTask(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1c4a35]"
            disabled={running}
          >
            {TASKS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={runAgent}
          disabled={running}
          className="w-full bg-[#1c4a35] text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-[#2d6b4f] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          aria-busy={running}
        >
          {running ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Sofia a analisar CRM...
            </>
          ) : (
            'Executar Agent'
          )}
        </button>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{result.iterations}</p>
                <p className="text-xs text-green-600">Iteracoes</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{result.results.length}</p>
                <p className="text-xs text-blue-600">Acoes</p>
              </div>
              <div className="text-center p-3 bg-[#1c4a35]/5 rounded-lg">
                <p className="text-2xl font-bold text-[#1c4a35]">{tasksCreated}</p>
                <p className="text-xs text-[#1c4a35]">Tarefas criadas</p>
              </div>
            </div>

            {followupsGenerated > 0 && (
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-700">{followupsGenerated}</p>
                <p className="text-xs text-amber-600">Follow-ups gerados</p>
              </div>
            )}

            {result.summary && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumo</h3>
                <p className="text-sm text-gray-600">
                  {String((result.summary as Record<string, unknown>).summary ?? '')}
                </p>
              </div>
            )}

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium hover:text-gray-700">
                Ver log detalhado ({result.results.length} acoes)
              </summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 py-1 border-b border-gray-100">
                    <span className="font-mono text-blue-600 shrink-0">{r.tool}</span>
                    <span className="text-gray-400">&#8594;</span>
                    <span className="truncate">{JSON.stringify(r.result).slice(0, 80)}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
