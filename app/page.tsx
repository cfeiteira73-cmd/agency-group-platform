'use client'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import PressSection from './components/PressSection'
import { CurrencySelector } from './components/CurrencyWidget'
import { AIPropertySearch } from './components/AIPropertySearch'

gsap.registerPlugin(ScrollTrigger)

// ─── Mortgage Simulator component (homepage — standalone, sem Zustand) ────────

interface MortRes {
  inputs: { montante: number; capital: number; ltv_pct: number; prazo_anos: number; spread_pct: number; tan_pct: number; uso: string }
  resultado: { prestacao_mensal: number; tan_pct: number; taeg_pct: number; total_juros: number; total_pago: number; custo_total_aquisicao: number; imt_estimado: number; is_estimado: number; imi_anual: number; deducao_irs_ano1: number; euribor_6m_pct: number }
  cenarios: { label: string; tan_pct: number; pmt: number }[]
  tabela_amortizacao: { ano: number; prestacao_anual: number; juros: number; amortizacao: number; saldo: number }[]
  acessibilidade: { dsti_pct: number; dsti_ok: boolean; nota: string; poupanca_irs_anual: number } | null
  info: { nota_legal: string; intermediario: string }
}

const fmtM = (n: number) => `€${Math.round(n).toLocaleString('pt-PT')}`

function HomeMortgage() {
  const [montante, setMontante] = useState('')
  const [entrada, setEntrada] = useState(20)
  const [prazo, setPrazo] = useState(30)
  const [spread, setSpread] = useState(1.4)
  const [uso, setUso] = useState<'habitacao_propria'|'investimento'>('habitacao_propria')
  const [rendimento, setRendimento] = useState('')
  const [result, setResult] = useState<MortRes|null>(null)
  const [loading, setLoading] = useState(false)
  const [subTab, setSubTab] = useState<'cenarios'|'amortizacao'>('cenarios')

  const PERSONAS = [
    { label: 'Comprador HPP', montante: '400000', entrada: 20, prazo: 35, spread: 0.9, uso: 'habitacao_propria' as const },
    { label: 'Investidor Premium', montante: '1200000', entrada: 30, prazo: 25, spread: 1.2, uso: 'investimento' as const, rendimento: '60000' },
    { label: 'Estrangeiro NHR', montante: '800000', entrada: 40, prazo: 20, spread: 1.5, uso: 'habitacao_propria' as const },
  ]

  const simulate = async (overrides?: { montante?: string; entrada?: number; prazo?: number; spread?: number; uso?: 'habitacao_propria'|'investimento'; rendimento?: string }) => {
    const m = overrides?.montante ?? montante
    if (!m || Number(m) < 10000) return
    setLoading(true)
    try {
      const body = {
        montante: Number(overrides?.montante ?? montante),
        entrada_pct: overrides?.entrada ?? entrada,
        prazo: overrides?.prazo ?? prazo,
        spread: overrides?.spread ?? spread,
        uso: overrides?.uso ?? uso,
        rendimento_anual: Number(overrides?.rendimento ?? rendimento) || 0,
      }
      const res = await fetch('/api/mortgage', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) setResult(data as MortRes)
      else alert(data.error || 'Erro no cálculo')
    } catch { alert('Erro de ligação.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr',gap:'40px',alignItems:'start'}}>
      {/* ── Form ── */}
      <div style={{background:'#fff',borderTop:'2px solid #1c4a35',padding:'32px',boxShadow:'0 12px 56px rgba(14,14,13,.08)'}}>
        <h3 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.35rem',color:'#0e0e0d',marginBottom:'16px',letterSpacing:'-.01em'}}>Simulação · Crédito Habitação</h3>
        {/* Persona presets */}
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'18px'}}>
          {PERSONAS.map(p=>(
            <button key={p.label} onClick={()=>{
              if(p.montante) setMontante(p.montante)
              setEntrada(p.entrada); setPrazo(p.prazo); setSpread(p.spread); setUso(p.uso)
              if(p.rendimento) setRendimento(p.rendimento)
              simulate({montante:p.montante,entrada:p.entrada,prazo:p.prazo,spread:p.spread,uso:p.uso,rendimento:p.rendimento})
            }} style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',padding:'5px 10px',background:'rgba(28,74,53,.06)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.15)',cursor:'pointer'}}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{display:'grid',gap:'14px'}}>
          <div>
            <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:'5px'}}>Valor do Imóvel (€)</label>
            <input type="number" value={montante} onChange={e=>setMontante(e.target.value)} placeholder="ex: 500000" style={{width:'100%',padding:'10px 0',border:'none',borderBottom:'1.5px solid rgba(14,14,13,.15)',fontFamily:"'Jost',sans-serif",fontSize:'1rem',outline:'none',color:'#0e0e0d',boxSizing:'border-box',background:'transparent',transition:'border-color .2s'}} />
          </div>
          <div>
            <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:'5px'}}>Entrada — {entrada}% {montante&&Number(montante)>0?`(${fmtM(Number(montante)*entrada/100)})`:''}  </label>
            <input type="range" min={10} max={80} value={entrada} onChange={e=>setEntrada(Number(e.target.value))} style={{width:'100%',accentColor:'#1c4a35'}} />
          </div>
          <div>
            <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:'5px'}}>Prazo — {prazo} anos</label>
            <input type="range" min={5} max={40} value={prazo} onChange={e=>setPrazo(Number(e.target.value))} style={{width:'100%',accentColor:'#1c4a35'}} />
          </div>
          <div>
            <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:'5px'}}>Spread — {spread.toFixed(2)}%</label>
            <input type="range" min={0.5} max={3} step={0.05} value={spread} onChange={e=>setSpread(Number(e.target.value))} style={{width:'100%',accentColor:'#1c4a35'}} />
          </div>
          <div>
            <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:'5px'}}>Finalidade</label>
            <select value={uso} onChange={e=>setUso(e.target.value as 'habitacao_propria'|'investimento')} style={{width:'100%',padding:'10px 0',border:'none',borderBottom:'1.5px solid rgba(14,14,13,.15)',fontFamily:"'Jost',sans-serif",fontSize:'.88rem',outline:'none',background:'transparent',color:'#0e0e0d',appearance:'none',cursor:'pointer'}}>
              <option value="habitacao_propria">Habitação Própria Permanente</option>
              <option value="investimento">Investimento / 2ª Habitação</option>
            </select>
          </div>
          <div>
            <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:'5px'}}>Rendimento Anual (€) — DSTI</label>
            <input type="number" value={rendimento} onChange={e=>setRendimento(e.target.value)} placeholder="ex: 80000 — opcional" style={{width:'100%',padding:'10px 0',border:'none',borderBottom:'1.5px solid rgba(14,14,13,.15)',fontFamily:"'Jost',sans-serif",fontSize:'1rem',outline:'none',color:'#0e0e0d',boxSizing:'border-box',background:'transparent',transition:'border-color .2s'}} />
          </div>
          <button onClick={()=>simulate()} disabled={loading||!montante} style={{width:'100%',padding:'14px',background:'#1c4a35',color:'#f4f0e6',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',cursor:'pointer',fontWeight:400,opacity:loading?0.6:1,marginTop:'8px',transition:'background .25s'}}>
            {loading?'✦ A simular...':'Calcular →'}
          </button>
        </div>
      </div>

      {/* ── Results ── */}
      <div>
        {!result&&!loading&&(
          <div style={{background:'#0c1f15',padding:'40px 36px',position:'relative',overflow:'hidden',minHeight:'420px',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
            {/* Ambient glow */}
            <div style={{position:'absolute',top:'-40px',right:'-40px',width:'220px',height:'220px',background:'radial-gradient(circle,rgba(201,169,110,.12) 0%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',bottom:'-30px',left:'-30px',width:'180px',height:'180px',background:'radial-gradient(circle,rgba(28,74,53,.3) 0%,transparent 70%)',pointerEvents:'none'}}/>
            {/* Top */}
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.22em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'16px'}}>O QUE VAI DESCOBRIR</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.7rem',color:'#f4f0e6',lineHeight:1.15,marginBottom:'8px'}}>
                A simulação mais<br/><em style={{fontStyle:'italic',color:'#c9a96e'}}>completa de Portugal</em>
              </div>
              <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(244,240,230,.35)',lineHeight:1.7,marginBottom:'28px',maxWidth:'320px'}}>
                Euribor 6M em tempo real · TAEG exacto · 4 cenários de stress-test · Tabela de amortização completa
              </div>
            </div>
            {/* Feature cards */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'28px'}}>
              {[
                {icon:'◆',label:'Prestação mensal',sub:'TAN + TAEG exacto'},
                {icon:'◇',label:'IMT + IS + IMI',sub:'Custo total de aquisição'},
                {icon:'◈',label:'4 cenários Euribor',sub:'Bear · Base · Bull · Mínimo'},
                {icon:'▲',label:'Amortização 30 anos',sub:'Tabela anual completa'},
              ].map(f=>(
                <div key={f.label} style={{padding:'14px 16px',background:'rgba(244,240,230,.04)',border:'1px solid rgba(244,240,230,.08)'}}>
                  <div style={{fontSize:'.95rem',marginBottom:'5px'}}>{f.icon}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.8)',letterSpacing:'.04em',marginBottom:'2px'}}>{f.label}</div>
                  <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.72rem',color:'rgba(244,240,230,.3)'}}>{f.sub}</div>
                </div>
              ))}
            </div>
            {/* Bottom DSTI note */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.12)'}}>
              <span style={{fontSize:'1rem',flexShrink:0}}>✦</span>
              <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.76rem',color:'rgba(244,240,230,.4)',lineHeight:1.5}}>
                Introduz o rendimento anual para obter o <strong style={{color:'rgba(201,169,110,.7)'}}>DSTI</strong> — verificação Banco de Portugal e dedução IRS habitação própria
              </div>
            </div>
          </div>
        )}
        {loading&&(
          <div style={{padding:'64px 24px',textAlign:'center',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.06)'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#1c4a35',letterSpacing:'.2em'}}>✦ A simular...</div>
          </div>
        )}
        {result&&(
          <div>
            {/* Main metric */}
            <div style={{padding:'22px 26px',background:'#0c1f15',marginBottom:'12px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px'}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.5)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:'5px'}}>Prestação Mensal</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',fontWeight:400,color:'var(--gold)',lineHeight:1}}>{fmtM(result.resultado.prestacao_mensal)}</div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.5)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:'5px'}}>TAN</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',fontWeight:300,color:'var(--cr)',lineHeight:1}}>{result.resultado.tan_pct}%</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.4)',marginTop:'2px'}}>Euribor {result.resultado.euribor_6m_pct}%</div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.5)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:'5px'}}>TAEG</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',fontWeight:300,color:'var(--cr)',lineHeight:1}}>{result.resultado.taeg_pct}%</div>
              </div>
            </div>
            {/* Key metrics */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'12px'}}>
              {[
                {l:'Capital',v:result.inputs.capital},
                {l:'Total Juros',v:result.resultado.total_juros},
                {l:'Total Pago',v:result.resultado.total_pago},
                {l:'IMT + IS',v:result.resultado.imt_estimado+result.resultado.is_estimado},
                {l:'IMI / Ano',v:result.resultado.imi_anual},
                {l:'Custo Total',v:result.resultado.custo_total_aquisicao,gold:true},
              ].map(m=>(
                <div key={m.l} style={{padding:'10px 12px',background:'#fff',border:'1px solid rgba(14,14,13,.07)',textAlign:'center'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.45)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'3px'}}>{m.l}</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'.95rem',fontWeight:600,color:(m as {gold?:boolean}).gold?'#c9a96e':'#0e0e0d'}}>{fmtM(m.v)}</div>
                </div>
              ))}
            </div>
            {/* DSTI */}
            {result.acessibilidade&&(
              <div style={{padding:'10px 14px',background:result.acessibilidade.dsti_ok?'rgba(28,74,53,.05)':'rgba(220,38,38,.05)',border:`1px solid ${result.acessibilidade.dsti_ok?'rgba(28,74,53,.18)':'rgba(220,38,38,.18)'}`,borderLeft:`3px solid ${result.acessibilidade.dsti_ok?'#1c4a35':'#dc2626'}`,marginBottom:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:result.acessibilidade.dsti_ok?'#1c4a35':'#dc2626',textTransform:'uppercase',letterSpacing:'.08em'}}>DSTI {result.acessibilidade.dsti_pct}% {result.acessibilidade.dsti_ok?'✓':'⚠'}</div>
                  {result.acessibilidade.poupanca_irs_anual>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#1c4a35'}}>Dedução IRS: {fmtM(result.acessibilidade.poupanca_irs_anual)}/ano</div>}
                </div>
                <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.76rem',color:'rgba(14,14,13,.5)',marginTop:'3px',lineHeight:1.5}}>{result.acessibilidade.nota}</div>
              </div>
            )}
            {/* Sub-tabs */}
            <div style={{display:'flex',gap:'0',marginBottom:'12px',borderBottom:'1px solid rgba(14,14,13,.1)'}}>
              {(['cenarios','amortizacao'] as const).map(t=>(
                <button key={t} onClick={()=>setSubTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:`2px solid ${subTab===t?'#c9a96e':'transparent'}`,fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:subTab===t?'#0e0e0d':'rgba(14,14,13,.4)',cursor:'pointer',letterSpacing:'.06em',textTransform:'uppercase',transition:'all .15s'}}>
                  {t==='cenarios'?'Cenários Euribor':'Amortização'}
                </button>
              ))}
              <a href="/portal" style={{marginLeft:'auto',padding:'8px 14px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#c9a96e',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px'}}>Ver análise completa →</a>
            </div>
            {/* Cenários */}
            {subTab==='cenarios'&&(
              <div style={{display:'grid',gap:'6px'}}>
                {result.cenarios.map((c,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#fff',border:'1px solid rgba(14,14,13,.07)'}}>
                    <div>
                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'#0e0e0d',marginBottom:'1px'}}>{c.label}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)'}}>TAN {c.tan_pct}%</div>
                    </div>
                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',fontWeight:400,color:i===0?'var(--gold)':i===1?'#dc2626':'var(--g)'}}>{fmtM(c.pmt)}<span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.4)',fontWeight:400}}>/mês</span></div>
                  </div>
                ))}
              </div>
            )}
            {/* Amortização */}
            {subTab==='amortizacao'&&(
              <div style={{overflowX:'auto',maxHeight:'320px',overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontFamily:"'Jost',sans-serif",fontSize:'.78rem'}}>
                  <thead style={{position:'sticky',top:0}}>
                    <tr style={{background:'rgba(28,74,53,.06)'}}>
                      {['Ano','Prestação','Juros','Amort.','Saldo'].map(h=>(
                        <th key={h} style={{padding:'7px 10px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:400,borderBottom:'1px solid rgba(14,14,13,.08)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.tabela_amortizacao.map((row,i)=>(
                      <tr key={row.ano} style={{background:i%2===0?'#fff':'rgba(14,14,13,.01)',borderBottom:'1px solid rgba(14,14,13,.04)'}}>
                        <td style={{padding:'6px 10px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)'}}>{row.ano}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#0e0e0d'}}>{fmtM(row.prestacao_anual)}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#dc2626'}}>{fmtM(row.juros)}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#1c4a35'}}>{fmtM(row.amortizacao)}</td>
                        <td style={{padding:'6px 10px',textAlign:'right',color:'#0e0e0d',fontWeight:600}}>{fmtM(row.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Nota legal */}
            <div style={{marginTop:'10px',fontFamily:"'Jost',sans-serif",fontSize:'.7rem',color:'rgba(14,14,13,.3)',lineHeight:1.5}}>{result.info?.nota_legal}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [slideIdx, setSlideIdx] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isAgent, setIsAgent] = useState(false)
  const [agModal, setAgModal] = useState(false)
  const [agEmailVal, setAgEmailVal] = useState('')
  const [agSent, setAgSent] = useState(false)
  const [agSending, setAgSending] = useState(false)
  const [cpcvDeals, setCpcvDeals] = useState([
    { id:1, ref:'AG-2026-001', imovel:'Villa Quinta da Marinha · Cascais', valor:'€ 3.800.000', fase:'CPCV Assinado', pct:60, cor:'#c9a96e', data:'15 Jan 2026' },
    { id:2, ref:'AG-2026-002', imovel:'Penthouse Chiado · Lisboa', valor:'€ 2.100.000', fase:'Due Diligence', pct:40, cor:'#4a9c7a', data:'22 Jan 2026' },
    { id:3, ref:'AG-2026-003', imovel:'Herdade Comporta', valor:'€ 6.500.000', fase:'Proposta Aceite', pct:25, cor:'#3a7bd5', data:'28 Jan 2026' },
  ])
  const loaderRef = useRef<HTMLDivElement>(null)
  const gsapInitRef = useRef(false)

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

    // Redirected from /portal (session expired or no cookie) → redirect to portal
    if (params.get('acesso') === 'required') {
      window.location.href = '/portal'
    }
  }, [])

  // ═══ CURSOR + KEYBOARD (runs every mount — works correctly with StrictMode) ═══
  useEffect(() => {
    const dot = document.getElementById('cDot')
    const ring = document.getElementById('cRing')
    if (!dot || !ring) return
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
    document.querySelectorAll('.hl,.market-section,.mq,.ag-section,.test-section,.cred-section,.nhr-section,.cpcv-section').forEach(el => {
      el.addEventListener('mouseenter',()=>document.body.classList.add('on-dark'))
      el.addEventListener('mouseleave',()=>document.body.classList.remove('on-dark'))
    })
    // Zone cards — custom expanded cursor with zone name
    const cTxt = document.getElementById('cTxt')
    document.querySelectorAll('.zc').forEach(el => {
      const nome = el.querySelector('.zc-nm')?.textContent || ''
      el.addEventListener('mouseenter', () => {
        if (cTxt) cTxt.textContent = nome
        document.body.classList.add('on-zone')
        document.body.classList.remove('hovering', 'on-dark')
      })
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('on-zone')
      })
    })
    const onKey = (e:KeyboardEvent) => {
      if (e.key==='Escape') {
        setModalOpen(false)
        document.body.style.overflow=''
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // ═══ GSAP (guarded with ref — runs once per component instance, skips StrictMode second mount) ═══
  useEffect(() => {
    if (gsapInitRef.current) return   // StrictMode second run: GSAP still alive, skip re-init
    gsapInitRef.current = true
    let cancelled = false
    // LOADER
    document.body.style.overflow = 'hidden'
    const loader = loaderRef.current
    if (!loader) return
    const loaderEl = loader
    function finishLoader() {
      if (loaderEl.classList.contains('done')) return
      loaderEl.classList.add('done')
      document.body.style.overflow = ''
      setTimeout(heroEntrance, 150)
      setTimeout(() => { if (loaderRef.current) loaderRef.current.style.display = 'none' }, 1200)
    }
    // Safety: force loader out after 4500ms (cinematic loader needs breathing room)
    const ldrSafetyTimer = setTimeout(finishLoader, 4500)
    // Loader — cinematic luxury entrance
    gsap.set('#ldrA', { y: 40, opacity: 0, filter: 'blur(8px)' })
    gsap.set('#ldrG', { y: 40, opacity: 0, filter: 'blur(8px)' })
    gsap.set('#ldrFill', { scaleX: 0, transformOrigin: 'left center' })
    gsap.set('#ldrTxt', { opacity: 0, y: 12 })
    const ldrTL = gsap.timeline({
      onComplete: () => { clearTimeout(ldrSafetyTimer); finishLoader() }
    })
    ldrTL
      .to('#ldrA', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' })
      .to('#ldrG', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' }, '-=0.45')
      .to('#ldrFill', { scaleX: 1, duration: 1.2, ease: 'power3.out' }, '-=0.4')
      .to('#ldrTxt', { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.9')
      .to(loader, { opacity: 0, duration: 0.6, ease: 'power2.inOut', delay: 0.3 })

    // HERO ENTRANCE
    function heroEntrance() {
      // Set initial hidden states (CSS no longer has them — progressive enhancement)
      gsap.set('.hero-h1 .line-inner', { y: '115%' })
      gsap.set('#hSub', { opacity: 0, y: 36, filter: 'blur(4px)' })
      gsap.set('#hBtns', { opacity: 0, y: 32 })
      gsap.set('#hStats', { opacity: 0, y: 24 })
      gsap.set('#hScroll', { opacity: 0, y: 12 })
      gsap.set('#searchBox', { opacity: 0, y: 28 })
      const tl = gsap.timeline()
      tl.fromTo('#hEye',
          { clipPath: 'inset(0 100% 0 0)' },
          { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power4.out' })
        .to('.hero-h1 .line-inner', { y: 0, duration: 1.1, stagger: 0.14, ease: 'power4.out' }, '-=0.55')
        .to('#hSub', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }, '-=0.4')
        .to('#hBtns', { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' }, '-=0.35')
        .to('#hStats', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.5')
        .to('#searchBox', { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' }, '-=0.5')
        .to('#hScroll', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.3')
      // Hero stat counters — count up after entrance (varied durations = luxury weight)
      ;[
        { sel: '#hStats > div:nth-child(1) .hs-n', to: 169, pre: '', suf: 'K', dur: 2.6 },
        { sel: '#hStats > div:nth-child(2) .hs-n', to: 17, pre: '+', suf: '%', dur: 2.0 },
        { sel: '#hStats > div:nth-child(3) .hs-n', to: 44, pre: '', suf: '%', dur: 2.2 },
      ].forEach(({ sel, to, pre, suf, dur }, i) => {
        const el = document.querySelector<HTMLElement>(sel)
        if (!el) return
        const obj = { n: 0 }
        gsap.to(obj, {
          n: to, duration: dur, ease: 'expo.out', delay: 1.4 + i * 0.18,
          onUpdate() { el.innerHTML = `${pre}${Math.round(obj.n)}<em>${suf}</em>` }
        })
      })
    }

    // MARKET BARS DOM — build before GSAP context so elements exist when animated
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
    if (mktEl && !mktEl.hasChildNodes()) {
      ZONES_MKT.forEach(z => {
        const d = document.createElement('div')
        d.className = 'mkt-row'
        d.innerHTML = `<span class="mkt-nm">${z.n}</span><div class="mkt-bar"><div class="mkt-fill" style="width:${z.w*100}%"></div></div><span class="mkt-pm2">${z.pm2}</span><span class="mkt-yoy">${z.yoy}</span>`
        mktEl.appendChild(d)
      })
    }

    // ALL SCROLLTRIGGER ANIMATIONS — deferred one frame so DOM is painted
    // try-catch prevents StrictMode double-invoke crash from bubbling to error boundary
    let ctx: gsap.Context | null = null
    const stRafId = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        ctx = gsap.context(() => {
          // SCROLL PROGRESS
          gsap.to('#pgb', { scaleX:1, ease:'none', scrollTrigger:{ trigger: document.body, start:'top top', end:'bottom bottom', scrub:0.5 }})
          // NAV SOLID
          ScrollTrigger.create({
            start: 90,
            onEnter: () => document.getElementById('mainNav')?.classList.add('solid'),
            onLeaveBack: () => document.getElementById('mainNav')?.classList.remove('solid'),
          })
          // Set initial states programmatically (CSS no longer hides these — progressive enhancement)
          gsap.set('.text-reveal-inner', { y: '102%' })
          gsap.set('.clip-reveal', { clipPath: 'inset(0 100% 0 0)' })
          gsap.set('.fade-in', { opacity: 0, y: 48 })
          // TEXT REVEALS — grouped by heading for stagger
          document.querySelectorAll('.sec-h2,.mkt-h2,.ag-h2').forEach(heading => {
            const lines = heading.querySelectorAll('.text-reveal-inner')
            if (!lines.length) return
            gsap.fromTo(lines, { y: '115%' }, { y:0, duration:1.1, stagger:0.11, ease:'power4.out', scrollTrigger:{ trigger:heading, start:'top 80%', once:true }})
          })
          document.querySelectorAll('.text-reveal').forEach(el => {
            const inner = el.querySelector('.text-reveal-inner')
            if (!inner) return
            if ((el.closest('.sec-h2,.mkt-h2,.ag-h2'))) return // already handled above
            gsap.fromTo(inner, { y: '102%' }, { y:0, duration:1.1, ease:'power4.out', scrollTrigger:{ trigger:el, start:'top 82%', once:true }})
          })
          // CLIP REVEALS
          document.querySelectorAll('.clip-reveal').forEach(el => {
            gsap.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath:'inset(0 0% 0 0)', duration:1.2, ease:'power4.inOut', scrollTrigger:{ trigger:el, start:'top 85%', once:true }})
          })
          // FADE IN
          document.querySelectorAll('.fade-in').forEach((el, i) => {
            const delay = Math.min(i * 0.05, 0.25)
            gsap.fromTo(el, { opacity:0, y:48 }, { opacity:1, y:0, duration:1.0, ease:'power3.out', delay, scrollTrigger:{ trigger:el, start:'top 84%', once:true }})
          })
          // IMÓVEIS CLIP-PATH REVEAL
          document.querySelectorAll<HTMLElement>('.imc').forEach((card, i) => {
            const revEl = card.querySelector('.imc-img-reveal')
            if (!revEl) return
            gsap.timeline({ scrollTrigger:{ trigger:card, start:'top 80%', once:true, onEnter:()=>card.classList.add('revealed') }})
              .fromTo(revEl,
                { clipPath:'inset(0 0 0% 0)' },
                { clipPath:'inset(0 0 100% 0)', duration:1.2, delay: Math.min(i * 0.1, 0.3), ease:'power4.inOut' })
          })
          // ZONAS STAGGER
          if (document.querySelector('.zc') && document.querySelector('.zonas-grid')) {
            gsap.fromTo('.zc',
              { clipPath:'inset(0 0 100% 0)', opacity:0 },
              { clipPath:'inset(0 0 0% 0)', opacity:1, duration:1.1, stagger:{ amount:0.7, from:'start' }, ease:'power4.inOut',
                scrollTrigger:{ trigger:'.zonas-grid', start:'top 78%', once:true } })
          }
          // MARKET BARS ANIMATION
          if (document.querySelector('.mkt-zones')) {
            gsap.set('.mkt-fill', { scaleX: 0, transformOrigin: 'left' })
            gsap.to('.mkt-fill', { scaleX:1, duration:1.4, stagger:0.08, ease:'power3.out', scrollTrigger:{ trigger:'.mkt-zones', start:'top 80%', once:true }})
          }
          // CREDENCIAIS — override the .fade-in set above
          if (document.querySelector('.cred-grid')) {
            gsap.fromTo('.cred-c', { opacity:0, y:56 }, { opacity:1, y:0, duration:1.1, stagger:0.1, ease:'power3.out', scrollTrigger:{ trigger:'.cred-grid', start:'top 82%', once:true }})
          }
          // NUMBER COUNTERS — credenciais
          ;[
            { sel: '.cred-c:nth-child(1) .cred-n', to: 169, pre: '', suf: 'K' },
            { sel: '.cred-c:nth-child(2) .cred-n', to: 17, pre: '+', suf: '%' },
            { sel: '.cred-c:nth-child(3) .cred-n', to: 44, pre: '', suf: '%' },
          ].forEach(({ sel, to, pre, suf }) => {
            const el = document.querySelector<HTMLElement>(sel)
            if (!el) return
            const obj = { n: 0 }
            gsap.to(obj, {
              n: to, duration: 2.8, ease: 'power4.out',
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
              onUpdate() { el.innerHTML = `${pre}${Math.round(obj.n)}<sup>${suf}</sup>` }
            })
          })
          // Counter animation for credenciais
          const credNumbers = document.querySelectorAll<HTMLElement>('.cred-n')
          credNumbers.forEach((el) => {
            const text = el.innerText || el.textContent || ''
            const numMatch = text.match(/[\d.]+/)
            if (!numMatch) return
            const target = parseFloat(numMatch[0])
            const isDecimal = numMatch[0].includes('.')
            ScrollTrigger.create({
              trigger: el,
              start: 'top 85%',
              once: true,
              onEnter: () => {
                const sup = el.querySelector('sup')?.outerHTML || ''
                gsap.fromTo({ val: 0 }, { val: target }, {
                  duration: 1.8,
                  ease: 'power2.out',
                  onUpdate: function() {
                    const v = isDecimal ? this.targets()[0].val.toFixed(1) : Math.round(this.targets()[0].val)
                    el.innerHTML = v + sup
                  }
                })
              }
            })
          })
          // MAGNETIC BUTTONS
          document.querySelectorAll<HTMLElement>('.btn-gold, .btn-outline').forEach(btn => {
            btn.addEventListener('mousemove', (e: MouseEvent) => {
              const r = btn.getBoundingClientRect()
              gsap.to(btn, { x: (e.clientX-r.left-r.width/2)*0.22, y: (e.clientY-r.top-r.height/2)*0.22, duration: 0.35, ease: 'power3.out', overwrite: 'auto' })
            })
            btn.addEventListener('mouseleave', () => {
              gsap.to(btn, { x: 0, y: 0, duration: 0.85, ease: 'elastic.out(0.75,0.4)', overwrite: 'auto' })
            })
          })
          // ZONE CARDS — mousemove image parallax (GSAP owns transform — CSS transform removed)
          document.querySelectorAll<HTMLElement>('.zc').forEach(card => {
            const bg = card.querySelector<HTMLElement>('.zc-bg')
            if (!bg) return
            card.addEventListener('mousemove', (e: MouseEvent) => {
              const r = card.getBoundingClientRect()
              gsap.to(bg, { x: ((e.clientX-r.left)/r.width-0.5)*22, y: ((e.clientY-r.top)/r.height-0.5)*22, scale: 1.06, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
            })
            card.addEventListener('mouseleave', () => {
              gsap.to(bg, { x: 0, y: 0, scale: 1, duration: 1.1, ease: 'power3.out', overwrite: 'auto' })
            })
          })
          // FONTS READY — final refresh after all triggers registered
          document.fonts.ready.then(() => {
            if (!cancelled) requestAnimationFrame(() => { if (!cancelled) ScrollTrigger.refresh() })
          })
        })
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[GSAP] ScrollTrigger init error (StrictMode):', e)
        }
      }
    })

    return () => {
      cancelled = true
      gsapInitRef.current = false   // allow re-init after StrictMode cleanup
      clearTimeout(ldrSafetyTimer)
      cancelAnimationFrame(stRafId)
      ctx?.revert()
      document.body.style.overflow = ''
      ldrTL.kill()
    }
  }, [])

  // HERO SLIDESHOW
  useEffect(() => {
    const timer = setInterval(() => setSlideIdx(s => (s+1)%3), 6500)
    return () => clearInterval(timer)
  }, [])

  // ═══ MODAL ═══
  function openModal() { setModalOpen(true); document.body.style.overflow='hidden'; setTimeout(()=>document.getElementById('offPwd')?.focus(),300) }
  function closeModal() { setModalOpen(false); document.body.style.overflow='' }
  async function checkOff() {
    const input = document.getElementById('offPwd') as HTMLInputElement
    const code = input?.value ?? ''
    try {
      const res = await fetch('/api/auth/offmarket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const { valid } = await res.json()
      if (valid) {
        closeModal()
        localStorage.setItem('ag_offmarket', '1')
        alert('✅ Acesso concedido. Portfolio off-market a carregar...')
      } else {
        const err = document.getElementById('offErr')
        if (err) err.style.display = 'block'
        if (input) input.value = ''
      }
    } catch {
      const err = document.getElementById('offErr')
      if (err) err.style.display = 'block'
      if (input) input.value = ''
    }
  }

  // ═══ PROPERTIES DATA ═══
  const PROPERTIES = [
    { id: 'rev0', feat: true, badge: 'b-off', bl: 'Off-Market', zona: 'Cascais', zonaLabel: 'Cascais · Quinta da Marinha', tipo: 'Moradia', titulo: 'Villa Contemporânea com Piscina Infinita e Vista Mar', specs: ['5 Quartos', '620 m²', 'Piscina Infinita', 'Vista Mar', '3 Garagens', 'EPC A'], preco: 3800000, precoLabel: '€ 3.800.000', pm2: '€6.129/m²', quartos: 5, grad: 'linear-gradient(145deg,#1c3d28,#0b1a10 55%,#3d8b68 100%)', photo: '/properties/villa-cascais.jpg' },
    { id: 'rev1', feat: false, badge: 'b-new', bl: 'Novo', zona: 'Lisboa', zonaLabel: 'Lisboa · Chiado', tipo: 'Apartamento', titulo: 'Penthouse com Terraço e Vista Rio Tejo', specs: ['4 Quartos', '280 m²', 'Vista Rio', 'EPC A'], preco: 2100000, precoLabel: '€ 2.100.000', pm2: '€7.500/m²', quartos: 4, grad: 'linear-gradient(145deg,#0c2030,#060e18 60%,#1c4a35 100%)', photo: '/properties/penthouse-lisboa.jpg' },
    { id: 'rev2', feat: false, badge: 'b-exc', bl: 'Exclusivo', zona: 'Comporta', zonaLabel: 'Comporta · Grândola', tipo: 'Quinta', titulo: 'Herdade Privada nos Arrozais da Comporta', specs: ['6 Quartos', '850 m²', '12 hectares', 'Piscina'], preco: 6500000, precoLabel: '€ 6.500.000', pm2: '€7.647/m²', quartos: 6, grad: 'linear-gradient(145deg,#2e2009,#140e05 60%,#c9a96e 100%)', photo: '/properties/quinta-comporta.jpg' },
    { id: 'rev3', feat: false, badge: null, bl: null, zona: 'Cascais', zonaLabel: 'Abóboda · Cascais', tipo: 'Moradia', titulo: 'Moradia Contemporânea Nova Construção · Design Premium', specs: ['3 Quartos', '113 m²', 'Nova Construção'], preco: 1400000, precoLabel: '€ 1.400.000', pm2: '€12.389/m²', quartos: 3, grad: 'linear-gradient(145deg,#1a3a26,#081510 60%,#2d6a4f 100%)', photo: '/properties/moradia-cascais.jpg' },
    { id: 'rev4', feat: false, badge: null, bl: null, zona: 'Ericeira', zonaLabel: "Ericeira · Ribeira d'Ilhas", tipo: 'Apartamento', titulo: 'Duplex Vista Mar · World Surf Reserve · Ericeira', specs: ['3 Quartos', '189 m²', 'Vista Mar'], preco: 679000, precoLabel: '€ 679.000', pm2: '€3.593/m²', quartos: 3, grad: 'linear-gradient(145deg,#081e1e,#040f0f 60%,#1c4a35 100%)', photo: '/properties/duplex-ericeira.jpg' },
    { id: 'rev5', feat: false, badge: 'b-new', bl: 'Novo', zona: 'Oeiras', zonaLabel: 'Oeiras · Av. República', tipo: 'Apartamento', titulo: 'T4 Reabilitado com Terraço · Potencial Premium', specs: ['4 Quartos', '111 m²', 'Exclusividade 6M'], preco: 520000, precoLabel: '€ 520.000', pm2: '€4.685/m²', quartos: 4, grad: 'linear-gradient(145deg,#0a1828,#05090f 60%,#2d4a6a 100%)', photo: '/properties/apartamento-oeiras.jpg' },
  ]

  // ═══ SEARCH STATE ═══
  const [searchZona, setSearchZona] = useState('')
  const [searchTipo, setSearchTipo] = useState('')
  const [searchPreco, setSearchPreco] = useState('')
  const [searchQuartos, setSearchQuartos] = useState('')
  // ═══ AI SEARCH STATE ═══
  const [searchMode, setSearchMode] = useState<'filtros'|'ai'>('filtros')
  const [naturalQuery, setNaturalQuery] = useState('')
  const [aiResults, setAiResults] = useState<typeof PROPERTIES|null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState('')

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

  // ═══ UTIL ═══
  function doSearch() { document.getElementById('imoveis')?.scrollIntoView({behavior:'smooth'}) }
  async function doAiSearch() {
    if (!naturalQuery.trim() || aiLoading) return
    setAiLoading(true); setAiResults(null); setAiSummary('')
    try {
      const res = await fetch('/api/properties/search-natural', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:naturalQuery})})
      const d = await res.json()
      const matched = (d.matches||[]).map((m:{id:string})=>PROPERTIES.find(p=>p.id===m.id)).filter(Boolean) as typeof PROPERTIES
      setAiResults(matched); setAiSummary(d.searchSummary||'')
    } catch { setAiResults([]) }
    finally { setAiLoading(false); document.getElementById('imoveis')?.scrollIntoView({behavior:'smooth'}) }
  }
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
    { badge:'b-off', label:'Off-Market', titulo:'Villa Contemporânea\nQuinta da Marinha · Cascais', preco:'€ 3.800.000', specs:'5 Qtos · 620m² · Vista Mar', num:'01', grad:'linear-gradient(140deg,#1a3a26,#0b1a10 50%,#2d6a4f 100%)', photo:'/slides/slide1.jpg' },
    { badge:'b-new', label:'Novo', titulo:'Penthouse Panorâmica\nChiado · Lisboa', preco:'€ 2.100.000', specs:'4 Qtos · 280m² · Vista Rio', num:'02', grad:'linear-gradient(140deg,#0c2030,#060e18 50%,#1c4a35 100%)', photo:'/slides/slide2.jpg' },
    { badge:'b-exc', label:'Exclusivo', titulo:'Herdade Privada\nComporta · Grândola', preco:'€ 6.500.000', specs:'6 Qtos · 850m² · 12 ha', num:'03', grad:'linear-gradient(140deg,#2e2009,#150f04 50%,#c9a96e 100%)', photo:'/slides/slide3.jpg' },
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
      <div id="cur"><div className="c-dot" id="cDot"></div><div className="c-ring" id="cRing"><span className="c-txt" id="cTxt"></span></div></div>
      <div id="pgb"></div>

      {/* MODAL OFF-MARKET */}
      <div className={`modal-ov${modalOpen?' open':''}`} id="offModal" onClick={e=>{if(e.target===e.currentTarget)closeModal()}}>
        <div className="modal-box">
          <button className="modal-x" onClick={closeModal}>✕</button>
          <div className="modal-eye">Acesso Restrito</div>
          <h2 className="modal-h2">Portfolio<br/><em style={{fontStyle:'italic',color:'var(--g)'}}>Off-Market</em></h2>
          <p className="modal-desc">As propriedades mais raras nunca chegam aos portais. Este portfolio existe apenas para quem foi convidado.</p>
          <input className="modal-inp" type="password" id="offPwd" placeholder="código de acesso" onKeyDown={e=>{if(e.key==='Enter')checkOff()}}/>
          <button className="modal-btn" onClick={checkOff}>Aceder ao Portfolio</button>
          <div className="modal-err" id="offErr">Código inválido · Solicitar acesso: geral@agencygroup.pt</div>
        </div>
      </div>

      {/* MODAL ÁREA AGENTES — nunca abre, código inactivo */}
      {agModal && (
        <div style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(12,31,21,.92)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={closeAgModal}>
          <div style={{background:'#0c1f15',border:'1px solid rgba(201,169,110,.18)',padding:'52px 44px',maxWidth:'420px',width:'100%',position:'relative',boxShadow:'0 40px 100px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}>
            <button onClick={closeAgModal} style={{position:'absolute',top:'18px',right:'18px',background:'none',border:'none',color:'rgba(244,240,230,.3)',cursor:'pointer',fontSize:'1rem',lineHeight:1,padding:'4px 8px'}}>✕</button>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.22em',textTransform:'uppercase',color:'rgba(201,169,110,.65)',marginBottom:'8px'}}>Acesso Restrito · AMI 22506</div>
            <h2 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.9rem',color:'#f4f0e6',lineHeight:1.1,marginBottom:'6px'}}>Portal do<br/><em style={{fontStyle:'italic',color:'#c9a96e'}}>Consultor</em></h2>
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
            <div style={{marginTop:'28px',paddingTop:'16px',borderTop:'1px solid rgba(244,240,230,.05)',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.25)',letterSpacing:'.1em',textTransform:'uppercase'}}>
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
          <li><a href="#simulador">Crédito</a></li>
          <li><a href="/reports" style={{color:'var(--gold)'}}>Reports</a></li>
          <li><a href="#" onClick={e=>{e.preventDefault();openModal()}}>Off-Market</a></li>
          <li><a href="#contacto">Contacto</a></li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CurrencySelector />
          {isAgent
            ? <a href={(() => { try { const d = JSON.parse(localStorage.getItem('ag_auth')||'{}'); return d.token ? `/portal?token=${encodeURIComponent(d.token)}` : '/portal' } catch { return '/portal' } })()} className="nav-cta">Portal →</a>
            : <a href="/portal" className="nav-cta">Área Agentes</a>
          }
          <button
            className={`nav-burger${menuOpen?' open':''}`}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen(o => !o); document.body.style.overflow = menuOpen ? '' : 'hidden' }}
          >
            <span/><span/><span/>
          </button>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <div className={`nav-drawer${menuOpen?' open':''}`} aria-hidden={!menuOpen}>
        <div className="nav-drawer-ov" onClick={() => { setMenuOpen(false); document.body.style.overflow = '' }} />
        <nav className="nav-drawer-panel" aria-label="Menu móvel">
          <div className="nav-drawer-links">
            <a href="/imoveis" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Imóveis</a>
            <a href="#zonas" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Zonas</a>
            <a href="#simulador" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Crédito</a>
            <a href="/reports" style={{color:'var(--gold)'}} onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Reports</a>
            <a href="#" onClick={e=>{e.preventDefault();setMenuOpen(false);document.body.style.overflow='';openModal()}}>Off-Market</a>
            <a href="#contacto" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Contacto</a>
          </div>
          {isAgent
            ? <a href="/portal" className="nav-drawer-cta">Portal Agentes →</a>
            : <a href="/portal" className="nav-drawer-cta">Área Agentes</a>
          }
        </nav>
      </div>

      {/* HERO */}
      <section className="hero" role="region" aria-label="Imóveis em destaque" aria-live="polite">
        <div className="hl">
          <div className="hl-bg"></div>
          <div className="hl-grain"></div>
          <div className="hero-content">
            <div className="hero-eyebrow" id="hEye">Lisboa · Portugal · AMI 22506</div>
            <h1 className="hero-h1" id="hTitle">
              <span className="line"><span className="line-inner">Aqui, o mundo</span></span>
              <span className="line"><span className="line-inner"><em>veio ter</em></span></span>
              <span className="line"><span className="line-inner">consigo.</span></span>
            </h1>
            <p className="hero-sub" id="hSub">Da Comporta a Cascais. Do Chiado ao Algarve. Imóveis que raramente chegam ao mercado — para quem chegou primeiro.</p>
            <div className="hero-btns" id="hBtns">
              <a href="#imoveis" className="btn-gold">Descobrir Portfolio<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
              <a href="#avaliacao" className="btn-outline">Avaliação Privada →</a>
            </div>
          </div>
          <div className="hero-stats" id="hStats">
            <div><div className="hs-n">169<em>K</em></div><div className="hs-l">Transacções 2025</div></div>
            <div><div className="hs-n">+17<em>%</em></div><div className="hs-l">Valorização · 2025</div></div>
            <div><div className="hs-n">44<em>%</em></div><div className="hs-l">Compradores Internacionais</div></div>
          </div>
          <div className="hero-scroll" id="hScroll" aria-label="Scroll para explorar">
            <div className="hs-line"></div>
            <div className="hs-txt">↓</div>
          </div>
        </div>
        <aside className="hr">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/hero-poster.jpg"
            aria-hidden="true"
            src="/hero-video.mp4"
            style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
          />
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

      {/* AI PROPERTY SEARCH — Sofia NLP */}
      <div className="sw" style={{ paddingTop: '40px', paddingBottom: '0' }}>
        <AIPropertySearch />
      </div>

      {/* SEARCH */}
      <div className="search-wrap">
        <div className="search-box" id="searchBox">
          {/* Tabs — inside the box, no overlap with marquee */}
          <div className="search-tabs">
            <button className={`search-tab${searchMode==='filtros'?' active':''}`} onClick={()=>{setSearchMode('filtros');setAiResults(null);setAiSummary('')}}>⊞ Filtros</button>
            <button className={`search-tab${searchMode==='ai'?' active':''}`} onClick={()=>setSearchMode('ai')}>✦ Linguagem Natural</button>
          </div>
          {/* Fields */}
          {searchMode==='filtros' ? (
            <div className="search-fields">
              <div className="sf" style={{flex:2}}>
                <label className="sf-lbl">Localização</label>
                <input className="sf-inp" type="text" id="sfQ" placeholder="Lisboa, Cascais, Comporta..." value={searchZona} onChange={e=>{setSearchZona(e.target.value)}}/>
              </div>
              <div className="sf"><label className="sf-lbl">Tipo</label><select className="sf-sel" value={searchTipo} onChange={e=>setSearchTipo(e.target.value)}><option value="">Todos</option><option value="Apartamento">Apartamento</option><option value="Moradia">Moradia</option><option value="Villa">Villa</option><option value="Penthouse">Penthouse</option><option value="Quinta">Quinta</option></select></div>
              <div className="sf"><label className="sf-lbl">Preço</label><select className="sf-sel" value={searchPreco} onChange={e=>setSearchPreco(e.target.value)}><option value="">Qualquer</option><option value="500-1000">€500K–€1M</option><option value="1000-2500">€1M–€2.5M</option><option value="2500-5000">€2.5M–€5M</option><option value="5000-999999">€5M+</option></select></div>
              <div className="sf"><label className="sf-lbl">Quartos (mín.)</label><select className="sf-sel" value={searchQuartos} onChange={e=>setSearchQuartos(e.target.value)}><option value="">Todos</option><option value="1">T1+</option><option value="2">T2+</option><option value="3">T3+</option><option value="4">T4+</option><option value="5">T5+</option></select></div>
              <button className="sf-btn" onClick={doSearch}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Descobrir</button>
            </div>
          ) : (
            <div className="search-fields" style={{gap:'16px',alignItems:'flex-end',padding:'18px 24px'}}>
              <div style={{flex:1}}>
                <label className="sf-lbl" style={{letterSpacing:'.12em'}}>Descreve o imóvel que imaginas</label>
                <input className="sf-inp" type="text" placeholder='"T3 vista mar em Cascais, até €2M"' value={naturalQuery} onChange={e=>setNaturalQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doAiSearch()} style={{width:'100%'}}/>
              </div>
              <button className="sf-btn" onClick={doAiSearch} disabled={aiLoading} style={{opacity:aiLoading?.65:1,whiteSpace:'nowrap',flexShrink:0}}>
                {aiLoading ? '✦ A analisar...' : '✦ Descobrir'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ZONAS */}
      <section className="zonas-section" id="zonas">
        <div className="sw">
          <div className="zonas-head">
            <div>
              <div className="sec-eye"><span className="clip-reveal" data-reveal="left">9 Zonas · Portugal &amp; Espanha</span></div>
              <h2 className="sec-h2" id="zonasH2">
                <span className="text-reveal"><span className="text-reveal-inner">Os lugares</span></span>
                <span className="text-reveal"><span className="text-reveal-inner"><em>que o mundo cobiça</em></span></span>
              </h2>
            </div>
            <a href="#imoveis" className="lnk-sm fade-in">Ver todos →</a>
          </div>
          <div className="zonas-grid">
            {[
              {c:'z1',nome:'Lisboa',pais:'Portugal',pm2:'€6.538/m²',yoy:'+19%',tag:'The city that reinvented itself',photo:'/zones/lisboa.jpg'},
              {c:'z2',nome:'Cascais',pais:'Portugal',pm2:'€6.638/m²',yoy:'+14%',tag:'Where old money meets the Atlantic',photo:'/zones/cascais.jpg'},
              {c:'z3',nome:'Comporta',pais:'Portugal',pm2:'€11.000/m²',yoy:'+28%',tag:"Europe's last unhurried place",photo:'/zones/comporta.jpg'},
              {c:'z4',nome:'Porto',pais:'Portugal',pm2:'€4.528/m²',yoy:'+12%',tag:'The river that seduces everyone',photo:'/zones/porto.jpg'},
              {c:'z5',nome:'Algarve',pais:'Portugal',pm2:'€5.200/m²',yoy:'+10%',tag:'300 mornings of light',photo:'/zones/algarve.jpg'},
              {c:'z6',nome:'Madeira',pais:'Portugal',pm2:'€3.760/m²',yoy:'+20%',tag:'The island that needs nothing',photo:'/zones/madeira.jpg'},
              {c:'z7',nome:'Sintra',pais:'Portugal',pm2:'€3.600/m²',yoy:'+13%',tag:'Where history forgot to leave',photo:'/zones/sintra.jpg'},
              {c:'z8',nome:'Arrábida',pais:'Portugal',pm2:'€4.500/m²',yoy:'+19%',tag:'The coast nobody found yet',photo:'/zones/arrabida.jpg'},
              {c:'z9',nome:'Ericeira',pais:'Portugal',pm2:'€3.200/m²',yoy:'+15%',tag:'World surf reserve. Naturally',photo:'/zones/ericeira.jpg'},
            ].map(z=>(
              <a key={z.c} href={`/zonas/${z.nome.toLowerCase()}`} className={`zc ${z.c}`} onClick={(e)=>{e.preventDefault();filterZ(z.nome)}}>
                <div className="zc-bg" style={{backgroundImage:`url(${z.photo})`}}></div><div className="zc-ov"></div><div className="zc-clip-overlay"></div>
                <div className="zc-c">
                  <div className="zc-id">{z.nome} · {z.pais}</div>
                  <h3 className="zc-nm">{z.nome}</h3>
                  <div className="zc-data"><span className="zc-pm2">{z.pm2}</span><span className="zc-yoy">{z.yoy}</span></div>
                  <div className="zc-tag">{z.tag}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET STATS TICKER ── */}
      <div style={{background:'#0c1f15',borderTop:'1px solid rgba(201,169,110,.1)',borderBottom:'1px solid rgba(201,169,110,.1)',overflow:'hidden',padding:'0',position:'relative'}}
        onMouseEnter={e=>{const t=e.currentTarget.querySelector('div') as HTMLElement;if(t)t.style.animationPlayState='paused'}}
        onMouseLeave={e=>{const t=e.currentTarget.querySelector('div') as HTMLElement;if(t)t.style.animationPlayState='running'}}
      >
        <div style={{display:'flex',alignItems:'center',animation:'tickerScroll 40s linear infinite',whiteSpace:'nowrap',gap:'0'}}>
          {[
            {label:'Mercado PT 2026',value:'+17.6%',desc:'Valorização média'},
            {label:'Transacções',value:'169.812',desc:'Vendas totais'},
            {label:'Preço Mediana',value:'€3.076/m²',desc:'Portugal'},
            {label:'Lisboa Prime',value:'€7.500/m²',desc:'Chiado · Príncipe Real'},
            {label:'Cascais',value:'€6.638/m²',desc:'Quinta da Marinha'},
            {label:'Comporta',value:'€11.000/m²',desc:'Zona mais valorizada'},
            {label:'Algarve',value:'€5.200/m²',desc:'+10% YoY'},
            {label:'Madeira',value:'€3.760/m²',desc:'+44% tendência'},
            {label:'Top 5 Mundial',value:'Lisboa',desc:'Savills Luxury 2026'},
            {label:'Compradores int.',value:'44%',desc:'Mercados prime'},
            {label:'NHR/IFICI',value:'10 anos',desc:'Isenção fiscal'},
            {label:'IMT HPP isenção',value:'€97K',desc:'Limiar 2026'},
            // repeat for smooth loop
            {label:'Mercado PT 2026',value:'+17.6%',desc:'Valorização média'},
            {label:'Transacções',value:'169.812',desc:'Vendas totais'},
            {label:'Lisboa Prime',value:'€7.500/m²',desc:'Chiado · Príncipe Real'},
            {label:'Comporta',value:'€11.000/m²',desc:'Zona mais valorizada'},
          ].map((s,i)=>(
            <div key={i} style={{display:'inline-flex',alignItems:'center',gap:'20px',padding:'14px 32px',borderRight:'1px solid rgba(201,169,110,.1)',flexShrink:0}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(201,169,110,.6)',letterSpacing:'.1em',textTransform:'uppercase'}}>{s.label}</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1rem',fontWeight:600,color:'#c9a96e',lineHeight:1}}>{s.value}</div>
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.4)',letterSpacing:'.06em'}}>{s.desc}</div>
            </div>
          ))}
        </div>
        <style>{`@keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      </div>

      {/* IMÓVEIS */}
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
              <button onClick={() => { setSearchZona(''); setSearchTipo(''); setSearchPreco(''); setSearchQuartos(''); setAiResults(null); setNaturalQuery(''); setSearchMode('filtros'); setAiSummary('') }}
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
              <button onClick={() => setModalOpen(true)} style={{ marginTop: '24px', background: 'transparent', color: '#c9a96e', border: '1px solid rgba(201,169,110,.45)', padding: '12px 32px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Aceder ao Portfolio Off-Market →
              </button>
            </div>
          ) : (
            <div className="im-grid">
              {displayedProperties.map(im=>(
                <div key={im.id} className={`imc${im.feat?' feat':''}`}>
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
              Ver o Portfolio Completo
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </section>

      {/* SIMULADOR DE CRÉDITO — versão completa (cenários, amortização, DSTI) */}
      <section id="simulador" style={{background:'#f4f0e6',padding:'112px 0',borderBottom:'1px solid rgba(14,14,13,.08)'}}>
        <div className="sw">
          <div style={{marginBottom:'40px'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'10px'}}>Simulação · Crédito Habitação · Portugal</div>
            <h2 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'clamp(2.2rem,4vw,4rem)',color:'#0e0e0d',lineHeight:1.05,marginBottom:'12px',letterSpacing:'-.012em'}}>A Verdade <em style={{fontStyle:'italic',color:'#1c4a35'}}>Sobre o Crédito</em></h2>
            <p style={{fontFamily:"'Jost',sans-serif",fontSize:'.86rem',lineHeight:1.8,color:'rgba(14,14,13,.5)',maxWidth:'560px'}}>Euribor 6M em tempo real · TAEG Newton-Raphson · 4 cenários stress-test · Tabela amortização · DSTI Banco de Portugal · IMT + IS incluído</p>
          </div>
          <HomeMortgage />
        </div>
      </section>

      {/* MARKET DATA */}
      <section className="market-section" id="mercado">
        <div className="sw">
          <div className="mkt-grid">
            <div>
              <div className="mkt-eye">Dados de Mercado · INE · Savills · Knight Frank</div>
              <h2 className="mkt-h2" id="mktH2">
                <span className="text-reveal"><span className="text-reveal-inner">O mercado que</span></span>
                <span className="text-reveal"><span className="text-reveal-inner">o mundo <em>escolheu.</em></span></span>
              </h2>
              <p className="mkt-desc fade-in">169.812 transacções em 2025. Lisboa no top 5 mundial de luxo (Savills 2026). Valorização +17.6%. Previsão 2026: +4 a +5.9% — INE · Knight Frank.</p>
              <div className="fade-in">
                {['44% dos compradores nos mercados prime são internacionais','Lisboa entre as 5 cidades de luxo mais valorizadas do mundo','Valorização prevista +4 a +5.9% em 2026 — INE · Savills · Knight Frank','Avaliação proprietária com margem de 4–7%. A mais precisa do mercado.'].map(t=>(
                  <div key={t} className="mkt-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>{t}</div>
                ))}
              </div>
            </div>
            <div className="mkt-zones fade-in" id="mktZones"></div>
          </div>
        </div>
      </section>

      {/* ── Market CTA ── */}
      <div style={{background:'#f4f0e6',padding:'32px 0',textAlign:'center',borderBottom:'1px solid rgba(14,14,13,.06)'}}>
        <a href="#imoveis" style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',color:'#1c4a35',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:'8px',transition:'gap .25s var(--ease-out)'}}
          onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.gap='14px'}
          onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.gap='8px'}
        >
          Explorar o Portfolio →
        </a>
      </div>

      {/* BLOCO 2 — Avaliação Privada */}
      <section id="avaliacao" style={{background:'#f4f0e6',padding:'112px 0',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg, transparent, rgba(201,169,110,.6), transparent)'}}/>
        <div className="sw" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'80px',alignItems:'center'}}>

          {/* LEFT — Text */}
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'28px'}}>Avaliação Privada · Dados Reais · Sem Estimativas</div>
            <h2 style={{fontFamily:"'Cormorant',serif",fontSize:'clamp(2.4rem,4vw,4rem)',fontWeight:300,color:'#0e0e0d',lineHeight:1.08,margin:'0 0 28px',letterSpacing:'-.01em'}}>
              O seu imóvel vale<br/>quanto vale.<br/><em style={{fontStyle:'italic',color:'#1c4a35'}}>Não mais. Não menos.</em>
            </h2>
            <p style={{fontFamily:"'Jost',sans-serif",fontSize:'.92rem',fontWeight:300,color:'rgba(14,14,13,.55)',lineHeight:1.78,marginBottom:'40px',maxWidth:'400px'}}>
              Avaliação proprietária calibrada com dados INE 2025 e transacções reais. Reservado a proprietários e investidores qualificados.
            </p>
            <a
              href="https://wa.me/351919948986?text=Gostaria+de+solicitar+uma+avalia%C3%A7%C3%A3o+privada+do+meu+im%C3%B3vel."
              target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:'12px',padding:'16px 40px',background:'#1c4a35',color:'#f4f0e6',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.18em',textTransform:'uppercase',textDecoration:'none',fontWeight:400}}
            >
              Pedir Avaliação Privada
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.35)',letterSpacing:'.1em',marginTop:'12px'}}>
              ✓ ±4.2% precisão mediana · calibrado com 847 transacções Q1 2026
            </div>
          </div>

          {/* RIGHT — Formulário simples */}
          <div style={{background:'#fff',padding:'48px',boxShadow:'0 24px 80px rgba(14,14,13,.10),0 4px 16px rgba(14,14,13,.06)',borderTop:'2px solid var(--g)'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'28px'}}>Pedido de Avaliação · Confidencial</div>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {[{id:'avalNome',label:'Nome',placeholder:'O seu nome'},
                {id:'avalTel',label:'Telefone',placeholder:'+351 9XX XXX XXX'},
                {id:'avalZona',label:'Zona',placeholder:'Ex: Lisboa, Cascais, Comporta...'}
              ].map(f=>(
                <div key={f.id}>
                  <label style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.5)',display:'block',marginBottom:'6px'}}>{f.label}</label>
                  <input id={f.id} placeholder={f.placeholder} style={{width:'100%',padding:'12px 0',border:'none',borderBottom:'1px solid rgba(14,14,13,.18)',fontFamily:"'Jost',sans-serif",fontSize:'.88rem',color:'#0e0e0d',outline:'none',background:'transparent',boxSizing:'border-box',transition:'border-color .3s'}}/>
                </div>
              ))}
              <button
                onClick={()=>{
                  const nome=(document.getElementById('avalNome') as HTMLInputElement)?.value||''
                  const tel=(document.getElementById('avalTel') as HTMLInputElement)?.value||''
                  const zona=(document.getElementById('avalZona') as HTMLInputElement)?.value||''
                  if(!nome||!tel){alert('Por favor preenche o nome e telefone.');return}
                  window.open(`https://wa.me/351919948986?text=${encodeURIComponent(`Pedido de avaliação privada:\nNome: ${nome}\nTelefone: ${tel}\nZona: ${zona}`)}`, '_blank')
                }}
                style={{marginTop:'8px',padding:'14px',background:'#1c4a35',color:'#f4f0e6',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',cursor:'pointer',fontWeight:400,transition:'background .25s,transform .2s'}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';(e.currentTarget as HTMLButtonElement).style.background='#16382a'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';(e.currentTarget as HTMLButtonElement).style.background='#1c4a35'}}
              >
                Pedir Avaliação Privada →
              </button>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.35)',letterSpacing:'.06em',textTransform:'uppercase',textAlign:'center'}}>Resposta em menos de 2 horas · 100% confidencial</div>
            </div>
          </div>
        </div>
      </section>

      {/* BLOCO 3 — Viver e Investir em Portugal · Editorial 2 colunas */}
      <section style={{background:'#0c1f15',minHeight:'560px',display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'hidden',position:'relative'}}>

        {/* LEFT — Lifestyle image simulation: mesa de jantar em Comporta */}
        <div style={{position:'relative',minHeight:'560px',overflow:'hidden'}}>
          {/* Warm terracotta/clay afternoon light */}
          <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg, #1a0e08 0%, #3d1f0d 25%, #7a4020 45%, #c4844a 62%, #e8b87a 72%, #c99850 82%, #241005 100%)'}}/>
          <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(ellipse 70% 50% at 45% 55%, rgba(232,184,122,.25) 0%, transparent 65%)',mixBlendMode:'overlay'}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to right, transparent 60%, rgba(12,31,21,.95) 100%)'}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to top, rgba(12,31,21,.7) 0%, transparent 50%)'}}/>
          <div style={{position:'absolute',bottom:'32px',left:'32px'}}>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',fontWeight:300,color:'rgba(244,240,230,.6)',fontStyle:'italic'}}>
              "Quinta-feira à noite.<br/>Mesa em Comporta.<br/>20% flat. Para sempre."
            </div>
          </div>
        </div>

        {/* RIGHT — Text + bullets + CTA */}
        <div style={{display:'flex',flexDirection:'column',justifyContent:'center',padding:'80px 64px'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(201,169,110,.7)',marginBottom:'28px'}}>NHR · IFICI · Residência Fiscal · Portugal</div>
          <h2 style={{fontFamily:"'Cormorant',serif",fontSize:'clamp(2.2rem,3.8vw,3.8rem)',fontWeight:300,color:'#f4f0e6',lineHeight:1.05,margin:'0 0 28px',letterSpacing:'-.012em'}}>
            Dez Anos de<br/>Liberdade Fiscal.<br/><em style={{fontStyle:'italic',color:'#c9a96e'}}>Uma Vida Nova.</em>
          </h2>
          <div style={{width:'36px',height:'1px',background:'rgba(201,169,110,.4)',marginBottom:'28px'}}/>
          <div style={{display:'flex',flexDirection:'column',gap:'18px',marginBottom:'44px'}}>
            {[
              '20% de taxa flat durante 10 anos — para quem escolhe Portugal como casa.',
              'Os seus rendimentos internacionais trabalham para si. Não para o Estado.',
              'A melhor qualidade de vida da Europa. Com a fiscalidade mais competitiva.',
            ].map((t,i)=>(
              <div key={i} style={{display:'flex',gap:'16px',alignItems:'flex-start'}}>
                <div style={{width:'20px',height:'20px',border:'1px solid rgba(201,169,110,.35)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'2px'}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" width="10"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.85rem',color:'rgba(244,240,230,.5)',lineHeight:1.65,fontWeight:300}}>{t}</span>
              </div>
            ))}
          </div>
          <a
            href="https://wa.me/351919948986?text=Gostaria+de+falar+com+o+vosso+consultor+fiscal+sobre+NHR%2FIFICI."
            target="_blank" rel="noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:'12px',padding:'16px 36px',background:'transparent',border:'1px solid rgba(201,169,110,.4)',color:'#c9a96e',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',textDecoration:'none',fontWeight:400,width:'fit-content'}}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Falar com o Consultor Fiscal
          </a>
        </div>
      </section>

      {/* ACESSO PRIVADO — Private Client · Split editorial */}
      <section style={{background:'#070f0a',minHeight:'640px',position:'relative',overflow:'hidden',display:'grid',gridTemplateColumns:'1fr 1fr'}}>

        {/* LEFT — Editorial photo simulation: villa ao pôr do sol */}
        <div style={{position:'relative',minHeight:'640px',overflow:'hidden'}}>
          {/* Golden hour base */}
          <div style={{position:'absolute',inset:0,background:'linear-gradient(160deg, #0c0802 0%, #1a0e03 20%, #3d2008 45%, #c9862a 65%, #e8a84e 78%, #b87520 88%, #050300 100%)'}}/>
          {/* Villa silhouette overlay */}
          <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(ellipse 80% 40% at 50% 68%, rgba(201,134,42,.35) 0%, transparent 60%)',mixBlendMode:'screen'}}/>
          {/* Atmosphere haze */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:'55%',background:'linear-gradient(to top, rgba(7,15,10,.95) 0%, transparent 100%)'}}/>
          {/* Top vignette */}
          <div style={{position:'absolute',top:0,left:0,right:0,height:'30%',background:'linear-gradient(to bottom, rgba(7,15,10,.7) 0%, transparent 100%)'}}/>
          {/* Editorial label */}
          <div style={{position:'absolute',bottom:'36px',left:'36px',right:'36px'}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(201,169,110,.7)',marginBottom:'8px'}}>Comporta · Herdade Privada · Off-Market</div>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',fontWeight:300,color:'rgba(244,240,230,.75)',fontStyle:'italic',lineHeight:1.2}}>
              "Os imóveis mais extraordinários<br/>nunca chegam ao mercado."
            </div>
          </div>
        </div>

        {/* RIGHT — Text + CTA */}
        <div style={{display:'flex',flexDirection:'column',justifyContent:'center',padding:'80px 64px',position:'relative'}}>
          {/* Subtle grid */}
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(201,169,110,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,169,110,.025) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}}/>

          <div style={{position:'relative'}}>
            {/* Eyebrow */}
            <div style={{display:'inline-flex',alignItems:'center',gap:'10px',padding:'6px 18px',border:'1px solid rgba(201,169,110,.22)',marginBottom:'40px'}}>
              <div style={{width:'5px',height:'5px',background:'#c9a96e',borderRadius:'50%'}}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(201,169,110,.8)'}}>Off-Market · By Invitation Only</span>
            </div>

            {/* Title */}
            <h2 style={{fontFamily:"'Cormorant',serif",fontSize:'clamp(2.8rem,4.5vw,4.8rem)',fontWeight:300,color:'#f4f0e6',lineHeight:1.03,margin:'0 0 6px',letterSpacing:'-.01em'}}>Acesso</h2>
            <h2 style={{fontFamily:"'Cormorant',serif",fontSize:'clamp(2.8rem,4.5vw,4.8rem)',fontWeight:300,color:'#f4f0e6',lineHeight:1.03,margin:'0 0 32px',letterSpacing:'-.01em',fontStyle:'italic'}}>Privado</h2>

            {/* Divider */}
            <div style={{width:'40px',height:'1px',background:'rgba(201,169,110,.4)',marginBottom:'32px'}}/>

            {/* Subtitle */}
            <p style={{fontFamily:"'Jost',sans-serif",fontSize:'.9rem',fontWeight:300,color:'rgba(244,240,230,.38)',lineHeight:1.8,marginBottom:'48px',maxWidth:'340px'}}>
              As propriedades mais extraordinárias<br/>nunca chegam ao mercado público.<br/>Chegam apenas a quem já conhecemos.
            </p>

            {/* CTA */}
            <button
              onClick={()=>window.location.href='/portal'}
              style={{display:'inline-flex',alignItems:'center',gap:'14px',padding:'17px 44px',background:'transparent',border:'1px solid rgba(201,169,110,.42)',color:'#c9a96e',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.18em',textTransform:'uppercase',cursor:'pointer',transition:'all .25s',fontWeight:400,width:'fit-content'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(201,169,110,.09)';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(201,169,110,.75)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(201,169,110,.42)'}}
            >
              Pedir Acesso Exclusivo
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>

            {/* Bottom note */}
            <div style={{marginTop:'52px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.1em',color:'rgba(244,240,230,.22)',textTransform:'uppercase'}}>Agency Group · AMI 22506 · Acesso restrito</div>
          </div>
        </div>
      </section>

      {/* CREDENCIAIS */}
      <section className="cred-section">
        <div className="cred-grid">
          <div className="cred-c fade-in"><div className="cred-n">169<sup>K</sup></div><div className="cred-l">Transacções em Portugal</div><div className="cred-d">O mercado mais activo da história.</div></div>
          <div className="cred-c fade-in"><div className="cred-n">+17<sup>%</sup></div><div className="cred-l">Valorização 2025</div><div className="cred-d">Quarto máximo histórico consecutivo.</div></div>
          <div className="cred-c fade-in"><div className="cred-n">44<sup>%</sup></div><div className="cred-l">Compradores Internacionais</div><div className="cred-d">O mundo descobriu Portugal.</div></div>
          <div className="cred-c fade-in"><div className="cred-n">Top<sup>5</sup></div><div className="cred-l">Luxo Mundial</div><div className="cred-d">Lisboa. As 5 melhores do mundo.</div></div>
        </div>
      </section>

      {/* ── Credenciais CTA ── */}
      <div style={{background:'#0c1f15',padding:'40px 0',textAlign:'center',borderTop:'1px solid rgba(201,169,110,.08)'}}>
        <a href="https://wa.me/351919948986?text=Bom%20dia%2C%20gostaria%20de%20falar%20com%20um%20consultor." target="_blank" rel="noreferrer"
          style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',color:'#c9a96e',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:'10px',border:'1px solid rgba(201,169,110,.3)',padding:'13px 32px',transition:'all .25s'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(201,169,110,.08)';(e.currentTarget as HTMLAnchorElement).style.borderColor='rgba(201,169,110,.6)'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='transparent';(e.currentTarget as HTMLAnchorElement).style.borderColor='rgba(201,169,110,.3)'}}
        >
          Falar com um Consultor
          <svg viewBox="0 0 24 24" fill="currentColor" width="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
      </div>

      {/* AGENTES */}
      <section className="ag-section" id="agentes">
        <div className="ag-inner">
          <div className="ag-eye">Acesso Restrito · AMI 22506</div>
          <h2 className="ag-h2">Portal do Consultor</h2>
          <p className="ag-sub">Pipeline · CRM · Deal Radar · Relatórios · Off-Market.</p>
          <div className="ag-form">
            <a href="/portal" className="ag-btn" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',textDecoration:'none'}}>Aceder ao Portal →</a>
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

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="test-section" style={{
        background: '#070f0a',
        borderTop: '1px solid rgba(201,169,110,.08)',
        padding: '112px 40px',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.24em', color: 'rgba(201,169,110,.7)',
              textTransform: 'uppercase', marginBottom: '16px',
            }}>47 Famílias · 14 Nacionalidades · 4.9/5</div>
            <h2 style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#f4f0e6',
              margin: '0 0 8px',
            }}>Eles chegaram.</h2>
            <h2 style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300, fontStyle: 'italic',
              fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#c9a96e',
              margin: 0,
            }}>Eles ficaram.</h2>
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
                quote: 'Três semanas. Villa de sonho. Escritura assinada. Nunca pensámos que seria tão simples — nem que Cascais seria para sempre.',
                property: 'Villa T5 · Cascais · €2.4M',
                date: 'Janeiro 2026',
              },
              {
                name: 'Mohammed Al-Rashidi',
                country: '🇸🇦 Arábia Saudita',
                zone: 'Lisboa',
                rating: 5,
                quote: 'Penthouse no Príncipe Real como investimento. O retorno superou todas as projecções. Lisboa está a crescer — e nós estamos dentro.',
                property: 'Penthouse T4 · Lisboa · €3.1M',
                date: 'Dezembro 2025',
              },
              {
                name: 'Chen Wei & Li Ming',
                country: '🇨🇳 China',
                zone: 'Comporta',
                rating: 5,
                quote: 'A Comporta era o nosso sonho. Encontraram a propriedade certa. Trataram de tudo. No dia da escritura, soubemos que tínhamos chegado.',
                property: 'Quinta T6 · Comporta · €5.2M',
                date: 'Novembro 2025',
              },
              {
                name: 'Marc & Isabelle Fontaine',
                country: '🇫🇷 França',
                zone: 'Porto',
                rating: 5,
                quote: 'Investidores há 15 anos. Nunca trabalhámos com uma equipa assim. 5.1% de rentabilidade no primeiro ano. O Porto foi a melhor decisão.',
                property: 'Apartamento T3 · Porto · €890K',
                date: 'Outubro 2025',
              },
              {
                name: 'Robert & Anna Schneider',
                country: '🇩🇪 Alemanha',
                zone: 'Algarve',
                rating: 5,
                quote: 'Comparámos 6 agências. Escolhemos a Agency Group. A villa no Algarve é exactamente o que imaginámos — e o processo foi impecável.',
                property: 'Villa T5 · Algarve · €1.8M',
                date: 'Setembro 2025',
              },
              {
                name: 'David & Rachel Goldstein',
                country: '🇺🇸 Estados Unidos',
                zone: 'Madeira',
                rating: 5,
                quote: 'Viemos para a Madeira com o NHR. Trataram de tudo — imóvel, advogado, escola para os filhos. Hoje dizemos que a vida começou aqui.',
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
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
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
                      fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                      letterSpacing: '.1em', color: 'rgba(244,240,230,.4)',
                    }}>{t.country} · {t.zone}</div>
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
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
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
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
            Falar Agora
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="ft-inner">
          <div className="ft-top">
            <div><div className="ft-la">Agency</div><div className="ft-lg">Group</div><p className="ft-tag">Portugal. Para quem não aceita menos.</p></div>
            <div className="ft-col"><div className="ft-col-h">Zonas</div><ul><li><a href="#">Lisboa</a></li><li><a href="#">Cascais</a></li><li><a href="#">Comporta</a></li><li><a href="#">Porto</a></li><li><a href="#">Algarve</a></li><li><a href="#">Madeira</a></li></ul></div>
            <div className="ft-col"><div className="ft-col-h">Serviços</div><ul><li><a href="#" onClick={e=>{e.preventDefault();openModal()}}>Off-Market</a></li><li><a href="/portal">Portal Agentes</a></li><li><a href="#contacto">NHR / Vistos</a></li><li><a href="#simulador">Simulador IMT</a></li></ul></div>
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
