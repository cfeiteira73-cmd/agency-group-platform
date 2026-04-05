'use client'
import { useUIStore } from '../stores/uiStore'
import { useAVMStore } from '../stores/avmStore'

interface PortalAVMProps {
  onRunAVM: () => Promise<void>
  onAddToPortfolio?: (data: Record<string, unknown>) => void
}

// ─── Gauge SVG ────────────────────────────────────────────────────────────────
function Gauge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1)
  const r = 40
  const cx = 50
  const cy = 52
  const circumference = Math.PI * r
  const dash = circumference * pct
  const gap = circumference - dash
  const color = pct > 0.8 ? '#22c55e' : pct > 0.6 ? '#c9a96e' : '#e05252'

  // Arc: starts at 180deg (left), ends at 0deg (right) — top semi-circle
  const startX = cx - r
  const startY = cy
  const endX = cx + r
  const endY = cy

  return (
    <svg width="100" height="60" viewBox="0 0 100 60" style={{ overflow: 'visible' }}>
      {/* Track */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        fill="none"
        stroke="rgba(14,14,13,.08)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ transition: 'stroke-dasharray .6s ease, stroke .4s ease' }}
      />
      {/* Value label */}
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontFamily: "'Cormorant',serif", fontSize: '13px', fill: color, fontWeight: 600 }}>
        {value}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '6px', fill: 'rgba(14,14,13,.35)', letterSpacing: '.1em' }}>
        CONFIANÇA
      </text>
    </svg>
  )
}

// ─── Inline Bar ───────────────────────────────────────────────────────────────
function InlineBar({ pct, color = '#1c4a35' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: '4px', background: 'rgba(14,14,13,.06)', borderRadius: '2px', overflow: 'hidden', minWidth: '60px' }}>
      <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: '2px', transition: 'width .5s ease' }} />
    </div>
  )
}

// ─── Preços de referência por zona ───────────────────────────────────────────
const ZONA_PRICES: Record<string, number> = {
  'Lisboa — Chiado': 9800,
  'Lisboa — Príncipe Real': 9200,
  'Lisboa — Bairro Alto': 8800,
  'Lisboa — Alfama': 7400,
  'Lisboa — Belém': 7100,
  'Lisboa — Parque das Nações': 6800,
  'Lisboa — Avenidas Novas': 6400,
  'Cascais': 5890,
  'Estoril': 5600,
  'Sintra': 3200,
  'Oeiras': 4100,
  'Porto — Foz': 5200,
  'Porto — Boavista': 4600,
  'Porto — Ribeira': 4900,
  'Algarve — Lagos': 4800,
  'Algarve — Albufeira': 4200,
  'Algarve — Vilamoura': 5100,
  'Comporta': 6500,
  'Alentejo': 1800,
  'Madeira — Funchal': 3760,
  'Açores — Ponta Delgada': 1952,
}

export default function PortalAVM({ onRunAVM, onAddToPortfolio }: PortalAVMProps) {
  const { darkMode } = useUIStore()
  const {
    avmResult, avmLoading,
    avmZona, setAvmZona,
    avmTipo, setAvmTipo,
    avmArea, setAvmArea,
    avmEstado, setAvmEstado,
    avmVista, setAvmVista,
    avmPiscina, setAvmPiscina,
    avmGaragem, setAvmGaragem,
    avmEpc, setAvmEpc,
    avmAndar, setAvmAndar,
    avmOrientacao, setAvmOrientacao,
    avmAnoConstr, setAvmAnoConstr,
    avmTerraco, setAvmTerraco,
    avmCasasBanho, setAvmCasasBanho,
    avmUso, setAvmUso,
  } = useAVMStore()

  const ZONAS = [
    'Lisboa — Chiado','Lisboa — Príncipe Real','Lisboa — Bairro Alto','Lisboa — Alfama','Lisboa — Belém',
    'Lisboa — Parque das Nações','Lisboa — Avenidas Novas','Cascais','Estoril','Sintra','Oeiras',
    'Porto — Foz','Porto — Boavista','Porto — Ribeira','Algarve — Lagos','Algarve — Albufeira',
    'Algarve — Vilamoura','Comporta','Alentejo','Madeira — Funchal','Açores — Ponta Delgada',
  ]

  const res = avmResult as Record<string, unknown> | null

  // Normalize field names (API pode devolver camelCase ou snake_case)
  const valorCentral = Number(res?.valor_central ?? res?.valorEstimado ?? 0)
  const valorMin = Number(res?.valor_min ?? res?.valorMin ?? 0)
  const valorMax = Number(res?.valor_max ?? res?.valorMax ?? 0)
  const precoM2 = Number(res?.preco_m2 ?? res?.precoM2 ?? 0)
  const confianca = Number(res?.confianca ?? res?.confidenceScore ?? 0)
  const yieldBruto = res?.yield_bruto ?? res?.yieldEstimado ?? '—'
  const liquidez = String(res?.liquidez ?? res?.tempoVenda ?? '—')
  const rendaEstimada = Number(res?.renda_estimada ?? res?.rendaEstimada ?? 0)

  const metodologias = (res?.metodologias ?? res?.methodologies ?? []) as Array<{
    nome: string; valor: number; peso: number
  }>
  const comparaveis = (res?.comparaveis ?? res?.comparables ?? []) as Array<{
    morada: string; area: number; valor: number; distancia: number; ajuste: number
  }>

  const confidenceLabel = confianca > 80 ? 'Alta Confiança' : confianca > 60 ? 'Confiança Moderada' : 'Confiança Baixa'
  const confidenceColor = confianca > 80 ? '#22c55e' : confianca > 60 ? '#c9a96e' : '#e05252'

  // Comparável badge
  const comparavelBadge = (ajuste: number) => {
    if (ajuste < -5) return { label: 'Inferior', color: '#e05252', bg: 'rgba(224,82,82,.08)' }
    if (ajuste > 5) return { label: 'Superior', color: '#1c4a35', bg: 'rgba(28,74,53,.08)' }
    return { label: 'Similar', color: '#c9a96e', bg: 'rgba(201,169,110,.1)' }
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Avaliação Automática de Imóveis</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>AVM Inteligente</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>6 metodologias RICS · Comparáveis em tempo real · Relatório PDF</div>
      </div>

      <div className="p-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="p-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="p-label">Zona / Localização</label>
                <select className="p-sel" value={avmZona} onChange={e => setAvmZona(e.target.value)}>
                  {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Tipologia</label>
                <select className="p-sel" value={avmTipo} onChange={e => setAvmTipo(e.target.value)}>
                  {['T0','T1','T2','T3','T4','T5+','Moradia','Villa','Penthouse','Loja','Escritório'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Área (m²)</label>
                <input className="p-inp" type="number" placeholder="ex: 120" value={avmArea} onChange={e => setAvmArea(e.target.value)} />
              </div>
              <div>
                <label className="p-label">Estado</label>
                <select className="p-sel" value={avmEstado} onChange={e => setAvmEstado(e.target.value)}>
                  {['Novo','Excelente','Bom','Razoável','Para Renovar'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Vista</label>
                <select className="p-sel" value={avmVista} onChange={e => setAvmVista(e.target.value)}>
                  {['interior','jardim','cidade','mar','rio','campo'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Andar</label>
                <select className="p-sel" value={avmAndar} onChange={e => setAvmAndar(e.target.value)}>
                  {['rc','1-2','3-5','6+'].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Certificado Energético</label>
                <select className="p-sel" value={avmEpc} onChange={e => setAvmEpc(e.target.value)}>
                  {['A+','A','B','B-','C','D','E','F'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Garagem</label>
                <select className="p-sel" value={avmGaragem} onChange={e => setAvmGaragem(e.target.value)}>
                  {['sem','1','2','box'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Piscina</label>
                <select className="p-sel" value={avmPiscina} onChange={e => setAvmPiscina(e.target.value)}>
                  <option value="nao">Sem piscina</option>
                  <option value="sim">Com piscina</option>
                </select>
              </div>
              <div>
                <label className="p-label">Casas de Banho</label>
                <select className="p-sel" value={avmCasasBanho} onChange={e => setAvmCasasBanho(e.target.value)}>
                  {['1','2','3','4+'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Ano Construção</label>
                <input className="p-inp" type="number" placeholder="ex: 2005" value={avmAnoConstr} onChange={e => setAvmAnoConstr(e.target.value)} />
              </div>
              <div>
                <label className="p-label">Terraço (m²)</label>
                <input className="p-inp" type="number" placeholder="0" value={avmTerraco} onChange={e => setAvmTerraco(e.target.value)} />
              </div>
              <div>
                <label className="p-label">Orientação</label>
                <select className="p-sel" value={avmOrientacao} onChange={e => setAvmOrientacao(e.target.value)}>
                  <option value="">— Não especificado</option>
                  {['Norte','Sul','Este','Oeste','Sul-Nascente','Sul-Poente'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Uso</label>
                <select className="p-sel" value={avmUso} onChange={e => setAvmUso(e.target.value)}>
                  <option value="habitacao">Habitação</option>
                  <option value="comercial">Comercial</option>
                  <option value="investimento">Investimento</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <button className="p-btn" style={{ width: '100%' }} onClick={onRunAVM} disabled={avmLoading}>
                  {avmLoading ? '✦ A calcular...' : '✦ Avaliar Imóvel'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Painel de referência de mercado ─────────────────────────────── */}
          <div className="p-card" style={{ marginTop: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '10px' }}>Referência de Mercado · €/m²</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(ZONA_PRICES)
                .sort((a, b) => b[1] - a[1])
                .map(([zona, preco]) => {
                  const isActive = avmZona === zona
                  const maxPrice = 10000
                  const barPct = preco / maxPrice
                  return (
                    <div
                      key={zona}
                      onClick={() => setAvmZona(zona)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px',
                        cursor: 'pointer',
                        background: isActive ? 'rgba(28,74,53,.06)' : 'transparent',
                        border: isActive ? '1px solid rgba(28,74,53,.15)' : '1px solid transparent',
                        borderRadius: '2px',
                        transition: 'background .15s',
                      }}
                    >
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: isActive ? '#1c4a35' : 'rgba(14,14,13,.55)', width: '140px', flexShrink: 0, fontWeight: isActive ? 700 : 400 }}>{zona}</div>
                      <InlineBar pct={barPct} color={isActive ? '#1c4a35' : 'rgba(28,74,53,.25)'} />
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: isActive ? '#1c4a35' : 'rgba(14,14,13,.5)', width: '52px', textAlign: 'right', flexShrink: 0, fontWeight: isActive ? 700 : 400 }}>
                        €{preco.toLocaleString('pt-PT')}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        <div>
          {!avmResult && !avmLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏠</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: darkMode ? 'rgba(244,240,230,.5)' : 'rgba(14,14,13,.4)', marginBottom: '8px' }}>Aguarda avaliação</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.3)', lineHeight: 1.6 }}>Preencha os dados e clique em Avaliar</div>
            </div>
          )}

          {avmLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A calcular avaliação...</div>
            </div>
          )}

          {avmResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── Hero valor ─────────────────────────────────────────────── */}
              <div className="p-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '6px' }}>Valor de Mercado Estimado</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.5rem', color: '#1c4a35', fontWeight: 300, lineHeight: 1, marginBottom: '8px' }}>
                      €{valorCentral.toLocaleString('pt-PT')}
                    </div>
                    {/* Confidence interval */}
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', marginBottom: '10px' }}>
                      €{valorMin.toLocaleString('pt-PT')} <span style={{ color: 'rgba(14,14,13,.2)', margin: '0 4px' }}>—</span> €{valorMax.toLocaleString('pt-PT')}
                    </div>
                    {/* Confidence interval bar */}
                    {valorMin > 0 && valorMax > 0 && (
                      <div style={{ position: 'relative', height: '6px', background: 'rgba(14,14,13,.06)', borderRadius: '3px', marginBottom: '10px', overflow: 'visible' }}>
                        {(() => {
                          const range = valorMax - valorMin
                          const leftPct = range > 0 ? ((valorCentral - valorMin) / range) * 80 : 40
                          return (
                            <>
                              <div style={{ position: 'absolute', left: '10%', right: '10%', top: 0, bottom: 0, background: 'rgba(28,74,53,.15)', borderRadius: '3px' }} />
                              <div style={{ position: 'absolute', left: `calc(10% + ${leftPct * 0.8}%)`, top: '-3px', width: '12px', height: '12px', background: '#1c4a35', borderRadius: '50%', transform: 'translateX(-50%)' }} />
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {/* Confidence badge */}
                    {confianca > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: `${confidenceColor}12`, border: `1px solid ${confidenceColor}30`, borderRadius: '20px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: confidenceColor }} />
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: confidenceColor, letterSpacing: '.05em' }}>{confidenceLabel} · {confianca}%</span>
                      </div>
                    )}
                  </div>
                  {/* Gauge */}
                  {confianca > 0 && (
                    <div style={{ flexShrink: 0 }}>
                      <Gauge value={confianca} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Grid 4 KPIs ─────────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Renda Est./mês', val: rendaEstimada > 0 ? `€${rendaEstimada.toLocaleString('pt-PT')}` : '—' },
                  { label: 'Yield Bruto', val: yieldBruto ? `${yieldBruto}%` : '—' },
                  { label: 'Tempo de Venda', val: liquidez },
                  { label: 'Preço / m²', val: precoM2 > 0 ? `€${precoM2.toLocaleString('pt-PT')}` : '—' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '14px 16px', background: 'rgba(28,74,53,.03)', border: '1px solid rgba(28,74,53,.07)', borderRadius: '2px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: '#1c4a35', fontWeight: 300 }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* ── Metodologias ─────────────────────────────────────────────── */}
              {metodologias.length > 0 && (
                <div className="p-card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>Breakdown de Metodologias</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {metodologias.map((m, i) => {
                      const contrib = (m.valor * m.peso) / 100
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.7)' }}>{m.nome}</div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>peso {m.peso}%</span>
                              <span style={{ fontFamily: "'Cormorant',serif", fontSize: '.9rem', color: '#1c4a35', fontWeight: 500 }}>€{contrib.toLocaleString('pt-PT')}</span>
                            </div>
                          </div>
                          <InlineBar pct={m.peso / 100} color="#1c4a35" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Comparáveis ──────────────────────────────────────────────── */}
              {comparaveis.length > 0 && (
                <div className="p-card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>Comparáveis de Mercado</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {comparaveis.slice(0, 5).map((c, i) => {
                      const badge = comparavelBadge(c.ajuste ?? 0)
                      const pm2 = c.area > 0 ? Math.round(c.valor / c.area) : 0
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.06)', borderRadius: '2px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.75)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.morada}</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>{c.area}m²</span>
                              {pm2 > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>€{pm2.toLocaleString('pt-PT')}/m²</span>}
                              {c.distancia > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)' }}>{c.distancia}km</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#1c4a35', marginBottom: '4px' }}>€{c.valor.toLocaleString('pt-PT')}</div>
                            <div style={{ display: 'inline-block', padding: '2px 8px', background: badge.bg, borderRadius: '10px' }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: badge.color, letterSpacing: '.05em' }}>
                                {badge.label}{c.ajuste !== 0 ? ` ${c.ajuste > 0 ? '+' : ''}${c.ajuste}%` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Botão Adicionar ao Portfólio ─────────────────────────────── */}
              {onAddToPortfolio && (
                <button
                  className="p-btn"
                  style={{ width: '100%', background: 'transparent', border: '1px solid rgba(28,74,53,.3)', color: '#1c4a35' }}
                  onClick={() => onAddToPortfolio({
                    zona: avmZona, tipo: avmTipo, area: avmArea,
                    valorEstimado: valorCentral, precoM2, yieldBruto, rendaEstimada,
                  })}
                >
                  + Adicionar ao Portfólio
                </button>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
