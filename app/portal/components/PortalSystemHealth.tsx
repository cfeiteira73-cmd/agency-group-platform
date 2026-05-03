'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthSummary {
  overall_status: 'healthy' | 'degraded' | 'critical' | 'unknown'
  stability_score: number
  alerts_active: number
  jobs_pending: number
  jobs_failed: number
  quality_flags_open: number
  cron_success_rate_24h: number
  last_updated: string
}

interface AlertItem {
  id: string
  level: 'critical' | 'high' | 'medium' | 'low'
  component: string
  message: string
  triggered_at: string
}

interface SLABreach {
  id: string
  contact_name: string
  stage: string
  agent_email: string | null
  breach_severity: 'critical' | 'high' | 'medium'
  days_overdue: number
}

interface CronExecution {
  automation_type: string
  outcome: string
  ran_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

function scoreColor(score: number) {
  if (score >= 80) return '#2cc96a'
  if (score >= 50) return '#c9a96e'
  return '#e05252'
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    healthy:  { bg: 'rgba(44,201,106,.12)', color: '#2cc96a',  label: 'Operacional' },
    degraded: { bg: 'rgba(201,169,110,.15)', color: '#c9a96e', label: 'Degradado' },
    critical: { bg: 'rgba(224,82,82,.12)',  color: '#e05252',  label: 'Crítico' },
    unknown:  { bg: 'rgba(140,140,140,.12)', color: '#888',    label: 'Desconhecido' },
  }
  return map[status] ?? map.unknown
}

function severityColor(severity: string) {
  if (severity === 'critical') return '#e05252'
  if (severity === 'high')     return '#e08352'
  if (severity === 'medium')   return '#c9a96e'
  return '#6fcf97'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const c = scoreColor(score)
  const r = 36, cx = 44, cy = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(14,14,13,.08)" strokeWidth={6} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill={c}
          style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.5rem' }}>{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(14,14,13,.4)"
          style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>/ 100</text>
      </svg>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)' }}>{label}</div>
    </div>
  )
}

function KpiChip({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  const dm = useUIStore(s => s.darkMode)
  return (
    <div style={{ background: dm ? '#0e2416' : '#fff', border: `1px solid ${dm ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'}`, padding: '14px 18px', flex: 1, minWidth: 110 }}>
      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: valueColor ?? '#1c4a35', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalSystemHealth() {
  const dm = useUIStore(s => s.darkMode)

  const [health, setHealth]       = useState<HealthSummary | null>(null)
  const [alerts, setAlerts]       = useState<AlertItem[]>([])
  const [sla, setSla]             = useState<SLABreach[]>([])
  const [crons, setCrons]         = useState<CronExecution[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [tab, setTab]             = useState<'overview' | 'sla' | 'crons' | 'alerts'>('overview')

  const card  = dm ? '#0e2416' : '#fff'
  const text  = dm ? 'rgba(244,240,230,.85)' : '#0e0e0d'
  const muted = dm ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.4)'
  const bord  = dm ? 'rgba(201,169,110,.1)' : 'rgba(14,14,13,.08)'

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const [healthRes, slaRes] = await Promise.allSettled([
        fetch('/api/ops/health',        { headers }),
        fetch('/api/ops/sla-dashboard', { headers }),
      ])

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const d = await healthRes.value.json()
        const h = d.health ?? {}
        setHealth({
          overall_status:          h.overall_status    ?? 'unknown',
          stability_score:         h.stability_score   ?? 70,
          alerts_active:           h.alerts_active     ?? (d.alerts?.length ?? 0),
          jobs_pending:            h.jobs_pending      ?? 0,
          jobs_failed:             h.jobs_failed       ?? 0,
          quality_flags_open:      h.quality_flags_open ?? 0,
          cron_success_rate_24h:   h.cron_success_rate_24h ?? 100,
          last_updated:            h.last_updated      ?? new Date().toISOString(),
        })
        setAlerts(Array.isArray(d.alerts) ? d.alerts.slice(0, 20) : [])
        setCrons(Array.isArray(d.recent_crons) ? d.recent_crons.slice(0, 30) : [])
      }

      if (slaRes.status === 'fulfilled' && slaRes.value.ok) {
        const d = await slaRes.value.json()
        setSla(Array.isArray(d.breaches) ? d.breaches.slice(0, 20) : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Render ─────────────────────────────────────────────────────────────────

  const status = health ? statusBadge(health.overall_status) : statusBadge('unknown')

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'alerts',   label: `Alertas${alerts.length ? ` (${alerts.length})` : ''}` },
    { id: 'sla',      label: `SLA${sla.length ? ` (${sla.length})` : ''}` },
    { id: 'crons',    label: 'Crons' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 300, color: dm ? '#c9a96e' : '#1c4a35', letterSpacing: '.04em' }}>System Health</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginTop: 4 }}>
            Self-Healing Infrastructure Monitor · Tempo real
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {health && (
            <span style={{ padding: '4px 12px', background: status.bg, color: status.color, fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              ● {status.label}
            </span>
          )}
          <button onClick={load} disabled={loading}
            style={{ background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '8px 18px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.16em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .5 : 1 }}>
            {loading ? '...' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', padding: '12px 16px', color: '#e05252', fontFamily: "'DM Mono',monospace", fontSize: '.5rem' }}>
          {error}
        </div>
      )}

      {loading && !health && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ flex: 1, height: 80, background: dm ? '#0e2416' : 'rgba(14,14,13,.04)', animation: 'ag-pulse 1.4s ease-in-out infinite', animationDelay: `${i*.15}s` }} />
          ))}
          <style>{`@keyframes ag-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
        </div>
      )}

      {health && (
        <>
          {/* KPI Row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: card, border: `1px solid ${bord}`, padding: '20px 24px' }}>
              <ScoreGauge score={health.stability_score} label="Estabilidade" />
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiChip label="Alertas Activos"     value={health.alerts_active}  valueColor={health.alerts_active > 0 ? '#e05252' : '#2cc96a'} />
              <KpiChip label="Jobs Pendentes"      value={health.jobs_pending}   valueColor={health.jobs_pending > 5 ? '#c9a96e' : '#2cc96a'} />
              <KpiChip label="Jobs Falhados"       value={health.jobs_failed}    valueColor={health.jobs_failed > 0 ? '#e05252' : '#2cc96a'} />
              <KpiChip label="Flags Qualidade"     value={health.quality_flags_open} valueColor={health.quality_flags_open > 0 ? '#c9a96e' : '#2cc96a'} />
              <KpiChip label="Crons OK 24h"        value={`${Math.round(health.cron_success_rate_24h)}%`} valueColor={health.cron_success_rate_24h >= 95 ? '#2cc96a' : health.cron_success_rate_24h >= 80 ? '#c9a96e' : '#e05252'} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: `1px solid ${bord}`, display: 'flex', gap: 0 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '10px 20px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.14em', textTransform: 'uppercase', border: 'none', borderBottom: tab === t.id ? '2px solid #c9a96e' : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === t.id ? '#c9a96e' : muted, transition: 'all .2s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}

          {tab === 'overview' && (
            <div style={{ background: card, border: `1px solid ${bord}`, padding: 24 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 16 }}>Estado dos Componentes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { name: 'Supabase DB',       ok: health.jobs_failed === 0 },
                  { name: 'API Layer',          ok: true },
                  { name: 'Cron Jobs',          ok: health.cron_success_rate_24h >= 90 },
                  { name: 'Alert Engine',       ok: health.alerts_active < 5 },
                  { name: 'Job Queue',          ok: health.jobs_pending < 10 },
                  { name: 'Quality Monitor',    ok: health.quality_flags_open < 3 },
                  { name: 'Economic Truth',     ok: health.stability_score >= 60 },
                  { name: 'Distribution Engine', ok: health.stability_score >= 50 },
                ].map(comp => (
                  <div key={comp.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: `1px solid ${bord}`, background: comp.ok ? 'rgba(44,201,106,.04)' : 'rgba(224,82,82,.05)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: comp.ok ? '#2cc96a' : '#e05252', flexShrink: 0 }} />
                    <span style={{ fontSize: '.78rem', color: text }}>{comp.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>
                Última actualização: {new Date(health.last_updated).toLocaleString('pt-PT')}
              </div>
            </div>
          )}

          {tab === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.length === 0 ? (
                <div style={{ background: card, border: `1px solid ${bord}`, padding: 32, textAlign: 'center', color: '#2cc96a', fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.1em' }}>
                  ● SEM ALERTAS ACTIVOS
                </div>
              ) : alerts.map((a, i) => (
                <div key={a.id ?? i} style={{ background: card, border: `1px solid ${bord}`, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: severityColor(a.level), flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.1em', textTransform: 'uppercase', color: severityColor(a.level) }}>{a.level}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>{a.component}</span>
                    </div>
                    <div style={{ fontSize: '.8rem', color: text, lineHeight: 1.5 }}>{a.message}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted, marginTop: 4 }}>
                      {new Date(a.triggered_at).toLocaleString('pt-PT')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'sla' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sla.length === 0 ? (
                <div style={{ background: card, border: `1px solid ${bord}`, padding: 32, textAlign: 'center', color: '#2cc96a', fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.1em' }}>
                  ● SEM VIOLAÇÕES SLA
                </div>
              ) : sla.map((breach, i) => (
                <div key={breach.id ?? i} style={{ background: card, border: `1px solid ${severityColor(breach.breach_severity)}33`, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '.8rem', color: text, fontWeight: 500 }}>{breach.contact_name ?? '—'}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted, marginTop: 2 }}>{breach.agent_email ?? '—'}</div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.08em', textTransform: 'uppercase', color: muted }}>{breach.stage}</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 300, color: severityColor(breach.breach_severity) }}>+{breach.days_overdue}d</div>
                  <span style={{ padding: '3px 10px', background: `${severityColor(breach.breach_severity)}18`, color: severityColor(breach.breach_severity), fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {breach.breach_severity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'crons' && (
            <div style={{ background: card, border: `1px solid ${bord}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${bord}` }}>
                    {['Cron Job', 'Resultado', 'Executado em'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crons.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>Sem execuções nas últimas 24h</td></tr>
                  ) : crons.map((c, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${bord}` }}>
                      <td style={{ padding: '10px 16px', fontSize: '.78rem', color: text }}>{c.automation_type}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '2px 8px', background: c.outcome === 'success' ? 'rgba(44,201,106,.1)' : 'rgba(224,82,82,.1)', color: c.outcome === 'success' ? '#2cc96a' : '#e05252', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          {c.outcome}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>
                        {new Date(c.ran_at).toLocaleString('pt-PT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
