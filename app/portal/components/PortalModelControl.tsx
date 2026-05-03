'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelStatus = 'draft' | 'shadow' | 'staged' | 'production' | 'archived' | 'rolled_back'

interface ModelVersion {
  version_id: string
  version_tag: string
  status: ModelStatus
  accuracy_score?: number
  mae?: number
  r2?: number
  feature_count?: number
  created_at: string
  promoted_at?: string
  archived_at?: string
  created_by?: string
  notes?: string
}

interface DriftReport {
  id?: string
  period_start?: string
  period_end?: string
  mae_current?: number
  mae_baseline?: number
  mae_drift_pct?: number
  r2_current?: number
  r2_baseline?: number
  zone_drifts?: Array<{ zone: string; drift_pct: number; severity: string }>
  recommended_action?: string
  drift_detected?: boolean
  generated_at?: string
}

interface CalibrationRec {
  id?: string
  zone_key?: string
  feature?: string
  current_value?: number
  recommended_value?: number
  delta_pct?: number
  confidence?: number
  sample_size?: number
  rationale?: string
  status?: string
  generated_at?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

function statusStyle(s: ModelStatus) {
  const map: Record<ModelStatus, { bg: string; color: string }> = {
    draft:       { bg: 'rgba(140,140,140,.1)',    color: '#888' },
    shadow:      { bg: 'rgba(58,123,213,.12)',    color: '#3a7bd5' },
    staged:      { bg: 'rgba(201,169,110,.15)',   color: '#c9a96e' },
    production:  { bg: 'rgba(44,201,106,.12)',    color: '#2cc96a' },
    archived:    { bg: 'rgba(140,140,140,.08)',   color: '#666' },
    rolled_back: { bg: 'rgba(224,82,82,.1)',      color: '#e05252' },
  }
  return map[s] ?? map.draft
}

function driftSeverityColor(severity: string) {
  if (severity === 'high' || severity === 'critical') return '#e05252'
  if (severity === 'medium')  return '#c9a96e'
  return '#6fcf97'
}

// ─── Version Card ─────────────────────────────────────────────────────────────

function VersionCard({ v, onPromote, onArchive, dm }: {
  v: ModelVersion
  onPromote: (id: string, from: ModelStatus) => void
  onArchive: (id: string) => void
  dm: boolean
}) {
  const bord  = dm ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'
  const muted = dm ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.4)'
  const text  = dm ? 'rgba(244,240,230,.85)' : '#0e0e0d'
  const st    = statusStyle(v.status)

  const canPromote = v.status === 'draft' || v.status === 'shadow' || v.status === 'staged'
  const canArchive = v.status !== 'archived' && v.status !== 'rolled_back'

  return (
    <div style={{ background: dm ? '#0e2416' : '#fff', border: `1px solid ${v.status === 'production' ? '#c9a96e' : bord}`, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '.88rem', fontWeight: 500, color: text }}>{v.version_tag}</span>
            <span style={{ padding: '2px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.08em', textTransform: 'uppercase', background: st.bg, color: st.color }}>
              {v.status}
            </span>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>{v.version_id.slice(0, 20)}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canPromote && (
            <button onClick={() => onPromote(v.version_id, v.status)}
              style={{ padding: '5px 12px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              → Promover
            </button>
          )}
          {canArchive && v.status !== 'production' && (
            <button onClick={() => onArchive(v.version_id)}
              style={{ padding: '5px 12px', background: 'transparent', color: muted, border: `1px solid ${bord}`, fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Arquivar
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          { label: 'Accuracy', val: v.accuracy_score != null ? `${(v.accuracy_score * 100).toFixed(1)}%` : '—' },
          { label: 'MAE',      val: v.mae != null ? v.mae.toFixed(3) : '—' },
          { label: 'R²',       val: v.r2  != null ? v.r2.toFixed(3)  : '—' },
          { label: 'Features', val: v.feature_count ?? '—' },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', padding: '8px 0', border: `1px solid ${bord}` }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: '#1c4a35', lineHeight: 1 }}>{String(m.val)}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginTop: 3 }}>{m.label}</div>
          </div>
        ))}
      </div>
      {v.notes && <div style={{ marginTop: 10, fontSize: '.75rem', color: muted, fontStyle: 'italic' }}>{v.notes}</div>}
      <div style={{ marginTop: 8, fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>
        Criado: {new Date(v.created_at).toLocaleDateString('pt-PT')}
        {v.promoted_at ? ` · Promovido: ${new Date(v.promoted_at).toLocaleDateString('pt-PT')}` : ''}
        {v.created_by ? ` · Por: ${v.created_by}` : ''}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PortalModelControl() {
  const dm = useUIStore(s => s.darkMode)

  const [versions,  setVersions]  = useState<ModelVersion[]>([])
  const [production, setProd]     = useState<ModelVersion | null>(null)
  const [drift,     setDrift]     = useState<DriftReport | null>(null)
  const [calibration, setCalib]   = useState<CalibrationRec[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [tab,       setTab]       = useState<'versions' | 'drift' | 'calibration'>('versions')
  const [byStatus,  setByStatus]  = useState<Record<string, number>>({})
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const card  = dm ? '#0e2416' : '#fff'
  const bord  = dm ? 'rgba(201,169,110,.1)' : 'rgba(14,14,13,.08)'
  const muted = dm ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.4)'
  const text  = dm ? 'rgba(244,240,230,.85)' : '#0e0e0d'

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const [versRes, driftRes, calibRes] = await Promise.allSettled([
        fetch('/api/analytics/model-versions', { headers }),
        fetch('/api/analytics/model-drift',    { headers }),
        fetch('/api/analytics/calibration?view=recommendations&limit=20', { headers }),
      ])

      if (versRes.status === 'fulfilled' && versRes.value.ok) {
        const d = await versRes.value.json()
        setVersions(Array.isArray(d.versions) ? d.versions : [])
        setProd(d.production_version ?? null)
        setByStatus(d.by_status ?? {})
      }
      if (driftRes.status === 'fulfilled' && driftRes.value.ok) {
        const d = await driftRes.value.json()
        setDrift(d.report ?? d.data ?? d)
      }
      if (calibRes.status === 'fulfilled' && calibRes.value.ok) {
        const d = await calibRes.value.json()
        setCalib(Array.isArray(d.recommendations) ? d.recommendations : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Model Control')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function promote(versionId: string, from: ModelStatus) {
    const next: Record<ModelStatus, ModelStatus> = {
      draft: 'shadow', shadow: 'staged', staged: 'production',
      production: 'production', archived: 'archived', rolled_back: 'archived',
    }
    const toStatus = next[from]
    setActionMsg(`A promover para ${toStatus}…`)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/analytics/model-versions', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'promote', version_id: versionId, to_status: toStatus }),
      })
      const data = await res.json()
      if (res.ok) { setActionMsg(`✓ Promovido para ${toStatus}`); await load() }
      else setActionMsg(`Erro: ${data.error}`)
    } catch (e) { setActionMsg(e instanceof Error ? e.message : 'Erro') }
    setTimeout(() => setActionMsg(null), 3000)
  }

  async function archive(versionId: string) {
    setActionMsg('A arquivar…')
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/analytics/model-versions', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'archive', version_id: versionId }),
      })
      if (res.ok) { setActionMsg('✓ Arquivado'); await load() }
      else setActionMsg('Erro ao arquivar')
    } catch (e) { setActionMsg(e instanceof Error ? e.message : 'Erro') }
    setTimeout(() => setActionMsg(null), 3000)
  }

  async function applyCalib(recId: string) {
    setActionMsg('A aplicar calibração…')
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/analytics/calibration', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'apply', recommendation_id: recId }),
      })
      if (res.ok) { setActionMsg('✓ Calibração aplicada'); await load() }
      else { const d = await res.json(); setActionMsg(`Erro: ${d.error}`) }
    } catch (e) { setActionMsg(e instanceof Error ? e.message : 'Erro') }
    setTimeout(() => setActionMsg(null), 3000)
  }

  const tabs = [
    { id: 'versions' as const,     label: `Versões (${versions.length})` },
    { id: 'drift' as const,        label: drift?.drift_detected ? '⚠ Drift Detectado' : 'Drift Analysis' },
    { id: 'calibration' as const,  label: `Calibração (${calibration.length})` },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 300, color: dm ? '#c9a96e' : '#1c4a35', letterSpacing: '.04em' }}>Model Control Center</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginTop: 4 }}>
            Versionamento · Drift · Calibração Automática
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {actionMsg && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: '#c9a96e', letterSpacing: '.06em' }}>{actionMsg}</span>}
          <button onClick={load} disabled={loading}
            style={{ background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '8px 18px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.16em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .5 : 1 }}>
            {loading ? '...' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', padding: '12px 16px', color: '#e05252', fontFamily: "'DM Mono',monospace", fontSize: '.5rem' }}>{error}</div>}

      {/* Production version banner */}
      {production && (
        <div style={{ background: dm ? '#122a1a' : 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2cc96a', flexShrink: 0 }} />
          <div>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#2cc96a', marginRight: 12 }}>PRODUÇÃO</span>
            <span style={{ fontSize: '.84rem', color: text, fontWeight: 500 }}>{production.version_tag}</span>
          </div>
          {production.accuracy_score != null && (
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted, marginLeft: 'auto' }}>
              Accuracy {(production.accuracy_score * 100).toFixed(1)}% · MAE {production.mae?.toFixed(3) ?? '—'} · R² {production.r2?.toFixed(3) ?? '—'}
            </span>
          )}
        </div>
      )}

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 12 }}>
        {(['draft','shadow','staged','production','archived'] as ModelStatus[]).map(s => (
          <div key={s} style={{ background: card, border: `1px solid ${bord}`, padding: '12px 16px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 300, color: statusStyle(s).color, lineHeight: 1 }}>{byStatus[s] ?? 0}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${bord}`, display: 'flex' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.14em', textTransform: 'uppercase', border: 'none', borderBottom: tab === t.id ? '2px solid #c9a96e' : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === t.id ? '#c9a96e' : (t.id === 'drift' && drift?.drift_detected ? '#e05252' : muted), transition: 'all .2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Versions */}
      {tab === 'versions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ height: 100, background: 'rgba(14,14,13,.04)', animation: 'ag-pulse 1.4s ease-in-out infinite' }}>
              <style>{`@keyframes ag-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
            </div>
          ) : versions.length === 0 ? (
            <div style={{ background: card, border: `1px solid ${bord}`, padding: 40, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>
              SEM VERSÕES REGISTADAS
            </div>
          ) : (
            versions.map(v => (
              <VersionCard key={v.version_id} v={v} onPromote={promote} onArchive={archive} dm={dm} />
            ))
          )}
        </div>
      )}

      {/* Drift */}
      {tab === 'drift' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!drift ? (
            <div style={{ background: card, border: `1px solid ${bord}`, padding: 40, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>
              SEM RELATÓRIO DE DRIFT. USE ?recompute=true PARA GERAR.
            </div>
          ) : (
            <>
              <div style={{ background: card, border: `1px solid ${drift.drift_detected ? 'rgba(224,82,82,.3)' : bord}`, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: drift.drift_detected ? '#e05252' : '#2cc96a', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: drift.drift_detected ? '#e05252' : '#2cc96a' }}>
                    {drift.drift_detected ? 'DRIFT DETECTADO' : 'SISTEMA ESTÁVEL'}
                  </span>
                  {drift.generated_at && (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted, marginLeft: 'auto' }}>
                      {new Date(drift.generated_at).toLocaleString('pt-PT')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'MAE Actual',   val: drift.mae_current?.toFixed(3) ?? '—' },
                    { label: 'MAE Baseline', val: drift.mae_baseline?.toFixed(3) ?? '—' },
                    { label: 'MAE Drift',    val: drift.mae_drift_pct != null ? `${drift.mae_drift_pct.toFixed(1)}%` : '—' },
                    { label: 'R² Actual',    val: drift.r2_current?.toFixed(3) ?? '—' },
                    { label: 'R² Baseline',  val: drift.r2_baseline?.toFixed(3) ?? '—' },
                  ].map(m => (
                    <div key={m.label} style={{ background: dm ? '#122a1a' : 'rgba(14,14,13,.03)', border: `1px solid ${bord}`, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 300, color: '#1c4a35', lineHeight: 1 }}>{m.val}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.41rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginTop: 4 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
                {drift.recommended_action && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.2)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 4 }}>Acção Recomendada</div>
                    <div style={{ fontSize: '.8rem', color: text }}>{drift.recommended_action}</div>
                  </div>
                )}
              </div>

              {Array.isArray(drift.zone_drifts) && drift.zone_drifts.length > 0 && (
                <div style={{ background: card, border: `1px solid ${bord}`, padding: 20 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 14 }}>Drift por Zona</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {drift.zone_drifts.map((z, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 80, fontFamily: "'DM Mono',monospace", fontSize: '.44rem', textTransform: 'uppercase', color: muted }}>{z.zone}</div>
                        <div style={{ flex: 1, height: 6, background: 'rgba(14,14,13,.08)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.abs(z.drift_pct))}%`, height: '100%', background: driftSeverityColor(z.severity), borderRadius: 3, transition: 'width .4s' }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: driftSeverityColor(z.severity), minWidth: 40, textAlign: 'right' }}>{z.drift_pct.toFixed(1)}%</span>
                        <span style={{ padding: '2px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase', background: `${driftSeverityColor(z.severity)}18`, color: driftSeverityColor(z.severity) }}>{z.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Calibration */}
      {tab === 'calibration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {calibration.length === 0 ? (
            <div style={{ background: card, border: `1px solid ${bord}`, padding: 40, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>
              SEM RECOMENDAÇÕES DE CALIBRAÇÃO PENDENTES
            </div>
          ) : calibration.map((c, i) => (
            <div key={c.id ?? i} style={{ background: card, border: `1px solid ${bord}`, padding: '16px 20px', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 16, alignItems: 'center' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.08em', textTransform: 'uppercase', color: muted }}>{c.zone_key ?? '—'}</div>
              <div>
                <div style={{ fontSize: '.82rem', color: text, marginBottom: 2 }}>{c.feature ?? c.rationale ?? '—'}</div>
                {c.rationale && c.feature && <div style={{ fontSize: '.72rem', color: muted, fontStyle: 'italic' }}>{c.rationale}</div>}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>Actual</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: text }}>{c.current_value?.toFixed(2) ?? '—'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: muted }}>Recomendado</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: '#c9a96e' }}>{c.recommended_value?.toFixed(2) ?? '—'}</div>
              </div>
              <button onClick={() => c.id && applyCalib(c.id)}
                style={{ padding: '6px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Aplicar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
