'use client'

import { useState } from 'react'
import { track } from '@/lib/gtm'

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

export default function HomeMortgage() {
  const [montante, setMontante] = useState('')
  const [entrada, setEntrada] = useState(20)
  const [prazo, setPrazo] = useState(30)
  const [spread, setSpread] = useState(1.4)
  const [uso, setUso] = useState<'habitacao_propria'|'investimento'>('habitacao_propria')
  const [rendimento, setRendimento] = useState('')
  const [result, setResult] = useState<MortRes|null>(null)
  const [loading, setLoading] = useState(false)
  const [subTab, setSubTab] = useState<'cenarios'|'amortizacao'>('cenarios')
  const [mortgageError, setMortgageError] = useState<string | null>(null)
  // Lead capture after simulation
  const [simEmail, setSimEmail] = useState('')
  const [simCaptured, setSimCaptured] = useState(false)

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
      if (data.success) {
        setResult(data as MortRes)
        setMortgageError(null)
        track('mortgage_simulated', { montante: body.montante, uso: body.uso })
      }
      else setMortgageError(data.error || 'Erro no cálculo')
    } catch { setMortgageError('Erro de ligação.') }
    finally { setLoading(false) }
  }

  return (
    <div className="home-mtg-grid">
      {/* ── Form ── */}
      <div style={{background:'#fff',borderTop:'2px solid #1c4a35',padding:'32px',boxShadow:'0 12px 56px rgba(14,14,13,.08)'}}>
        <h3 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.35rem',color:'#0e0e0d',marginBottom:'16px',letterSpacing:'-.01em'}}>Simulação · Crédito Habitação</h3>
        {!!mortgageError && <div role="alert" style={{background:'rgba(176,58,46,.08)',border:'1px solid rgba(176,58,46,.25)',color:'#b03a2e',padding:'10px 14px',marginBottom:'14px',fontFamily:"'DM Mono',monospace",fontSize:'.55rem',letterSpacing:'.06em'}}>{mortgageError}</div>}
        {/* Persona presets */}
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'18px'}}>
          {PERSONAS.map(p=>(
            <button key={p.label} type="button" onClick={()=>{
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
          <button type="button" onClick={()=>simulate()} disabled={loading||!montante} style={{width:'100%',padding:'14px',background:'#1c4a35',color:'#f4f0e6',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',cursor:'pointer',fontWeight:400,opacity:loading?0.6:1,marginTop:'8px',transition:'background .25s'}}>
            {loading?'✦ A simular...':'Calcular →'}
          </button>
        </div>
      </div>

      {/* ── Results ── */}
      <div>
        {!result&&!loading&&(
          <div style={{background:'#0c1f15',padding:'40px 36px',position:'relative',overflow:'hidden',minHeight:'420px',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
            <div style={{position:'absolute',top:'-40px',right:'-40px',width:'220px',height:'220px',background:'radial-gradient(circle,rgba(201,169,110,.12) 0%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',bottom:'-30px',left:'-30px',width:'180px',height:'180px',background:'radial-gradient(circle,rgba(28,74,53,.3) 0%,transparent 70%)',pointerEvents:'none'}}/>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.22em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'16px'}}>O QUE VAI DESCOBRIR</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.7rem',color:'#f4f0e6',lineHeight:1.15,marginBottom:'8px'}}>
                A simulação mais<br/><em style={{fontStyle:'italic',color:'#c9a96e'}}>completa de Portugal</em>
              </div>
              <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(244,240,230,.35)',lineHeight:1.7,marginBottom:'28px',maxWidth:'320px'}}>
                Euribor 6M em tempo real · TAEG exacto · 4 cenários de stress-test · Tabela de amortização completa
              </div>
            </div>
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
            {result.acessibilidade&&(
              <div style={{padding:'10px 14px',background:result.acessibilidade.dsti_ok?'rgba(28,74,53,.05)':'rgba(220,38,38,.05)',border:`1px solid ${result.acessibilidade.dsti_ok?'rgba(28,74,53,.18)':'rgba(220,38,38,.18)'}`,borderLeft:`3px solid ${result.acessibilidade.dsti_ok?'#1c4a35':'#dc2626'}`,marginBottom:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:result.acessibilidade.dsti_ok?'#1c4a35':'#dc2626',textTransform:'uppercase',letterSpacing:'.08em'}}>DSTI {result.acessibilidade.dsti_pct}% {result.acessibilidade.dsti_ok?'✓':'⚠'}</div>
                  {result.acessibilidade.poupanca_irs_anual>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#1c4a35'}}>Dedução IRS: {fmtM(result.acessibilidade.poupanca_irs_anual)}/ano</div>}
                </div>
                <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.76rem',color:'rgba(14,14,13,.5)',marginTop:'3px',lineHeight:1.5}}>{result.acessibilidade.nota}</div>
              </div>
            )}
            <div style={{display:'flex',gap:'0',marginBottom:'12px',borderBottom:'1px solid rgba(14,14,13,.1)'}}>
              {(['cenarios','amortizacao'] as const).map(t=>(
                <button key={t} type="button" onClick={()=>setSubTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:`2px solid ${subTab===t?'#c9a96e':'transparent'}`,fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:subTab===t?'#0e0e0d':'rgba(14,14,13,.4)',cursor:'pointer',letterSpacing:'.06em',textTransform:'uppercase',transition:'all .15s'}}>
                  {t==='cenarios'?'Cenários Euribor':'Amortização'}
                </button>
              ))}
              <a href="/portal" style={{marginLeft:'auto',padding:'8px 14px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#c9a96e',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px'}}>Ver análise completa →</a>
            </div>
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
            <div style={{marginTop:'10px',fontFamily:"'Jost',sans-serif",fontSize:'.7rem',color:'rgba(14,14,13,.3)',lineHeight:1.5}}>{result.info?.nota_legal}</div>

            {/* ── Simulator lead capture ── */}
            {!simCaptured ? (
              <div style={{marginTop:'12px',padding:'14px 16px',background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.12)',display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.08em',flexShrink:0}}>Receber análise por email</span>
                <input
                  type="email"
                  value={simEmail}
                  onChange={e=>setSimEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  style={{flex:1,minWidth:'160px',padding:'7px 10px',border:'1px solid rgba(14,14,13,.12)',fontFamily:"'Jost',sans-serif",fontSize:'.78rem',outline:'none',background:'#fff',color:'#0e0e0d'}}
                />
                <button
                  type="button"
                  disabled={!simEmail.includes('@')}
                  onClick={()=>{
                    if(!simEmail.includes('@'))return
                    fetch('/api/leads',{
                      method:'POST',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({
                        email:simEmail.trim(),
                        source:'mortgage_simulator',
                        message:`Simulação: €${result.inputs.montante.toLocaleString('pt-PT')} · ${result.inputs.prazo_anos}a · ${uso}`,
                        budget_max:result.inputs.montante,
                      }),
                    }).catch(()=>{})
                    track('lead_form_submit',{source:'mortgage_simulator'})
                    setSimCaptured(true)
                  }}
                  style={{padding:'7px 14px',background:'#1c4a35',color:'#f4f0e6',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.12em',textTransform:'uppercase',cursor:'pointer',opacity:simEmail.includes('@')?1:0.5}}
                >Enviar →</button>
              </div>
            ) : (
              <div style={{marginTop:'12px',padding:'10px 14px',background:'rgba(28,74,53,.06)',border:'1px solid rgba(28,74,53,.15)',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#1c4a35',letterSpacing:'.06em'}}>✓ Análise enviada — verifique o seu email em breve.</div>
            )}

            {/* ── Post-result CTA — BLOCO 5 ── */}
            <div style={{
              marginTop:'20px',
              padding:'20px 22px',
              background:'#0c1f15',
              display:'flex',
              flexDirection:'column',
              gap:'10px',
            }}>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.15rem',color:'#f4f0e6',lineHeight:1.35}}>
                Prestação de <span style={{color:'#c9a96e',fontWeight:400}}>{fmtM(result.resultado.prestacao_mensal)}/mês</span> —<br />
                quer ver imóveis neste orçamento?
              </div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <a
                  href={`/imoveis?preco=${result.inputs.montante <= 500000 ? '500k-1m' : result.inputs.montante <= 1000000 ? '1m-2m' : result.inputs.montante <= 2000000 ? '2m-4m' : '4m+'}`}
                  style={{
                    display:'inline-flex',alignItems:'center',
                    padding:'10px 18px',
                    background:'#c9a96e',color:'#0c1f15',
                    fontFamily:"'DM Mono',monospace",fontSize:'.5rem',
                    letterSpacing:'.14em',textTransform:'uppercase',
                    textDecoration:'none',fontWeight:400,
                    transition:'opacity .2s',
                  }}
                >
                  Ver Imóveis →
                </a>
                <a
                  href="https://wa.me/351919948986?text=Calculei+a+minha+prestação+no+simulador+da+Agency+Group.+Gostaria+de+falar+com+um+especialista."
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display:'inline-flex',alignItems:'center',
                    padding:'10px 18px',
                    background:'transparent',
                    border:'1px solid rgba(201,169,110,.3)',
                    color:'rgba(244,240,230,.6)',
                    fontFamily:"'DM Mono',monospace",fontSize:'.5rem',
                    letterSpacing:'.14em',textTransform:'uppercase',
                    textDecoration:'none',fontWeight:400,
                  }}
                >
                  Falar com Especialista
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
