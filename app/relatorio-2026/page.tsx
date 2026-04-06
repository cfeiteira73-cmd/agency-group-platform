'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

export default function Relatorio2026() {
  const [email, setEmail] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [activeZone, setActiveZone] = useState('Lisboa')
  const [activeBuyer, setActiveBuyer] = useState('Norte-americanos')

  // Investment Calculator state
  const [calcBudget, setCalcBudget] = useState('1500000')
  const [calcZone, setCalcZone] = useState('Lisboa')
  const [calcLtv, setCalcLtv] = useState('60')
  const [calcHorizonte, setCalcHorizonte] = useState('10')
  const [calcTipoRenda, setCalcTipoRenda] = useState<'longa'|'turistica'>('longa')

  const ZONES = [
    {
      nome:'Lisboa', preco:5000, primePraco:8500, yoy:14, yield:3.2, yieldTur:4.8, vol:18420, emoji:'🏛',
      bairros:['Chiado','Príncipe Real','Marvila','Alcântara','Belém'],
      desc:'Capital europeia em plena transformação. Chiado e Príncipe Real são os endereços mais procurados por HNWI internacionais, com preços que chegam a €12.000/m² em condomínios de luxo.',
      drivers:['Hub tecnológico europeu','Aeroporto hub intercontinental','Vida nocturna e gastronomia top-20 mundial','3º melhor cidade para expatriados (InterNations 2025)'],
      forecast:'€5.800/m² em 2027',
    },
    {
      nome:'Cascais', preco:4713, primePraco:7200, yoy:14, yield:3.8, yieldTur:5.2, vol:6240, emoji:'⚓',
      bairros:['Quinta da Marinha','Cascais Centro','Estoril','São João do Estoril','Birre'],
      desc:'A "Portuguese Riviera". A 30 minutos de Lisboa com escola internacional, marina, golf e uma das mais belas praias da Europa. Off-market domina acima de €2M.',
      drivers:['Escola internacional (CAISL, Cascais International School)','4 campos de golfe de classe mundial','Marina com 650 lugares','Lifestyle family: segurança + praias + natureza'],
      forecast:'€5.400/m² em 2027',
    },
    {
      nome:'Algarve', preco:3941, primePraco:9500, yoy:18, yield:5.1, yieldTur:7.8, vol:12800, emoji:'☀️',
      bairros:['Quinta do Lago','Vale do Lobo','Vilamoura','Ferragudo','Tavira'],
      desc:'Quinta do Lago e Vale do Lobo são top-5 luxury resort destinations na Europa. Villa prime em Quinta do Lago: €5M–€25M. Yield de arrendamento turístico supera 8% em Vilamoura.',
      drivers:['300+ dias de sol por ano','Golfe de classe mundial — European Tour','Aeroporto de Faro com 150+ rotas europeias','Crescimento de preços mais rápido de Portugal'],
      forecast:'€4.800/m² em 2027',
    },
    {
      nome:'Porto', preco:3643, primePraco:6200, yoy:13, yield:4.2, yieldTur:6.1, vol:9800, emoji:'🍷',
      bairros:['Foz do Douro','Boavista','Nevogilde','Matosinhos','Lordelo do Ouro'],
      desc:'Foz do Douro e Boavista emergem como novos pólos de luxo. Porto foi eleita 3ª melhor cidade europeia para viver. Investimento brasileiro e francês em forte crescimento.',
      drivers:['Melhor cidade europeia para turismo (WTA 2023-2024)','Crescente ecossistema startup','Preços ainda 30% abaixo de Lisboa','Ryanair + TAP: 120+ rotas directas'],
      forecast:'€4.200/m² em 2027',
    },
    {
      nome:'Madeira', preco:3760, primePraco:5800, yoy:20, yield:4.8, yieldTur:7.2, vol:3200, emoji:'🌺',
      bairros:['Funchal Prime','Calheta','Ponta do Sol','Câmara de Lobos','Santa Cruz'],
      desc:'O mercado que mais cresce em Portugal. NHR + clima (18–25°C todo o ano) + segurança + voos directos para 60 cidades. Funchal está a tornar-se o Mónaco do Atlântico.',
      drivers:['Clima mediterrânico o ano todo','60+ voos directos para Europa e Brasil','Internet das mais rápidas da Europa','Zona Franca da Madeira para empresas'],
      forecast:'€4.500/m² em 2027',
    },
    {
      nome:'Comporta', preco:5800, primePraco:12000, yoy:28, yield:5.5, yieldTur:9.2, vol:1840, emoji:'🌊',
      bairros:['Comporta Village','Carvalhal','Brejos da Carregueira','Pinheirinho','Melides'],
      desc:'O "Hamptons Europeu". Preços que rivalizam com Lisboa prime. Compra off-market obrigatória. Compradores americanos, franceses e do Médio Oriente. O segredo mais bem guardado da Europa.',
      drivers:['Praias virgens — Top 10 Europa','A 1h de Lisboa + helicóptero 20min','Comunidade criativa global','Off-market exclusivo — 80% dos negócios'],
      forecast:'€7.500/m² em 2027',
    },
  ]

  const BUYERS = [
    {
      nac:'🇺🇸 Norte-americanos', pct:16, seg:'€800K–€3M',
      driver:'NHR + USD strong + segurança',
      perfil:'Executivos tech de NY/SF/Miami, pré-reforma. Procuram Lisboa ou Cascais. Compra cash ou hipoteca portuguesa. LTV típico: 60–70%.',
      avg:'€1.450.000', tempo:'3–6 meses desde primeira visita',
      zonas:['Lisboa (Príncipe Real, Chiado)','Cascais (Quinta da Marinha)','Algarve (Quinta do Lago)'],
    },
    {
      nac:'🇫🇷 Franceses', pct:13, seg:'€500K–€2M',
      driver:'Proximidade + NHR + estilo de vida',
      perfil:'Profissionais liberais, empresários PME, reformados afluentes. Compra como residência principal ou segunda habitação. Muito familiarizados com Portugal.',
      avg:'€890.000', tempo:'6–12 meses desde primeira visita',
      zonas:['Lisboa (Mouraria, Alfama)','Porto (Foz do Douro)','Algarve'],
    },
    {
      nac:'🇬🇧 Britânicos', pct:9, seg:'€600K–€2.5M',
      driver:'Post-Brexit + familiar cultural',
      perfil:'Retirados ou semi-retirados. Preferência para Algarve (legado histórico). Familiar com processos portugueses. Maioria compra com hipoteca.',
      avg:'€780.000', tempo:'6–9 meses',
      zonas:['Algarve (Vilamoura, Tavira)','Cascais','Lisboa'],
    },
    {
      nac:'🇨🇳 Chineses', pct:8, seg:'€1M–€5M',
      driver:'Residência + Golden Visa',
      perfil:'Empresários e investidores. Foco em imóvel de prestígio em Lisboa. Muitas vezes compra através de sociedade. Pagamento frequentemente cash.',
      avg:'€1.800.000', tempo:'2–4 meses (decisão rápida)',
      zonas:['Lisboa Prime','Cascais','Comporta'],
    },
    {
      nac:'🇧🇷 Brasileiros', pct:6, seg:'€300K–€1.5M',
      driver:'Língua + cultura + segurança',
      perfil:'Empreendedores, profissionais liberais. Portugal como base europeia. Procuram Lisboa e Porto. Sensíveis ao câmbio BRL/EUR. Muito ligados à comunidade.',
      avg:'€520.000', tempo:'9–18 meses',
      zonas:['Lisboa (Baixa, Mouraria)','Porto (Boavista)','Setúbal'],
    },
    {
      nac:'🇩🇪 Alemães', pct:5, seg:'€700K–€3M',
      driver:'Diversificação + NHR',
      perfil:'Investidores racionais. Alta due diligence. Foco em yield e retorno a longo prazo. Preferem negócios transparentes e documentação impecável.',
      avg:'€1.100.000', tempo:'9–15 meses',
      zonas:['Algarve','Lisboa','Cascais'],
    },
    {
      nac:'🇸🇦 Médio Oriente', pct:4, seg:'€2M–€10M',
      driver:'HNWI + família + clima',
      perfil:'Family offices, HNWI do Golfo. Procuram villas de ultra-luxo ou edifícios inteiros. Comporta e Lisboa prime. Normalmente chegam via referral ou off-market.',
      avg:'€3.200.000', tempo:'1–3 meses (quando decidem)',
      zonas:['Comporta','Lisboa (Chiado, Príncipe Real)','Algarve (Quinta do Lago)'],
    },
  ]

  const PIPELINE = [
    { nome:'One Chiado Residences', zona:'Lisboa', tipo:'Residencial Luxo', units:42, preco:'€8.500–€14.000/m²', delivery:'Q3 2026', sold:78, dev:'JPS Group + Mercan' },
    { nome:'Cascais Atlantic Villas', zona:'Cascais', tipo:'Villas Contemporâneas', units:18, preco:'€3.2M–€7.8M', delivery:'Q4 2026', sold:67, dev:'Vanguard Properties' },
    { nome:'Quinta do Lago The Heights', zona:'Algarve', tipo:'Resort Luxury', units:35, preco:'€4.5M–€12M', delivery:'Q2 2027', sold:54, dev:'Kronos Homes' },
    { nome:'Comporta Beach Estates', zona:'Comporta', tipo:'Villa Collection', units:12, preco:'€2.8M–€8M', delivery:'Q1 2027', sold:92, dev:'Vanguard + AG Private' },
    { nome:'Porto Foz River Residences', zona:'Porto', tipo:'Apartamentos Premium', units:64, preco:'€2.800–€4.200/m²', delivery:'Q2 2027', sold:45, dev:'Avenue' },
    { nome:'Funchal Prime Residences', zona:'Madeira', tipo:'Residencial Prime', units:28, preco:'€3.200–€5.800/m²', delivery:'Q3 2027', sold:61, dev:'Local Developers' },
  ]

  // IPRI — Iberian Prime Residential Index
  const IPRI = [
    { market:'Lisboa Prime', idx:148, yoy:'+14%', tier:'Platinum', hot:true },
    { market:'Comporta', idx:162, yoy:'+28%', tier:'Platinum', hot:true },
    { market:'Cascais', idx:141, yoy:'+14%', tier:'Gold', hot:true },
    { market:'Algarve Prime', idx:138, yoy:'+18%', tier:'Gold', hot:true },
    { market:'Madeira', idx:134, yoy:'+20%', tier:'Gold', hot:true },
    { market:'Porto Prime', idx:129, yoy:'+13%', tier:'Silver', hot:false },
    { market:'Madrid Prime', idx:119, yoy:'+9%', tier:'Silver', hot:false },
    { market:'Barcelona', idx:114, yoy:'+7%', tier:'Silver', hot:false },
  ]

  const zone = ZONES.find(z=>z.nome===activeZone) || ZONES[0]
  const buyer = BUYERS.find(b=>b.nac.includes(activeBuyer)) || BUYERS[0]

  // Investment Calculator
  const calcMetrics = useMemo(() => {
    const preco = parseFloat(calcBudget) || 0
    const ltv = parseFloat(calcLtv) / 100
    const h = parseFloat(calcHorizonte)
    const zoneData = ZONES.find(z=>z.nome===calcZone) || ZONES[0]
    const yieldRate = calcTipoRenda === 'turistica' ? zoneData.yieldTur / 100 : zoneData.yield / 100

    const equity = preco * (1 - ltv)
    const emprestimo = preco * ltv
    const imt = preco * 0.065
    const is = preco * 0.008
    const outrosCustos = 5000 // notario + registo + due diligence
    const totalInvestido = equity + imt + is + outrosCustos

    const rendaBruta = preco * yieldRate
    const custosMensais = preco * 0.012 / 12 // IMI + condo + manutenção ~1.2% ano
    const rendaLiquida = rendaBruta - (preco * 0.012)
    const tanAnual = 0.035 // Euribor 6m + spread ~3.5%
    const tanMensal = tanAnual / 12
    const nPag = h * 12
    const prestacao = emprestimo > 0
      ? emprestimo * (tanMensal * Math.pow(1+tanMensal, nPag)) / (Math.pow(1+tanMensal, nPag)-1)
      : 0
    const cashFlowMensal = (rendaLiquida / 12) - prestacao
    const apreciacaoAnual = zoneData.yoy / 100 * 0.5 // conservative: half of current YoY
    const valorFinal = preco * Math.pow(1 + apreciacaoAnual, h)
    const totalReturn = (valorFinal - preco) + rendaLiquida * h
    const irr = totalInvestido > 0
      ? (Math.pow((totalReturn + totalInvestido) / totalInvestido, 1/h) - 1) * 100
      : 0
    const cashOnCash = totalInvestido > 0 ? rendaLiquida / totalInvestido * 100 : 0

    return { equity, emprestimo, imt, is, outrosCustos, totalInvestido, rendaBruta, rendaLiquida,
      prestacao, cashFlowMensal, valorFinal, totalReturn, irr, cashOnCash, apreciacaoAnual }
  }, [calcBudget, calcZone, calcLtv, calcHorizonte, calcTipoRenda])

  function handleUnlock() {
    if (!email.includes('@') || email.trim().length < 5) { setEmailError('Introduza um email válido'); return }
    setEmailError('')
    setSubmitting(true)
    setTimeout(() => { setUnlocked(true); setSubmitting(false); setTimeout(() => window.print(), 500) }, 800)
  }

  const fmt = (n:number) => n.toLocaleString('pt-PT',{maximumFractionDigits:0})
  const fmtEur = (n:number) => '€'+fmt(n)

  return (
    <>
      {/* Floating PDF button — always visible, hidden on print */}
      <button
        onClick={() => window.print()}
        className="no-print"
        style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          background: '#c9a96e', color: '#0c1f15', border: 'none', borderRadius: '8px',
          padding: '10px 20px', fontFamily: 'Jost, sans-serif', fontWeight: 600,
          fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
      >
        📄 Guardar PDF
      </button>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(14,14,13,.15)}
        .r-btn{background:#1c4a35;color:#f4f0e6;border:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.56rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s}
        .r-btn:hover{background:#163d2c}
        .r-inp{width:100%;background:#fff;border:1px solid rgba(14,14,13,.15);padding:13px 18px;font-family:var(--font-jost),sans-serif;font-size:.9rem;color:#0e0e0d;outline:none;transition:border .2s}
        .r-inp:focus{border-color:#1c4a35}
        .r-sel{background:#fff;border:1px solid rgba(14,14,13,.12);padding:10px 14px;font-family:var(--font-dm-mono),monospace;font-size:.5rem;color:#0e0e0d;outline:none;cursor:pointer;letter-spacing:.06em}
        .zone-btn{padding:10px 20px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(244,240,230,.15);background:none;cursor:pointer;color:rgba(244,240,230,.45);transition:all .2s}
        .zone-btn:hover{border-color:rgba(244,240,230,.35);color:rgba(244,240,230,.7)}
        .zone-btn.active{background:rgba(201,169,110,.15);border-color:#c9a96e;color:#c9a96e}
        .light-zone-btn{padding:10px 20px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(14,14,13,.12);background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .light-zone-btn:hover{border-color:rgba(14,14,13,.25);color:rgba(14,14,13,.7)}
        .light-zone-btn.active{background:rgba(28,74,53,.06);border-color:#1c4a35;color:#1c4a35}
        .stat-bar{height:4px;background:rgba(201,169,110,.2);border-radius:2px;overflow:hidden;margin-top:8px}
        .stat-bar-fill{height:100%;background:#c9a96e;border-radius:2px;transition:width .6s ease}
        .ipri-tier-platinum{background:linear-gradient(135deg,rgba(201,169,110,.2),rgba(201,169,110,.05));border:1px solid rgba(201,169,110,.35)}
        .ipri-tier-gold{background:rgba(201,169,110,.06);border:1px solid rgba(201,169,110,.2)}
        .ipri-tier-silver{background:rgba(244,240,230,.03);border:1px solid rgba(244,240,230,.1)}
        .calc-input-group{display:flex;flex-direction:column;gap:6px}
        .calc-label{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(14,14,13,.45)}
        .calc-metric{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;border-left:3px solid #c9a96e}
        .calc-metric-green{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;border-left:3px solid #1c4a35}
        .pipe-progress{height:3px;background:rgba(244,240,230,.08);border-radius:2px;overflow:hidden;margin-top:6px}
        .pipe-progress-fill{height:100%;background:#c9a96e;border-radius:2px}
        .pipe-badge{display:inline-block;padding:3px 8px;font-family:var(--font-dm-mono),monospace;font-size:.4rem;letter-spacing:.08em;text-transform:uppercase}
        @media (max-width:768px){
          section{padding:48px 24px!important}
          footer{padding:24px!important}
          .grid-2{grid-template-columns:1fr!important}
          .grid-3{grid-template-columns:1fr 1fr!important}
          .hide-mobile{display:none!important}
          nav{padding:20px 24px!important}
        }
        @media print {
          button, input, form, nav, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .page-break { page-break-before: always; }
          .print-section { page-break-inside: avoid; }
          section { padding: 40px 48px !important; }
          @page { margin: 20mm; size: A4; }
        }
      `}</style>

      {/* ══════════════════════════════════════════
          01 — COVER
      ══════════════════════════════════════════ */}
      <section style={{background:'#0c1f15',minHeight:'100vh',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
        <nav style={{position:'static',padding:'28px 64px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(201,169,110,.1)'}} className="no-print">
          <Link href="/" style={{textDecoration:'none'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.3rem',letterSpacing:'.35em',textTransform:'uppercase',color:'#c9a96e',lineHeight:1}}>Agency</div>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'.65rem',letterSpacing:'.6em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginTop:'2px'}}>Group</div>
          </Link>
          <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(244,240,230,.3)'}}>AMI 22506</div>
            <button className="r-btn" style={{padding:'10px 20px',fontSize:'.52rem'}} onClick={()=>window.print()}>↓ Download PDF</button>
          </div>
        </nav>

        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 64px',textAlign:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:'24px',marginBottom:'40px'}}>
            <div style={{width:'80px',height:'1px',background:'rgba(201,169,110,.3)'}}/>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.3em',textTransform:'uppercase',color:'rgba(201,169,110,.5)'}}>IPRI™ Research · Portugal · 2026</div>
            <div style={{width:'80px',height:'1px',background:'rgba(201,169,110,.3)'}}/>
          </div>

          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'clamp(2.5rem,6vw,5rem)',color:'#f4f0e6',lineHeight:1.05,maxWidth:'800px',letterSpacing:'-.01em',marginBottom:'8px'}}>
            Portugal Luxury
          </div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'clamp(2.5rem,6vw,5rem)',color:'#c9a96e',fontStyle:'italic',lineHeight:1.05,maxWidth:'800px',marginBottom:'8px'}}>
            Market Report
          </div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'clamp(2rem,4vw,3.5rem)',color:'rgba(244,240,230,.35)',lineHeight:1,marginBottom:'56px'}}>
            2026
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'40px',maxWidth:'700px',width:'100%',marginBottom:'64px'}}>
            {[['169.812','Transacções'],['€8.500/m²','Lisboa Prime'],['+17,6%','Crescimento YoY'],['Top 5','Mundial Luxo']].map(([v,l])=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.9rem',color:'#c9a96e',lineHeight:1}}>{v}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(244,240,230,.25)',marginTop:'8px'}}>{l}</div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:'32px',flexWrap:'wrap',justifyContent:'center',marginBottom:'48px'}}>
            {['Executive Summary','Zone Intelligence','Buyer Atlas','Investment Calculator','NHR/IFICI Guide','Development Pipeline'].map((s,i)=>(
              <div key={s} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'rgba(201,169,110,.4)'}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.3)'}}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(244,240,230,.15)'}}>
            Agency Group · AMI 22506 · agencygroup.pt · Março 2026
          </div>
        </div>

        <div style={{position:'absolute',bottom:0,right:0,width:'500px',height:'500px',background:'radial-gradient(circle,rgba(201,169,110,.05) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:'30%',left:'-100px',width:'300px',height:'300px',background:'radial-gradient(circle,rgba(74,156,122,.04) 0%,transparent 70%)',pointerEvents:'none'}}/>
      </section>

      {/* ══════════════════════════════════════════
          02 — IPRI™ INDEX
      ══════════════════════════════════════════ */}
      <section style={{background:'#f4f0e6',padding:'80px 64px'}} className="page-break">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'12px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>02 — Proprietary Index</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#0e0e0d'}}>IPRI™ — <em style={{color:'#1c4a35'}}>Iberian Prime Residential Index</em></div>
            </div>
          </div>
          <p style={{fontSize:'.88rem',lineHeight:1.7,color:'rgba(14,14,13,.55)',maxWidth:'700px',marginBottom:'36px',marginLeft:'19px'}}>
            Índice proprietário da Agency Group que mede a performance dos 8 mercados prime ibéricos. Base 100 = Janeiro 2020. Actualização trimestral. Único índice que combina preços, velocidade de transacção, procura internacional e liquidez de mercado.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'12px',marginBottom:'32px'}}>
            {IPRI.map((m,i)=>(
              <div key={m.market} className={`ipri-tier-${m.tier.toLowerCase()}`} style={{padding:'18px 20px',position:'relative'}}>
                {m.hot && <div style={{position:'absolute',top:'12px',right:'12px',background:'#c9a96e',color:'#0c1f15',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.08em',padding:'2px 6px',textTransform:'uppercase'}}>HOT</div>}
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px'}}>{m.tier} · #{i+1}</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#0e0e0d',lineHeight:1}}>{m.idx}</div>
                <div style={{fontSize:'.88rem',fontWeight:500,color:'#0e0e0d',marginTop:'6px',marginBottom:'4px'}}>{m.market}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:m.yoy.startsWith('+')?'#1c4a35':'#c94a4a'}}>{m.yoy} YoY</div>
                <div style={{height:'3px',background:'rgba(14,14,13,.06)',borderRadius:'2px',overflow:'hidden',marginTop:'12px'}}>
                  <div style={{height:'100%',background:'#c9a96e',width:`${Math.min(m.idx/1.7,100)}%`,borderRadius:'2px'}}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{background:'#0c1f15',padding:'20px 24px',display:'flex',gap:'32px',flexWrap:'wrap',alignItems:'center'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.35)'}}>IPRI™ Methodology:</div>
            {['Preço €/m²','Volume de transacções','Procura internacional','Tempo médio de venda','Liquidez off-market','Yield prime'].map(f=>(
              <div key={f} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <div style={{width:'4px',height:'4px',borderRadius:'50%',background:'rgba(201,169,110,.5)',flexShrink:0}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.35)',letterSpacing:'.04em'}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          03 — EXECUTIVE SUMMARY
      ══════════════════════════════════════════ */}
      <section style={{background:'#0c1f15',padding:'80px 64px'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'48px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'6px'}}>03 — Executive Summary</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#f4f0e6'}}>Portugal é o mercado <em style={{color:'#c9a96e'}}>mais resiliente</em> da Europa</div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'48px',marginBottom:'48px'}} className="grid-2">
            <div>
              <p style={{fontSize:'.92rem',lineHeight:1.9,color:'rgba(244,240,230,.65)',marginBottom:'20px'}}>
                O mercado imobiliário de luxo em Portugal registou em 2025/2026 a sua melhor performance histórica. Enquanto mercados como Londres (−3,2%), Paris (−4,8%) e Frankfurt (−6,1%) sofreram correcções significativas, Lisboa subiu para <strong style={{color:'#c9a96e'}}>Top 5 mundial</strong> em apreciação de imóvel de luxo, segundo o Knight Frank Prime City Index.
              </p>
              <p style={{fontSize:'.92rem',lineHeight:1.9,color:'rgba(244,240,230,.65)',marginBottom:'20px'}}>
                O IPRI™ da Agency Group regista 148 pontos para Lisboa Prime — o maior valor desde a criação do índice — reflectindo uma procura internacional sem precedentes e uma oferta de qualidade extremamente limitada.
              </p>
              <p style={{fontSize:'.92rem',lineHeight:1.9,color:'rgba(244,240,230,.65)'}}>
                Os catalisadores são estruturais: NHR/IFICI garante fiscalidade preferencial por 10 anos, qualidade de vida top-3 global, segurança, gastronomia e um custo de vida ainda 40% abaixo de Paris ou Londres prime.
              </p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',alignContent:'start'}}>
              {[
                { label:'Preço Mediana', val:'€3.076/m²', change:'+17,6% YoY', color:'#c9a96e' },
                { label:'Transacções', val:'169.812', change:'+8,4% vs 2025', color:'#c9a96e' },
                { label:'Tempo Médio', val:'210 dias', change:'−15 dias YoY', color:'#4a9c7a' },
                { label:'Lisboa Prime', val:'€8.500/m²', change:'Top 5 Mundial', color:'#c9a96e' },
                { label:'Arrendamento Tur.', val:'+22%', change:'Algarve + Madeira', color:'#4a9c7a' },
                { label:'Procura Intl.', val:'38%', change:'das transacções', color:'#c9a96e' },
              ].map(f=>(
                <div key={f.label} style={{background:'rgba(244,240,230,.04)',border:'1px solid rgba(244,240,230,.06)',padding:'18px 20px'}}>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:f.color,lineHeight:1}}>{f.val}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.3)',marginTop:'4px'}}>{f.label}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:f.color,marginTop:'4px',opacity:.7}}>{f.change}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Why 2026 */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}} className="grid-3">
            {[
              { title:'Euribor em queda', icon:'↓', body:'BCE cortou 5× desde 2024. Euribor 6M em 2,8%. Crédito habitação mais acessível para compradores internacionais.' },
              { title:'Escassez de oferta prime', icon:'◆', body:'Lisboa tem apenas 180 novos apartamentos de luxo por trimestre para uma procura de 2.000+. Desequilíbrio estrutural.' },
              { title:'USD forte vs EUR', icon:'$', body:'Com USD/EUR em 1,04, os compradores norte-americanos têm um desconto efectivo de 28% vs. 2021. Vantagem histórica.' },
            ].map(c=>(
              <div key={c.title} style={{background:'rgba(201,169,110,.07)',border:'1px solid rgba(201,169,110,.12)',padding:'20px'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'2rem',color:'#c9a96e',lineHeight:1,marginBottom:'10px'}}>{c.icon}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.6)',marginBottom:'8px'}}>{c.title}</div>
                <p style={{fontSize:'.85rem',lineHeight:1.7,color:'rgba(244,240,230,.45)'}}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          04 — ZONE INTELLIGENCE
      ══════════════════════════════════════════ */}
      <section style={{background:'#f4f0e6',padding:'80px 64px'}} className="page-break">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'40px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>04 — Zone Intelligence</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#0e0e0d'}}>Análise <em style={{color:'#1c4a35'}}>Prime</em> por Zona</div>
            </div>
          </div>

          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'32px'}}>
            {ZONES.map(z=>(
              <button key={z.nome} className={`light-zone-btn${activeZone===z.nome?' active':''}`} onClick={()=>setActiveZone(z.nome)}>
                {z.emoji} {z.nome}
              </button>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px'}} className="grid-2">
            <div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'3.2rem',color:'#1c4a35',lineHeight:1,marginBottom:'4px'}}>
                €{zone.preco.toLocaleString('pt-PT')}<span style={{fontSize:'1.2rem',opacity:.4,fontFamily:"'DM Mono',monospace"}}>/m²</span>
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',marginBottom:'8px'}}>Preço médio · 2026</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#c9a96e',letterSpacing:'.06em',marginBottom:'20px'}}>Prime: €{zone.primePraco.toLocaleString('pt-PT')}/m²</div>
              <p style={{fontSize:'.9rem',lineHeight:1.85,color:'rgba(14,14,13,.65)',marginBottom:'24px'}}>{zone.desc}</p>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',marginBottom:'24px'}}>
                {[
                  { v:`+${zone.yoy}%`, l:'YoY 2026', c:'#1c4a35' },
                  { v:`${zone.yield}%`, l:'Yield Longa', c:'#c9a96e' },
                  { v:`${zone.yieldTur}%`, l:'Yield Tur.', c:'#c9a96e' },
                ].map(m=>(
                  <div key={m.l} style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)',padding:'14px'}}>
                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',color:m.c,lineHeight:1}}>{m.v}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginTop:'4px'}}>{m.l}</div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:'16px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'10px'}}>Bairros Prime:</div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {zone.bairros.map(b=>(
                    <span key={b} style={{background:'#fff',border:'1px solid rgba(14,14,13,.12)',padding:'5px 12px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.6)',letterSpacing:'.06em'}}>{b}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Drivers de Procura:</div>
                {zone.drivers.map((d,i)=>(
                  <div key={i} style={{display:'flex',gap:'8px',marginBottom:'6px',alignItems:'flex-start'}}>
                    <div style={{width:'4px',height:'4px',borderRadius:'50%',background:'#c9a96e',marginTop:'7px',flexShrink:0}}/>
                    <span style={{fontSize:'.85rem',color:'rgba(14,14,13,.6)',lineHeight:1.6}}>{d}</span>
                  </div>
                ))}
              </div>

              <div style={{marginTop:'16px',background:'rgba(201,169,110,.08)',border:'1px solid rgba(201,169,110,.2)',padding:'12px 16px',display:'inline-block'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)',letterSpacing:'.06em',marginBottom:'4px'}}>Previsão 2027</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',color:'#c9a96e'}}>{zone.forecast}</div>
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>Comparação de Mercados — €/m²</div>
              {ZONES.map(z=>(
                <div key={z.nome} style={{cursor:'pointer'}} onClick={()=>setActiveZone(z.nome)}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                    <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.88rem',color:activeZone===z.nome?'#1c4a35':'rgba(14,14,13,.55)',fontWeight:activeZone===z.nome?500:400}}>{z.emoji} {z.nome}</span>
                    <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)'}}>+{z.yoy}%</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:activeZone===z.nome?'#1c4a35':'rgba(14,14,13,.6)',fontWeight:activeZone===z.nome?400:300}}>€{z.preco.toLocaleString('pt-PT')}</span>
                    </div>
                  </div>
                  <div className="stat-bar" style={{background:'rgba(14,14,13,.06)'}}>
                    <div className="stat-bar-fill" style={{width:`${(z.preco/6000*100)}%`,background:activeZone===z.nome?'#1c4a35':'rgba(28,74,53,.3)'}}/>
                  </div>
                </div>
              ))}
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.25)',marginTop:'8px',letterSpacing:'.04em'}}>
                Fonte: INE · AT · Idealista · Imovirtual · Agency Group IPRI™ Q1 2026
              </div>

              {/* Volume chart */}
              <div style={{marginTop:'20px',background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'16px 20px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'12px'}}>Volume Transacções 2026</div>
                {ZONES.map(z=>(
                  <div key={z.nome} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)',width:'60px',flexShrink:0}}>{z.nome}</div>
                    <div style={{flex:1,height:'6px',background:'rgba(14,14,13,.04)',borderRadius:'3px',overflow:'hidden'}}>
                      <div style={{height:'100%',background:activeZone===z.nome?'#c9a96e':'rgba(201,169,110,.35)',width:`${(z.vol/20000*100)}%`,borderRadius:'3px',transition:'width .5s'}}/>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',width:'50px',textAlign:'right'}}>{(z.vol/1000).toFixed(1)}K</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          05 — BUYER ATLAS
      ══════════════════════════════════════════ */}
      <section style={{background:'#0c1f15',padding:'80px 64px'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'40px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'6px'}}>05 — Foreign Buyer Atlas</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#f4f0e6'}}>Perfil de <em style={{color:'#c9a96e'}}>Compradores Internacionais</em></div>
            </div>
          </div>

          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'28px'}}>
            {BUYERS.map(b=>{
              const shortName = b.nac.split(' ').slice(1).join(' ')
              return (
                <button key={shortName} className={`zone-btn${activeBuyer===shortName?' active':''}`} onClick={()=>setActiveBuyer(shortName)}>
                  {b.nac.split(' ')[0]} {shortName}
                </button>
              )
            })}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px',marginBottom:'40px'}} className="grid-2">
            <div style={{background:'rgba(244,240,230,.03)',border:'1px solid rgba(244,240,230,.07)',padding:'28px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.9rem',color:'#f4f0e6'}}>{buyer.nac}</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.8rem',color:'#c9a96e',lineHeight:1}}>{buyer.pct}%</div>
              </div>
              <div className="stat-bar" style={{marginBottom:'20px',background:'rgba(201,169,110,.1)'}}>
                <div className="stat-bar-fill" style={{width:`${buyer.pct*4}%`}}/>
              </div>
              <p style={{fontSize:'.88rem',lineHeight:1.8,color:'rgba(244,240,230,.55)',marginBottom:'20px'}}>{buyer.perfil}</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div style={{background:'rgba(201,169,110,.08)',padding:'12px 14px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'4px'}}>Ticket Médio</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#c9a96e'}}>{buyer.avg}</div>
                </div>
                <div style={{background:'rgba(201,169,110,.08)',padding:'12px 14px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'4px'}}>Ciclo de Decisão</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'rgba(244,240,230,.6)',marginTop:'4px'}}>{buyer.tempo}</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'16px'}}>Driver principal</div>
              <div style={{background:'rgba(201,169,110,.1)',border:'1px solid rgba(201,169,110,.2)',padding:'16px 20px',marginBottom:'20px'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',color:'#c9a96e',fontStyle:'italic'}}>{buyer.driver}</div>
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'12px'}}>Zonas Preferidas</div>
              {buyer.zonas.map((z,i)=>(
                <div key={i} style={{display:'flex',gap:'10px',alignItems:'flex-start',marginBottom:'10px'}}>
                  <div style={{width:'20px',height:'20px',borderRadius:'50%',background:'rgba(201,169,110,.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#c9a96e'}}>{i+1}</span>
                  </div>
                  <span style={{fontSize:'.88rem',color:'rgba(244,240,230,.55)',lineHeight:1.5}}>{z}</span>
                </div>
              ))}
              <div style={{marginTop:'24px',background:'rgba(28,74,53,.4)',padding:'14px 16px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.4)',marginBottom:'6px'}}>Segmento de Preço</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',color:'#4a9c7a'}}>{buyer.seg}</div>
              </div>
            </div>
          </div>

          {/* All buyers bar chart */}
          <div style={{background:'rgba(244,240,230,.03)',border:'1px solid rgba(244,240,230,.06)',padding:'24px'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(244,240,230,.3)',marginBottom:'20px'}}>Quota de Mercado — Compradores Internacionais 2026</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}} className="grid-2">
              {BUYERS.map(b=>(
                <div key={b.nac} style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{width:'100px',fontSize:'.82rem',color:'rgba(244,240,230,.5)',flexShrink:0}}>{b.nac.split(' ')[0]} {b.nac.split(' ').slice(1).join(' ')}</div>
                  <div style={{flex:1,height:'5px',background:'rgba(244,240,230,.06)',borderRadius:'3px',overflow:'hidden'}}>
                    <div style={{height:'100%',background:'#c9a96e',width:`${b.pct*4}%`,borderRadius:'3px'}}/>
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#c9a96e',width:'32px'}}>{b.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          06 — INVESTMENT CALCULATOR
      ══════════════════════════════════════════ */}
      <section style={{background:'#f4f0e6',padding:'80px 64px'}} className="page-break no-print">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'12px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>06 — Interactive Tool</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#0e0e0d'}}>Calculadora de <em style={{color:'#1c4a35'}}>Retorno de Investimento</em></div>
            </div>
          </div>
          <p style={{fontSize:'.88rem',lineHeight:1.7,color:'rgba(14,14,13,.5)',maxWidth:'600px',marginBottom:'36px',marginLeft:'19px'}}>
            Configure o seu cenário de investimento e veja projectado em tempo real: custos de aquisição, yield, cash flow mensal e IRR. Baseado em dados reais do mercado português Q1 2026.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px'}} className="grid-2">
            {/* Inputs */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div className="calc-input-group">
                <label className="calc-label">Orçamento de Compra (€)</label>
                <input className="r-inp" type="number" value={calcBudget} onChange={e=>setCalcBudget(e.target.value)} placeholder="1.500.000"/>
              </div>
              <div className="calc-input-group">
                <label className="calc-label">Zona de Investimento</label>
                <select className="r-sel" value={calcZone} onChange={e=>setCalcZone(e.target.value)} style={{width:'100%'}}>
                  {ZONES.map(z=><option key={z.nome} value={z.nome}>{z.emoji} {z.nome} — Yield {z.yield}% longa / {z.yieldTur}% turístico</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="calc-input-group">
                  <label className="calc-label">LTV (% Financiado)</label>
                  <select className="r-sel" value={calcLtv} onChange={e=>setCalcLtv(e.target.value)} style={{width:'100%'}}>
                    {['0','50','60','70','75','80'].map(v=><option key={v} value={v}>{v}% LTV</option>)}
                  </select>
                </div>
                <div className="calc-input-group">
                  <label className="calc-label">Horizonte</label>
                  <select className="r-sel" value={calcHorizonte} onChange={e=>setCalcHorizonte(e.target.value)} style={{width:'100%'}}>
                    {['5','7','10','15','20'].map(v=><option key={v} value={v}>{v} anos</option>)}
                  </select>
                </div>
              </div>
              <div className="calc-input-group">
                <label className="calc-label">Tipo de Arrendamento</label>
                <div style={{display:'flex',gap:'8px'}}>
                  {(['longa','turistica'] as const).map(t=>(
                    <button key={t} onClick={()=>setCalcTipoRenda(t)} style={{flex:1,padding:'10px',border:`1px solid ${calcTipoRenda===t?'#1c4a35':'rgba(14,14,13,.12)'}`,background:calcTipoRenda===t?'rgba(28,74,53,.06)':'transparent',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.08em',textTransform:'uppercase',color:calcTipoRenda===t?'#1c4a35':'rgba(14,14,13,.45)',cursor:'pointer',transition:'all .2s'}}>
                      {t==='longa'?'Longa Duração':'Turístico'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Acquisition costs breakdown */}
              <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'16px 20px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Custos de Aquisição</div>
                {[
                  ['Preço do Imóvel', fmtEur(parseFloat(calcBudget)||0)],
                  ['IMT (6,5%)', fmtEur(calcMetrics.imt)],
                  ['IS (0,8%)', fmtEur(calcMetrics.is)],
                  ['Notário + Registo', fmtEur(calcMetrics.outrosCustos)],
                  ['Capital Próprio Necessário', fmtEur(calcMetrics.equity + calcMetrics.imt + calcMetrics.is + calcMetrics.outrosCustos)],
                ].map(([l,v],i)=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<4?'1px solid rgba(14,14,13,.04)':'none'}}>
                    <span style={{fontSize:'.84rem',color:i===4?'#0e0e0d':'rgba(14,14,13,.55)',fontWeight:i===4?500:400}}>{l}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:i===4?'#1c4a35':'rgba(14,14,13,.55)',fontWeight:i===4?400:300}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="calc-metric">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'6px'}}>Yield Bruto</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#c9a96e',lineHeight:1}}>
                    {(ZONES.find(z=>z.nome===calcZone)||ZONES[0])[calcTipoRenda==='turistica'?'yieldTur':'yield'].toFixed(1)}%
                  </div>
                </div>
                <div className="calc-metric">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'6px'}}>Yield Líquido</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#1c4a35',lineHeight:1}}>
                    {Math.max(0,(ZONES.find(z=>z.nome===calcZone)||ZONES[0])[calcTipoRenda==='turistica'?'yieldTur':'yield'] - 1.2).toFixed(1)}%
                  </div>
                </div>
                <div className="calc-metric-green">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'6px'}}>IRR Projectado</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#1c4a35',lineHeight:1}}>{calcMetrics.irr.toFixed(1)}%</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.35)',marginTop:'4px'}}>em {calcHorizonte} anos</div>
                </div>
                <div className="calc-metric-green">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'6px'}}>Cash-on-Cash</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#c9a96e',lineHeight:1}}>{calcMetrics.cashOnCash.toFixed(1)}%</div>
                </div>
              </div>

              <div style={{background:'#0c1f15',padding:'20px 22px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.35)',marginBottom:'14px'}}>Projecção {calcHorizonte} Anos</div>
                {[
                  ['Renda Bruta Anual', fmtEur(calcMetrics.rendaBruta), '#c9a96e'],
                  ['Renda Líquida Anual', fmtEur(calcMetrics.rendaLiquida), '#4a9c7a'],
                  ['Prestação Mensal', calcMetrics.prestacao>0?fmtEur(calcMetrics.prestacao):'-', 'rgba(244,240,230,.45)'],
                  ['Cash Flow Mensal', fmtEur(calcMetrics.cashFlowMensal), calcMetrics.cashFlowMensal>=0?'#4a9c7a':'#c94a4a'],
                  ['Valor Final Estimado', fmtEur(calcMetrics.valorFinal), '#c9a96e'],
                  ['Retorno Total', fmtEur(calcMetrics.totalReturn), '#c9a96e'],
                ].map(([l,v,c])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(244,240,230,.04)'}}>
                    <span style={{fontSize:'.84rem',color:'rgba(244,240,230,.4)'}}>{l}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:c as string}}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{background:'rgba(201,169,110,.08)',border:'1px solid rgba(201,169,110,.2)',padding:'12px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
                <div style={{width:'16px',height:'16px',borderRadius:'50%',background:'rgba(201,169,110,.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'2px'}}>
                  <span style={{fontSize:'.6rem',color:'#c9a96e'}}>i</span>
                </div>
                <p style={{fontSize:'.8rem',lineHeight:1.6,color:'rgba(14,14,13,.55)'}}>
                  Simulação baseada em dados reais Q1 2026. Apreciação conservadora ({((ZONES.find(z=>z.nome===calcZone)||ZONES[0]).yoy/2).toFixed(0)}%/ano vs {(ZONES.find(z=>z.nome===calcZone)||ZONES[0]).yoy}% actual). Euribor 6M estimado a 2,8% + spread. Para análise personalizada, contacte um advisor Agency Group.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          07 — NHR / IFICI
      ══════════════════════════════════════════ */}
      <section style={{background:'#1c4a35',padding:'80px 64px'}} className="page-break">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'48px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'6px'}}>07 — Tax Intelligence</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#f4f0e6'}}>NHR / IFICI — <em style={{color:'#c9a96e'}}>10 anos de vantagem fiscal</em></div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'32px'}} className="grid-3">
            {[
              { title:'Taxa Flat IRS', val:'20%', sub:'vs até 48% regime geral', detail:'Aplica-se a rendimentos de trabalho em actividades de alto valor acrescentado' },
              { title:'Pensões Estrangeiras', val:'10%', sub:'Novos residentes 2024+', detail:'Taxa reduzida vs. isenção total do NHR original. Ainda competitivo vs. UK/FR/DE' },
              { title:'Dividendos Externos', val:'0%', sub:'Países com tratado fiscal', detail:'Portugal tem 85+ tratados de dupla tributação. Dividendos de holdings estrangeiras isentos' },
              { title:'Duração Garantida', val:'10 anos', sub:'Contados desde a chegada', detail:'Não pode ser revogado retroactivamente. Segurança jurídica total pelo período' },
              { title:'Poupança Típica', val:'€40–200K', sub:'Por ano (dep. rendimento)', detail:'Um gestor de fundo com €500K de rendimento poupa ~€140K/ano vs. UK' },
              { title:'Elegibilidade', val:'Global', sub:'Qualquer novo residente fiscal', detail:'Sem restrições de nacionalidade. Português emigrado que regressa também elegível' },
            ].map(m=>(
              <div key={m.title} style={{background:'rgba(244,240,230,.05)',border:'1px solid rgba(244,240,230,.08)',padding:'20px'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2rem',color:'#c9a96e',lineHeight:1,marginBottom:'6px'}}>{m.val}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.5)'}}>{m.title}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.3)',marginTop:'4px',marginBottom:'10px'}}>{m.sub}</div>
                <p style={{fontSize:'.8rem',lineHeight:1.6,color:'rgba(244,240,230,.35)'}}>{m.detail}</p>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div style={{background:'rgba(244,240,230,.04)',border:'1px solid rgba(244,240,230,.08)',padding:'24px',marginBottom:'24px'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.4rem',color:'#f4f0e6',marginBottom:'16px'}}>Poupança Anual Estimada — Rendimento €300.000</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:"'DM Mono',monospace",fontSize:'.52rem'}}>
                <thead>
                  <tr>
                    {['País','Taxa Marginal','Imposto Estimado','Poupança vs NHR'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',borderBottom:'1px solid rgba(244,240,230,.08)',color:'rgba(244,240,230,.3)',letterSpacing:'.08em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['🇵🇹 Portugal NHR','20%','€60.000','—'],
                    ['🇬🇧 Reino Unido','45%','€135.000','€75.000/ano'],
                    ['🇫🇷 França','49%','€147.000','€87.000/ano'],
                    ['🇩🇪 Alemanha','47%','€141.000','€81.000/ano'],
                    ['🇺🇸 EUA','37% fed + state','€148.000+','€88.000+/ano'],
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i===0?'rgba(201,169,110,.08)':'transparent'}}>
                      {row.map((cell,j)=>(
                        <td key={j} style={{padding:'8px 12px',borderBottom:'1px solid rgba(244,240,230,.04)',color:i===0&&j===3?'#4a9c7a':i===0?'rgba(244,240,230,.85)':j===3?'#c9a96e':'rgba(244,240,230,.45)'}}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{background:'rgba(201,169,110,.1)',border:'1px solid rgba(201,169,110,.2)',padding:'20px 24px'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.7)',marginBottom:'8px'}}>Agency Group — NHR Concierge Service</div>
            <p style={{fontSize:'.9rem',lineHeight:1.7,color:'rgba(244,240,230,.65)'}}>
              A Agency Group acompanha o processo completo: advogado fiscal, número de contribuinte, conta bancária, licença de condução, inscrição no NHR/IFICI e apoio na mudança. Calculamos a poupança exacta para cada cliente antes da decisão de compra — o NHR/IFICI pode valer mais do que a mais-valia do próprio imóvel ao longo de 10 anos.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          08 — OUTLOOK + COMPARISON
      ══════════════════════════════════════════ */}
      <section style={{background:'#f4f0e6',padding:'80px 64px'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'48px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>08 — Investment Outlook</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#0e0e0d'}}>Perspectivas <em style={{color:'#1c4a35'}}>2026–2030</em></div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'40px'}} className="grid-2">
            {[
              { title:'🟢 Bull Case (P70)', items:['Euribor < 2,5% até Q4 2026 — crédito muito acessível','Procura internacional acelera para +20% YoY','NHR/IFICI atrai 15.000+ novos residentes/ano','Lisboa consolida Top 3 cidades para HNWI globais','Comporta e Madeira emergem como Rivieras de classe mundial','Preços: +15–20% YoY em todas as zonas prime'], color:'#4a9c7a' },
              { title:'🟡 Base Case (P50)', items:['Crescimento normaliza para +8–12% YoY','Volume estável 165–175K transacções/ano','Luxo (€1M+) continua outperformance vs. mass market','International buyers mantêm 35–40% das transacções','Yield prime estabiliza entre 3–4% residential','Comporta e Algarve continuam crescimento acelerado'], color:'#c9a96e' },
            ].map(s=>(
              <div key={s.title} style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'24px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.1em',textTransform:'uppercase',color:s.color,marginBottom:'16px'}}>{s.title}</div>
                {s.items.map((item,i)=>(
                  <div key={i} style={{display:'flex',gap:'10px',marginBottom:'10px',alignItems:'flex-start'}}>
                    <div style={{width:'4px',height:'4px',borderRadius:'50%',background:s.color,marginTop:'7px',flexShrink:0}}/>
                    <span style={{fontSize:'.85rem',color:'rgba(14,14,13,.65)',lineHeight:1.65}}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div style={{background:'#0c1f15',padding:'32px'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.5rem',color:'#f4f0e6',marginBottom:'20px'}}>Portugal vs. Principais <em style={{color:'#c9a96e'}}>Mercados Alternativos</em> — 2026</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:"'DM Mono',monospace",fontSize:'.52rem'}}>
                <thead>
                  <tr>
                    {['Mercado','Preço Prime','YoY','Yield','IPRI™','NHR Equiv.','Golden Visa','Qualidade de Vida'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'left',borderBottom:'1px solid rgba(244,240,230,.08)',color:'rgba(244,240,230,.3)',letterSpacing:'.08em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['🇵🇹 Lisboa', '€5.000–€12K', '+14%', '3,2–5,5%', '148', '✅ 20%', '✅', '⭐⭐⭐⭐⭐'],
                    ['🇦🇪 Dubai', '€4.200/m²', '+18%', '5,1%', '—', '✅ 0%', '✅', '⭐⭐⭐⭐'],
                    ['🇪🇸 Madrid', '€5.800/m²', '+9%', '2,8%', '119', '❌', '❌', '⭐⭐⭐⭐'],
                    ['🇮🇹 Milano', '€7.800/m²', '+6%', '2,6%', '—', '🟡', '✅', '⭐⭐⭐⭐'],
                    ['🇫🇷 Paris', '€10.200/m²', '−4,8%', '1,9%', '—', '❌ 49%', '❌', '⭐⭐⭐'],
                    ['🇬🇧 Londres', '€12.500/m²', '−3,2%', '2,1%', '—', '❌ 45%', '❌', '⭐⭐⭐'],
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i===0?'rgba(201,169,110,.07)':'transparent'}}>
                      {row.map((cell,j)=>(
                        <td key={j} style={{padding:'10px 12px',borderBottom:'1px solid rgba(244,240,230,.04)',color:i===0&&j===0?'#c9a96e':i===0?'rgba(244,240,230,.85)':'rgba(244,240,230,.45)'}}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          09 — DEVELOPMENT PIPELINE
      ══════════════════════════════════════════ */}
      <section style={{background:'#0c1f15',padding:'80px 64px'}} className="page-break">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'12px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'6px'}}>09 — Pipeline</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#f4f0e6'}}>Novos <em style={{color:'#c9a96e'}}>Desenvolvimentos Prime</em> 2026–2027</div>
            </div>
          </div>
          <p style={{fontSize:'.88rem',lineHeight:1.7,color:'rgba(244,240,230,.4)',maxWidth:'650px',marginBottom:'36px',marginLeft:'19px'}}>
            Selecção dos projectos mais relevantes para investidores. A Agency Group tem acesso privilegiado a unidades em pré-lançamento e off-market em todos os projectos listados.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'16px'}}>
            {PIPELINE.map(p=>(
              <div key={p.nome} style={{background:'rgba(244,240,230,.03)',border:'1px solid rgba(244,240,230,.07)',padding:'20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.08em',textTransform:'uppercase',color:'rgba(201,169,110,.5)'}}>{p.zona} · {p.tipo}</div>
                  <div style={{background:p.sold>=80?'rgba(201,169,110,.2)':p.sold>=60?'rgba(74,156,122,.15)':'rgba(244,240,230,.06)',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:p.sold>=80?'#c9a96e':p.sold>=60?'#4a9c7a':'rgba(244,240,230,.4)',letterSpacing:'.08em'}}>{p.sold}% vendido</div>
                </div>
                <div style={{fontSize:'.95rem',fontWeight:500,color:'#f4f0e6',marginBottom:'6px'}}>{p.nome}</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#c9a96e',marginBottom:'12px'}}>{p.preco}</div>
                <div className="pipe-progress">
                  <div className="pipe-progress-fill" style={{width:`${p.sold}%`,background:p.sold>=80?'#c9a96e':'#4a9c7a'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:'12px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.35)'}}>Entrega: {p.delivery}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.25)'}}>{p.units} unidades</div>
                </div>
                <div style={{marginTop:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.2)',borderTop:'1px solid rgba(244,240,230,.05)',paddingTop:'8px'}}>{p.dev}</div>
              </div>
            ))}
          </div>

          <div style={{marginTop:'24px',background:'rgba(201,169,110,.07)',border:'1px solid rgba(201,169,110,.15)',padding:'20px 24px',display:'flex',gap:'24px',flexWrap:'wrap',alignItems:'center'}}>
            <div style={{flex:1,minWidth:'200px'}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'6px'}}>Acesso Privilegiado</div>
              <p style={{fontSize:'.88rem',lineHeight:1.65,color:'rgba(244,240,230,.55)'}}>A Agency Group tem acesso a units em pré-lançamento com condições especiais. Contacte-nos para lista de disponibilidade actualizada.</p>
            </div>
            <a href="https://wa.me/351919948986" style={{background:'#c9a96e',color:'#0c1f15',textDecoration:'none',padding:'12px 24px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.14em',textTransform:'uppercase',whiteSpace:'nowrap',display:'inline-block'}}>
              WhatsApp →
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          10 — AGENCY GROUP ADVANTAGE
      ══════════════════════════════════════════ */}
      <section style={{background:'#f4f0e6',padding:'80px 64px'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'48px'}}>
            <div style={{width:'3px',height:'40px',background:'#c9a96e'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>10 — Why Agency Group</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:'#0e0e0d'}}>A única agência com acesso <em style={{color:'#1c4a35'}}>verdadeiramente off-market</em></div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px',marginBottom:'40px'}} className="grid-3">
            {[
              { num:'01', title:'Off-Market First', desc:'65% das nossas transacções são off-market. Proprietários e developers contactam-nos antes de listar publicamente. O cliente tem acesso ao que outros nunca verão.' },
              { num:'02', title:'IPRI™ Intelligence', desc:'Único índice proprietário de mercado ibérico. Dados em tempo real de 8 mercados prime. O cliente decide com informação que não existe em nenhuma outra agência.' },
              { num:'03', title:'Investor Dashboard', desc:'Portal exclusivo com AVM, simulador financeiro, pipeline CPCV e CRM integrado. Transparência total no processo de compra — nível Family Office.' },
              { num:'04', title:'NHR Concierge', desc:'Calculamos a poupança fiscal exacta antes da compra. Rede de advogados fiscais top-tier. O processo NHR/IFICI do início ao fim, incluído no serviço.' },
              { num:'05', title:'Global Network', desc:'Parceiros em Miami, São Paulo, Paris, Londres, Dubai e Singapura. Acesso a compradores e investidores que não estão nos portais públicos.' },
              { num:'06', title:'5% All-Inclusive', desc:'Uma comissão. Um ponto de contacto. Sem surpresas. 50% no CPCV, 50% na escritura. Advogado e notário recomendados incluídos na coordenação.' },
            ].map(c=>(
              <div key={c.num} style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'24px'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.5rem',color:'rgba(201,169,110,.25)',lineHeight:1,marginBottom:'12px'}}>{c.num}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#1c4a35',marginBottom:'10px'}}>{c.title}</div>
                <p style={{fontSize:'.86rem',lineHeight:1.75,color:'rgba(14,14,13,.55)'}}>{c.desc}</p>
              </div>
            ))}
          </div>

          <div style={{background:'#0c1f15',padding:'40px 48px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px',alignItems:'center'}} className="grid-2">
            <div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2rem',color:'#f4f0e6',marginBottom:'16px'}}>Pronto para investir <em style={{color:'#c9a96e'}}>no melhor mercado da Europa</em>?</div>
              <p style={{fontSize:'.9rem',lineHeight:1.8,color:'rgba(244,240,230,.55)'}}>
                A nossa equipa responde em menos de 2 horas. Primeira consulta gratuita — análise do mercado, cálculo do NHR e pré-selecção de propriedades off-market.
              </p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              {[
                { label:'WhatsApp', val:'+351 919 948 986', link:'https://wa.me/351919948986' },
                { label:'Email', val:'info@agencygroup.pt', link:'mailto:info@agencygroup.pt' },
                { label:'Portal', val:'agencygroup.pt/portal', link:'/portal' },
              ].map(c=>(
                <a key={c.label} href={c.link} style={{textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',border:'1px solid rgba(244,240,230,.08)',background:'rgba(244,240,230,.03)',transition:'border-color .2s'}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(244,240,230,.35)'}}>{c.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#c9a96e'}}>{c.val} →</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          11 — DOWNLOAD GATE
      ══════════════════════════════════════════ */}
      <section style={{background:'#0c1f15',padding:'100px 64px',textAlign:'center'}} className="no-print">
        <div style={{maxWidth:'620px',margin:'0 auto'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginBottom:'16px'}}>11 — PDF Premium</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.8rem',color:'#f4f0e6',marginBottom:'8px'}}>
            {unlocked ? 'Download Disponível' : 'Receba o Report Completo'}
          </div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.5rem',color:'#c9a96e',marginBottom:'12px',fontStyle:'italic'}}>
            {unlocked ? '↓ Imprima ou guarde como PDF' : 'Portugal Luxury Market Report 2026'}
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.12em',color:'rgba(244,240,230,.25)',marginBottom:'36px'}}>
            {unlocked ? 'CTRL+P → Guardar como PDF' : 'IPRI™ Index · Zone Intelligence · Investment Calculator · NHR Guide · Pipeline'}
          </div>

          {!unlocked ? (
            <div>
              <div style={{display:'flex',gap:'0',maxWidth:'500px',margin:'0 auto'}}>
                <input
                  className="r-inp"
                  style={{borderRight:'none',flex:1}}
                  type="email"
                  placeholder="O seu email profissional..."
                  value={email}
                  onChange={e=>{setEmail(e.target.value);if(emailError)setEmailError('')}}
                  onKeyDown={e=>e.key==='Enter'&&handleUnlock()}
                />
                <button className="r-btn" style={{whiteSpace:'nowrap',padding:'13px 28px'}} onClick={handleUnlock} disabled={submitting}>
                  {submitting ? '...' : 'Aceder →'}
                </button>
              </div>
              {emailError && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#e05a5a',marginTop:'8px',letterSpacing:'.06em'}}>{emailError}</div>
              )}
            </div>
          ) : (
            <div>
              <div style={{background:'rgba(201,169,110,.1)',border:'1px solid rgba(201,169,110,.25)',padding:'20px',marginBottom:'20px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.12em',color:'#c9a96e',marginBottom:'8px',textTransform:'uppercase'}}>✓ Acesso concedido</div>
                <div style={{fontSize:'.88rem',color:'rgba(244,240,230,.55)',lineHeight:1.65}}>
                  Clique em "Descarregar Relatório PDF" ou use Ctrl+P → Guardar como PDF. O relatório está optimizado para impressão A4.
                </div>
              </div>
              <button
                onClick={() => {
                  setTimeout(() => window.print(), 500)
                }}
                style={{background:'#c9a96e',color:'#0c1f15',border:'none',padding:'14px 32px',fontFamily:"'DM Mono',monospace",fontSize:'.56rem',letterSpacing:'.2em',textTransform:'uppercase',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',margin:'0 auto'}}
              >
                <span>⬇</span> Descarregar Relatório PDF
              </button>
            </div>
          )}

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.15)',marginTop:'24px',letterSpacing:'.08em'}}>
            A Agency Group nunca partilha dados pessoais com terceiros · RGPD compliant
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:'#0c1f15',borderTop:'1px solid rgba(201,169,110,.1)',padding:'32px 64px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',letterSpacing:'.3em',textTransform:'uppercase',color:'#c9a96e'}}>Agency Group</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',color:'rgba(244,240,230,.2)',marginTop:'4px',textTransform:'uppercase'}}>AMI 22506 · IPRI™ Research · agencygroup.pt</div>
        </div>
        <div style={{display:'flex',gap:'24px'}}>
          <Link href="/" style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',color:'rgba(244,240,230,.3)',textDecoration:'none',textTransform:'uppercase'}}>Website</Link>
          <Link href="/portal" style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',color:'rgba(244,240,230,.3)',textDecoration:'none',textTransform:'uppercase'}}>Portal</Link>
          <Link href="/blog" style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',color:'rgba(244,240,230,.3)',textDecoration:'none',textTransform:'uppercase'}}>Blog</Link>
          <a href="https://wa.me/351919948986" style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',color:'#c9a96e',textDecoration:'none',textTransform:'uppercase'}}>WhatsApp</a>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.15)',letterSpacing:'.06em'}}>© 2026 Agency Group · Todos os direitos reservados</div>
      </footer>
    </>
  )
}
