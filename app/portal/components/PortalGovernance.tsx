'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type GovernanceClass = 'routine' | 'requires_approval' | 'requires_super_admin' | 'forbidden'
type DecisionStatus  = 'approved' | 'blocked' | 'pending'

type SystemActionType =
  | 'auto_route_deal' | 'score_opportunity' | 'promote_model' | 'rollback_model'
  | 'modify_threshold' | 'suppress_recipient' | 'trigger_distribution'
  | 'apply_calibration' | 'dismiss_calibration' | 'update_feature_flag'
  | 'force_release_cron' | 'modify_rls_policy' | 'delete_data' | 'export_pii'

interface GovernanceRecord {
  id?: string
  action_type: SystemActionType
  triggered_by: string
  governance_class: GovernanceClass
  approved_by?: string
  approved_at?: string
  decision: DecisionStatus
  audit_reason: string
  created_at: string
}

interface ApprovalMatrix {
  viewer:      SystemActionType[]
  agent:       SystemActionType[]
  admin:       SystemActionType[]
  super_admin: SystemActionType[]
}

interface ClassifyResult {
  governance_class: GovernanceClass
  permission: { permitted: boolean; reason: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

function govClassStyle(c: GovernanceClass) {
  const map = {
    routine:               { bg: 'rgba(44,201,106,.1)',    color: '#2cc96a' },
    requires_approval:     { bg: 'rgba(201,169,110,.15)',  color: '#c9a96e' },
    requires_super_admin:  { bg: 'rgba(58,123,213,.12)',   color: '#3a7bd5' },
    forbidden:             { bg: 'rgba(224,82,82,.1)',     color: '#e05252' },
  }
  return map[c] ?? map.routine
}

function decisionStyle(d: DecisionStatus) {
  const map = {
    approved: { bg: 'rgba(44,201,106,.1)',    color: '#2cc96a' },
    blocked:  { bg: 'rgba(224,82,82,.1)',     color: '#e05252' },
    pending:  { bg: 'rgba(201,169,110,.15)',  color: '#c9a96e' },
  }
  return map[d]
}

const ALL_ACTION_TYPES: SystemActionType[] = [
  'auto_route_deal','score_opportunity','trigger_distribution',
  'apply_calibration','dismiss_calibration','promote_model','suppress_recipient','update_feature_flag',
  'rollback_model','modify_threshold','force_release_cron',
  'modify_rls_policy','delete_data','export_pii',
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PortalGovernance() {
  const dm = useUIStore(s => s.darkMode)

  const [history,   setHistory]   = useState<GovernanceRecord[]>([])
  const [pending,   setPending]   = useState<GovernanceRecord[]>([])
  const [matrix,    setMatrix]    = useState<ApprovalMatrix | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [tab,       setTab]       = useState<'history' | 'pending' | 'matrix' | 'classify'>('history')

  // Classify form
  const [clAction,  setClAction]  = useState<SystemActionType>('auto_route_deal')
  const [clResult,  setClResult]  = useState<ClassifyResult | null>(null)
  const [clLoading, setClLoading] = useState(false)

  // Record form
  const [recAction,   setRecAction]   = useState<SystemActionType>('auto_route_deal')
  const [recDecision, setRecDecision] = useState<DecisionStatus>('approved')
  const [recReason,   setRecReason]   = useState('')
  const [recLoading,  setRecLoading]  = useState(false)
  const [recMsg,      setRecMsg]      = useState<string | null>(null)

  const card  = dm ? '#0e2416' : '#fff'
  const bord  = dm ? 'rgba(201,169,110,.1)' : 'rgba(14,14,13,.08)'
  const muted = dm ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.4)'
  const text  = dm ? 'rgba(244,240,230,.85)' : '#0e0e0d'

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const [histRes, pendRes, matRes] = await Promise.allSettled([
        fetch('/api/ops/governance?view=history&limit=50', { headers }),
        fetch('/api/ops/governance?view=pending',          { headers }),
        fetch('/api/ops/governance?view=matrix',           { headers }),
      ])

      if (histRes.status === 'fulfilled' && histRes.value.ok) {
        const d = await histRes.value.json()
        setHistory(Array.isArray(d.history) ? d.history : [])
      }
      if (pendRes.status === 'fulfilled' && pendRes.value.ok) {
        const d = await pendRes.value.json()
        setPending(Array.isArray(d.pending) ? d.pending : [])
      }
      if (matRes.status === 'fulfilled' && matRes.value.ok) {
        const d = await matRes.value.json()
        setMatrix(d.matrix ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Governance')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function classify() {
    setClLoading(true); setClResult(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/ops/governance', {
        method: 'POST', headers,
        body: JSON.stringify({
          action_meta: 'classify',
          system_action: { action_type: clAction, triggered_by: 'admin' },
        }),
      })
      const data = await res.json()
      if (res.ok) setClResult(data)
      else throw new Error(data.error ?? `HTTP ${res.status}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setClLoading(false) }
  }

  async function recordDecision() {
    if (!recReason.trim()) return
    setRecLoading(true); setRecMsg(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/ops/governance', {
        method: 'POST', headers,
        body: JSON.stringify({
          action_meta: 'record',
          system_action: { action_type: recAction, triggered_by: 'admin' },
          decision: recDecision,
          audit_reason: recReason,
        }),
      })
      const data = await res.json()
      if (res.ok) { setRecMsg('✓ Decisão registada'); setRecReason(''); await load() }
      else setRecMsg(`Erro: ${data.error}`)
    } catch (e) { setRecMsg(e instanceof Error ? e.message : 'Erro') }
    finally { setRecLoading(false) }
    setTimeout(() => setRecMsg(null), 3000)
  }

  const tabs = [
    { id: 'history'  as const, label: `Histórico (${history.length})` },
    { id: 'pending'  as const, label: `Pendentes${pending.length ? ` (${pending.length})` : ''}` },
    { id: 'matrix'   as const, label: 'Matriz de Permissões' },
    { id: 'classify' as const, label: '⚡ Classificar' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 300, color: dm ? '#c9a96e' : '#1c4a35', letterSpacing: '.04em' }}>Governance Engine</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginTop: 4 }}>
            Controlo Formal · Rastreabilidade · Human Override
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pending.length > 0 && (
            <span style={{ padding: '4px 12px', background: 'rgba(201,169,110,.15)', color: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {pending.length} PENDENTE{pending.length > 1 ? 'S' : ''}
            </span>
          )}
          <button onClick={load} disabled={loading}
            style={{ background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '8px 18px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.16em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .5 : 1 }}>
            {loading ? '...' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', padding: '12px 16px', color: '#e05252', fontFamily: "'DM Mono',monospace", fontSize: '.5rem' }}>{error}</div>}

      {/* Gov class legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['routine','requires_approval','requires_super_admin','forbidden'] as GovernanceClass[]).map(c => {
          const st = govClassStyle(c)
          const labels: Record<GovernanceClass, string> = {
            routine:               'Rotina — automático',
            requires_approval:     'Aprovação admin',
            requires_super_admin:  'Super admin only',
            forbidden:             'Proibido — jamais',
          }
          return (
            <span key={c} style={{ padding: '3px 10px', background: st.bg, color: st.color, fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {labels[c]}
            </span>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${bord}`, display: 'flex' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.14em', textTransform: 'uppercase', border: 'none', borderBottom: tab === t.id ? '2px solid #c9a96e' : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === t.id ? '#c9a96e' : (t.id === 'pending' && pending.length > 0 ? '#e05252' : muted), transition: 'all .2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* History */}
      {tab === 'history' && (
        <div style={{ background: card, border: `1px solid ${bord}`, overflow: 'hidden' }}>
          {history.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>SEM HISTÓRICO DE DECISÕES</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${bord}` }}>
                  {['Acção', 'Classe', 'Por', 'Decisão', 'Razão', 'Data'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => {
                  const gc = govClassStyle(r.governance_class)
                  const ds = decisionStyle(r.decision)
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${bord}` }}>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: text }}>{r.action_type}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 7px', background: gc.bg, color: gc.color, fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          {r.governance_class.replace('requires_', '').replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>{r.triggered_by}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 7px', background: ds.bg, color: ds.color, fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          {r.decision}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '.75rem', color: muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.audit_reason}</td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>
                        {new Date(r.created_at).toLocaleDateString('pt-PT')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pending */}
      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.length === 0 ? (
            <div style={{ background: card, border: `1px solid ${bord}`, padding: 32, textAlign: 'center', color: '#2cc96a', fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.1em' }}>
              ● SEM DECISÕES PENDENTES
            </div>
          ) : pending.map((r, i) => {
            const gc = govClassStyle(r.governance_class)
            return (
              <div key={i} style={{ background: card, border: '1px solid rgba(201,169,110,.25)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.1em', textTransform: 'uppercase', color: text }}>{r.action_type}</span>
                  <span style={{ padding: '2px 8px', background: gc.bg, color: gc.color, fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {r.governance_class}
                  </span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>{new Date(r.created_at).toLocaleString('pt-PT')}</span>
                </div>
                <div style={{ fontSize: '.78rem', color: muted }}>{r.audit_reason}</div>
              </div>
            )
          })}

          {/* Record new decision */}
          <div style={{ background: card, border: `1px solid ${bord}`, padding: 20 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 16 }}>Registar Decisão</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 5, display: 'block' }}>Acção</label>
                <select value={recAction} onChange={e => setRecAction(e.target.value as SystemActionType)} className="p-sel">
                  {ALL_ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 5, display: 'block' }}>Decisão</label>
                <select value={recDecision} onChange={e => setRecDecision(e.target.value as DecisionStatus)} className="p-sel">
                  <option value="approved">Aprovado</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>
              <div>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 5, display: 'block' }}>Razão / Auditoria</label>
                <input type="text" value={recReason} onChange={e => setRecReason(e.target.value)} className="p-inp" placeholder="Motivo da decisão…" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={recordDecision} disabled={recLoading || !recReason.trim()} className="p-btn">
                {recLoading ? 'A registar…' : 'Registar Decisão'}
              </button>
              {recMsg && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: recMsg.startsWith('✓') ? '#2cc96a' : '#e05252' }}>{recMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Matrix */}
      {tab === 'matrix' && (
        <div style={{ background: card, border: `1px solid ${bord}`, overflow: 'auto' }}>
          {!matrix ? (
            <div style={{ padding: 32, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>A carregar matriz…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${bord}` }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted }}>Acção</th>
                  {(['viewer','agent','admin','super_admin'] as const).map(r => (
                    <th key={r} style={{ padding: '10px 14px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted }}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_ACTION_TYPES.map(action => (
                  <tr key={action} style={{ borderBottom: `1px solid ${bord}` }}>
                    <td style={{ padding: '8px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: text }}>{action}</td>
                    {(['viewer','agent','admin','super_admin'] as const).map(role => {
                      const allowed = matrix[role].includes(action)
                      return (
                        <td key={role} style={{ padding: '8px 14px', textAlign: 'center' }}>
                          <span style={{ color: allowed ? '#2cc96a' : 'rgba(14,14,13,.2)', fontSize: '.9rem' }}>{allowed ? '✓' : '✗'}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Classify */}
      {tab === 'classify' && (
        <div style={{ background: card, border: `1px solid ${bord}`, padding: 28 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 20 }}>Classificar Acção do Sistema</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 6, display: 'block' }}>Tipo de Acção</label>
              <select value={clAction} onChange={e => setClAction(e.target.value as SystemActionType)} className="p-sel">
                {ALL_ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={classify} disabled={clLoading} className="p-btn" style={{ minWidth: 160 }}>
              {clLoading ? 'A classificar…' : '⚡ Classificar'}
            </button>
          </div>

          {clResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '16px 20px', background: govClassStyle(clResult.governance_class).bg, border: `1px solid ${govClassStyle(clResult.governance_class).color}33` }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 6 }}>Classe de Governance</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.5rem', fontWeight: 300, color: govClassStyle(clResult.governance_class).color }}>{clResult.governance_class}</span>
                </div>
              </div>
              <div style={{ padding: '16px 20px', background: clResult.permission.permitted ? 'rgba(44,201,106,.06)' : 'rgba(224,82,82,.06)', border: `1px solid ${clResult.permission.permitted ? 'rgba(44,201,106,.2)' : 'rgba(224,82,82,.2)'}` }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 6 }}>
                  Permissão — Role Actual
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: clResult.permission.permitted ? '#2cc96a' : '#e05252', flexShrink: 0 }} />
                  <span style={{ fontSize: '.84rem', color: text }}>{clResult.permission.reason}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
