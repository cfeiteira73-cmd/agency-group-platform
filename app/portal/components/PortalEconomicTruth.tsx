'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TruthEvent {
  id?: string
  property_id: string
  zone_key: string
  asset_class: string
  price_band: string
  avm_accuracy_score: number
  negotiation_score: number
  time_to_close_score: number
  routing_efficiency_score: number
  spread_vs_predicted_score: number
  raw_truth_score: number
  normalized_truth_score?: number
  avm_error_pct: number
  negotiation_delta_pct: number
  routing_precision_pct: number
  spread_error_pct: number
  created_at?: string
}

interface ZoneSummary {
  zone_key: string
  count: number
  avg_raw: number
  avg_normalized: number
  avg_avm_accuracy: number
  avg_negotiation: number
  avg_time: number
  avg_routing: number
  avg_spread: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

function scoreBar(value: number, color: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(14,14,13,.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color, minWidth: 28, textAlign: 'right' }}>{Math.round(value)}</span>
    </div>
  )
}

function componentColor(name: string): string {
  const map: Record<string, string> = {
    avm:         '#3a7bd5',
    negotiation: '#1c4a35',
    time:        '#c9a96e',
    routing:     '#6fcf97',
    spread:      '#9b8cff',
  }
  return map[name] ?? '#888'
}

const WEIGHTS = { avm: 0.25, negotiation: 0.30, time: 0.20, routing: 0.15, spread: 0.10 }

// ─── Component breakdown ──────────────────────────────────────────────────────

function ComponentBreakdown({ event }: { event: TruthEvent }) {
  const components = [
    { key: 'avm',         label: 'AVM Accuracy',    value: event.avm_accuracy_score,        weight: WEIGHTS.avm,         detail: `Erro: ${event.avm_error_pct.toFixed(1)}%` },
    { key: 'negotiation', label: 'Negociação',       value: event.negotiation_score,          weight: WEIGHTS.negotiation, detail: `Delta: ${event.negotiation_delta_pct.toFixed(1)}%` },
    { key: 'time',        label: 'Tempo de Fecho',   value: event.time_to_close_score,        weight: WEIGHTS.time,        detail: '' },
    { key: 'routing',     label: 'Ef. Distribuição', value: event.routing_efficiency_score,   weight: WEIGHTS.routing,     detail: `Precisão: ${event.routing_precision_pct.toFixed(0)}%` },
    { key: 'spread',      label: 'Spread Previsto',  value: event.spread_vs_predicted_score,  weight: WEIGHTS.spread,      detail: `Erro: ${event.spread_error_pct.toFixed(1)}%` },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {components.map(c => (
        <div key={c.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '.75rem', color: 'rgba(14,14,13,.7)' }}>{c.label}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)' }}>
              {(c.weight * 100).toFixed(0)}% peso{c.detail ? ` · ${c.detail}` : ''}
            </span>
          </div>
          {scoreBar(c.value, componentColor(c.key))}
        </div>
      ))}
    </div>
  )
}

// ─── Zone summary card ────────────────────────────────────────────────────────

function ZoneCard({ z, selected, onClick, dm }: { z: ZoneSummary; selected: boolean; onClick: () => void; dm: boolean }) {
  const bord = dm ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'
  const scoreC = z.avg_normalized
    ? (z.avg_normalized >= 100 ? '#2cc96a' : z.avg_normalized >= 80 ? '#c9a96e' : '#e05252')
    : (z.avg_raw >= 70 ? '#2cc96a' : z.avg_raw >= 50 ? '#c9a96e' : '#e05252')
  return (
    <button onClick={onClick} style={{
      background: selected ? (dm ? '#122a1a' : 'rgba(28,74,53,.06)') : (dm ? '#0e2416' : '#fff'),
      border: `${selected ? 2 : 1}px solid ${selected ? '#c9a96e' : bord}`,
      padding: '16px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all .2s',
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: 6 }}>{z.zone_key}</div>
      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', fontWeight: 300, color: scoreC, lineHeight: 1 }}>
        {z.avg_normalized ? z.avg_normalized.toFixed(0) : z.avg_raw.toFixed(0)}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)', marginTop: 4 }}>
        {z.count} eventos · {z.avg_normalized ? 'normalizado' : 'raw'}
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalEconomicTruth() {
  const dm = useUIStore(s => s.darkMode)

  const [events, setEvents]       = useState<TruthEvent[]>([])
  const [zones, setZones]         = useState<ZoneSummary[]>([])
  const [selected, setSelected]   = useState<TruthEvent | null>(null)
  const [selectedZone, setSelZone] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [view, setView]           = useState<'zones' | 'events' | 'compute'>('zones')

  // Compute inputs
  const [cAskPrice, setCaskPrice] = useState('')
  const [cFinalPrice, setCFinalPrice] = useState('')
  const [cAvmPrice, setCAvmPrice] = useState('')
  const [cSysPredicted, setCSysPredicted] = useState('')
  const [cNegoDays, setCNegoDays] = useState('')
  const [cContacted, setCContacted] = useState('')
  const [cConverted, setCConverted] = useState('')
  const [cZone, setCZone] = useState('lisboa')
  const [cClass, setCClass] = useState('residential')
  const [cBand, setCBand] = useState('500k-1m')
  const [cResult, setCResult] = useState<TruthEvent | null>(null)
  const [cLoading, setCLoading] = useState(false)

  const card  = dm ? '#0e2416' : '#fff'
  const bord  = dm ? 'rgba(201,169,110,.1)' : 'rgba(14,14,13,.08)'
  const text  = dm ? 'rgba(244,240,230,.85)' : '#0e0e0d'
  const muted = dm ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.4)'

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/analytics/economic-truth?view=list&limit=100', { headers })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `HTTP ${res.status}`) }
      const data = await res.json()
      const evts: TruthEvent[] = Array.isArray(data.events) ? data.events : []
      setEvents(evts)

      // Aggregate by zone
      const byZone = new Map<string, TruthEvent[]>()
      evts.forEach(e => {
        if (!byZone.has(e.zone_key)) byZone.set(e.zone_key, [])
        byZone.get(e.zone_key)!.push(e)
      })
      const summaries: ZoneSummary[] = Array.from(byZone.entries()).map(([zone_key, zEvts]) => {
        const avg = (fn: (e: TruthEvent) => number) => zEvts.reduce((s, e) => s + fn(e), 0) / zEvts.length
        return {
          zone_key,
          count:            zEvts.length,
          avg_raw:          Math.round(avg(e => e.raw_truth_score)),
          avg_normalized:   zEvts.some(e => e.normalized_truth_score) ? Math.round(avg(e => e.normalized_truth_score ?? e.raw_truth_score)) : 0,
          avg_avm_accuracy: Math.round(avg(e => e.avm_accuracy_score)),
          avg_negotiation:  Math.round(avg(e => e.negotiation_score)),
          avg_time:         Math.round(avg(e => e.time_to_close_score)),
          avg_routing:      Math.round(avg(e => e.routing_efficiency_score)),
          avg_spread:       Math.round(avg(e => e.spread_vs_predicted_score)),
        }
      }).sort((a, b) => b.avg_raw - a.avg_raw)
      setZones(summaries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Economic Truth')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredEvents = selectedZone ? events.filter(e => e.zone_key === selectedZone) : events

  async function computeTruth() {
    const ap = parseFloat(cAskPrice), fp = parseFloat(cFinalPrice), av = parseFloat(cAvmPrice)
    const sp = parseFloat(cSysPredicted), nd = parseInt(cNegoDays), rc = parseInt(cContacted), rv = parseInt(cConverted)
    if (!ap || !fp || !av || !sp || !nd || !rc) return
    setCLoading(true); setCResult(null)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/analytics/economic-truth', {
        method: 'POST', headers,
        body: JSON.stringify({
          action: 'compute',
          inputs: {
            property_id: `manual-${Date.now()}`,
            zone_key: cZone, asset_class: cClass, price_band: cBand,
            asking_price: ap, final_sale_price: fp,
            avm_predicted_price: av, system_predicted_price: sp,
            negotiation_days: nd, recipients_contacted: rc, recipients_converted: rv || 0,
          },
        }),
      })
      const data = await res.json()
      if (data.result) setCResult(data.result)
      else throw new Error(data.error ?? 'Erro no cálculo')
    } catch (e) { alert(e instanceof Error ? e.message : 'Erro') }
    finally { setCLoading(false) }
  }

  const tabs = [
    { id: 'zones' as const,   label: 'Por Zona' },
    { id: 'events' as const,  label: `Eventos (${events.length})` },
    { id: 'compute' as const, label: '⚡ Calcular' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 300, color: dm ? '#c9a96e' : '#1c4a35', letterSpacing: '.04em' }}>Economic Truth Engine</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginTop: 4 }}>
            AVM 25% · Negociação 30% · Tempo 20% · Distribuição 15% · Spread 10%
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '8px 18px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.16em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .5 : 1 }}>
          {loading ? '...' : '↻ Actualizar'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', padding: '12px 16px', color: '#e05252', fontFamily: "'DM Mono',monospace", fontSize: '.5rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${bord}`, display: 'flex' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            style={{ padding: '10px 20px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.14em', textTransform: 'uppercase', border: 'none', borderBottom: view === t.id ? '2px solid #c9a96e' : '2px solid transparent', background: 'none', cursor: 'pointer', color: view === t.id ? '#c9a96e' : muted, transition: 'all .2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Zones view */}
      {view === 'zones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ height: 90, background: 'rgba(14,14,13,.04)', animation: 'ag-pulse 1.4s ease-in-out infinite' }} />)}
              <style>{`@keyframes ag-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
            </div>
          ) : zones.length === 0 ? (
            <div style={{ background: card, border: `1px solid ${bord}`, padding: 40, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 300, color: muted, marginBottom: 8 }}>Sem dados ainda</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: muted }}>USE A ABA CALCULAR PARA REGISTAR O PRIMEIRO EVENTO</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {zones.map(z => (
                  <ZoneCard key={z.zone_key} z={z} selected={selectedZone === z.zone_key} onClick={() => setSelZone(selectedZone === z.zone_key ? null : z.zone_key)} dm={dm} />
                ))}
              </div>
              {selectedZone && (() => {
                const z = zones.find(z => z.zone_key === selectedZone)
                if (!z) return null
                const components = [
                  { key: 'avm', label: 'AVM Accuracy', value: z.avg_avm_accuracy },
                  { key: 'negotiation', label: 'Negociação', value: z.avg_negotiation },
                  { key: 'time', label: 'Tempo de Fecho', value: z.avg_time },
                  { key: 'routing', label: 'Distribuição', value: z.avg_routing },
                  { key: 'spread', label: 'Spread Previsto', value: z.avg_spread },
                ]
                return (
                  <div style={{ background: card, border: `1px solid ${bord}`, padding: 24 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 16 }}>{z.zone_key.toUpperCase()} — BREAKDOWN MÉDIO ({z.count} eventos)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {components.map(c => (
                        <div key={c.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: '.78rem', color: text }}>{c.label}</span>
                            <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: componentColor(c.key) }}>{c.value}</span>
                          </div>
                          {scoreBar(c.value, componentColor(c.key))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* Events view */}
      {view === 'events' && (
        <div style={{ background: card, border: `1px solid ${bord}`, overflow: 'hidden' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: muted, fontFamily: "'DM Mono',monospace", fontSize: '.48rem' }}>Sem eventos registados</div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${bord}` }}>
                    {['Propriedade', 'Zona', 'Classe', 'Score Raw', 'Norm.', 'AVM', 'Nego', 'Data'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.slice(0, 50).map((e, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${bord}`, cursor: 'pointer' }} onClick={() => setSelected(selected?.property_id === e.property_id ? null : e)}>
                      <td style={{ padding: '10px 14px', fontSize: '.78rem', color: text }}>{e.property_id.slice(0, 14)}{e.property_id.length > 14 ? '…' : ''}</td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>{e.zone_key}</td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>{e.asset_class}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: e.raw_truth_score >= 70 ? '#2cc96a' : e.raw_truth_score >= 50 ? '#c9a96e' : '#e05252' }}>{e.raw_truth_score}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>{e.normalized_truth_score ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: componentColor('avm') }}>{e.avm_accuracy_score}</td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: componentColor('negotiation') }}>{e.negotiation_score}</td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: muted }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('pt-PT') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected && (
                <div style={{ borderTop: `1px solid ${bord}`, padding: 20 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 16 }}>BREAKDOWN — {selected.property_id}</div>
                  <ComponentBreakdown event={selected} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Compute view */}
      {view === 'compute' && (
        <div style={{ background: card, border: `1px solid ${bord}`, padding: 28 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 20 }}>Calcular Score de Verdade Económica</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Preço Pedido (€)', val: cAskPrice, set: setCaskPrice },
              { label: 'Preço Final Venda (€)', val: cFinalPrice, set: setCFinalPrice },
              { label: 'AVM Previsto (€)', val: cAvmPrice, set: setCAvmPrice },
              { label: 'Sistema Previsto (€)', val: cSysPredicted, set: setCSysPredicted },
              { label: 'Dias Negociação', val: cNegoDays, set: setCNegoDays },
              { label: 'Contactados', val: cContacted, set: setCContacted },
              { label: 'Convertidos', val: cConverted, set: setCConverted },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 6, display: 'block' }}>{f.label}</label>
                <input type="number" value={f.val} onChange={e => f.set(e.target.value)} className="p-inp" placeholder="0" />
              </div>
            ))}
            <div>
              <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: muted, marginBottom: 6, display: 'block' }}>Zona</label>
              <select value={cZone} onChange={e => setCZone(e.target.value)} className="p-sel">
                {['lisboa','cascais','porto','algarve','madeira','comporta','sintra','ericeira'].map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <button onClick={computeTruth} disabled={cLoading || !cAskPrice || !cFinalPrice}
            className="p-btn" style={{ minWidth: 200 }}>
            {cLoading ? 'A calcular...' : '⚡ Calcular Score'}
          </button>
          {cResult && (
            <div style={{ marginTop: 24, padding: 20, background: dm ? '#122a1a' : 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '3rem', fontWeight: 300, color: cResult.raw_truth_score >= 70 ? '#2cc96a' : cResult.raw_truth_score >= 50 ? '#c9a96e' : '#e05252', lineHeight: 1 }}>{cResult.raw_truth_score}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', color: muted }}>/ 100 · Economic Truth Score</div>
              </div>
              <ComponentBreakdown event={cResult} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
