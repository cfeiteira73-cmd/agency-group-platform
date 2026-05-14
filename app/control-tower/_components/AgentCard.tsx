'use client'

import Link from 'next/link'
import type { AgentId } from '@/lib/agents/types'

export type AgentHealthStatus = 'healthy' | 'degraded' | 'idle' | 'failed'

export interface AgentCardData {
  id: AgentId
  name: string
  layer: string
  status: AgentHealthStatus
  last_duration_ms: number | null
  last_ev_score: number | null
  last_run_at: string | null
  success_rate_24h: number | null
}

const STATUS_DOT: Record<AgentHealthStatus, string> = {
  healthy:  'bg-green-400',
  degraded: 'bg-amber-400',
  idle:     'bg-slate-600',
  failed:   'bg-red-400',
}

const STATUS_BORDER: Record<AgentHealthStatus, string> = {
  healthy:  'border-green-900',
  degraded: 'border-amber-900',
  idle:     'border-slate-800',
  failed:   'border-red-900',
}

const LAYER_COLOR: Record<string, string> = {
  'Revenue Intelligence':   'text-purple-400',
  'Sales Execution':        'text-blue-400',
  'System Automation':      'text-green-400',
  'Strategy & Analytics':   'text-amber-400',
  'Governance':             'text-red-400',
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function AgentCard({ agent }: { agent: AgentCardData }) {
  return (
    <Link href={`/control-tower/agents/${agent.id}`}>
      <div className={`bg-[#111118] border rounded-lg p-3 hover:bg-[#1A1A24] transition-colors cursor-pointer ${STATUS_BORDER[agent.status]}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[agent.status]}`} />
            <span className="text-xs font-medium text-slate-200 truncate">{agent.name}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">{agent.status.toUpperCase()}</span>
        </div>

        {/* Layer */}
        <p className={`text-[10px] uppercase tracking-wide font-medium mb-2 ${LAYER_COLOR[agent.layer] ?? 'text-slate-500'}`}>
          {agent.layer}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div>
            <span className="text-slate-600">Duration</span>
            <span className="text-slate-300 font-mono ml-1">{formatDuration(agent.last_duration_ms)}</span>
          </div>
          <div>
            <span className="text-slate-600">EV</span>
            <span className={`font-mono ml-1 ${agent.last_ev_score !== null && agent.last_ev_score > 0 ? 'text-green-400' : 'text-slate-400'}`}>
              {agent.last_ev_score !== null ? agent.last_ev_score.toFixed(2) : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-600">Last run</span>
            <span className="text-slate-400 ml-1">{formatRelative(agent.last_run_at)}</span>
          </div>
          <div>
            <span className="text-slate-600">24h ok</span>
            <span className={`font-mono ml-1 ${(agent.success_rate_24h ?? 0) >= 0.9 ? 'text-green-400' : 'text-amber-400'}`}>
              {agent.success_rate_24h !== null ? `${Math.round(agent.success_rate_24h * 100)}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
