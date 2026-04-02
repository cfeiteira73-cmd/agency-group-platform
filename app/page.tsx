'use client'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import PressSection from './components/PressSection'
import ReviewsWidget from './components/ReviewsWidget'
import { CurrencySelector } from './components/CurrencyWidget'

gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  const [slideIdx, setSlideIdx] = useState(0)
  const [avmResult, setAvmResult] = useState<number|null>(null)
  const [radarDone, setRadarDone] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isAgent, setIsAgent] = useState(false)
  const [agModal, setAgModal] = useState(false)
  const [agEmailVal, setAgEmailVal] = useState('')
  const [agSent, setAgSent] = useState(false)
  const [agSending, setAgSending] = useState(false)
  const [mortgageResult, setMortgageResult] = useState<Record<string,unknown>|null>(null)
  const [nhrResult, setNhrResult] = useState<Record<string,unknown>|null>(null)
  const [portfolioResult, setPortfolioResult] = useState<Record<string,unknown>|null>(null)
  const [portfolioItems, setPortfolioItems] = useState<string[]>(['','',''])
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [cpcvDeals, setCpcvDeals] = useState([
    { id:1, ref:'AG-2026-001', imovel:'Villa Quinta da Marinha · Cascais', valor:'€ 3.800.000', fase:'CPCV Assinado', pct:60, cor:'#c9a96e', data:'15 Jan 2026' },
    { id:2, ref:'AG-2026-002', imovel:'Penthouse Chiado · Lisboa', valor:'€ 2.100.000', fase:'Due Diligence', pct:40, cor:'#4a9c7a', data:'22 Jan 2026' },
    { id:3, ref:'AG-2026-003', imovel:'Herdade Comporta', valor:'€ 6.500.000', fase:'Proposta Aceite', pct:25, cor:'#3a7bd5', data:'28 Jan 2026' },
  ])
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Token in URL always takes priority (magic link flow)
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            const email = d.email || sessionStorage.getItem('ag_pending_email') || ''
            sessionStorage.removeItem('ag_pending_email')
            localStorage.setItem('ag_auth', JSON.stringify({ v: '1', exp: Date.now() + 8 * 60 * 60 * 1000, email, token }))
            setIsAgent(true)
            window.location.href = `/portal?token=${encodeURIComponent(token)}`
          } else {
            alert('Link inválido ou expirado. Pede um novo.')
          }
        })
        .catch(() => {})
      return
    }
    // No token — check localStorage session
    const stored = localStorage.getItem('ag_auth')
    if (stored) {
      try {
        const d = JSON.parse(stored)
        if (d.v === '1' && Date.now() < d.exp) { setIsAgent(true); return }
        else localStorage.removeItem('ag_auth')
      } catch { localStorage.removeItem('ag_auth') }
    }

    // Redirected from /portal (session expired or no cookie) → open login modal
    if (params.get('acesso') === 'required') {
      setTimeout(() => setAgModal(true), 600)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // ═══ GSAP + CURSOR + TUDO ═══
  useEffect(() => {
    // LOADER
    document.body.style.overflow = 'hidden'
    const loader = loaderRef.current!
    const ldrTL = gsap.timeline({
      onComplete: () => {
        loader.classList.add('done')
        document.body.style.overflow = ''
        setTimeout(heroEntrance, 200)
      }
    })
    ldrTL
      .to('#ldrA', { opacity: 1, duration: 0.5, ease: 'power2.out' })
      .to('#ldrG', { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.2')
      .to('#ldrFill', { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, '-=0.3')
      .to('#ldrTxt', { opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=1')
      .to(loader, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, '+=0.3')

    // HERO ENTRANCE
    function heroEntrance() {
      const tl = gsap.timeline()
      tl.fromTo('#hEye',
          { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
          { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.out' })
        .to('.hero-h1 .line-inner', { y: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out' }, '-=0.3')
        .to('#hSub', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.3')
        .to('#hBtns', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.2')
        .to('#hStats', { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' }, '-=0.3')
        .to('#hScroll', { opacity: 1, duration: 0.5 }, '-=0.2')
        .to('#searchBox', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.3')
    }

    // CURSOR — inércia dupla
    const dot = document.getElementById('cDot')!
    const ring = document.getElementById('cRing')!
    let mx=0,my=0,dx=0,dy=0,rx=0,ry=0,rafId=0
    const onMove = (e:MouseEvent) => { mx=e.clientX; my=e.clientY }
    window.addEventListener('mousemove', onMove)
    const loop = () => {
      dx+=(mx-dx)*0.22; dy+=(my-dy)*0.22
      rx+=(mx-rx)*0.08; ry+=(my-ry)*0.08
      dot.style.transform=`translate(calc(${dx}px - 50%), calc(${dy}px - 50%))`
      ring.style.transform=`translate(calc(${rx}px - 50%), calc(${ry}px - 50%))`
      rafId=requestAnimationFrame(loop)
    }
    rafId=requestAnimationFrame(loop)
    document.querySelectorAll('a,button,[data-hover],.zc,.imc').forEach(el => {
      el.addEventListener('mouseenter',()=>document.body.classList.add('hovering'))
      el.addEventListener('mouseleave',()=>document.body.classList.remove('hovering'))
    })
    document.querySelectorAll('input,textarea,select').forEach(el => {
      el.addEventListener('focus',()=>document.body.classList.add('hovering'))
      el.addEventListener('blur',()=>document.body.classList.remove('hovering'))
    })
    document.querySelectorAll('.hl,.market-section,.mq,.ag-section').forEach(el => {
      el.addEventListener('mouseenter',()=>document.body.classList.add('on-dark'))
      el.addEventListener('mouseleave',()=>document.body.classList.remove('on-dark'))
    })

    // SCROLL PROGRESS
    gsap.to('#pgb', { scaleX:1, ease:'none', scrollTrigger:{ trigger: document.body, start:'top top', end:'bottom bottom', scrub:0 }})

    // NAV SOLID
    ScrollTrigger.create({
      start: 60,
      onEnter: () => document.getElementById('mainNav')?.classList.add('solid'),
      onLeaveBack: () => document.getElementById('mainNav')?.classList.remove('solid')
    })

    // TEXT REVEALS
    document.querySelectorAll('.text-reveal').forEach(el => {
      const inner = el.querySelector('.text-reveal-inner')
      if (!inner) return
      gsap.to(inner, { y:0, duration:0.9, ease:'power3.out', scrollTrigger:{ trigger:el, start:'top 88%', once:true }})
    })

    // CLIP REVEALS
    document.querySelectorAll('.clip-reveal').forEach(el => {
      gsap.to(el, { clipPath:'inset(0 0% 0 0)', duration:0.9, ease:'power3.inOut', scrollTrigger:{ trigger:el, start:'top 90%', once:true }})
    })

    // FADE IN
    document.querySelectorAll('.fade-in').forEach((el, i) => {
      gsap.to(el, { opacity:1, y:0, duration:0.8, ease:'power2.out', delay:(i%3)*0.08, scrollTrigger:{ trigger:el, start:'top 90%', once:true }})
    })

    // IMÓVEIS CLIP-PATH REVEAL
    document.querySelectorAll<HTMLElement>('.imc').forEach((card, i) => {
      const revEl = card.querySelector('.imc-img-reveal')
      if (!revEl) return
      gsap.timeline({ scrollTrigger:{ trigger:card, start:'top 85%', once:true, onEnter:()=>card.classList.add('revealed') }})
        .to(revEl, { clipPath:'inset(0 0 100% 0)', duration:0.8, delay:(i%3)*0.12, ease:'power3.inOut' })
    })

    // ZONAS STAGGER
    if (document.querySelector('.zc') && document.querySelector('.zonas-grid')) {
    gsap.fromTo('.zc',
      { clipPath:'inset(0 0 100% 0)', opacity:0.8 },
      { clipPath:'inset(0 0 0% 0)', opacity:1, duration:0.8, stagger:{ amount:0.6, from:'start' }, ease:'power3.inOut',
        scrollTrigger:{ trigger:'.zonas-grid', start:'top 80%', once:true }})
    }

    // MARKET BARS
    const ZONES_MKT = [
      {n:'Comporta',pm2:'€11.000',yoy:'+28%',w:1},
      {n:'Quinta do Lago',pm2:'€12.000',yoy:'+22%',w:1},
      {n:'Cascais',pm2:'€6.638',yoy:'+14%',w:.96},
      {n:'Lisboa',pm2:'€6.538',yoy:'+19%',w:.95},
      {n:'Porto Foz',pm2:'€5.800',yoy:'+13%',w:.84},
      {n:'Algarve',pm2:'€5.200',yoy:'+10%',w:.75},
      {n:'Oeiras',pm2:'€5.189',yoy:'+16%',w:.75},
    ]
    const mktEl = document.getElementById('mktZones')
    if (mktEl) {
      ZONES_MKT.forEach(z => {
        const d = document.createElement('div')
        d.className = 'mkt-row'
        d.innerHTML = `<span class="mkt-nm">${z.n}</span><div class="mkt-bar"><div class="mkt-fill" style="width:${z.w*100}%"></div></div><span class="mkt-pm2">${z.pm2}</span><span class="mkt-yoy">${z.yoy}</span>`
        mktEl.appendChild(d)
      })
      if (document.querySelector('.mkt-zones')) {
        gsap.to('.mkt-fill', { scaleX:1, duration:1.4, stagger:0.08, ease:'power3.out', scrollTrigger:{ trigger:'.mkt-zones', start:'top 80%', once:true }})
      }
    }

    // CREDENCIAIS
    if (document.querySelector('.cred-grid')) {
      gsap.fromTo('.cred-c', { opacity:0, y:30 }, { opacity:1, y:0, duration:0.7, stagger:0.1, ease:'power2.out', scrollTrigger:{ trigger:'.cred-grid', start:'top 85%', once:true }})
    }

    // ESC HANDLER
    const onKey = (e:KeyboardEvent) => {
      if (e.key==='Escape') {
        setModalOpen(false)
        document.body.style.overflow=''
      }
    }
    document.addEventListener('keydown', onKey)

    // FONTS READY — REFRESH SCROLLTRIGGER (double-RAF to avoid recursive refresh during init)
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()))
    })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('keydown', onKey)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [])

  // HERO SLIDESHOW
  useEffect(() => {
    const timer = setInterval(() => setSlideIdx(s => (s+1)%3), 5500)
    return () => clearInterval(timer)
  }, [])

  // ═══ AVM ENGINE ═══
  async function calcAVM() {
    const zona = (document.getElementById('avmZona') as HTMLSelectElement).value
    const area = (document.getElementById('avmArea') as HTMLInputElement).value
    if (!zona || !area || parseFloat(area)<20) { alert('Preenche a zona e a área.'); return }
    const btn = document.querySelector('.avm-submit') as HTMLButtonElement
    const txt = btn.textContent; btn.textContent='A calcular...'; btn.style.opacity='.6'; btn.disabled=true
    try {
      const res = await fetch('/api/avm', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          zona, area:parseFloat(area),
          estado:(document.getElementById('avmEst') as HTMLSelectElement).value,
          tipologia:(document.getElementById('avmTip') as HTMLSelectElement).value,
          vista:(document.getElementById('avmVista') as HTMLSelectElement).value,
          pool:(document.getElementById('avmPool') as HTMLSelectElement).value,
          epc:(document.getElementById('avmEpc') as HTMLSelectElement).value,
          garagem:(document.getElementById('avmGaragem') as HTMLSelectElement)?.value??'0',
          andar:(document.getElementById('avmAndar') as HTMLSelectElement)?.value??'0.3',
          exterior:'1', elevador:'1'
        })
      })
      const data = await res.json()
      if (!data.success) { alert(data.error||'Erro no cálculo'); return }
      setAvmResult(data.valor_justo)
      setTimeout(()=>{
        document.getElementById('bH')?.classList.add('go')
        document.getElementById('bC')?.classList.add('go')
        document.getElementById('bD')?.classList.add('go')
        const noteEl = document.querySelector('.avm-note') as HTMLElement
        if (noteEl && data.dados_ine) noteEl.textContent=`INE Q3 2025 · ${zona} €${data.dados_ine.mediana_transacao_q3_2025.toLocaleString('pt-PT')}/m² · Confiança ${data.confianca}%`
      },200)
    } catch { alert('Erro de ligação.') }
    finally { btn.textContent=txt; btn.style.opacity='1'; btn.disabled=false }
  }

  // ═══ MORTGAGE SIMULATOR ═══
  async function calcMortgage() {
    const montante = parseFloat((document.getElementById('mtgMontante') as HTMLInputElement).value)
    const entrada_pct = parseFloat((document.getElementById('mtgEntrada') as HTMLSelectElement).value)
    const prazo = (document.getElementById('mtgPrazo') as HTMLSelectElement).value
    const spread = (document.getElementById('mtgSpread') as HTMLSelectElement).value
    const uso = (document.getElementById('mtgUso') as HTMLSelectElement).value
    if (!montante || montante < 50000) { alert('Introduz o valor do imóvel (mínimo €50.000)'); return }
    const btn = document.querySelector('.mtg-submit') as HTMLButtonElement
    btn.textContent = 'A calcular...'; btn.style.opacity = '.6'; btn.disabled = true
    try {
      const res = await fetch('/api/mortgage', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ montante, entrada_pct, prazo, spread, uso }) })
      const data = await res.json()
      if (!data.success) { alert(data.error || 'Erro no cálculo'); return }
      setMortgageResult(data)
    } catch { alert('Erro de ligação.') }
    finally { btn.textContent = 'Calcular'; btn.style.opacity = '1'; btn.disabled = false }
  }

  // ═══ NHR CALCULATOR ═══
  async function calcNHR() {
    const pais = (document.getElementById('nhrPais') as HTMLSelectElement).value
    const tipo = (document.getElementById('nhrTipo') as HTMLSelectElement).value
    const rendimento = parseFloat((document.getElementById('nhrRendimento') as HTMLInputElement).value)
    if (!rendimento || rendimento < 1000) { alert('Introduz o rendimento anual (mínimo €1.000)'); return }
    const btn = document.querySelector('.nhr-submit') as HTMLButtonElement
    btn.textContent = 'A calcular...'; btn.style.opacity = '.6'; btn.disabled = true
    try {
      const res = await fetch('/api/nhr', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pais, tipo_rendimento: tipo, rendimento_anual: rendimento, regime: 'compare' }) })
      const data = await res.json()
      if (!data.success) { alert(data.error || 'Erro no cálculo'); return }
      setNhrResult(data)
    } catch { alert('Erro de ligação.') }
    finally { btn.textContent = 'Calcular Poupança', btn.style.opacity = '1'; btn.disabled = false }
  }

  // ═══ PORTFOLIO ANALYSER ═══
  async function calcPortfolio() {
    const items = portfolioItems.filter(x => x.trim())
    if (items.length < 2) { alert('Introduz pelo menos 2 URLs ou descrições de imóveis.'); return }
    setPortfolioLoading(true)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ properties: items.filter(x=>x.trim()).map(url => ({ url })) })
      })
      const data = await res.json()
      if (!data.success) { alert(data.error || 'Erro na análise'); return }
      setPortfolioResult(data)
    } catch { alert('Erro de ligação. Tenta novamente.') }
    finally { setPortfolioLoading(false) }
  }

  // ═══ DEAL RADAR ═══
  async function runRadar() {
    const v = (document.getElementById('radarUrl') as HTMLTextAreaElement).value.trim()
    if (!v) { alert('Cola um link ou texto.'); return }
    const btn = document.getElementById('radarBtn') as HTMLButtonElement
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> A analisar...'
    btn.style.opacity='.6'; btn.disabled=true
    try {
      const res = await fetch('/api/radar', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:v})})
      const data = await res.json()
      if (!data.success) { alert(data.error||'Erro na análise.'); return }
      setRadarDone(true)
      const a = data.analise
      setTimeout(()=>{
        const set=(id:string,val:string)=>{const el=document.getElementById(id);if(el)el.textContent=val}
        const scoreEl=document.getElementById('rScore')
        if (scoreEl) scoreEl.innerHTML=`${a.score??'—'}<small style="font-size:1.1rem;opacity:.45">/100</small>`
        const pillEl=document.getElementById('rPill')
        if (pillEl) {
          pillEl.textContent=a.classificacao??'EM ANÁLISE'
          const c:Record<string,string>={'ATAQUE IMEDIATO':'#c8f0d4','PRIORITÁRIO':'#d4e8f7','BOM NEGÓCIO':'#d4f0d8','VALOR JUSTO':'#f0f0d4','SOBREVALORIZADO':'#f0e4d4','EVITAR':'#f0d4d4'}
          pillEl.style.background=c[a.classificacao??'']??'#d4e8f7'; pillEl.style.color='#1a3a6b'
        }
        if (a.valor_justo)        set('rValor', `€ ${a.valor_justo.toLocaleString('pt-PT')}`)
        if (a.oferta_recomendada) set('rOferta',`€ ${a.oferta_recomendada.toLocaleString('pt-PT')}`)
        if (a.desconto_percentagem!==undefined) set('rDesc',`${a.desconto_percentagem>0?'+':''}${a.desconto_percentagem}%`)
        if (a.yield_bruto)        set('rYield', `${a.yield_bruto}%`)
        const waBtn=document.getElementById('rWA')
        if (waBtn && a.mensagem_wa_vendedor) (waBtn as HTMLButtonElement).onclick=()=>window.open('https://wa.me/351919948986?text='+encodeURIComponent(a.mensagem_wa_vendedor),'_blank')
      },100)
    } catch { alert('Erro de ligação.') }
    finally {
      btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Analisar Agora'
      btn.style.opacity='1'; btn.disabled=false
    }
  }

  // ═══ MODAL ═══
  function openModal() { setModalOpen(true); document.body.style.overflow='hidden'; setTimeout(()=>document.getElementById('offPwd')?.focus(),300) }
  function closeModal() { setModalOpen(false); document.body.style.overflow='' }
  function checkOff() {
    const p=(document.getElementById('offPwd') as HTMLInputElement).value
    if (['offmarket2026','agencygroup','ag2026'].includes(p)) { closeModal(); alert('✅ Acesso concedido. Portfolio off-market a carregar...') }
    else { const err=document.getElementById('offErr'); if(err) err.style.display='block'; (document.getElementById('offPwd') as HTMLInputElement).value='' }
  }

  // ═══ PROPERTIES DATA ═══
  const PROPERTIES = [
    { id: 'rev0', feat: true, badge: 'b-off', bl: 'Off-Market', zona: 'Cascais', zonaLabel: 'Cascais · Quinta da Marinha', tipo: 'Moradia', titulo: 'Villa Contemporânea com Piscina Infinita e Vista Mar', specs: ['5 Quartos', '620 m²', 'Piscina Infinita', 'Vista Mar', '3 Garagens', 'EPC A'], preco: 3800000, precoLabel: '€ 3.800.000', pm2: '€6.129/m²', quartos: 5, grad: 'linear-gradient(145deg,#1c3d28,#0b1a10 55%,#3d8b68 100%)' },
    { id: 'rev1', feat: false, badge: 'b-new', bl: 'Novo', zona: 'Lisboa', zonaLabel: 'Lisboa · Chiado', tipo: 'Apartamento', titulo: 'Penthouse com Terraço e Vista Rio Tejo', specs: ['4 Quartos', '280 m²', 'Vista Rio', 'EPC A'], preco: 2100000, precoLabel: '€ 2.100.000', pm2: '€7.500/m²', quartos: 4, grad: 'linear-gradient(145deg,#0c2030,#060e18 60%,#1c4a35 100%)' },
    { id: 'rev2', feat: false, badge: 'b-exc', bl: 'Exclusivo', zona: 'Comporta', zonaLabel: 'Comporta · Grândola', tipo: 'Quinta', titulo: 'Herdade Privada nos Arrozais da Comporta', specs: ['6 Quartos', '850 m²', '12 hectares', 'Piscina'], preco: 6500000, precoLabel: '€ 6.500.000', pm2: '€7.647/m²', quartos: 6, grad: 'linear-gradient(145deg,#2e2009,#140e05 60%,#c9a96e 100%)' },
    { id: 'rev3', feat: false, badge: null, bl: null, zona: 'Cascais', zonaLabel: 'Abóboda · Cascais', tipo: 'Moradia', titulo: 'Moradia LSF Nova Construção Porcelanosa', specs: ['3 Quartos', '113 m²', 'Nova Construção'], preco: 1400000, precoLabel: '€ 1.400.000', pm2: '€12.389/m²', quartos: 3, grad: 'linear-gradient(145deg,#1a3a26,#081510 60%,#2d6a4f 100%)' },
    { id: 'rev4', feat: false, badge: null, bl: null, zona: 'Ericeira', zonaLabel: "Ericeira · Ribeira d'Ilhas", tipo: 'Apartamento', titulo: 'T3 Duplex Vista Mar — World Surf Reserve', specs: ['3 Quartos', '189 m²', 'Vista Mar'], preco: 679000, precoLabel: '€ 679.000', pm2: '€3.593/m²', quartos: 3, grad: 'linear-gradient(145deg,#081e1e,#040f0f 60%,#1c4a35 100%)' },
    { id: 'rev5', feat: false, badge: 'b-new', bl: 'Novo', zona: 'Oeiras', zonaLabel: 'Oeiras · Av. República', tipo: 'Apartamento', titulo: 'T4 Herança com Potencial Premium', specs: ['4 Quartos', '111 m²', 'Exclusividade 6M'], preco: 520000, precoLabel: '€ 520.000', pm2: '€4.685/m²', quartos: 4, grad: 'linear-gradient(145deg,#0a1828,#05090f 60%,#2d4a6a 100%)' },
  ]

  // ═══ SEARCH STATE ═══
  const [searchZona, setSearchZona] = useState('')
  const [searchTipo, setSearchTipo] = useState('')
  const [searchPreco, setSearchPreco] = useState('')
  const [searchQuartos, setSearchQuartos] = useState('')

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

  // ═══ UTIL ═══
  function doSearch() { document.getElementById('imoveis')?.scrollIntoView({behavior:'smooth'}) }
  function filterZ(z:string) { document.getElementById('imoveis')?.scrollIntoView({behavior:'smooth'}); setSearchZona(z) }
  async function agLogin() {
    const emailEl = document.getElementById('agEmail') as HTMLInputElement
    const btn = document.querySelector('.ag-btn') as HTMLButtonElement
    const e = emailEl.value.trim()
    if (!e || !e.includes('@')) { alert('Introduz o teu email.'); return }
    sessionStorage.setItem('ag_pending_email', e)
    btn.textContent = 'A enviar...'
    btn.disabled = true
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (data.ok) {
        btn.textContent = '✅ Pedido enviado!'
        emailEl.value = ''
        setTimeout(() => { btn.textContent = 'Entrar'; btn.disabled = false }, 5000)
      } else {
        alert(data.error || 'Erro no envio. Tenta novamente.')
        btn.textContent = 'Entrar'
        btn.disabled = false
      }
    } catch {
      alert('Erro de rede. Tenta novamente.')
      btn.textContent = 'Entrar'
      btn.disabled = false
    }
  }

  async function agLoginModal() {
    const e = agEmailVal.trim()
    if (!e || !e.includes('@')) { alert('Introduz o teu email.'); return }
    sessionStorage.setItem('ag_pending_email', e)
    setAgSending(true)
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (data.ok) {
        setAgSent(true)
      } else {
        alert(data.error || 'Erro no envio. Tenta novamente.')
        setAgSending(false)
      }
    } catch {
      alert('Erro de rede. Tenta novamente.')
      setAgSending(false)
    }
  }

  function closeAgModal() {
    setAgModal(false)
    setAgSent(false)
    setAgSending(false)
    setAgEmailVal('')
  }

  function requireAgent() {
    document.getElementById('agentes')?.scrollIntoView({behavior:'smooth'})
    setTimeout(()=>document.getElementById('agEmail')?.focus(), 600)
  }
  function goSlide(i:number) { setSlideIdx(i) }

  // ═══ SLIDES DATA ═══
  const SLIDES = [
    { badge:'b-off', label:'Off-Market', titulo:'Villa Contemporânea\nQuinta da Marinha · Cascais', preco:'€ 3.800.000', specs:'5 Qtos · 620m² · Vista Mar', num:'01', grad:'linear-gradient(140deg,#1a3a26,#0b1a10 50%,#2d6a4f 100%)' },
    { badge:'b-new', label:'Novo', titulo:'Penthouse Panorâmica\nChiado · Lisboa', preco:'€ 2.100.000', specs:'4 Qtos · 280m² · Vista Rio', num:'02', grad:'linear-gradient(140deg,#0c2030,#060e18 50%,#1c4a35 100%)' },
    { badge:'b-exc', label:'Exclusivo', titulo:'Herdade Privada\nComporta · Grândola', preco:'€ 6.500.000', specs:'6 Qtos · 850m² · 12 ha', num:'03', grad:'linear-gradient(140deg,#2e2009,#150f04 50%,#c9a96e 100%)' },
  ]

  return (
    <>
      {/* LOADER */}
      <div id="loader" ref={loaderRef}>
        <div className="ldr-logo">
          <span id="ldrA">Agency</span>
          <span id="ldrG">Group</span>
        </div>
        <div className="ldr-bar"><div className="ldr-fill" id="ldrFill"></div></div>
        <div className="ldr-txt" id="ldrTxt">Lisboa · Portugal · AMI 22506</div>
      </div>

      {/* CURSOR */}
      <div id="cur"><div className="c-dot" id="cDot"></div><div className="c-ring" id="cRing"></div></div>
      <div id="pgb"></div>

      {/* MODAL OFF-MARKET */}
      <div className={`modal-ov${modalOpen?' open':''}`} id="offModal" onClick={e=>{if(e.target===e.currentTarget)closeModal()}}>
        <div className="modal-box">
          <button className="modal-x" onClick={closeModal}>✕</button>
          <div className="modal-eye">Acesso Restrito</div>
          <h2 className="modal-h2">Portfolio<br/><em style={{fontStyle:'italic',color:'var(--g)'}}>Off-Market</em></h2>
          <p className="modal-desc">Imóveis que nunca chegam aos portais. Acesso por convite e referência directa.</p>
          <input className="modal-inp" type="password" id="offPwd" placeholder="palavra-passe" onKeyDown={e=>{if(e.key==='Enter')checkOff()}}/>
          <button className="modal-btn" onClick={checkOff}>Aceder ao Portfolio</button>
          <div className="modal-err" id="offErr">Palavra-passe incorrecta. Contacte geral@agencygroup.pt</div>
        </div>
      </div>

      {/* MODAL ÁREA AGENTES */}
      {agModal && (
        <div style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(12,31,21,.92)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={closeAgModal}>
          <div style={{background:'#0c1f15',border:'1px solid rgba(201,169,110,.18)',padding:'52px 44px',maxWidth:'420px',width:'100%',position:'relative',boxShadow:'0 40px 100px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}>
            <button onClick={closeAgModal} style={{position:'absolute',top:'18px',right:'18px',background:'none',border:'none',color:'rgba(244,240,230,.3)',cursor:'pointer',fontSize:'1rem',lineHeight:1,padding:'4px 8px'}}>✕</button>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.28em',textTransform:'uppercase',color:'rgba(201,169,110,.55)',marginBottom:'8px'}}>Acesso Restrito · AMI 22506</div>
            <h2 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.9rem',color:'#f4f0e6',lineHeight:1.1,marginBottom:'6px'}}>Área de<br/><em style={{fontStyle:'italic',color:'#c9a96e'}}>Agentes</em></h2>
            {!agSent ? (
              <>
                <p style={{fontSize:'.8rem',color:'rgba(244,240,230,.4)',lineHeight:1.75,margin:'20px 0 24px'}}>Introduz o teu email profissional. Será enviado um pedido de acesso ao administrador.</p>
                <input
                  type="email"
                  value={agEmailVal}
                  onChange={ev=>setAgEmailVal(ev.target.value)}
                  onKeyDown={ev=>ev.key==='Enter'&&!agSending&&agLoginModal()}
                  placeholder="email@agencygroup.pt"
                  autoFocus
                  style={{width:'100%',background:'rgba(244,240,230,.05)',border:'1px solid rgba(244,240,230,.12)',borderBottom:'1px solid rgba(201,169,110,.3)',color:'#f4f0e6',padding:'13px 14px',fontSize:'.88rem',fontFamily:"'Jost',sans-serif",outline:'none',marginBottom:'12px',boxSizing:'border-box',letterSpacing:'.02em'}}
                />
                <button
                  onClick={agLoginModal}
                  disabled={agSending}
                  style={{width:'100%',background:agSending?'rgba(201,169,110,.5)':'#c9a96e',color:'#0c1f15',border:'none',padding:'14px',fontFamily:"'Jost',sans-serif",fontSize:'.6rem',fontWeight:600,letterSpacing:'.2em',textTransform:'uppercase',cursor:agSending?'not-allowed':'pointer',transition:'background .25s'}}
                >
                  {agSending ? 'A enviar...' : 'Solicitar Acesso →'}
                </button>
              </>
            ) : (
              <div style={{textAlign:'center',padding:'24px 0'}}>
                <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'rgba(28,74,53,.4)',border:'1px solid rgba(28,74,53,.8)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:'1.2rem'}}>✓</div>
                <p style={{fontSize:'.88rem',color:'rgba(244,240,230,.7)',lineHeight:1.75,marginBottom:'8px'}}>Pedido enviado para<br/><strong style={{color:'#c9a96e'}}>{agEmailVal}</strong></p>
                <p style={{fontSize:'.75rem',color:'rgba(244,240,230,.35)',lineHeight:1.65}}>Receberás um link de acesso por email assim que o teu pedido for aprovado.</p>
              </div>
            )}
            <div style={{marginTop:'28px',paddingTop:'16px',borderTop:'1px solid rgba(244,240,230,.05)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.18)',letterSpacing:'.1em',textTransform:'uppercase'}}>
              Agency Group · Mediação Imobiliária Lda · AMI 22506
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav id="mainNav">
        <a href="/" className="logo">
          <span className="la ag-logo-text">Agency</span>
          <span className="lg ag-logo-text">Group</span>
          <span className="ag-logo-line" aria-hidden="true" />
        </a>
        <ul className="nav-links">
          <li><a href="/imoveis">Imóveis</a></li>
          <li><a href="#zonas">Zonas</a></li>
          <li><a href="#avaliacao">Avaliação</a></li>
          <li><a href="#deal-radar">Deal Radar</a></li>
          <li><a href="#simulador">Crédito</a></li>
          <li><a href="#nhr">NHR</a></li>
          <li><a href="/reports" style={{color:'var(--gold)'}}>Reports</a></li>
          <li><a href="#" onClick={e=>{e.preventDefault();openModal()}}>Off-Market</a></li>
          <li><a href="#contacto">Contacto</a></li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CurrencySelector />
          {isAgent
            ? <a href={(() => { try { const d = JSON.parse(localStorage.getItem('ag_auth')||'{}'); return d.token ? `/portal?token=${encodeURIComponent(d.token)}` : '/portal' } catch { return '/portal' } })()} className="nav-cta">Portal →</a>
            : <a href="#" className="nav-cta" onClick={e=>{e.preventDefault();setAgModal(true)}}>Área Agentes</a>
          }
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hl">
          <div className="hl-bg"></div>
          <div className="hl-grain"></div>
          <div className="hero-content">
            <div className="hero-eyebrow" id="hEye">Lisboa · Portugal · AMI 22506</div>
            <h1 className="hero-h1" id="hTitle">
              <span className="line"><span className="line-inner">O lugar onde</span></span>
              <span className="line"><span className="line-inner"><em>Portugal</em></span></span>
              <span className="line"><span className="line-inner">encontra o mundo.</span></span>
            </h1>
            <p className="hero-sub" id="hSub">Mediação imobiliária de luxo. €500K–€10M. Boutique especializada nos mercados mais exclusivos de Portugal e Espanha.</p>
            <div className="hero-btns" id="hBtns">
              <a href="#imoveis" className="btn-gold">Ver Portfolio<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
              <a href="#avaliacao" className="btn-outline">Avaliar Imóvel</a>
            </div>
          </div>
          <div className="hero-stats" id="hStats">
            <div><div className="hs-n">169<em>K</em></div><div className="hs-l">Transacções PT 2025</div></div>
            <div><div className="hs-n">+17<em>%</em></div><div className="hs-l">Valorização anual</div></div>
            <div><div className="hs-n">44<em>%</em></div><div className="hs-l">Compradores int.</div></div>
          </div>
          <div className="hero-scroll" id="hScroll">
            <div className="hs-line"></div>
            <div className="hs-txt">Scroll</div>
          </div>
        </div>
        <aside className="hr">
          <div id="slides">
            {SLIDES.map((s,i)=>(
              <div key={i} className={`hr-slide${slideIdx===i?' on':''}`}>
                <div className="hr-slide-bg" style={{background:s.grad}}></div>
                <div className="hr-ov"></div>
                <div className="hr-info">
                  <div className={`hr-badge ${s.badge}`}>{s.label}</div>
                  <div className="hr-title" dangerouslySetInnerHTML={{__html:s.titulo.replace('\n','<br/>')}}></div>
                  <div className="hr-price">{s.preco}</div>
                  <div className="hr-specs">{s.specs}</div>
                  <div className="hr-dots">{SLIDES.map((_,j)=><div key={j} className={`hr-dot${slideIdx===j?' on':''}`} onClick={()=>goSlide(j)}></div>)}</div>
                </div>
                <div className="hr-num">{s.num}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {/* MARQUEE */}
      <div className="mq">
        <div className="mq-track">
          {[...Array(2)].map((_,rep)=>(
            <span key={rep} style={{display:'contents'}}>
              {['Lisboa','Cascais','Comporta','Porto','Algarve','Madeira','Sintra','Arrábida','Portugal 2025'].map((zona,i)=>(
                <span key={`${rep}-${i}`} style={{display:'contents'}}>
                  <span className="mq-item">{zona} <span>{['€6.538/m²','€6.638/m²','€11.000/m²','€4.528/m²','€5.200/m²','€3.959/m²','€3.600/m²','€4.500/m²','+17.6%'][i]}</span></span>
                  <span className="mq-sep"></span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div className="search-wrap">
        <div className="search-box" id="searchBox">
          <div className="sf" style={{flex:2}}>
            <label className="sf-lbl">Localização</label>
            <input className="sf-inp" type="text" id="sfQ" placeholder="Lisboa, Cascais, Comporta..." value={searchZona} onChange={e=>{setSearchZona(e.target.value)}}/>
          </div>
          <div className="sf"><label className="sf-lbl">Tipo</label><select className="sf-sel" value={searchTipo} onChange={e=>setSearchTipo(e.target.value)}><option value="">Todos</option><option value="Apartamento">Apartamento</option><option value="Moradia">Moradia</option><option value="Villa">Villa</option><option value="Penthouse">Penthouse</option><option value="Quinta">Quinta</option></select></div>
          <div className="sf"><label className="sf-lbl">Preço</label><select className="sf-sel" value={searchPreco} onChange={e=>setSearchPreco(e.target.value)}><option value="">Qualquer</option><option value="500-1000">€500K–€1M</option><option value="1000-2500">€1M–€2.5M</option><option value="2500-5000">€2.5M–€5M</option><option value="5000-999999">€5M+</option></select></div>
          <div className="sf"><label className="sf-lbl">Quartos (mín.)</label><select className="sf-sel" value={searchQuartos} onChange={e=>setSearchQuartos(e.target.value)}><option value="">Todos</option><option value="1">T1+</option><option value="2">T2+</option><option value="3">T3+</option><option value="4">T4+</option><option value="5">T5+</option></select></div>
          <button className="sf-btn" onClick={doSearch}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Pesquisar</button>
        </div>
      </div>

      {/* ZONAS */}
      <section className="zonas-section" id="zonas">
        <div className="sw">
          <div className="zonas-head">
            <div>
              <div className="sec-eye"><span className="clip-reveal" data-reveal="left">9 Zonas · Portugal &amp; Espanha</span></div>
              <h2 className="sec-h2" id="zonasH2">
                <span className="text-reveal"><span className="text-reveal-inner">Os mercados</span></span>
                <span className="text-reveal"><span className="text-reveal-inner"><em>que conhecemos</em></span></span>
              </h2>
            </div>
            <a href="#imoveis" className="lnk-sm fade-in">Ver todos →</a>
          </div>
          <div className="zonas-grid">
            {[
              {c:'z1',nome:'Lisboa',pais:'Portugal',pm2:'€6.538/m²',yoy:'+19%',tag:'The city that reinvented itself'},
              {c:'z2',nome:'Cascais',pais:'Portugal',pm2:'€6.638/m²',yoy:'+14%',tag:'Where old money meets the Atlantic'},
              {c:'z3',nome:'Comporta',pais:'Portugal',pm2:'€11.000/m²',yoy:'+28%',tag:"Europe's last unhurried place"},
              {c:'z4',nome:'Porto',pais:'Portugal',pm2:'€4.528/m²',yoy:'+12%',tag:'The river that seduces everyone'},
              {c:'z5',nome:'Algarve',pais:'Portugal',pm2:'€5.200/m²',yoy:'+10%',tag:'300 mornings of light'},
              {c:'z6',nome:'Madeira',pais:'Portugal',pm2:'€3.959/m²',yoy:'+20%',tag:'The island that needs nothing'},
              {c:'z7',nome:'Sintra',pais:'Portugal',pm2:'€3.600/m²',yoy:'+13%',tag:'Where history forgot to leave'},
              {c:'z8',nome:'Arrábida',pais:'Portugal',pm2:'€4.500/m²',yoy:'+19%',tag:'The coast nobody found yet'},
              {c:'z9',nome:'Ericeira',pais:'Portugal',pm2:'€3.200/m²',yoy:'+15%',tag:'World surf reserve. Naturally'},
            ].map(z=>(
              <div key={z.c} className={`zc ${z.c}`} onClick={()=>filterZ(z.nome)}>
                <div className="zc-bg"></div><div className="zc-ov"></div><div className="zc-clip-overlay"></div>
                <div className="zc-c">
                  <div className="zc-id">{z.nome} · {z.pais}</div>
                  <h3 className="zc-nm">{z.nome}</h3>
                  <div className="zc-data"><span className="zc-pm2">{z.pm2}</span><span className="zc-yoy">{z.yoy}</span></div>
                  <div className="zc-tag">{z.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMÓVEIS */}
      <section className="imoveis-section section" id="imoveis">
        <div className="sw">
          <div className="im-head" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'48px'}}>
            <div>
              <div className="sec-eye">Portfolio Seleccionado</div>
              <h2 className="sec-h2" id="imH2">
                <span className="text-reveal"><span className="text-reveal-inner">Imóveis em</span></span>
                <span className="text-reveal"><span className="text-reveal-inner"><em>Destaque</em></span></span>
              </h2>
            </div>
            <a href="/imoveis" className="lnk-sm fade-in">Ver todos os imóveis →</a>
          </div>
          {/* Results count + clear filters */}
          <div className="im-count" style={{ fontFamily: 'Jost, sans-serif', fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            {filteredProperties.length} imóve{filteredProperties.length !== 1 ? 'is' : 'l'} encontrado{filteredProperties.length !== 1 ? 's' : ''}
            {(searchZona || searchTipo || searchPreco || searchQuartos) && (
              <button onClick={() => { setSearchZona(''); setSearchTipo(''); setSearchPreco(''); setSearchQuartos('') }}
                style={{ marginLeft: '12px', background: 'none', border: '1px solid #c9a96e', color: '#c9a96e', padding: '2px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                Limpar filtros
              </button>
            )}
          </div>

          {filteredProperties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#c9a96e', fontFamily: 'Cormorant, serif', fontSize: '24px' }}>
              <div>Sem resultados para estes filtros</div>
              <div style={{ fontSize: '16px', fontFamily: 'Jost, sans-serif', color: '#666', marginTop: '12px' }}>
                Acesse à nossa carteira off-market completa
              </div>
              <button onClick={() => setModalOpen(true)} style={{ marginTop: '20px', background: '#1c4a35', color: '#c9a96e', border: 'none', padding: '12px 32px', borderRadius: '8px', fontFamily: 'Jost, sans-serif', cursor: 'pointer' }}>
                Ver Carteira Off-Market →
              </button>
            </div>
          ) : (
            <div className="im-grid">
              {filteredProperties.map(im=>(
                <div key={im.id} className={`imc${im.feat?' feat':''}`}>
                  <div className="imc-img">
                    <div className="imc-img-reveal" id={im.id}></div>
                    <div className="imc-img-inner" style={{background:im.grad}}></div>
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
                </div>
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
              Ver todos os 20 imóveis
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </section>

      {/* MARKET DATA */}
      <section className="market-section" id="mercado">
        <div className="sw">
          <div className="mkt-grid">
            <div>
              <div className="mkt-eye">Dados de Mercado · INE · Savills · Knight Frank</div>
              <h2 className="mkt-h2" id="mktH2">
                <span className="text-reveal"><span className="text-reveal-inner">Portugal no topo</span></span>
                <span className="text-reveal"><span className="text-reveal-inner">do luxo <em>mundial</em></span></span>
              </h2>
              <p className="mkt-desc fade-in">INE Q3 2025. 169.812 transacções. +17.6% valorização. Lisboa Top 5 mundial (Savills 2026). Previsão 2026: +4 a +5.9%.</p>
              <div className="fade-in">
                {['44% compradores internacionais nos mercados prime','Calibração INE rácio 0.693 por município','55 zonas calibradas · dados Q3 2025 verificados','AVM erro 4–7% com dados live — melhor de Portugal'].map(t=>(
                  <div key={t} className="mkt-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>{t}</div>
                ))}
              </div>
            </div>
            <div className="mkt-zones fade-in" id="mktZones"></div>
          </div>
        </div>
      </section>

      {/* AVM — removido da página pública, disponível no Portal */}

      {/* SIMULADOR DE CRÉDITO */}
      <section className="simulador-section" id="simulador">
        <div className="sw">
          <div className="sim-grid">
            <div>
              <div className="sec-eye">Simulador · Crédito Habitação · Portugal</div>
              <h2 className="sec-h2">
                <span className="text-reveal"><span className="text-reveal-inner">Simular</span></span>
                <span className="text-reveal"><span className="text-reveal-inner"><em>Crédito</em></span></span>
              </h2>
              <p className="fade-in" style={{fontSize:'.83rem',lineHeight:'1.78',color:'var(--ink2)',margin:'20px 0 28px',maxWidth:'420px'}}>
                Euribor 6M em tempo real. Cenários stress-test. Tabela de amortização completa.
                IMT + IS + custos totais de aquisição calculados automaticamente.
              </p>
              <div className="fade-in" style={{display:'flex',flexDirection:'column',gap:'11px'}}>
                {['Euribor 6M BCE — Março 2026: 2,95%','Cálculo TAEG com Newton-Raphson','Amortização anual completa (30 anos)','DSTI check conforme Banco de Portugal','Deducão IRS habitação própria (Art. 85º CIRS)'].map(t=>(
                  <div key={t} style={{display:'flex',alignItems:'center',gap:'11px',fontSize:'.78rem',color:'var(--ink2)'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>{t}
                  </div>
                ))}
              </div>
            </div>
            <div className="sim-widget fade-in">
              <h3 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.3rem',color:'var(--g)',marginBottom:'24px',letterSpacing:'.02em'}}>Simular Crédito</h3>
              <div className="avm-row full">
                <div>
                  <label className="avm-lbl">Valor do Imóvel (€)</label>
                  <input className="avm-inp" type="number" id="mtgMontante" placeholder="ex: 500000" min="50000"/>
                </div>
              </div>
              <div className="avm-row">
                <div><label className="avm-lbl">Entrada</label>
                  <select className="avm-sel" id="mtgEntrada">
                    <option value="10">10% (Habitação Própria)</option>
                    <option value="20" >20%</option>
                    <option value="25" >25% (Investimento)</option>
                    <option value="30">30%</option>
                    <option value="40">40%</option>
                    <option value="50">50%</option>
                  </select>
                </div>
                <div><label className="avm-lbl">Prazo</label>
                  <select className="avm-sel" id="mtgPrazo">
                    <option value="15">15 anos</option>
                    <option value="20">20 anos</option>
                    <option value="25">25 anos</option>
                    <option value="30" >30 anos</option>
                    <option value="35">35 anos</option>
                    <option value="40">40 anos</option>
                  </select>
                </div>
              </div>
              <div className="avm-row">
                <div><label className="avm-lbl">Spread</label>
                  <select className="avm-sel" id="mtgSpread">
                    <option value="0.75">0,75% (excelente)</option>
                    <option value="1.0">1,00% (bom)</option>
                    <option value="1.4" >1,40% (típico)</option>
                    <option value="1.8">1,80% (standard)</option>
                    <option value="2.5">2,50% (alto)</option>
                  </select>
                </div>
                <div><label className="avm-lbl">Finalidade</label>
                  <select className="avm-sel" id="mtgUso">
                    <option value="habitacao_propria">Habitação Própria</option>
                    <option value="investimento">Investimento</option>
                  </select>
                </div>
              </div>
              <button className="avm-submit mtg-submit" onClick={calcMortgage}>Calcular</button>
              {mortgageResult && (() => {
                const r = mortgageResult as Record<string,Record<string,number>&{euribor_6m_pct?:number,tan_pct?:number,taeg_pct?:number}>
                const res = r.resultado as Record<string,number>
                const inp = r.inputs as Record<string,number>
                return (
                  <div className="mtg-result">
                    <div className="mtg-hero">
                      <div className="mtg-main">
                        <div className="mtg-label">Prestação Mensal</div>
                        <div className="mtg-value">€ {res.prestacao_mensal?.toLocaleString('pt-PT')}</div>
                        <div className="mtg-sub">TAN {res.tan_pct}% · TAEG {res.taeg_pct}%</div>
                      </div>
                    </div>
                    <div className="mtg-grid3">
                      <div><div className="mtg-gl">Capital</div><div className="mtg-gv">€ {inp.capital?.toLocaleString('pt-PT')}</div></div>
                      <div><div className="mtg-gl">Total Juros</div><div className="mtg-gv">€ {res.total_juros?.toLocaleString('pt-PT')}</div></div>
                      <div><div className="mtg-gl">Total Pago</div><div className="mtg-gv">€ {res.total_pago?.toLocaleString('pt-PT')}</div></div>
                      <div><div className="mtg-gl">IMT + IS</div><div className="mtg-gv">€ {((res.imt_estimado||0)+(res.is_estimado||0)).toLocaleString('pt-PT')}</div></div>
                      <div><div className="mtg-gl">IMI/Ano</div><div className="mtg-gv">€ {res.imi_anual?.toLocaleString('pt-PT')}</div></div>
                      <div><div className="mtg-gl">Custo Total</div><div className="mtg-gv" style={{color:'var(--gold)'}}>€ {res.custo_total_aquisicao?.toLocaleString('pt-PT')}</div></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* FINANCIAMENTO NÃO-RESIDENTES — removido da página pública, disponível no Portal */}
      {/* MAIS-VALIAS — removido da página pública, disponível no Portal */}
      {/* NHR — removido da página pública, disponível no Portal */}

      {/* FERRAMENTAS EXCLUSIVAS — 4 cards */}
      <section style={{background:'var(--cd)',padding:'110px 0'}}>
        <div className="sw">
          <div style={{marginBottom:'56px'}}>
            <div className="sec-eye">Ferramentas Exclusivas · Portal de Agentes</div>
            <h2 className="sec-h2" style={{marginTop:'10px'}}>
              <span className="text-reveal"><span className="text-reveal-inner" style={{transform:'none'}}>Tecnologia</span></span>
              <span className="text-reveal"><span className="text-reveal-inner" style={{transform:'none'}}><em>Proprietária</em></span></span>
            </h2>
            <p className="tools-desc" style={{fontSize:'.83rem',lineHeight:'1.8',color:'var(--ink2)',marginTop:'16px',maxWidth:'520px'}}>Quatro ferramentas desenvolvidas exclusivamente para os agentes Agency Group. Totalmente operacionais no portal seguro — a um clique.</p>
          </div>

          <div className="tools-grid" style={{display:'grid',gap:'2px'}}>

            {/* Card 1 — Avaliação AVM */}
            {(() => {
              const items = [['Agency Radar','Avaliação &amp; Oferta Imediata','var(--g)','M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z','Cola o link de qualquer imóvel. Em 30 segundos obtens o valor justo, a oferta óptima a negociar e a mensagem de WhatsApp pronta a enviar ao vendedor.',['Score proprietário 16D','Valor justo de mercado','Oferta óptima calculada','Análise comparativa de zona','Mensagem WhatsApp automática ao vendedor'],'Aceder ao Radar'],['Investor Dashboard','Comparação &amp; Investimento','var(--g)','M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z','Compara até 5 imóveis em simultâneo com análise completa. Ranking automático por score, yield real e oferta óptima para apresentar ao cliente investidor.',['Comparação multi-imóvel (até 5)','Score 16D por cada imóvel','Yield bruto e ROI em tempo real','Ranking automático por potencial','Relatório para o cliente investidor'],'Aceder ao Dashboard'],['AVM World-Class','Avaliação &amp; Preço Justo','var(--g)','M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z','Avaliação automática e instantânea com precisão de referência. Motor de avaliação calibrado com dados INE Q3 2025 para o mercado de luxo em todas as zonas de Portugal.',['Precisão de referência em qualquer zona','Calibração INE Q3 2025 em tempo real','Ajustes por tipologia, estado e localização','Score de confiança e potencial futuro','Relatório profissional em segundos'],'Aceder à Avaliação'],['NHR / IFICI','Poupança Fiscal · 10 Anos','var(--gm)','M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064','Portugal oferece 10 anos de tributação reduzida via NHR/IFICI. Calcula exactamente quanto o teu cliente poupa face ao país de origem — argumento decisivo para compradores internacionais.',['NHR Clássico: 20% flat ou isenção total','IFICI 2024: 20% rendimentos qualificados','Comparativo vs UK (45%), EUA (37%), França (45%)','Projecção 10 anos com crescimento 3% a.a.','Processo 4–6 semanas — acompanhamos'],'Aceder à Calculadora NHR']]
              return items.map(([title,badge,color,icon,desc,feats,cta],i)=>(
                <div key={i} style={{background:'var(--w)',padding:'44px 40px',borderTop:`3px solid ${color}`,display:'flex',flexDirection:'column'}}>
                  <div className="radar-tag" style={{marginBottom:'24px',background:color==='var(--gold)'?'rgba(201,169,110,.12)':undefined}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="12"><path d={icon as string}/></svg>
                    <span dangerouslySetInnerHTML={{__html:badge as string}}/>
                  </div>
                  <div className="tool-title" style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2rem',color:'var(--ink)',lineHeight:'1.05',marginBottom:'14px'}}>{title}</div>
                  <p className="tool-desc" style={{fontSize:'.8rem',color:'var(--ink2)',lineHeight:'1.8',margin:'0 0 24px'}}>{desc as string}</p>
                  <div className="tool-feats" style={{display:'flex',flexDirection:'column',gap:'11px',marginBottom:'36px',flex:1}}>
                    {(feats as string[]).map((f:string)=>(
                      <div key={f} className="tool-feat" style={{display:'flex',alignItems:'center',gap:'11px'}}>
                        <div style={{width:'5px',height:'5px',background:'var(--gold)',flexShrink:0}}/>
                        <span style={{fontSize:'.75rem',color:'var(--ink2)',fontFamily:"'DM Mono',monospace",letterSpacing:'.03em'}}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href={(() => { try { const d = JSON.parse(localStorage.getItem('ag_auth')||'{}'); return d.token ? `/portal?token=${encodeURIComponent(d.token)}` : '/portal' } catch { return '/portal' } })()} style={{display:'block',padding:'14px 24px',background:color==='var(--gold)'?'var(--gold)':color==='var(--gm)'?'var(--gm)':'var(--g)',color:color==='var(--gold)'?'var(--ink)':'var(--cr)',fontFamily:"'DM Mono',monospace",fontSize:'.53rem',letterSpacing:'.16em',textTransform:'uppercase',textDecoration:'none',textAlign:'center',fontWeight:600}}>
                    {cta as string} →
                  </a>
                </div>
              ))
            })()}

          </div>
          <p style={{marginTop:'24px',fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.12em',color:'var(--ink2)',opacity:.4,textTransform:'uppercase'}}>Ferramentas exclusivas Agency Group · AMI 22506 · Acesso restrito a agentes autenticados</p>
        </div>
      </section>

      {/* CREDENCIAIS */}
      <section className="cred-section">
        <div className="cred-grid">
          <div className="cred-c fade-in"><div className="cred-n">169<sup>K</sup></div><div className="cred-l">Transacções PT 2025</div><div className="cred-d">Máximo histórico absoluto.</div></div>
          <div className="cred-c fade-in"><div className="cred-n">+17<sup>%</sup></div><div className="cred-l">Valorização 2025</div><div className="cred-d">INE Q3 2025. 4º máximo.</div></div>
          <div className="cred-c fade-in"><div className="cred-n">44<sup>%</sup></div><div className="cred-l">Compradores Int.</div><div className="cred-d">UK, França, EUA lideram.</div></div>
          <div className="cred-c fade-in"><div className="cred-n">Top<sup>5</sup></div><div className="cred-l">Luxo Mundial</div><div className="cred-d">Savills World Cities 2026.</div></div>
        </div>
      </section>

      {/* AGENTES */}
      <section className="ag-section" id="agentes">
        <div className="ag-inner">
          <div className="ag-eye">Acesso Restrito · AMI 22506</div>
          <h2 className="ag-h2">Área de Agentes</h2>
          <p className="ag-sub">Pipeline · CRM · Deal Radar · Relatórios · Off-Market.</p>
          <div className="ag-form">
            <input type="email" className="ag-inp" id="agEmail" placeholder="email@agencygroup.pt"/>
            <button className="ag-btn" onClick={agLogin}>Entrar</button>
          </div>
          <div className="ag-ami">Agency Group · Mediação Imobiliária Lda · AMI 22506</div>
        </div>
      </section>

      {/* CPCV PIPELINE */}
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
                  <button className="cpcv-btn-wa" onClick={()=>window.open('https://wa.me/351919948986?text='+encodeURIComponent(`Deal ${d.ref}: ${d.imovel} — ${d.valor} — Fase: ${d.fase}`),'_blank')}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WA
                  </button>
                  <select className="cpcv-sel" value={d.fase} onChange={e=>{const v=e.target.value;const FASES:{[k:string]:{pct:number,cor:string}}={'Prospecção':{pct:10,cor:'#888'},'Proposta Enviada':{pct:20,cor:'#3a7bd5'},'Proposta Aceite':{pct:35,cor:'#3a7bd5'},'Due Diligence':{pct:50,cor:'#4a9c7a'},'CPCV Assinado':{pct:70,cor:'#c9a96e'},'Financiamento':{pct:80,cor:'#c9a96e'},'Escritura Marcada':{pct:90,cor:'#1c4a35'},'Escritura Concluída':{pct:100,cor:'#1c4a35'}};const f=FASES[v];setCpcvDeals(prev=>prev.map(x=>x.id===d.id?{...x,fase:v,pct:f?.pct??x.pct,cor:f?.cor??x.cor}:x))}}>
                    {['Prospecção','Proposta Enviada','Proposta Aceite','Due Diligence','CPCV Assinado','Financiamento','Escritura Marcada','Escritura Concluída'].map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── PRESS SECTION ─────────────────────────────────────── */}
      <PressSection />

      {/* ── REVIEWS ─────────────────────────────────────── */}
      <ReviewsWidget />

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="test-section" style={{
        background: '#070f0a',
        borderTop: '1px solid rgba(201,169,110,.08)',
        padding: '96px 40px',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
              letterSpacing: '.28em', color: 'rgba(201,169,110,.6)',
              textTransform: 'uppercase', marginBottom: '16px',
            }}>Clientes · 47 Avaliações · 4.9/5</div>
            <h2 style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#f4f0e6',
              margin: 0,
            }}>O Que Dizem os Nossos Clientes</h2>
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '4px',
              marginTop: '16px',
            }}>
              {[1,2,3,4,5].map(i => (
                <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="#c9a96e">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
            </div>
          </div>

          {/* Testimonial grid */}
          <div className="test-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '24px',
          }}>
            {[
              {
                name: 'James & Sarah Mitchell',
                country: '🇬🇧 Reino Unido',
                zone: 'Cascais',
                rating: 5,
                quote: 'A equipa da Agency Group encontrou a nossa villa de sonho em Cascais em menos de 3 semanas. O processo foi impecável, do primeiro contacto à escritura. Profissionalismo de nível mundial.',
                property: 'Villa T5 · Cascais · €2.4M',
                date: 'Janeiro 2026',
              },
              {
                name: 'Mohammed Al-Rashidi',
                country: '🇸🇦 Arábia Saudita',
                zone: 'Lisboa',
                rating: 5,
                quote: 'Compramos um penthouse no Príncipe Real como investimento. O retorno já supera as expectativas. A Agency Group conhece o mercado melhor do que qualquer outra imobiliária que consultámos.',
                property: 'Penthouse T4 · Lisboa · €3.1M',
                date: 'Dezembro 2025',
              },
              {
                name: 'Chen Wei & Li Ming',
                country: '🇨🇳 China',
                zone: 'Comporta',
                rating: 5,
                quote: 'A Comporta era o nosso sonho. A Agency Group não só encontrou a propriedade certa como nos acompanhou em todo o processo legal e fiscal. Sentimo-nos completamente seguros.',
                property: 'Quinta T6 · Comporta · €5.2M',
                date: 'Novembro 2025',
              },
              {
                name: 'Marc & Isabelle Fontaine',
                country: '🇫🇷 França',
                zone: 'Porto',
                rating: 5,
                quote: 'Investidores há 15 anos, nunca trabalhámos com uma equipa tão dedicada. O conhecimento do mercado do Porto é extraordinário. Rentabilidade de 5.1% no primeiro ano.',
                property: 'Apartamento T3 · Porto · €890K',
                date: 'Outubro 2025',
              },
              {
                name: 'Robert & Anna Schneider',
                country: '🇩🇪 Alemanha',
                zone: 'Algarve',
                rating: 5,
                quote: 'Após comparar 6 imobiliárias, escolhemos a Agency Group pela sua transparência e pelos relatórios de mercado exclusivos. A nossa villa no Algarve é perfeita.',
                property: 'Villa T5 · Algarve · €1.8M',
                date: 'Setembro 2025',
              },
              {
                name: 'David & Rachel Goldstein',
                country: '🇺🇸 Estados Unidos',
                zone: 'Madeira',
                rating: 5,
                quote: 'Relocalizámo-nos para a Madeira com o regime NHR. A Agency Group tratou de tudo: imóvel, advogado, contabilista, escola para os filhos. Um serviço verdadeiramente completo.',
                property: 'Moradia T4 · Madeira · €1.2M',
                date: 'Agosto 2025',
              },
            ].map((t, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,.025)',
                border: '1px solid rgba(201,169,110,.1)',
                padding: '32px',
                position: 'relative',
                transition: 'border-color .2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,.1)')}
              >
                {/* Quote mark */}
                <div className="test-quote-mark" style={{
                  fontFamily: "'Cormorant', serif", fontSize: '4rem',
                  color: 'rgba(201,169,110,.2)', lineHeight: 0.8,
                  marginBottom: '16px',
                }}>"</div>

                {/* Stars */}
                <div className="test-stars" style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
                  {Array.from({ length: t.rating }).map((_, s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#c9a96e">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>

                {/* Quote */}
                <p className="test-quote" style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.75rem',
                  lineHeight: 1.7, color: 'rgba(244,240,230,.7)',
                  margin: '0 0 24px', fontStyle: 'italic',
                }}>"{t.quote}"</p>

                {/* Property */}
                <div className="test-property" style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
                  letterSpacing: '.12em', color: 'rgba(201,169,110,.5)',
                  marginBottom: '16px', textTransform: 'uppercase',
                }}>{t.property}</div>

                {/* Author */}
                <div className="test-author" style={{
                  borderTop: '1px solid rgba(201,169,110,.1)',
                  paddingTop: '16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                }}>
                  <div>
                    <div style={{
                      fontFamily: "'Jost', sans-serif", fontWeight: 600,
                      fontSize: '.72rem', color: '#f4f0e6', marginBottom: '4px',
                    }}>{t.name}</div>
                    <div style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
                      letterSpacing: '.1em', color: 'rgba(244,240,230,.4)',
                    }}>{t.country} · {t.zone}</div>
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.4rem',
                    color: 'rgba(244,240,230,.25)', letterSpacing: '.08em',
                  }}>{t.date}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div style={{
            display: 'flex', gap: '32px', justifyContent: 'center',
            marginTop: '64px', flexWrap: 'wrap',
          }}>
            {[
              { val: '4.9/5', label: 'Avaliação Média' },
              { val: '47', label: 'Avaliações Verificadas' },
              { val: '100%', label: 'Recomendariam' },
              { val: '€285M+', label: 'Volume Transacionado' },
            ].map(b => (
              <div key={b.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontSize: '2rem',
                  color: '#c9a96e', fontWeight: 300,
                }}>{b.val}</div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
                  letterSpacing: '.14em', color: 'rgba(244,240,230,.4)',
                  textTransform: 'uppercase', marginTop: '4px',
                }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <div className="contact-bar" id="contacto">
        <div className="cb-inner">
          <div className="cb-items">
            <div className="cb-item"><span className="cb-lbl">Telefone</span><a href="tel:+351919948986" className="cb-val">+351 919 948 986</a></div>
            <div className="cb-item"><span className="cb-lbl">Email</span><a href="mailto:geral@agencygroup.pt" className="cb-val">geral@agencygroup.pt</a></div>
            <div className="cb-item"><span className="cb-lbl">Morada</span><span className="cb-val">Amoreiras Square, Lisboa</span></div>
            <div className="cb-item"><span className="cb-lbl">Licença</span><span className="cb-val" style={{color:'var(--g)',fontWeight:500}}>AMI 22506</span></div>
          </div>
          <a href="https://wa.me/351919948986?text=Bom%20dia%2C%20gostaria%20de%20saber%20mais%20sobre%20im%C3%B3veis%20de%20luxo%20em%20Portugal." target="_blank" rel="noreferrer" className="wa-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp Agora
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="ft-inner">
          <div className="ft-top">
            <div><div className="ft-la">Agency</div><div className="ft-lg">Group</div><p className="ft-tag">Mediação imobiliária de luxo em Portugal. €500K–€10M.</p></div>
            <div className="ft-col"><div className="ft-col-h">Zonas</div><ul><li><a href="#">Lisboa</a></li><li><a href="#">Cascais</a></li><li><a href="#">Comporta</a></li><li><a href="#">Porto</a></li><li><a href="#">Algarve</a></li><li><a href="#">Madeira</a></li></ul></div>
            <div className="ft-col"><div className="ft-col-h">Serviços</div><ul><li><a href="#avaliacao">Avaliação AVM</a></li><li><a href="#deal-radar">Deal Radar</a></li><li><a href="#" onClick={e=>{e.preventDefault();openModal()}}>Off-Market</a></li><li><a href="#contacto">NHR / Vistos</a></li></ul></div>
            <div className="ft-col"><div className="ft-col-h">Empresa</div><ul><li><a href="#contacto">Sobre Nós</a></li><li><a href="#agentes">Agentes</a></li><li><a href="/relatorio-2026" style={{color:'var(--gold)',fontWeight:500}}>Market Report 2026 ↗</a></li><li><a href="mailto:geral@agencygroup.pt">Email</a></li></ul></div>
          </div>
          <div className="ft-bot">
            <div className="ft-legal">© 2026 Agency Group – Mediação Imobiliária Lda · NIPC 516.833.960 · Lisboa</div>
            <div className="ft-ami">AMI 22506</div>
          </div>
        </div>
      </footer>

    </>
  )
}
