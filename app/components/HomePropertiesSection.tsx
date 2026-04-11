'use client'

import { useEffect, useState } from 'react'

// ─── Properties data ──────────────────────────────────────────────────────────
const PROPERTIES = [
  { id: 'rev0', feat: true, badge: 'b-off', bl: 'Off-Market', zona: 'Cascais', zonaLabel: 'Cascais · Quinta da Marinha', tipo: 'Moradia', titulo: 'Villa Contemporânea com Piscina Infinita e Vista Mar', specs: ['5 Quartos', '620 m²', 'Piscina Infinita', 'Vista Mar', '3 Garagens', 'EPC A'], preco: 3800000, precoLabel: '€ 3.800.000', pm2: '€6.129/m²', quartos: 5, grad: 'linear-gradient(145deg,#1c3d28,#0b1a10 55%,#3d8b68 100%)', photo: '/properties/villa-cascais.jpg' },
  { id: 'rev1', feat: false, badge: 'b-new', bl: 'Novo', zona: 'Lisboa', zonaLabel: 'Lisboa · Chiado', tipo: 'Apartamento', titulo: 'Penthouse com Terraço e Vista Rio Tejo', specs: ['4 Quartos', '280 m²', 'Vista Rio', 'EPC A'], preco: 2100000, precoLabel: '€ 2.100.000', pm2: '€7.500/m²', quartos: 4, grad: 'linear-gradient(145deg,#0c2030,#060e18 60%,#1c4a35 100%)', photo: '/properties/penthouse-lisboa.jpg' },
  { id: 'rev2', feat: false, badge: 'b-exc', bl: 'Exclusivo', zona: 'Comporta', zonaLabel: 'Comporta · Grândola', tipo: 'Quinta', titulo: 'Herdade Privada nos Arrozais da Comporta', specs: ['6 Quartos', '850 m²', '12 hectares', 'Piscina'], preco: 6500000, precoLabel: '€ 6.500.000', pm2: '€7.647/m²', quartos: 6, grad: 'linear-gradient(145deg,#2e2009,#140e05 60%,#c9a96e 100%)', photo: '/properties/quinta-comporta.jpg' },
  { id: 'rev3', feat: false, badge: null, bl: null, zona: 'Cascais', zonaLabel: 'Abóboda · Cascais', tipo: 'Moradia', titulo: 'Moradia Contemporânea Nova Construção · Design Premium', specs: ['3 Quartos', '113 m²', 'Nova Construção'], preco: 1400000, precoLabel: '€ 1.400.000', pm2: '€12.389/m²', quartos: 3, grad: 'linear-gradient(145deg,#1a3a26,#081510 60%,#2d6a4f 100%)', photo: '/properties/moradia-cascais.jpg' },
  { id: 'rev4', feat: false, badge: null, bl: null, zona: 'Ericeira', zonaLabel: "Ericeira · Ribeira d'Ilhas", tipo: 'Apartamento', titulo: 'Duplex Vista Mar · World Surf Reserve · Ericeira', specs: ['3 Quartos', '189 m²', 'Vista Mar'], preco: 679000, precoLabel: '€ 679.000', pm2: '€3.593/m²', quartos: 3, grad: 'linear-gradient(145deg,#081e1e,#040f0f 60%,#1c4a35 100%)', photo: '/properties/duplex-ericeira.jpg' },
]

type Property = typeof PROPERTIES[number]


// ─── CPCV deals ───────────────────────────────────────────────────────────────
const INITIAL_CPCV = [
  { id:1, ref:'AG-2026-001', imovel:'Villa Quinta da Marinha · Cascais', valor:'€ 3.800.000', fase:'CPCV Assinado', pct:60, cor:'#c9a96e', data:'15 Jan 2026' },
  { id:2, ref:'AG-2026-002', imovel:'Penthouse Chiado · Lisboa', valor:'€ 2.100.000', fase:'Due Diligence', pct:40, cor:'#4a9c7a', data:'22 Jan 2026' },
  { id:3, ref:'AG-2026-003', imovel:'Herdade Comporta', valor:'€ 6.500.000', fase:'Proposta Aceite', pct:25, cor:'#3a7bd5', data:'28 Jan 2026' },
]

const FASES: Record<string, { pct: number; cor: string }> = {
  'Prospecção': {pct:10,cor:'#888'},
  'Proposta Enviada': {pct:20,cor:'#3a7bd5'},
  'Proposta Aceite': {pct:35,cor:'#3a7bd5'},
  'Due Diligence': {pct:50,cor:'#4a9c7a'},
  'CPCV Assinado': {pct:70,cor:'#c9a96e'},
  'Financiamento': {pct:80,cor:'#c9a96e'},
  'Escritura Marcada': {pct:90,cor:'#1c4a35'},
  'Escritura Concluída': {pct:100,cor:'#1c4a35'},
}

export default function HomePropertiesSection() {
  const [isAgent, setIsAgent] = useState(false)
  const [searchZona, setSearchZona] = useState('')
  const [searchTipo, setSearchTipo] = useState('')
  const [searchPreco, setSearchPreco] = useState('')
  const [searchQuartos, setSearchQuartos] = useState('')
  const [searchMode, setSearchMode] = useState<'filtros'|'ai'>('filtros')
  const [naturalQuery, setNaturalQuery] = useState('')
  const [aiResults, setAiResults] = useState<Property[]|null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [cpcvDeals, setCpcvDeals] = useState(INITIAL_CPCV)

  // Listen for zone filter events from zone cards (dispatched from RSC-rendered zone links)
  useEffect(() => {
    const handler = (e: Event) => {
      const { zona } = (e as CustomEvent<{ zona: string }>).detail
      setSearchZona(zona)
      setSearchMode('filtros')
      setAiResults(null)
      document.getElementById('imoveis')?.scrollIntoView({ behavior: 'smooth' })
    }
    window.addEventListener('ag:filter-zona', handler)
    return () => window.removeEventListener('ag:filter-zona', handler)
  }, [])

  // Auth check for CPCV section visibility
  useEffect(() => {
    const stored = localStorage.getItem('ag_auth')
    if (stored) {
      try {
        const d = JSON.parse(stored)
        if (d.v === '1' && Date.now() < d.exp) setIsAgent(true)
      } catch { /* noop */ }
    }
  }, [])

  // ─── Filtering logic ───────────────────────────────────────────────────────
  const filteredProperties = PROPERTIES.filter(p => {
    if (searchZona && !p.zonaLabel.toLowerCase().includes(searchZona.toLowerCase()) && !p.zona.toLowerCase().includes(searchZona.toLowerCase())) return false
    if (searchTipo && p.tipo !== searchTipo) return false
    if (searchPreco) {
      const ranges: Record<string, [number, number]> = {
        '500-1000': [500000, 1000000],
        '1000-2500': [1000000, 2500000],
        '2500-5000': [2500000, 5000000],
        '5000-999999': [5000000, 999999999],
      }
      const r = ranges[searchPreco]
      if (r && (p.preco < r[0] || p.preco > r[1])) return false
    }
    if (searchQuartos && p.quartos < parseInt(searchQuartos)) return false
    return true
  })
  const displayedProperties = (searchMode === 'ai' && aiResults !== null) ? aiResults : filteredProperties

  function doSearch() { document.getElementById('imoveis')?.scrollIntoView({behavior:'smooth'}) }

  async function doAiSearch() {
    if (!naturalQuery.trim() || aiLoading) return
    setAiLoading(true); setAiResults(null); setAiSummary('')
    try {
      const res = await fetch('/api/properties/search-natural', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:naturalQuery})})
      const d = await res.json()
      const matched = (d.matches||[]).map((m:{id:string})=>PROPERTIES.find(p=>p.id===m.id)).filter(Boolean) as Property[]
      setAiResults(matched); setAiSummary(d.searchSummary||'')
    } catch { setAiResults([]) }
    finally { setAiLoading(false); document.getElementById('imoveis')?.scrollIntoView({behavior:'smooth'}) }
  }

  function clearFilters() {
    setSearchZona(''); setSearchTipo(''); setSearchPreco(''); setSearchQuartos('')
    setAiResults(null); setNaturalQuery(''); setSearchMode('filtros'); setAiSummary('')
  }

  return (
    <>
      {/* SEARCH BOX */}
      <div className="search-wrap">
        <div className="search-box" id="searchBox">
          <div className="search-tabs">
            <button type="button" className={`search-tab${searchMode==='filtros'?' active':''}`} onClick={()=>{setSearchMode('filtros');setAiResults(null);setAiSummary('')}}>⊞ Filtros</button>
            <button type="button" className={`search-tab${searchMode==='ai'?' active':''}`} onClick={()=>setSearchMode('ai')}>✦ Linguagem Natural</button>
          </div>
          {searchMode==='filtros' ? (
            <div className="search-fields">
              <div className="sf" style={{flex:2}}>
                <label className="sf-lbl">Localização</label>
                <input className="sf-inp" type="text" id="sfQ" placeholder="Lisboa, Cascais, Comporta..." value={searchZona} onChange={e=>{setSearchZona(e.target.value)}}/>
              </div>
              <div className="sf"><label className="sf-lbl">Tipo</label><select className="sf-sel" value={searchTipo} onChange={e=>setSearchTipo(e.target.value)}><option value="">Todos</option><option value="Apartamento">Apartamento</option><option value="Moradia">Moradia</option><option value="Villa">Villa</option><option value="Penthouse">Penthouse</option><option value="Quinta">Quinta</option></select></div>
              <div className="sf"><label className="sf-lbl">Preço</label><select className="sf-sel" value={searchPreco} onChange={e=>setSearchPreco(e.target.value)}><option value="">Qualquer</option><option value="500-1000">€500K–€1M</option><option value="1000-2500">€1M–€2.5M</option><option value="2500-5000">€2.5M–€5M</option><option value="5000-999999">€5M+</option></select></div>
              <div className="sf"><label className="sf-lbl">Quartos (mín.)</label><select className="sf-sel" value={searchQuartos} onChange={e=>setSearchQuartos(e.target.value)}><option value="">Todos</option><option value="1">T1+</option><option value="2">T2+</option><option value="3">T3+</option><option value="4">T4+</option><option value="5">T5+</option></select></div>
              <button type="button" className="sf-btn" onClick={doSearch}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Descobrir</button>
            </div>
          ) : (
            <div className="search-fields" style={{gap:'16px',alignItems:'flex-end',padding:'18px 24px'}}>
              <div style={{flex:1}}>
                <label className="sf-lbl" style={{letterSpacing:'.12em'}}>Descreve o imóvel que imaginas</label>
                <input className="sf-inp" type="text" placeholder='"T3 vista mar em Cascais, até €2M"' value={naturalQuery} onChange={e=>setNaturalQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doAiSearch()} style={{width:'100%'}}/>
              </div>
              <button type="button" className="sf-btn" onClick={doAiSearch} disabled={aiLoading} style={{opacity:aiLoading?.65:1,whiteSpace:'nowrap',flexShrink:0}}>
                {aiLoading ? '✦ A analisar...' : '✦ Descobrir'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* IMÓVEIS SECTION */}
      <section className="imoveis-section section" id="imoveis">
        <div className="sw">
          <div className="im-head" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'48px'}}>
            <div>
              <div className="sec-eye">Portfolio Exclusivo</div>
              <h2 className="sec-h2" id="imH2">
                <span className="text-reveal"><span className="text-reveal-inner">Cada Imóvel,</span></span>
                <span className="text-reveal"><span className="text-reveal-inner"><em>Uma História.</em></span></span>
              </h2>
            </div>
            <a href="/imoveis" className="lnk-sm fade-in">Ver todos os imóveis →</a>
          </div>
          {/* Results count + clear filters */}
          <div className="im-count" style={{ fontFamily: 'Jost, sans-serif', fontSize: '14px', color: 'rgba(14,14,13,.42)', marginBottom: '16px' }}>
            {displayedProperties.length} imóve{displayedProperties.length !== 1 ? 'is' : 'l'} encontrado{displayedProperties.length !== 1 ? 's' : ''}
            {(searchZona || searchTipo || searchPreco || searchQuartos || (searchMode==='ai'&&aiResults!==null)) && (
              <button type="button" onClick={clearFilters}
                style={{ marginLeft: '12px', background: 'none', border: '1px solid #c9a96e', color: '#c9a96e', padding: '2px 10px', borderRadius: '0', cursor: 'pointer', fontSize: '12px' }}>
                Limpar filtros
              </button>
            )}
          </div>
          {/* AI Summary */}
          {searchMode==='ai' && aiSummary && (
            <div style={{background:'rgba(28,74,53,.06)',border:'1px solid rgba(28,74,53,.18)',borderLeft:'3px solid #1c4a35',padding:'10px 16px',marginBottom:'16px',fontFamily:"'Jost',sans-serif",fontSize:'13px',color:'rgba(14,14,13,.7)',lineHeight:1.6}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#1c4a35',fontWeight:600,marginRight:'8px'}}>✦ IA</span>{aiSummary}
            </div>
          )}
          {searchMode==='ai' && aiLoading && (
            <div style={{textAlign:'center',padding:'40px',color:'#c9a96e',fontFamily:"'DM Mono',monospace",fontSize:'.6rem',letterSpacing:'.15em'}}>✦ Inteligência Artificial a analisar pedido...</div>
          )}

          {displayedProperties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#c9a96e', fontFamily: 'Cormorant, serif', fontSize: '24px' }}>
              <div>Nenhum imóvel encontrado.</div>
              <div style={{ fontSize: '16px', fontFamily: 'Jost, sans-serif', color: '#888', marginTop: '12px', fontStyle: 'italic' }}>
                Os imóveis mais exclusivos não passam por aqui.
              </div>
              <a href="/imoveis" style={{ marginTop: '24px', display: 'inline-block', background: 'transparent', color: '#c9a96e', border: '1px solid rgba(201,169,110,.45)', padding: '12px 32px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Ver Todos os Imóveis →
              </a>
            </div>
          ) : (
            <div className="im-grid">
              {displayedProperties.map(im=>(
                <a key={im.id} href={`/imoveis#${im.id}`} className={`imc${im.feat?' feat':''}`} style={{textDecoration:'none',color:'inherit',display:'block'}}>
                  <div className="imc-img">
                    <div className="imc-img-reveal" id={im.id}></div>
                    <div className="imc-img-inner" style={{backgroundImage:`url(${im.photo})`,backgroundSize:'cover',backgroundPosition:'center'}}></div>
                    {im.badge && <span className={`imc-badge ${im.badge}`}>{im.bl}</span>}
                  </div>
                  <div className="imc-body">
                    <div className="imc-zona">{im.zonaLabel}</div>
                    <h3 className="imc-title">{im.titulo}</h3>
                    <div className="imc-specs">{im.specs.map(s=><span key={s} className="imc-spec">{s}</span>)}</div>
                    <div className="imc-foot">
                      <div><div className="imc-price">{im.precoLabel}</div><div className="imc-pm2">{im.pm2}</div></div>
                      <div className="imc-arr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Ver todos os imóveis CTA */}
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <a
              href="/imoveis"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: '1px solid rgba(201,169,110,.45)',
                color: '#c9a96e', padding: '14px 40px',
                fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase',
                textDecoration: 'none', transition: 'background .25s, color .25s',
              }}
            >
              Ver o Portfolio Completo
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </section>

      {/* CPCV PIPELINE — only visible to authenticated agents */}
      {isAgent && (
        <section className="cpcv-section" id="pipeline">
          <div className="sw">
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
              <div>
                <div className="sec-eye" style={{color:'var(--gold)'}}>Pipeline · Deals Activos</div>
                <h2 className="sec-h2" style={{margin:'8px 0 0'}}>
                  <span className="text-reveal"><span className="text-reveal-inner" style={{transform:'none'}}>CPCV</span></span>
                  <span className="text-reveal"><span className="text-reveal-inner" style={{transform:'none'}}><em>Tracker</em></span></span>
                </h2>
              </div>
              <div style={{display:'flex',gap:'20px',flexWrap:'wrap'}}>
                <div className="cpcv-stat"><div className="cpcv-stat-v" style={{color:'var(--gold)'}}>€ 12.4M</div><div className="cpcv-stat-l">Pipeline Total</div></div>
                <div className="cpcv-stat"><div className="cpcv-stat-v" style={{color:'var(--g)'}}>3</div><div className="cpcv-stat-l">Deals Activos</div></div>
                <div className="cpcv-stat"><div className="cpcv-stat-v" style={{color:'#4a9c7a'}}>€ 620K</div><div className="cpcv-stat-l">Comissão Prevista</div></div>
              </div>
            </div>
            <div className="cpcv-list">
              {cpcvDeals.map(d=>(
                <div key={d.id} className="cpcv-card">
                  <div className="cpcv-ref">{d.ref}</div>
                  <div className="cpcv-imovel">{d.imovel}</div>
                  <div className="cpcv-valor">{d.valor}</div>
                  <div className="cpcv-fase-wrap">
                    <div className="cpcv-fase" style={{color:d.cor}}>{d.fase}</div>
                    <div className="cpcv-bar"><div className="cpcv-fill" style={{width:d.pct+'%',background:d.cor}}></div></div>
                    <div className="cpcv-pct" style={{color:d.cor}}>{d.pct}%</div>
                  </div>
                  <div className="cpcv-data">{d.data}</div>
                  <div className="cpcv-actions">
                    <button type="button" className="cpcv-btn-wa" onClick={()=>window.open('https://wa.me/351919948986?text='+encodeURIComponent(`Deal ${d.ref}: ${d.imovel} — ${d.valor} — Fase: ${d.fase}`),'_blank')}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WA
                    </button>
                    <select
                      className="cpcv-sel"
                      value={d.fase}
                      onChange={e=>{
                        const v=e.target.value
                        const f=FASES[v]
                        setCpcvDeals(prev=>prev.map(x=>x.id===d.id?{...x,fase:v,pct:f?.pct??x.pct,cor:f?.cor??x.cor}:x))
                      }}
                    >
                      {Object.keys(FASES).map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
