'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// Mock deal data — in production would come from DB
const DEALS: Record<string, {
  ref: string; imovel: string; valor: string; fase: string; pct: number
  agent: { name: string; phone: string; email: string; photo: string }
  docs: { name: string; status: 'received'|'pending'|'reviewing'; required: boolean }[]
  stages: { name: string; done: boolean; current: boolean; date?: string }[]
  nextStep: string; nextStepDetail: string
  keyDates: { label: string; date: string; done: boolean }[]
  tourUrl?: string
}> = {
  'ag-2026-001': {
    ref: 'AG-2026-001',
    imovel: 'Villa Quinta da Marinha · Cascais',
    valor: '€ 3.800.000',
    fase: 'CPCV Assinado',
    pct: 70,
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
    tourUrl: 'https://my.matterport.com/show/?m=SFR2tst4qnM',
  },
  'ag-2026-002': {
    ref: 'AG-2026-002',
    imovel: 'Penthouse Chiado · Lisboa',
    valor: '€ 2.100.000',
    fase: 'Due Diligence',
    pct: 50,
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
    tourUrl: 'https://my.matterport.com/show/?m=oCXP6iB8r8s',
  },
}

export default function DealPage() {
  const params = useParams()
  const ref = (params?.ref as string || '').toLowerCase()
  const deal = DEALS[ref]
  const [msgSent, setMsgSent] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [tourOpen, setTourOpen] = useState(false)

  const docsReceived = deal?.docs.filter(d=>d.status==='received').length || 0
  const docsTotal = deal?.docs.filter(d=>d.required).length || 0

  if (!deal) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:'Jost',sans-serif;background:#0c1f15;-webkit-font-smoothing:antialiased}
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
        body{font-family:'Jost',sans-serif;background:#f4f0e6;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(14,14,13,.15)}
        .dp-btn{background:#1c4a35;color:#f4f0e6;border:none;padding:12px 24px;font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:background .2s;text-decoration:none;display:inline-block}
        .dp-btn:hover{background:#163d2c}
        .dp-btn-gold{background:#c9a96e;color:#0c1f15}
        .dp-btn-gold:hover{background:#b8965a}
        .dp-inp{width:100%;background:#fff;border:1px solid rgba(14,14,13,.15);padding:11px 16px;font-family:'Jost',sans-serif;font-size:.88rem;color:#0e0e0d;outline:none}
        .dp-inp:focus{border-color:#1c4a35}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes progressGrow{from{width:0}to{width:var(--target-width)}}
        .stage-item{display:flex;gap:16px;align-items:flex-start;padding-bottom:20px}
        .doc-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border:1px solid rgba(14,14,13,.07);margin-bottom:6px}
        @media(max-width:768px){
          .dp-grid{grid-template-columns:1fr!important}
          .dp-hero{padding:32px 20px!important}
          .dp-section{padding:40px 20px!important}
          nav{padding:16px 20px!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{background:'#0c1f15',padding:'20px 48px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(201,169,110,.1)'}}>
        <Link href="/" style={{textDecoration:'none'}}>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.2rem',letterSpacing:'.35em',textTransform:'uppercase',color:'#c9a96e',lineHeight:1}}>Agency</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'.6rem',letterSpacing:'.6em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',marginTop:'1px'}}>Group</div>
        </Link>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(244,240,230,.25)'}}>{deal.ref}</div>
          <a href={`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}`} className="dp-btn dp-btn-gold" style={{padding:'8px 18px',fontSize:'.44rem'}}>
            💬 WhatsApp
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div className="dp-hero" style={{background:'#0c1f15',padding:'56px 48px',animation:'fadeIn .5s ease'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.25em',textTransform:'uppercase',color:'rgba(201,169,110,.45)',marginBottom:'12px'}}>O Seu Deal · {deal.ref}</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'clamp(1.8rem,4vw,2.8rem)',color:'#f4f0e6',lineHeight:1.1,marginBottom:'6px'}}>{deal.imovel}</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.6rem',color:'#c9a96e',marginBottom:'32px'}}>{deal.valor}</div>

          {/* Progress */}
          <div style={{marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.14em',textTransform:'uppercase',color:deal.pct>=70?'#c9a96e':'rgba(244,240,230,.45)'}}>
              {deal.fase}
            </div>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.5rem',color:'#c9a96e',lineHeight:1}}>{deal.pct}%</div>
          </div>
          <div style={{height:'6px',background:'rgba(244,240,230,.08)',borderRadius:'3px',overflow:'hidden',marginBottom:'32px'}}>
            <div style={{height:'100%',width:`${deal.pct}%`,background:'linear-gradient(90deg,#1c4a35,#c9a96e)',borderRadius:'3px',transition:'width 1s ease'}}/>
          </div>

          {/* Stage dots */}
          <div style={{display:'flex',gap:'0',alignItems:'center'}}>
            {deal.stages.map((s,i)=>(
              <div key={s.name} style={{display:'flex',alignItems:'center',flex:1}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                  <div style={{width:'12px',height:'12px',borderRadius:'50%',border:`2px solid ${s.done?'#4a9c7a':s.current?'#c9a96e':'rgba(244,240,230,.2)'}`,background:s.done?'#4a9c7a':s.current?'#c9a96e':'transparent',flexShrink:0,transition:'all .3s'}}/>
                </div>
                {i < deal.stages.length-1 && (
                  <div style={{flex:1,height:'2px',background:s.done?'rgba(74,156,122,.4)':'rgba(244,240,230,.08)',margin:'0 2px'}}/>
                )}
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.3)',textTransform:'uppercase',letterSpacing:'.06em'}}>{deal.stages[0].name}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.3)',textTransform:'uppercase',letterSpacing:'.06em'}}>{deal.stages[deal.stages.length-1].name}</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'48px 48px 64px'}} className="dp-section">

        {/* Virtual Tour */}
        {deal.tourUrl && (
          <div style={{ marginBottom: '32px' }}>
            <button
              onClick={() => setTourOpen(!tourOpen)}
              style={{
                background: tourOpen ? '#0c1f15' : '#c9a96e',
                color: tourOpen ? '#c9a96e' : '#0c1f15',
                border: '2px solid #c9a96e',
                borderRadius: '10px',
                padding: '14px 28px',
                fontFamily: 'Jost, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                justifyContent: 'center',
                marginBottom: '16px'
              }}
            >
              <span>🏠</span>
              {tourOpen ? 'Fechar Tour Virtual' : '▶ Tour Virtual 3D — Ver Imóvel'}
            </button>
            {tourOpen && (
              <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(201,169,110,0.3)', background: '#000' }}>
                <iframe
                  src={deal.tourUrl}
                  width="100%"
                  height="400"
                  frameBorder="0"
                  allow="xr-spatial-tracking"
                  allowFullScreen
                  style={{ display: 'block' }}
                  title="Tour Virtual 3D"
                />
                <div style={{ padding: '12px 16px', background: '#0c1f15', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Jost, sans-serif', fontSize: '13px', color: 'rgba(244,240,230,0.6)' }}>
                    Tour 3D via Matterport · Navegação imersiva disponível
                  </span>
                  <a href={deal.tourUrl} target="_blank" rel="noopener" style={{ color: '#c9a96e', fontFamily: 'Jost, sans-serif', fontSize: '13px', textDecoration: 'none' }}>
                    Abrir em ecrã completo ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Step Card */}
        <div style={{background:'#fff',border:'2px solid #c9a96e',padding:'24px',marginBottom:'28px',animation:'fadeIn .6s ease .1s both'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.18em',textTransform:'uppercase',color:'#c9a96e',marginBottom:'8px'}}>→ Próximo Passo</div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:400,fontSize:'1.3rem',color:'#0e0e0d',marginBottom:'8px'}}>{deal.nextStep}</div>
          <p style={{fontSize:'.88rem',lineHeight:1.75,color:'rgba(14,14,13,.6)'}}>{deal.nextStepDetail}</p>
        </div>

        <div className="dp-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'28px'}}>

          {/* Documents */}
          <div style={{animation:'fadeIn .6s ease .2s both'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.2rem',color:'#0e0e0d',marginBottom:'6px'}}>Documentos</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>{docsReceived}/{docsTotal} recebidos</div>
            {deal.docs.map(d=>(
              <div className="doc-item" key={d.name}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:d.status==='received'?'#4a9c7a':d.status==='reviewing'?'#c9a96e':'rgba(14,14,13,.15)',flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:'.84rem',color:'rgba(14,14,13,.8)'}}>{d.name}</div>
                    {!d.required && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)'}}>Opcional</div>}
                  </div>
                </div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:d.status==='received'?'#4a9c7a':d.status==='reviewing'?'#c9a96e':'rgba(14,14,13,.35)',textTransform:'uppercase',letterSpacing:'.06em'}}>
                  {d.status==='received'?'✓ OK':d.status==='reviewing'?'Em revisão':'Pendente'}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline + Key Dates */}
          <div style={{animation:'fadeIn .6s ease .3s both'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.2rem',color:'#0e0e0d',marginBottom:'14px'}}>Fases do Processo</div>
            {deal.stages.map((s,i)=>(
              <div className="stage-item" key={s.name}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'20px',flexShrink:0}}>
                  <div style={{width:'14px',height:'14px',borderRadius:'50%',border:`2px solid ${s.done?'#4a9c7a':s.current?'#c9a96e':'rgba(14,14,13,.15)'}`,background:s.done?'#4a9c7a':s.current?'#c9a96e':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {s.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f4f0e6" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  {i<deal.stages.length-1&&<div style={{width:'2px',height:'20px',background:s.done?'#4a9c7a':'rgba(14,14,13,.08)',marginTop:'2px'}}/>}
                </div>
                <div style={{paddingBottom:i<deal.stages.length-1?'0':'0'}}>
                  <div style={{fontSize:'.84rem',fontWeight:s.current?500:400,color:s.current?'#1c4a35':s.done?'rgba(14,14,13,.7)':'rgba(14,14,13,.35)'}}>{s.name}</div>
                  {s.date && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',marginTop:'1px'}}>{s.date}</div>}
                  {s.current && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#c9a96e',marginTop:'2px'}}>← Fase actual</div>}
                </div>
              </div>
            ))}

            <div style={{marginTop:'16px',background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.15)',padding:'14px'}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>Datas Chave</div>
              {deal.keyDates.map((d,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{fontSize:'.82rem',color:'rgba(14,14,13,.65)'}}>{d.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:d.done?'#4a9c7a':'rgba(14,14,13,.5)'}}>{d.done?'✓ ':''}{d.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Contact */}
        <div style={{background:'#0c1f15',padding:'28px',marginBottom:'24px',animation:'fadeIn .6s ease .4s both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'20px',flexWrap:'wrap'}}>
            <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'rgba(201,169,110,.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#c9a96e'}}>{deal.agent.photo}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'4px'}}>O Seu Agente</div>
              <div style={{fontSize:'.95rem',fontWeight:500,color:'#f4f0e6',marginBottom:'2px'}}>{deal.agent.name}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.35)'}}>Agency Group · AMI 22506</div>
            </div>
            <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
              <a href={`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}`} className="dp-btn dp-btn-gold" target="_blank" rel="noopener noreferrer">
                💬 WhatsApp
              </a>
              <a href={`mailto:${deal.agent.email}`} className="dp-btn">
                ✉ Email
              </a>
            </div>
          </div>
        </div>

        {/* Message Agent */}
        {!msgSent ? (
          <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.1)',padding:'24px',animation:'fadeIn .6s ease .5s both'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d',marginBottom:'14px'}}>Enviar Mensagem ao Agente</div>
            <div style={{display:'flex',gap:'10px'}}>
              <input
                className="dp-inp"
                placeholder="A sua pergunta ou mensagem..."
                value={msgText}
                onChange={e=>setMsgText(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&msgText.trim()&&(setMsgSent(true))}
                style={{flex:1}}
              />
              <button
                className="dp-btn"
                onClick={()=>{
                  if(msgText.trim()) {
                    window.open(`https://wa.me/${deal.agent.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(`Deal ${deal.ref} — ${deal.imovel}\n\n${msgText}`)}`)
                    setMsgSent(true)
                  }
                }}
                style={{whiteSpace:'nowrap'}}
              >
                Enviar →
              </button>
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',marginTop:'8px',letterSpacing:'.06em'}}>
              Respondemos em menos de 2 horas · Disponível 7 dias/semana
            </div>
          </div>
        ) : (
          <div style={{background:'rgba(74,156,122,.08)',border:'1px solid rgba(74,156,122,.2)',padding:'20px',textAlign:'center',animation:'fadeIn .4s ease'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:'#4a9c7a',marginBottom:'6px'}}>✓ Mensagem enviada</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.45)'}}>Iremos responder em breve via WhatsApp</div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{background:'#0c1f15',borderTop:'1px solid rgba(201,169,110,.1)',padding:'24px 48px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',letterSpacing:'.3em',textTransform:'uppercase',color:'#c9a96e'}}>Agency Group</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.2)',marginTop:'2px',textTransform:'uppercase',letterSpacing:'.08em'}}>AMI 22506 · agencygroup.pt</div>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.2)',letterSpacing:'.06em'}}>© 2026 Agency Group · Este link é privado e confidencial</div>
      </footer>
    </>
  )
}
