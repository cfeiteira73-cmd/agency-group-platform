'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// ─── Deal data ────────────────────────────────────────────────────────────────
const DEALS: Record<string, {
  ref: string; imovel: string; valor: string; fase: string; pct: number
  property: { tipo: string; area: number; quartos: number; casasBanho: number; andar: string; energia: string; ano: number; pm2?: number; zonaPm2?: number }
  agent: { name: string; phone: string; email: string; photo: string }
  docs: { name: string; status: 'received'|'pending'|'reviewing'; required: boolean }[]
  stages: { name: string; done: boolean; current: boolean; date?: string }[]
  nextStep: string; nextStepDetail: string
  keyDates: { label: string; date: string; done: boolean }[]
  updates: { date: string; text: string; type: 'info'|'success'|'action' }[]
  tourUrl?: string
}> = {
  'ag-2026-001': {
    ref: 'AG-2026-001',
    imovel: 'Villa Quinta da Marinha · Cascais',
    valor: '€ 3.800.000',
    fase: 'CPCV Assinado',
    pct: 70,
    property: { tipo: 'Moradia/Villa', area: 620, quartos: 5, casasBanho: 5, andar: 'Moradia', energia: 'A+', ano: 2019, pm2: 6129, zonaPm2: 5200 },
    agent: { name: 'Carlos Feiteira', phone: '+351919948986', email: 'carlos@agencygroup.pt', photo: 'CF' },
    docs: [
      { name: 'Caderneta Predial', status: 'received', required: true },
      { name: 'Certidão Permanente', status: 'received', required: true },
      { name: 'Licença de Utilização', status: 'reviewing', required: true },
      { name: 'Certificado Energético', status: 'received', required: true },
      { name: 'Prova de Fundos', status: 'pending', required: true },
      { name: 'Identificação (Passaporte)', status: 'received', required: true },
      { name: 'NIF Português', status: 'received', required: true },
      { name: 'Relatório Técnico', status: 'pending', required: false },
    ],
    stages: [
      { name: 'Angariação', done: true, current: false, date: '02 Jan 2026' },
      { name: 'Proposta Enviada', done: true, current: false, date: '15 Jan 2026' },
      { name: 'Proposta Aceite', done: true, current: false, date: '22 Jan 2026' },
      { name: 'Due Diligence', done: true, current: false, date: '05 Fev 2026' },
      { name: 'CPCV Assinado', done: true, current: true, date: '14 Fev 2026' },
      { name: 'Financiamento', done: false, current: false },
      { name: 'Escritura Marcada', done: false, current: false },
      { name: 'Escritura Concluída', done: false, current: false },
    ],
    nextStep: 'Aprovação de Financiamento',
    nextStepDetail: 'O banco está a finalizar a avaliação do imóvel. Estimativa: 10–15 dias úteis. O nosso advogado está em contacto directo com a entidade bancária.',
    keyDates: [
      { label: 'CPCV Assinado', date: '14 Fev 2026', done: true },
      { label: 'Avaliação Bancária', date: '20 Mar 2026', done: false },
      { label: 'Escritura Prevista', date: '15 Abr 2026', done: false },
    ],
    updates: [
      { date: 'Hoje, 09:14', text: 'Advogado em contacto com banco — avaliação em curso.', type: 'info' },
      { date: 'Ontem, 16:30', text: 'CPCV assinado por ambas as partes. ✓ Sinal de 10% pago.', type: 'success' },
      { date: '05 Fev 2026', text: 'Due diligence concluída sem incidências. Certidão permanente limpa.', type: 'success' },
      { date: '22 Jan 2026', text: 'Proposta aceite. Preço final acordado: €3.800.000.', type: 'success' },
    ],
    tourUrl: 'https://my.matterport.com/show/?m=SFR2tst4qnM',
  },
  'ag-2026-002': {
    ref: 'AG-2026-002',
    imovel: 'Penthouse Chiado · Lisboa',
    valor: '€ 2.100.000',
    fase: 'Due Diligence',
    pct: 50,
    property: { tipo: 'Apartamento / Penthouse', area: 280, quartos: 4, casasBanho: 3, andar: '8º Andar', energia: 'A', ano: 2022, pm2: 7500, zonaPm2: 6200 },
    agent: { name: 'Carlos Feiteira', phone: '+351919948986', email: 'carlos@agencygroup.pt', photo: 'CF' },
    docs: [
      { name: 'Caderneta Predial', status: 'received', required: true },
      { name: 'Certidão Permanente', status: 'pending', required: true },
      { name: 'Licença de Utilização', status: 'pending', required: true },
      { name: 'Certificado Energético', status: 'received', required: true },
      { name: 'Prova de Fundos', status: 'received', required: true },
      { name: 'Identificação', status: 'received', required: true },
    ],
    stages: [
      { name: 'Angariação', done: true, current: false, date: '10 Jan 2026' },
      { name: 'Proposta Enviada', done: true, current: false, date: '20 Jan 2026' },
      { name: 'Proposta Aceite', done: true, current: false, date: '28 Jan 2026' },
      { name: 'Due Diligence', done: false, current: true },
      { name: 'CPCV Assinado', done: false, current: false },
      { name: 'Financiamento', done: false, current: false },
      { name: 'Escritura Marcada', done: false, current: false },
      { name: 'Escritura Concluída', done: false, current: false },
    ],
    nextStep: 'Due Diligence Jurídica',
    nextStepDetail: 'O advogado está a verificar a certidão permanente e a licença de utilização. Prazo estimado: 5 dias úteis.',
    keyDates: [
      { label: 'Proposta Aceite', date: '28 Jan 2026', done: true },
      { label: 'Due Diligence Concluída', date: '25 Mar 2026', done: false },
      { label: 'CPCV Previsto', date: '01 Abr 2026', done: false },
    ],
    updates: [
      { date: 'Hoje, 10:00', text: 'Pedida certidão permanente ao registo predial.', type: 'action' },
      { date: 'Ontem, 14:20', text: 'Proposta aceite confirmada por escrito pelo vendedor.', type: 'success' },
      { date: '20 Jan 2026', text: 'Proposta formal submetida — €2.100.000.', type: 'info' },
    ],
    tourUrl: 'https://my.matterport.com/show/?m=oCXP6iB8r8s',
  },
  'ag-2026-003': {
    ref: 'AG-2026-003',
    imovel: 'Herdade Privada · Comporta',
    valor: '€ 6.500.000',
    fase: 'Proposta Aceite',
    pct: 30,
    property: { tipo: 'Herdade / Quinta', area: 850, quartos: 6, casasBanho: 6, andar: 'Moradia', energia: 'B', ano: 2018, pm2: 7647, zonaPm2: 5800 },
    agent: { name: 'Carlos Feiteira', phone: '+351919948986', email: 'carlos@agencygroup.pt', photo: 'CF' },
    docs: [
      { name: 'Caderneta Predial', status: 'received', required: true },
      { name: 'Certidão Permanente', status: 'received', required: true },
      { name: 'Licença de Utilização', status: 'pending', required: true },
      { name: 'Certificado Energético', status: 'pending', required: true },
      { name: 'Prova de Fundos', status: 'received', required: true },
      { name: 'Identificação', status: 'received', required: true },
    ],
    stages: [
      { name: 'Angariação', done: true, current: false, date: '15 Jan 2026' },
      { name: 'Proposta Enviada', done: true, current: false, date: '10 Fev 2026' },
      { name: 'Proposta Aceite', done: false, current: true },
      { name: 'Due Diligence', done: false, current: false },
      { name: 'CPCV Assinado', done: false, current: false },
      { name: 'Financiamento', done: false, current: false },
      { name: 'Escritura Marcada', done: false, current: false },
      { name: 'Escritura Concluída', done: false, current: false },
    ],
    nextStep: 'Negociação Final & CPCV',
    nextStepDetail: 'Proposta aceite verbalmente. A aguardar confirmação por escrito do vendedor. Advogado a preparar minuta CPCV.',
    keyDates: [
      { label: 'Proposta Enviada', date: '10 Fev 2026', done: true },
      { label: 'CPCV Previsto', date: '10 Abr 2026', done: false },
      { label: 'Escritura Prevista', date: '30 Jun 2026', done: false },
    ],
    updates: [
      { date: 'Hoje, 11:30', text: 'Vendedor confirmou interesse. Resposta formal esperada amanhã.', type: 'info' },
      { date: '10 Fev 2026', text: 'Proposta de €6.500.000 submetida formalmente.', type: 'info' },
    ],
  },
}

// ─── IMT Calculator ─────────────────────────────────────────────────────────
function calcIMT(valor: number, isHPP: boolean): number {
  if (isHPP) {
    // IMT HPP 2026
    const brackets = [
      { limit: 101917, rate: 0,     deduct: 0 },
      { limit: 139412, rate: 0.02,  deduct: 2038.34 },
      { limit: 190086, rate: 0.05,  deduct: 6220.70 },
      { limit: 316772, rate: 0.07,  deduct: 10020.42 },
      { limit: 633453, rate: 0.08,  deduct: 13188.14 },
      { limit: 1102920, rate: 0.06, deduct: 0 },
      { limit: Infinity, rate: 0.075, deduct: 0 },
    ]
    for (const b of brackets) {
      if (valor <= b.limit) {
        return Math.max(0, valor * b.rate - b.deduct)
      }
    }
    return 0
  } else {
    // IMT Outros / Estrangeiros (non-HPP)
    if (valor <= 97064) return 0
    if (valor <= 132774) return valor * 0.02 - 1941.28
    if (valor <= 181034) return valor * 0.05 - 5924.50
    if (valor <= 301688) return valor * 0.07 - 9546.18
    if (valor <= 603289) return valor * 0.08 - 12570.06
    return valor * 0.06
  }
}

export default function DealPage() {
  const params = useParams()
  const ref = (params?.ref as string || '').toLowerCase()
  const deal = DEALS[ref]
  const [msgSent, setMsgSent] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [tourOpen, setTourOpen] = useState(false)
  const [isHPP, setIsHPP] = useState(false)
  const [nps, setNps] = useState<number|null>(null)
  const [faqOpen, setFaqOpen] = useState<number|null>(null)
  const [showCosts, setShowCosts] = useState(true)

  const docsReceived = deal?.docs.filter(d => d.status === 'received').length || 0
  const docsTotal = deal?.docs.filter(d => d.required).length || 0

  // Acquisition costs
  const valorNum = deal ? parseFloat(deal.valor.replace(/[^0-9]/g, '')) : 0
  const imt = deal ? calcIMT(valorNum, isHPP) : 0
  const impostoSelo = Math.round(valorNum * 0.008)
  const notario = Math.round(Math.min(Math.max(valorNum * 0.005, 1500), 8000))
  const advogado = Math.round(valorNum * 0.005)
  const totalCosts = imt + impostoSelo + notario + advogado
  const totalAquisicao = valorNum + totalCosts

  const FAQS = [
    { q: 'O que é o CPCV e qual a sua importância?', a: 'O Contrato Promessa de Compra e Venda (CPCV) é um contrato preliminar com força legal que vincula ambas as partes. O comprador paga geralmente 10–30% de sinal. Se o vendedor desistir, tem de pagar o dobro do sinal. Se o comprador desistir, perde o sinal.' },
    { q: 'Quanto tempo demora o processo até à escritura?', a: 'Em média 60–120 dias após o CPCV. Depende do financiamento (se necessário), da due diligence jurídica e da disponibilidade do notário. Com pagamento a pronto, pode ser mais rápido (30–45 dias).' },
    { q: 'Preciso de NIF português para comprar?', a: 'Sim, é obrigatório ter um Número de Identificação Fiscal (NIF) português para qualquer transacção imobiliária. A Agency Group ajuda a obtê-lo junto das Finanças — em 1–2 dias úteis para residentes EU, 5–10 dias para extra-EU.' },
    { q: 'Qual o prazo para transferir fundos do exterior?', a: 'Recomendamos transferir fundos com pelo menos 15 dias de antecedência à escritura. Todas as transferências acima de €10.000 requerem documentação de origem de fundos (KYC).' },
    { q: 'O que é o regime NHR e ainda é possível aplicar?', a: 'O NHR (Residente Não-Habitual) foi substituído pelo IFICI em 2024 para novos residentes. O IFICI oferece taxa flat de 20% em rendimentos de trabalho e isenção em rendimentos estrangeiros por 10 anos. A Agency Group tem consultores especializados.' },
    { q: 'A comissão de mediação quem paga?', a: 'Em Portugal, a comissão de mediação imobiliária (5% + IVA neste caso) é normalmente paga pelo vendedor. Como comprador, não tem custos directos de mediação — apenas IMT, IS, notário e advogado.' },
  ]

  if (!deal) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:var(--font-jost),sans-serif;background:#0c1f15;-webkit-font-smoothing:antialiased}
        `}</style>
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px',textAlign:'center'}}>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'3rem',color:'#c9a96e',marginBottom:'16px'}}>Deal não encontrado</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.15em',textTransform:'uppercase',color:'rgba(244,240,230,.3)',marginBottom:'32px'}}>O link pode estar incorrecto ou expirado</div>
          <Link href="/" style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.14em',textTransform:'uppercase',color:'#c9a96e',textDecoration:'none',border:'1px solid rgba(201,169,110,.3)',padding:'12px 24px'}}>← Voltar ao Site</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(14,14,13,.15)}
        .dp-btn{background:#1c4a35;color:#f4f0e6;border:none;padding:12px 24px;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
        .dp-btn:hover{background:#163d2c;transform:translateY(-1px)}
        .dp-btn-gold{background:#c9a96e;color:#0c1f15}
        .dp-btn-gold:hover{background:#b8965a}
        .dp-inp{width:100%;background:#fff;border:1px solid rgba(14,14,13,.15);padding:11px 16px;font-family:var(--font-jost),sans-serif;font-size:.88rem;color:#0e0e0d;outline:none}
        .dp-inp:focus{border-color:#1c4a35}
        .doc-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border:1px solid rgba(14,14,13,.07);margin-bottom:6px;transition:border .2s}
        .doc-item:hover{border-color:rgba(14,14,13,.18)}
        .stage-item{display:flex;gap:16px;align-items:flex-start;padding-bottom:20px}
        .faq-item{border-bottom:1px solid rgba(14,14,13,.07);overflow:hidden}
        .faq-q{display:flex;justify-content:space-between;align-items:center;padding:16px 0;cursor:pointer;font-size:.9rem;color:#0e0e0d;font-weight:400;gap:16px;background:none;border:none;width:100%;text-align:left}
        .faq-q:hover{color:#1c4a35}
        .nps-btn{width:36px;height:36px;border-radius:50%;border:2px solid rgba(14,14,13,.12);background:transparent;cursor:pointer;font-family:var(--font-dm-mono),monospace;font-size:.65rem;font-weight:600;transition:all .2s;display:flex;align-items:center;justify-content:center}
        .nps-btn:hover{border-color:#1c4a35;color:#1c4a35;transform:scale(1.08)}
        .nps-btn.selected{background:#1c4a35;border-color:#1c4a35;color:#f4f0e6}
        .cost-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(14,14,13,.06)}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
        @media(max-width:768px){
          .dp-grid{grid-template-columns:1fr!important}
          .dp-grid-3{grid-template-columns:1fr 1fr!important}
          .dp-hero{padding:32px 20px!important}
          .dp-content{padding:32px 20px!important}
          nav{padding:16px 20px!important}
          .dp-costs-grid{grid-template-columns:1fr 1fr!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{background:'#0c1f15',padding:'18px 48px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(201,169,110,.1)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{textDecoration:'none'}}>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',letterSpacing:'.35em',textTransform:'uppercase',color:'#c9a96e',lineHeight:1}}>Agency</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'.55rem',letterSpacing:'.6em',textTransform:'uppercase',color:'rgba(201,169,110,.35)',marginTop:'1px'}}>Group · AMI 22506</div>
        </Link>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(244,240,230,.2)'}}>{deal.ref}</div>
          <div style={{width:'1px',height:'16px',background:'rgba(244,240,230,.1)'}}/>
          <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#4a9c7a'}}/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.35)',letterSpacing:'.08em'}}>LIVE</span>
          </div>
          <a href={`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}`} className="dp-btn dp-btn-gold" style={{padding:'8px 16px',fontSize:'.42rem'}}>
            💬 WhatsApp
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div className="dp-hero" style={{background:'linear-gradient(135deg,#0c1f15 0%,#1c4a35 100%)',padding:'56px 48px',animation:'fadeIn .5s ease'}}>
        <div style={{maxWidth:'960px',margin:'0 auto'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'12px'}}>O Seu Negócio · {deal.ref}</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'clamp(1.8rem,4vw,3rem)',color:'#f4f0e6',lineHeight:1.1,marginBottom:'6px'}}>{deal.imovel}</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#c9a96e',marginBottom:'36px'}}>{deal.valor}</div>

          {/* Property specs row */}
          <div className="dp-grid-3" style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'10px',marginBottom:'36px'}}>
            {[
              { icon:'🏠', val: deal.property.tipo, lbl:'Tipo' },
              { icon:'📐', val: `${deal.property.area}m²`, lbl:'Área' },
              { icon:'🛏', val: `T${deal.property.quartos}`, lbl:'Quartos' },
              { icon:'🚿', val: deal.property.casasBanho, lbl:'WC' },
              { icon:'⚡', val: deal.property.energia, lbl:'Energia' },
              { icon:'📅', val: deal.property.ano, lbl:'Construção' },
            ].map((s,i)=>(
              <div key={i} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(201,169,110,.15)',borderRadius:'8px',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'1rem',marginBottom:'4px'}}>{s.icon}</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'.95rem',fontWeight:400,color:'#f4f0e6',lineHeight:1,marginBottom:'2px'}}>{String(s.val)}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(244,240,230,.35)',letterSpacing:'.08em',textTransform:'uppercase'}}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{marginBottom:'10px',display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.14em',textTransform:'uppercase',color:'#c9a96e'}}>{deal.fase}</div>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',color:'#c9a96e',lineHeight:1}}>{deal.pct}%</div>
          </div>
          <div style={{height:'8px',background:'rgba(244,240,230,.08)',borderRadius:'4px',overflow:'hidden',marginBottom:'28px'}}>
            <div style={{height:'100%',width:`${deal.pct}%`,background:'linear-gradient(90deg,#1c4a35,#c9a96e)',borderRadius:'4px',transition:'width 1.2s ease'}}/>
          </div>

          {/* Stage progress dots */}
          <div style={{display:'flex',gap:'0',alignItems:'center'}}>
            {deal.stages.map((s,i)=>(
              <div key={s.name} style={{display:'flex',alignItems:'center',flex:1}}>
                <div title={s.name} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',cursor:'default'}}>
                  <div style={{width:'14px',height:'14px',borderRadius:'50%',border:`2px solid ${s.done?'#4a9c7a':s.current?'#c9a96e':'rgba(244,240,230,.2)'}`,background:s.done?'#4a9c7a':s.current?'#c9a96e':'transparent',flexShrink:0,transition:'all .4s',boxShadow:s.current?'0 0 0 4px rgba(201,169,110,.2)':'none'}}/>
                </div>
                {i < deal.stages.length-1 && (
                  <div style={{flex:1,height:'2px',background:s.done?'rgba(74,156,122,.5)':'rgba(244,240,230,.08)',margin:'0 3px'}}/>
                )}
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(244,240,230,.25)',textTransform:'uppercase',letterSpacing:'.06em'}}>{deal.stages[0].name}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(244,240,230,.25)',textTransform:'uppercase',letterSpacing:'.06em'}}>{deal.stages[deal.stages.length-1].name}</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="dp-content" style={{maxWidth:'960px',margin:'0 auto',padding:'48px 48px 80px'}}>

        {/* Next Step Card */}
        <div style={{background:'#fff',border:'2px solid #c9a96e',padding:'24px 28px',marginBottom:'28px',animation:'fadeIn .5s ease .1s both',borderLeft:'5px solid #c9a96e'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.18em',textTransform:'uppercase',color:'#c9a96e'}}>→ Próximo Passo</span>
          </div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:400,fontSize:'1.3rem',color:'#0e0e0d',marginBottom:'8px'}}>{deal.nextStep}</div>
          <p style={{fontSize:'.88rem',lineHeight:1.75,color:'rgba(14,14,13,.6)'}}>{deal.nextStepDetail}</p>
        </div>

        {/* Countdown to next key date */}
        {deal.keyDates.filter(d=>!d.done)[0] && (() => {
          const next = deal.keyDates.filter(d=>!d.done)[0]
          const parts = next.date.split(' ')
          const months: Record<string,string> = {'Jan':'01','Fev':'02','Mar':'03','Abr':'04','Mai':'05','Jun':'06','Jul':'07','Ago':'08','Set':'09','Out':'10','Nov':'11','Dez':'12'}
          const dateStr = parts.length===3 ? `${parts[2]}-${months[parts[1]]||'01'}-${parts[0].padStart(2,'0')}` : ''
          const target = dateStr ? new Date(dateStr) : null
          const today = new Date()
          const daysLeft = target ? Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000)) : null
          if (daysLeft === null) return null
          return (
            <div style={{background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.2)',borderLeft:'4px solid #c9a96e',padding:'16px 24px',marginBottom:'28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',animation:'fadeIn .5s ease .08s both'}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>⏳ Próxima Data Importante</div>
                <div style={{fontSize:'.9rem',fontWeight:500,color:'#0e0e0d'}}>{next.label}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.45)',marginTop:'2px'}}>{next.date}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.2rem',fontWeight:300,color:daysLeft<=14?'#dc2626':'#1c4a35',lineHeight:1}}>{daysLeft}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',letterSpacing:'.1em',textTransform:'uppercase'}}>dias restantes</div>
              </div>
            </div>
          )
        })()}

        {/* Investment Snapshot */}
        {deal.property.pm2 && (
          <div style={{background:'linear-gradient(135deg,#0c1f15,#1a3d2a)',padding:'24px 28px',marginBottom:'28px',animation:'fadeIn .5s ease .12s both'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'14px'}}>📊 Investment Snapshot — Portugal 2026</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'14px'}}>
              {[
                { label:'Valorização Prevista', val:'+4-6%', sub:'12 meses · INE 2026', color:'#4a9c7a' },
                { label:'Yield Bruta Estimada', val:`${((valorNum>0?(valorNum*0.004*12)/valorNum*100:0)).toFixed(1)}%`, sub:'Renda mercado zona', color:'#c9a96e' },
                { label:'Custo/m²', val:`€${deal.property.pm2.toLocaleString('pt-PT')}`, sub:`Zona: €${(deal.property.zonaPm2||0).toLocaleString('pt-PT')}`, color:'#f4f0e6' },
                { label:'Mercado', val:'Top 5', sub:'Savills World Cities 2026', color:'#c9a96e' },
              ].map(k=>(
                <div key={k.label} style={{textAlign:'center',padding:'12px 8px',background:'rgba(255,255,255,.05)',border:'1px solid rgba(201,169,110,.1)'}}>
                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',color:k.color,lineHeight:1,marginBottom:'3px'}}>{k.val}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(244,240,230,.4)',letterSpacing:'.06em',marginBottom:'2px',textTransform:'uppercase'}}>{k.label}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(244,240,230,.25)'}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.2)',borderTop:'1px solid rgba(201,169,110,.1)',paddingTop:'10px'}}>
              Projecções baseadas em dados INE/AT Q1 2026 · Savills Capital Markets 2026 · Consultoria personalizada disponível
            </div>
          </div>
        )}

        {/* Virtual Tour */}
        {deal.tourUrl && (
          <div style={{marginBottom:'28px',animation:'fadeIn .5s ease .15s both'}}>
            <button onClick={()=>setTourOpen(!tourOpen)} style={{background:tourOpen?'#0c1f15':'#f4f0e6',color:tourOpen?'#c9a96e':'#0e0e0d',border:'2px solid rgba(14,14,13,.12)',padding:'14px 28px',fontFamily:"'Jost',sans-serif",fontWeight:500,fontSize:'.88rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px',width:'100%',justifyContent:'center',marginBottom:'12px',transition:'all .2s'}}>
              <span>🏠</span>
              {tourOpen ? 'Fechar Tour Virtual 3D' : '▶ Tour Virtual 3D — Visitar Imóvel'}
            </button>
            {tourOpen && (
              <div style={{borderRadius:'4px',overflow:'hidden',border:'1px solid rgba(201,169,110,.2)'}}>
                <iframe src={deal.tourUrl} width="100%" height="420" frameBorder="0" allow="xr-spatial-tracking" allowFullScreen style={{display:'block'}} title="Tour Virtual 3D"/>
                <div style={{padding:'10px 16px',background:'#0c1f15',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.4)'}}>Tour 3D imersivo via Matterport</span>
                  <a href={deal.tourUrl} target="_blank" rel="noopener" style={{color:'#c9a96e',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',textDecoration:'none'}}>Ecrã completo ↗</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3-column grid: Updates + Stages + Docs */}
        <div className="dp-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'28px',animation:'fadeIn .5s ease .2s both'}}>

          {/* Activity Feed */}
          <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'22px 24px'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.15rem',color:'#0e0e0d',marginBottom:'4px'}}>Actividade Recente</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',marginBottom:'16px',letterSpacing:'.06em'}}>ACTUALIZADO EM TEMPO REAL</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0'}}>
              {deal.updates.map((u,i)=>(
                <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',paddingBottom:'14px',animation:`slideIn .4s ease ${i*0.08}s both`}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'10px',flexShrink:0,marginTop:'4px'}}>
                    <div style={{width:'10px',height:'10px',borderRadius:'50%',background:u.type==='success'?'#4a9c7a':u.type==='action'?'#c9a96e':'rgba(28,74,53,.4)',flexShrink:0}}/>
                    {i<deal.updates.length-1&&<div style={{width:'1px',flex:1,background:'rgba(14,14,13,.06)',marginTop:'3px',minHeight:'20px'}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:'.82rem',color:'rgba(14,14,13,.75)',lineHeight:1.5}}>{u.text}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>{u.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'22px 24px'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.15rem',color:'#0e0e0d',marginBottom:'4px'}}>Documentação</div>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
              <div style={{flex:1,height:'4px',background:'rgba(14,14,13,.06)',borderRadius:'2px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${(docsReceived/docsTotal)*100}%`,background:'#4a9c7a',borderRadius:'2px',transition:'width .8s ease'}}/>
              </div>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)',flexShrink:0}}>{docsReceived}/{docsTotal}</span>
            </div>
            {deal.docs.map(d=>(
              <div className="doc-item" key={d.name}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'7px',height:'7px',borderRadius:'50%',background:d.status==='received'?'#4a9c7a':d.status==='reviewing'?'#c9a96e':'rgba(14,14,13,.15)',flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:'.82rem',color:'rgba(14,14,13,.8)'}}>{d.name}</div>
                    {!d.required && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)'}}>Opcional</div>}
                  </div>
                </div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:d.status==='received'?'#4a9c7a':d.status==='reviewing'?'#c9a96e':'rgba(14,14,13,.35)',textTransform:'uppercase',letterSpacing:'.06em',flexShrink:0}}>
                  {d.status==='received'?'✓ OK':d.status==='reviewing'?'Em revisão':'Pendente'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage timeline + Key Dates */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'28px',animation:'fadeIn .5s ease .25s both'}} className="dp-grid">
          <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'22px 24px'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.15rem',color:'#0e0e0d',marginBottom:'16px'}}>Fases do Processo</div>
            {deal.stages.map((s,i)=>(
              <div className="stage-item" key={s.name}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'16px',flexShrink:0}}>
                  <div style={{width:'14px',height:'14px',borderRadius:'50%',border:`2px solid ${s.done?'#4a9c7a':s.current?'#c9a96e':'rgba(14,14,13,.15)'}`,background:s.done?'#4a9c7a':s.current?'#c9a96e':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {s.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f4f0e6" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  {i<deal.stages.length-1&&<div style={{width:'2px',height:'18px',background:s.done?'rgba(74,156,122,.35)':'rgba(14,14,13,.06)',marginTop:'3px'}}/>}
                </div>
                <div>
                  <div style={{fontSize:'.84rem',fontWeight:s.current?500:400,color:s.current?'#1c4a35':s.done?'rgba(14,14,13,.7)':'rgba(14,14,13,.3)'}}>{s.name}</div>
                  {s.date && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',marginTop:'1px'}}>{s.date}</div>}
                  {s.current && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#c9a96e',marginTop:'2px'}}>← Fase actual</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Key Dates */}
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div style={{background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.15)',padding:'22px 24px',borderTop:'3px solid #c9a96e'}}>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.15rem',color:'#0e0e0d',marginBottom:'14px'}}>Datas Chave</div>
              {deal.keyDates.map((d,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',paddingBottom:'10px',borderBottom:i<deal.keyDates.length-1?'1px solid rgba(14,14,13,.06)':'none'}}>
                  <span style={{fontSize:'.84rem',color:'rgba(14,14,13,.65)'}}>{d.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:d.done?'#4a9c7a':'rgba(14,14,13,.5)',fontWeight:d.done?600:400}}>{d.done?'✓ ':''}{d.date}</span>
                </div>
              ))}
            </div>

            {/* Market context */}
            {deal.property.pm2 && (
              <div style={{background:'#0c1f15',padding:'18px 20px',border:'1px solid rgba(201,169,110,.1)'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'10px'}}>Contexto de Mercado</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div>
                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#c9a96e',lineHeight:1}}>€{deal.property.pm2.toLocaleString('pt-PT')}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.3)',marginTop:'2px'}}>€/m² este imóvel</div>
                  </div>
                  <div>
                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'rgba(244,240,230,.6)',lineHeight:1}}>€{deal.property.zonaPm2?.toLocaleString('pt-PT')}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.3)',marginTop:'2px'}}>€/m² mediana zona</div>
                  </div>
                </div>
                <div style={{marginTop:'10px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.6)'}}>
                  {deal.property.pm2 > (deal.property.zonaPm2||0)
                    ? `+${(((deal.property.pm2/(deal.property.zonaPm2||1))-1)*100).toFixed(0)}% acima da mediana da zona`
                    : `-${((1-(deal.property.pm2/(deal.property.zonaPm2||1)))*100).toFixed(0)}% abaixo da mediana — valor de entrada`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Acquisition Cost Calculator */}
        <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',marginBottom:'28px',animation:'fadeIn .5s ease .3s both',overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid rgba(14,14,13,.06)',cursor:'pointer'}} onClick={()=>setShowCosts(!showCosts)}>
            <div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.15rem',color:'#0e0e0d'}}>Custos de Aquisição</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',marginTop:'2px',letterSpacing:'.06em'}}>IMT · IMPOSTO DE SELO · NOTÁRIO · ADVOGADO</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',color:'#c9a96e',fontWeight:600}}>€{totalCosts.toLocaleString('pt-PT')}</span>
              <span style={{color:'rgba(14,14,13,.35)',fontSize:'1.2rem',transition:'transform .2s',transform:showCosts?'rotate(180deg)':'rotate(0deg)',display:'inline-block'}}>▾</span>
            </div>
          </div>
          {showCosts && (
            <div style={{padding:'20px 24px'}}>
              {/* HPP toggle */}
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',padding:'12px 16px',background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)'}}>
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontFamily:"'Jost',sans-serif",fontSize:'.84rem',color:'rgba(14,14,13,.65)'}}>
                  <input type="checkbox" checked={isHPP} onChange={e=>setIsHPP(e.target.checked)} style={{width:'16px',height:'16px',accentColor:'#1c4a35',cursor:'pointer'}}/>
                  <span>Habitação Própria e Permanente (HPP) — taxas reduzidas de IMT</span>
                </label>
              </div>
              <div className="dp-costs-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'12px',marginBottom:'20px'}}>
                {[
                  { label:'IMT', val:imt, note: isHPP ? 'HPP 2026' : 'Outros / Estrangeiros', color:'#1c4a35' },
                  { label:'Imposto de Selo', val:impostoSelo, note:'0.8% do valor', color:'#2563eb' },
                  { label:'Notário / Registo', val:notario, note:'Est. ≈ 0.5%', color:'#7c3aed' },
                  { label:'Advogado', val:advogado, note:'Est. ≈ 0.5%', color:'#c9a96e' },
                ].map(c=>(
                  <div key={c.label} style={{padding:'14px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.07)',textAlign:'center'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'6px'}}>{c.label}</div>
                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:c.color,fontWeight:600,marginBottom:'2px'}}>€{c.val.toLocaleString('pt-PT')}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)'}}>{c.note}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:'2px solid rgba(14,14,13,.08)',paddingTop:'16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
                <div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'4px'}}>Total Custos de Transacção</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',fontWeight:600,color:'#dc2626'}}>€{totalCosts.toLocaleString('pt-PT')}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>{((totalCosts/valorNum)*100).toFixed(1)}% do valor de compra</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'4px'}}>Total de Aquisição</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',fontWeight:600,color:'#0e0e0d'}}>€{totalAquisicao.toLocaleString('pt-PT')}</div>
                </div>
              </div>
              <div style={{marginTop:'12px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.25)',lineHeight:1.6}}>
                * Valores estimados para referência. IMT calculado com tabelas 2026. Notário/advogado variam. Não inclui custos de condomínio, AIMI ou gestão. Consulte o seu advogado.
              </div>
            </div>
          )}
        </div>

        {/* Agent Contact */}
        <div style={{background:'#0c1f15',padding:'28px',marginBottom:'24px',animation:'fadeIn .5s ease .35s both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'20px',flexWrap:'wrap'}}>
            <div style={{width:'56px',height:'56px',borderRadius:'50%',background:'rgba(201,169,110,.15)',border:'2px solid rgba(201,169,110,.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontFamily:"'Cormorant',serif",fontSize:'1.5rem',color:'#c9a96e'}}>{deal.agent.photo}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'4px'}}>O Seu Agente Dedicado</div>
              <div style={{fontSize:'1rem',fontWeight:500,color:'#f4f0e6',marginBottom:'2px'}}>{deal.agent.name}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.3)'}}>Agency Group · AMI 22506 · Disponível 7 dias/semana</div>
            </div>
            <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
              <a href={`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}`} className="dp-btn dp-btn-gold" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              <a href={`tel:${deal.agent.phone}`} className="dp-btn" style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(244,240,230,.1)'}}>📞 Ligar</a>
              <a href={`mailto:${deal.agent.email}`} className="dp-btn" style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(244,240,230,.1)'}}>✉ Email</a>
            </div>
          </div>
        </div>

        {/* Message Agent */}
        {!msgSent ? (
          <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.1)',padding:'24px',marginBottom:'28px',animation:'fadeIn .5s ease .4s both'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d',marginBottom:'14px'}}>Enviar Mensagem ao Agente</div>
            <div style={{display:'flex',gap:'10px'}}>
              <input className="dp-inp" placeholder="Tenho uma dúvida sobre..." value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&msgText.trim()){window.open(`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent('Deal '+deal.ref+' — '+deal.imovel+'\n\n'+msgText)}`);setMsgSent(true)}}} style={{flex:1}}/>
              <button className="dp-btn" onClick={()=>{if(msgText.trim()){window.open(`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(`Deal ${deal.ref} — ${deal.imovel}\n\n${msgText}`)}`);setMsgSent(true)}}} style={{whiteSpace:'nowrap'}}>Enviar →</button>
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.25)',marginTop:'8px'}}>Respondemos em menos de 2 horas · 7 dias/semana</div>
          </div>
        ) : (
          <div style={{background:'rgba(74,156,122,.06)',border:'1px solid rgba(74,156,122,.2)',padding:'20px',textAlign:'center',marginBottom:'28px',animation:'fadeIn .4s ease'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:'#4a9c7a',marginBottom:'6px'}}>✓ Mensagem enviada via WhatsApp</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)'}}>Iremos responder em breve</div>
          </div>
        )}

        {/* FAQ */}
        <div style={{marginBottom:'28px',animation:'fadeIn .5s ease .45s both'}}>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.4rem',color:'#0e0e0d',marginBottom:'16px'}}>Perguntas Frequentes</div>
          <div style={{border:'1px solid rgba(14,14,13,.08)',background:'#fff'}}>
            {FAQS.map((f,i)=>(
              <div key={i} className="faq-item">
                <button className="faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)}>
                  <span style={{fontFamily:"'Jost',sans-serif",fontWeight:400}}>{f.q}</span>
                  <span style={{color:'#1c4a35',fontSize:'1.2rem',flexShrink:0,transition:'transform .2s',transform:faqOpen===i?'rotate(45deg)':'rotate(0deg)',display:'inline-block'}}>+</span>
                </button>
                {faqOpen===i && (
                  <div style={{padding:'0 0 16px 0',fontSize:'.84rem',lineHeight:1.75,color:'rgba(14,14,13,.6)',animation:'fadeIn .2s ease'}}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* NPS */}
        <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'24px',marginBottom:'28px',textAlign:'center',animation:'fadeIn .5s ease .5s both'}}>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d',marginBottom:'4px'}}>Como avalia a nossa comunicação?</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',marginBottom:'16px',letterSpacing:'.06em'}}>ESCALA 1–10 · AGRADECEMOS O SEU FEEDBACK</div>
          {nps === null ? (
            <div style={{display:'flex',gap:'6px',justifyContent:'center',flexWrap:'wrap'}}>
              {Array.from({length:10},(_,i)=>i+1).map(n=>(
                <button key={n} className="nps-btn" onClick={()=>setNps(n)} style={{color:n>=9?'#1c4a35':n>=7?'#c9a96e':'rgba(14,14,13,.4)',borderColor:n>=9?'rgba(28,74,53,.3)':n>=7?'rgba(201,169,110,.3)':'rgba(14,14,13,.1)'}}>{n}</button>
              ))}
            </div>
          ) : (
            <div style={{animation:'fadeIn .3s ease'}}>
              <div style={{fontFamily:"'Cormorant',serif",fontSize:'2rem',color:'#4a9c7a',marginBottom:'6px'}}>✓ Obrigado!</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)'}}>Avaliação {nps}/10 registada · Partilhamos com a equipa.</div>
            </div>
          )}
        </div>

      </div>

      {/* FOOTER */}
      <footer style={{background:'#0c1f15',borderTop:'1px solid rgba(201,169,110,.08)',padding:'24px 48px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',letterSpacing:'.3em',textTransform:'uppercase',color:'#c9a96e'}}>Agency Group</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.2)',marginTop:'2px',textTransform:'uppercase',letterSpacing:'.08em'}}>AMI 22506 · Mediação Imobiliária Lda</div>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.18)',letterSpacing:'.06em',textAlign:'right'}}>
          © 2026 Agency Group<br/>
          <span style={{fontSize:'.34rem'}}>Este link é privado e confidencial</span>
        </div>
      </footer>
    </>
  )
}
