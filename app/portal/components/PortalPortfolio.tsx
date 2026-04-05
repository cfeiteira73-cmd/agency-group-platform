'use client'
import { useMemo } from 'react'
import { useUIStore } from '../stores/uiStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { PORTAL_PROPERTIES } from './constants'
import type { PortfolioProperty } from './types'

interface PortalPortfolioProps {
  onRunPortfolio: () => Promise<void>
}

export default function PortalPortfolio({ onRunPortfolio }: PortalPortfolioProps) {
  const { darkMode } = useUIStore()
  const {
    portItems, setPortItems,
    portResult, portLoading,
    portfolioProperties, addPortfolioProperty, removePortfolioProperty, updatePortfolioProperty,
    showPropertyPicker, setShowPropertyPicker,
    portfolioTab, setPortfolioTab,
  } = usePortfolioStore()

  const portfolioStats = useMemo(() => {
    if (portfolioProperties.length === 0) return null
    const totalValue = portfolioProperties.reduce((s, p) => s + p.currentValue, 0)
    const totalLoan = portfolioProperties.reduce((s, p) => s + (p.currentValue * (1 - p.downPayment / 100)), 0)
    const totalEquity = totalValue - totalLoan
    const totalRental = portfolioProperties.reduce((s, p) => s + (p.currentValue * p.rentalYield / 100), 0)
    const value5y = portfolioProperties.reduce((s, p) => s + p.currentValue * Math.pow(1 + p.appreciation / 100, 5), 0)
    const value10y = portfolioProperties.reduce((s, p) => s + p.currentValue * Math.pow(1 + p.appreciation / 100, 10), 0)
    const roi10y = ((value10y - totalValue) / totalValue * 100)
    return { totalValue, totalEquity, totalRental, value5y, value10y, roi10y }
  }, [portfolioProperties])

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Gestão de Activos</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Portfolio Análise</div>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '24px' }}>
        {(['comparar', 'simulador'] as const).map(t => (
          <button key={t} className={`deal-tab${portfolioTab === t ? ' active' : ''}`} onClick={() => setPortfolioTab(t)}>
            {t === 'comparar' ? '📊 Comparar Imóveis' : '📈 Simulador de Portfólio'}
          </button>
        ))}
      </div>

      {/* Compare mode */}
      {portfolioTab === 'comparar' && (
        <div>
          <div className="p-card" style={{ marginBottom: '20px' }}>
            <div className="p-label" style={{ marginBottom: '12px' }}>URLs dos Imóveis a Comparar</div>
            {portItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className="p-inp"
                  placeholder={`URL imóvel ${i + 1} (idealista, imovirtual...)`}
                  value={item}
                  onChange={e => {
                    const updated = [...portItems]
                    updated[i] = e.target.value
                    setPortItems(updated)
                  }}
                />
                {portItems.length > 2 && (
                  <button onClick={() => setPortItems(portItems.filter((_, j) => j !== i))} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid rgba(14,14,13,.1)', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)' }}>✕</button>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer', color: 'rgba(14,14,13,.5)' }} onClick={() => setPortItems([...portItems, ''])}>
                + Adicionar Imóvel
              </button>
              <button className="p-btn" onClick={onRunPortfolio} disabled={portLoading || portItems.filter(x => x.trim()).length < 2}>
                {portLoading ? '✦ A comparar...' : '✦ Comparar'}
              </button>
            </div>
          </div>

          {portResult && (
            <div className="p-card">
              <div className="p-label" style={{ marginBottom: '12px' }}>Análise Comparativa</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: 'rgba(14,14,13,.75)' }}>
                {String((portResult as Record<string, unknown>).summary || '')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simulator mode */}
      {portfolioTab === 'simulador' && (
        <div>
          {/* Stats */}
          {portfolioStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Valor Total', val: `€${(portfolioStats.totalValue / 1e6).toFixed(2)}M`, color: '#1c4a35' },
                { label: 'Equity', val: `€${(portfolioStats.totalEquity / 1e6).toFixed(2)}M`, color: '#c9a96e' },
                { label: 'Renda Anual', val: `€${Math.round(portfolioStats.totalRental).toLocaleString('pt-PT')}`, color: '#4a9c7a' },
                { label: 'Valor 5 Anos', val: `€${(portfolioStats.value5y / 1e6).toFixed(2)}M`, color: '#1c4a35' },
                { label: 'Valor 10 Anos', val: `€${(portfolioStats.value10y / 1e6).toFixed(2)}M`, color: '#c9a96e' },
                { label: 'ROI 10 Anos', val: `+${portfolioStats.roi10y.toFixed(1)}%`, color: '#4a9c7a' },
              ].map(m => (
                <div key={m.label} className="kpi-card">
                  <div className="kpi-val" style={{ color: m.color, fontSize: '1.4rem' }}>{m.val}</div>
                  <div className="kpi-label">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Properties in portfolio */}
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)' }}>
              {portfolioProperties.length} Imóveis no Portfólio
            </div>
            <button className="p-btn p-btn-gold" style={{ padding: '6px 14px' }} onClick={() => setShowPropertyPicker(true)}>
              + Adicionar Imóvel
            </button>
          </div>

          {portfolioProperties.length === 0 && (
            <div className="p-card" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏘️</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: 'rgba(14,14,13,.4)', marginBottom: '8px' }}>Portfólio vazio</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.3)' }}>Adicione imóveis para simular o portfólio</div>
            </div>
          )}

          {portfolioProperties.map(prop => (
            <div key={prop.id} className="p-card" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.88rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d' }}>{prop.name}</div>
                <button onClick={() => removePortfolioProperty(prop.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(14,14,13,.3)', cursor: 'pointer', fontSize: '.8rem' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { label: 'Valor (€)', key: 'currentValue', value: prop.currentValue },
                  { label: 'Entrada (%)', key: 'downPayment', value: prop.downPayment },
                  { label: 'Yield (%)', key: 'rentalYield', value: prop.rentalYield },
                  { label: 'Apreciação (%)', key: 'appreciation', value: prop.appreciation },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '3px' }}>{f.label}</div>
                    <input
                      type="number"
                      className="p-inp"
                      value={f.value}
                      onChange={e => updatePortfolioProperty(prop.id, { [f.key]: Number(e.target.value) } as Partial<PortfolioProperty>)}
                      style={{ padding: '6px 10px', fontSize: '.78rem' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Property Picker */}
          {showPropertyPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
              <div style={{ background: darkMode ? '#0f2117' : '#fff', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1c4a35' }}>Selecionar Imóvel</div>
                  <button onClick={() => setShowPropertyPicker(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'rgba(14,14,13,.4)' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {(PORTAL_PROPERTIES as Record<string, unknown>[]).map((p) => (
                    <div key={String(p.id)} style={{ padding: '12px', border: '1px solid rgba(14,14,13,.1)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => {
                        addPortfolioProperty({
                          id: String(p.id),
                          name: String(p.nome || p.title || p.id),
                          currentValue: Number(p.preco) || 0,
                          downPayment: 30,
                          rentalYield: 4.5,
                          appreciation: 3,
                        })
                        setShowPropertyPicker(false)
                      }}>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: darkMode ? 'rgba(244,240,230,.8)' : '#0e0e0d' }}>{String(p.nome || p.title)}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#c9a96e' }}>€{(Number(p.preco) / 1e6).toFixed(2)}M</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
