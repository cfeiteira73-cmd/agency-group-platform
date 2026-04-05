'use client'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { PIPELINE_STAGES, STAGE_PCT, STAGE_COLOR, CHECKLISTS } from './constants'
import type { Deal } from './types'

interface PortalPipelineProps {
  onToggleCheck: (dealId: number, fase: string, idx: number) => void
  onChangeFase: (dealId: number, fase: string) => void
  onAddDeal: () => void
  onDealRisk: (dealId: number) => Promise<void>
  onDealNego: (dealId: number) => Promise<void>
  exportToPDF: (title: string, html: string) => void
}

export default function PortalPipeline({
  onToggleCheck,
  onChangeFase,
  onAddDeal,
  onDealRisk,
  onDealNego,
  exportToPDF,
}: PortalPipelineProps) {
  const { darkMode } = useUIStore()
  const {
    deals,
    activeDeal, setActiveDeal,
    showNewDeal, setShowNewDeal,
    newDeal, setNewDeal,
    pipelineView, setPipelineView,
    pipelineSearch, setPipelineSearch,
    dealTab, setDealTab,
    dealRiskLoading, dealRiskAnalysis,
    dealNegoLoading, dealNego,
    makeOfferOpen, setMakeOfferOpen,
    offerMsg, setOfferMsg,
    dealRoomMsg, setDealRoomMsg,
    investorData, setInvestorData,
    invScenario, setInvScenario,
    taxRegime, setTaxRegime,
    tipoImovelInv, setTipoImovelInv,
  } = useDealStore()

  const pipelineTotal = deals.reduce((s, d) => s + parseFloat(d.valor.replace(/[^0-9.]/g, '')), 0)
  const activeDealObj = deals.find(d => d.id === activeDeal) || null
  const filteredDeals = deals.filter(d =>
    !pipelineSearch || d.imovel.toLowerCase().includes(pipelineSearch.toLowerCase()) || d.comprador.toLowerCase().includes(pipelineSearch.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '4px' }}>Gestão de Negócios</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>
            Pipeline CPCV · <span style={{ color: '#c9a96e' }}>€{(pipelineTotal / 1e6).toFixed(1)}M</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid rgba(14,14,13,.1)' }}>
            {(['lista', 'kanban'] as const).map(v => (
              <button key={v}
                style={{ padding: '6px 14px', background: pipelineView === v ? '#1c4a35' : 'transparent', color: pipelineView === v ? '#f4f0e6' : 'rgba(14,14,13,.45)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', border: 'none', cursor: 'pointer', letterSpacing: '.08em' }}
                onClick={() => setPipelineView(v)}>
                {v === 'lista' ? '☰ Lista' : '⠿ Kanban'}
              </button>
            ))}
          </div>
          <button className="p-btn p-btn-gold" style={{ padding: '6px 14px' }} onClick={() => setShowNewDeal(true)}>
            + Novo Deal
          </button>
        </div>
      </div>

      {/* Search */}
      <input className="p-inp" style={{ marginBottom: '16px' }} placeholder="Pesquisar deals..." value={pipelineSearch} onChange={e => setPipelineSearch(e.target.value)} />

      {/* New Deal Modal */}
      {showNewDeal && (
        <div style={{ padding: '16px', background: darkMode ? '#122a1a' : 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', marginBottom: '16px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '12px' }}>Novo Deal</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label className="p-label">Imóvel</label>
              <input className="p-inp" placeholder="Nome / Referência do imóvel" value={newDeal.imovel} onChange={e => setNewDeal({ ...newDeal, imovel: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Valor</label>
              <input className="p-inp" placeholder="€ 500.000" value={newDeal.valor} onChange={e => setNewDeal({ ...newDeal, valor: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="p-btn" onClick={onAddDeal} disabled={!newDeal.imovel || !newDeal.valor}>Adicionar</button>
            <button style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', cursor: 'pointer' }} onClick={() => setShowNewDeal(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {pipelineView === 'kanban' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.5rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)' }}>Vista Kanban</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: 'rgba(14,14,13,.25)' }}>Quadro Kanban por fase — disponível em breve</div>
        </div>
      )}

      {pipelineView === 'lista' && <div style={{ display: 'flex', gap: '20px', minHeight: 0 }}>
        {/* Deal List */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          {filteredDeals.map(deal => (
            <div key={deal.id}
              className={`deal-card${activeDeal === deal.id ? ' active' : ''}`}
              onClick={() => setActiveDeal(activeDeal === deal.id ? null : deal.id)}
              style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em' }}>{deal.ref}</div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STAGE_COLOR[deal.fase] || '#888', flexShrink: 0 }} />
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d', marginBottom: '4px' }}>{deal.imovel}</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#c9a96e', fontWeight: 300 }}>{deal.valor}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>{deal.fase}</div>
              {deal.comprador && (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>👤 {deal.comprador}</div>
              )}
              {/* Progress bar */}
              <div style={{ marginTop: '8px', height: '2px', background: 'rgba(14,14,13,.06)', borderRadius: '1px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${STAGE_PCT[deal.fase] || 10}%`, background: STAGE_COLOR[deal.fase] || '#888', transition: 'width .3s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Deal Detail */}
        {activeDealObj && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', fontWeight: 300, marginBottom: '4px' }}>{activeDealObj.imovel}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#c9a96e' }}>{activeDealObj.valor}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)' }}>·</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.45)' }}>{activeDealObj.ref}</span>
              </div>
            </div>

            {/* Phase selector */}
            <div style={{ marginBottom: '16px' }}>
              <label className="p-label">Fase do Negócio</label>
              <select className="p-sel" value={activeDealObj.fase} onChange={e => onChangeFase(activeDealObj.id, e.target.value)}>
                {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Deal tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '16px' }}>
              {(['checklist', 'investor', 'dealroom', 'timeline', 'nego'] as const).map(t => (
                <button key={t} className={`deal-tab${dealTab === t ? ' active' : ''}`} onClick={() => setDealTab(t)}>
                  {t === 'checklist' ? 'Checklist' : t === 'investor' ? 'Investidor' : t === 'dealroom' ? 'Deal Room' : t === 'timeline' ? 'Timeline' : 'Negociação'}
                </button>
              ))}
            </div>

            {/* Checklist tab */}
            {dealTab === 'checklist' && (
              <div>
                {Object.entries(activeDealObj.checklist).map(([fase, items]) => (
                  <div key={fase} style={{ marginBottom: '16px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: fase === activeDealObj.fase ? '#c9a96e' : 'rgba(14,14,13,.35)', marginBottom: '6px' }}>{fase}</div>
                    {(CHECKLISTS[fase] || []).map((item: string, idx: number) => (
                      <div key={idx} className={`check-item${(items as boolean[])[idx] ? ' done' : ''}`} onClick={() => onToggleCheck(activeDealObj.id, fase, idx)}>
                        <div style={{ width: '16px', height: '16px', border: `1.5px solid ${(items as boolean[])[idx] ? '#1c4a35' : 'rgba(14,14,13,.2)'}`, background: (items as boolean[])[idx] ? '#1c4a35' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(items as boolean[])[idx] && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" width="8" height="8"><path d="M2 6l3 3 5-5" /></svg>}
                        </div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Nego tab */}
            {dealTab === 'nego' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button className="p-btn" onClick={() => onDealRisk(activeDealObj.id)} disabled={dealRiskLoading}>
                    {dealRiskLoading ? '✦ A analisar...' : '🔍 Análise de Risco'}
                  </button>
                  <button className="p-btn p-btn-gold" onClick={() => onDealNego(activeDealObj.id)} disabled={dealNegoLoading}>
                    {dealNegoLoading ? '✦ A preparar...' : '⚡ Estratégia Negociação'}
                  </button>
                </div>
                {dealRiskAnalysis && (
                  <div className="p-card" style={{ marginBottom: '12px' }}>
                    <div className="p-label" style={{ marginBottom: '8px' }}>Análise de Risco</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                      {String(dealRiskAnalysis.summary || '')}
                    </div>
                  </div>
                )}
                {dealNego && (
                  <div className="p-card">
                    <div className="p-label" style={{ marginBottom: '8px' }}>Estratégia de Negociação</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                      {String(dealNego.estrategia || '')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline tab */}
            {dealTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px' }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.4rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)' }}>Timeline</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: 'rgba(14,14,13,.25)' }}>Cronologia de eventos — disponível em breve</div>
              </div>
            )}

            {/* Deal Room tab */}
            {dealTab === 'dealroom' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px' }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.4rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)' }}>Deal Room</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: 'rgba(14,14,13,.25)' }}>Gestão documental do deal — disponível em breve</div>
              </div>
            )}

            {/* Investor tab */}
            {dealTab === 'investor' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label className="p-label">Renda Mensal (€)</label>
                    <input className="p-inp" type="number" value={investorData.rendaMensal} onChange={e => setInvestorData({ rendaMensal: e.target.value })} placeholder="ex: 3500" />
                  </div>
                  <div>
                    <label className="p-label">Apreciação Anual (%)</label>
                    <input className="p-inp" type="number" value={investorData.apreciacao} onChange={e => setInvestorData({ apreciacao: e.target.value })} />
                  </div>
                  <div>
                    <label className="p-label">Horizonte (anos)</label>
                    <select className="p-sel" value={investorData.horizonte} onChange={e => setInvestorData({ horizonte: e.target.value })}>
                      {['5', '10', '15', '20'].map(h => <option key={h} value={h}>{h} anos</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {(['bear', 'base', 'bull'] as const).map(s => (
                    <div key={s} className={`inv-scenario${invScenario === s ? ' best' : ''}`} onClick={() => setInvScenario(s)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: s === 'bull' ? '#4a9c7a' : s === 'bear' ? '#dc2626' : '#c9a96e', textTransform: 'uppercase', letterSpacing: '.08em' }}>{s}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>{s === 'bull' ? '+4% anual' : s === 'base' ? '+2.5% anual' : '+0.5% anual'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {(['standard', 'ifici'] as const).map(r => (
                    <button key={r}
                      style={{ padding: '6px 14px', background: taxRegime === r ? '#1c4a35' : 'transparent', border: `1px solid ${taxRegime === r ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: taxRegime === r ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}
                      onClick={() => setTaxRegime(r)}>
                      {r === 'standard' ? 'Regime Geral' : 'IFICI/NHR'}
                    </button>
                  ))}
                  {(['residencial', 'comercial'] as const).map(t => (
                    <button key={t}
                      style={{ padding: '6px 14px', background: tipoImovelInv === t ? '#c9a96e' : 'transparent', border: `1px solid ${tipoImovelInv === t ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: tipoImovelInv === t ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}
                      onClick={() => setTipoImovelInv(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                {/* Computed investor metrics */}
                {investorData.rendaMensal && activeDealObj && (() => {
                  const preco = parseFloat(activeDealObj.valor.replace(/[^0-9.]/g, '')) || 0
                  const renda = parseFloat(investorData.rendaMensal) || 0
                  const aprecBase = parseFloat(investorData.apreciacao) || 3
                  const aprecMult = invScenario === 'bull' ? 1.4 : invScenario === 'bear' ? 0.3 : 1
                  const aprec = aprecBase * aprecMult
                  const anos = parseInt(investorData.horizonte) || 10
                  const yieldBruto = preco > 0 ? (renda * 12 / preco * 100) : 0
                  const taxRate = taxRegime === 'ifici' ? 0.20 : tipoImovelInv === 'residencial' ? 0.28 : 0.25
                  const yieldLiquido = yieldBruto * (1 - taxRate)
                  const valorFinal = preco * Math.pow(1 + aprec / 100, anos)
                  const totalReturn = preco > 0 ? ((valorFinal - preco + renda * 12 * anos) / preco * 100) : 0
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '16px' }}>
                      {[
                        { l: 'Yield Bruto', v: `${yieldBruto.toFixed(1)}%` },
                        { l: `Yield Líquido (${taxRegime === 'ifici' ? '20%' : taxRegime === 'standard' ? '28%' : '25%'})`, v: `${yieldLiquido.toFixed(1)}%` },
                        { l: `Valorização Anual (${invScenario})`, v: `+${aprec.toFixed(1)}%` },
                        { l: `Retorno Total ${anos}a`, v: `+${totalReturn.toFixed(0)}%` },
                        { l: `Valor Final Estimado`, v: `€${Math.round(valorFinal).toLocaleString('pt-PT')}` },
                        { l: 'Rendimento Total Acumulado', v: `€${Math.round(renda * 12 * anos).toLocaleString('pt-PT')}` },
                      ].map(m => (
                        <div key={m.l} style={{ padding: '12px 14px', background: darkMode ? 'rgba(28,74,53,.15)' : 'rgba(28,74,53,.04)', border: `1px solid ${darkMode ? 'rgba(201,169,110,.1)' : 'rgba(28,74,53,.1)'}` }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{m.l}</div>
                          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: '#c9a96e', fontWeight: 300 }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {!activeDeal && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(14,14,13,.25)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem' }}>
            Selecione um deal para ver os detalhes
          </div>
        )}
      </div>}
    </div>
  )
}
