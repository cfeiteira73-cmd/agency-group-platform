'use client'
import { useUIStore } from '../stores/uiStore'
import { useRadarStore } from '../stores/radarStore'
import { HEAT_MAP_ZONES } from './constants'

interface PortalRadarProps {
  onRunRadar: () => Promise<void>
  onRunRadarSearch: () => Promise<void>
  onGerarPDF: (deals: Record<string, unknown>[], filtros: Record<string, unknown>, stats: Record<string, unknown>) => void
}

export default function PortalRadar({ onRunRadar, onRunRadarSearch, onGerarPDF }: PortalRadarProps) {
  const { darkMode } = useUIStore()
  const {
    radarResult, radarLoading,
    radarUrl, setRadarUrl,
    radarMode, setRadarMode,
    searchZona, setSearchZona,
    searchPrecoMin, setSearchPrecoMin,
    searchPrecoMax, setSearchPrecoMax,
    searchTipos, setSearchTipos,
    searchScoreMin, setSearchScoreMin,
    searchFontes, setSearchFontes,
    searchResults, searchLoading,
    showHeatMap, setShowHeatMap,
  } = useRadarStore()

  const TIPOS_IMOVEL = ['apartamento', 'moradia', 'villa', 'penthouse', 'loja', 'escritorio', 'terreno', 'armazem']
  const FONTES = ['idealista', 'imovirtual', 'eleiloes', 'banca', 'century21', 'remax', 'era']

  const toggleTipo = (t: string) => {
    setSearchTipos(searchTipos.includes(t) ? searchTipos.filter(x => x !== t) : [...searchTipos, t])
  }
  const toggleFonte = (f: string) => {
    setSearchFontes(searchFontes.includes(f) ? searchFontes.filter(x => x !== f) : [...searchFontes, f])
  }

  const searchDeals = searchResults ? (searchResults as Record<string, unknown>).deals as Record<string, unknown>[] | undefined : undefined

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Inteligência de Mercado</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Deal Radar 16D</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>16 dimensões · Score AI · Leilões + Banca + Mercado livre</div>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid rgba(14,14,13,.1)' }}>
        {(['url', 'search'] as const).map(m => (
          <button key={m} className={`mkt-tab${radarMode === m ? ' active' : ''}`} onClick={() => setRadarMode(m)}>
            {m === 'url' ? '🔗 Analisar URL' : '🔍 Busca Inteligente'}
          </button>
        ))}
        <button
          className={`mkt-tab${showHeatMap ? ' active' : ''}`}
          onClick={() => setShowHeatMap(!showHeatMap)}
          style={{ marginLeft: 'auto' }}
        >🗺 Heat Map</button>
      </div>

      {/* URL Mode */}
      {radarMode === 'url' && (
        <div className="p-card" style={{ marginBottom: '24px' }}>
          <label className="p-label">URL do Imóvel ou Texto de Anúncio</label>
          <textarea
            className="p-inp"
            rows={3}
            placeholder="Cola URL do idealista, imovirtual, OLX... ou texto do anúncio"
            value={radarUrl}
            onChange={e => setRadarUrl(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <button className="p-btn" style={{ marginTop: '12px' }} onClick={onRunRadar} disabled={radarLoading || !radarUrl.trim()}>
            {radarLoading ? '✦ A analisar...' : '✦ Analisar Deal'}
          </button>
        </div>
      )}

      {/* Search Mode */}
      {radarMode === 'search' && (
        <div className="p-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="p-label">Zona</label>
              <input className="p-inp" value={searchZona} onChange={e => setSearchZona(e.target.value)} placeholder="ex: Lisboa" />
            </div>
            <div>
              <label className="p-label">Preço Mínimo (€)</label>
              <input className="p-inp" type="number" value={searchPrecoMin} onChange={e => setSearchPrecoMin(e.target.value)} />
            </div>
            <div>
              <label className="p-label">Preço Máximo (€)</label>
              <input className="p-inp" type="number" value={searchPrecoMax} onChange={e => setSearchPrecoMax(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="p-label">Tipologias</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TIPOS_IMOVEL.map(t => (
                <button key={t} onClick={() => toggleTipo(t)}
                  style={{ padding: '4px 10px', background: searchTipos.includes(t) ? '#1c4a35' : 'transparent', border: `1px solid ${searchTipos.includes(t) ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: searchTipos.includes(t) ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="p-label">Fontes</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FONTES.map(f => (
                <button key={f} onClick={() => toggleFonte(f)}
                  style={{ padding: '4px 10px', background: searchFontes.includes(f) ? '#c9a96e' : 'transparent', border: `1px solid ${searchFontes.includes(f) ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: searchFontes.includes(f) ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="p-label">Score Mínimo: {searchScoreMin}</label>
            <input type="range" min={40} max={95} value={searchScoreMin} onChange={e => setSearchScoreMin(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className="p-btn" onClick={onRunRadarSearch} disabled={searchLoading}>
            {searchLoading ? '✦ A pesquisar...' : '✦ Buscar Oportunidades'}
          </button>
        </div>
      )}

      {/* Heat Map */}
      {showHeatMap && (
        <div className="p-card" style={{ marginBottom: '24px' }}>
          <div className="p-label" style={{ marginBottom: '12px' }}>Heat Map de Preços — Portugal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
            {HEAT_MAP_ZONES.map((z: Record<string, unknown>) => (
              <div key={String(z.zona)} style={{ padding: '10px 12px', background: `${String(z.color)}14`, border: `1px solid ${String(z.color)}30` }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: String(z.color), letterSpacing: '.08em', marginBottom: '2px' }}>{String(z.zona)}</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>€{Number(z.pm2 || 0).toLocaleString('pt-PT')}/m²</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: '#4a9c7a' }}>{String(z.yoy || '0')}% YoY</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URL Analysis Result */}
      {radarResult && radarMode === 'url' && (
        <div className="p-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div className="p-label">Score de Oportunidade</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '3rem', fontWeight: 300, color: '#1c4a35', lineHeight: 1 }}>
                {String((radarResult as Record<string, unknown>).score || '—')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#c9a96e', padding: '4px 10px', background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.2)' }}>
                {String((radarResult as Record<string, unknown>).classificacao || '—')}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.7 }}>
            {String((radarResult as Record<string, unknown>).analise_narrativa || '')}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && radarMode === 'search' && searchDeals && searchDeals.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em' }}>
              {searchDeals.length} oportunidades encontradas
            </div>
            <button className="p-btn p-btn-gold" style={{ padding: '8px 16px' }}
              onClick={() => onGerarPDF(
                searchDeals,
                { zona: searchZona, preco_min: searchPrecoMin, preco_max: searchPrecoMax, tipos: searchTipos, fontes: searchFontes, score_min: searchScoreMin },
                (searchResults as Record<string, unknown>).stats as Record<string, unknown> || {}
              )}>
              ⬇ PDF Escolhas do Dia
            </button>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {searchDeals.map((deal, i) => (
              <div key={i} className="deal-card" style={{ borderLeft: `4px solid ${Number(deal.score || 0) >= 80 ? '#c9a96e' : Number(deal.score || 0) >= 65 ? '#4a9c7a' : '#888'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.6rem', fontWeight: 300, color: '#1c4a35' }}>{String(deal.score || 0)}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#c9a96e', padding: '2px 6px', background: 'rgba(201,169,110,.08)' }}>{String(deal.classificacao || '—')}</span>
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 500, color: '#0e0e0d', marginBottom: '2px' }}>{String(deal.titulo || 'Imóvel').substring(0, 80)}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)' }}>{String(deal.zona || '')} · {deal.area ? `${deal.area}m²` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: '#0e0e0d' }}>
                      {Number(deal.preco || 0) > 0 ? `€ ${Number(deal.preco).toLocaleString('pt-PT')}` : '—'}
                    </div>
                    {!!deal.url && (
                      <a href={String(deal.url)} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35' }}>Ver →</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
