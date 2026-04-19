'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type ZoneReport = {
  zona: string; pages: number; updated: string; price_range: string; key_stat: string;
  color: string; emoji: string; highlights: string[]
}
type ThematicReport = {
  title: string; subtitle: string; pages: number; icon: string; tag: string; desc: string
}

interface Props {
  zoneReports: ZoneReport[]
  thematicReports: ThematicReport[]
}

type ModalReport = { name: string; type: 'zone' | 'thematic' } | null

export default function ReportsClient({ zoneReports, thematicReports }: Props) {
  const [modal, setModal] = useState<ModalReport>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const openModal = useCallback((reportName: string, type: 'zone' | 'thematic') => {
    setModal({ name: reportName, type })
    setDone(false)
    setEmail('')
    setName('')
  }, [])

  const closeModal = useCallback(() => {
    setModal(null)
    setDone(false)
  }, [])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!modal) return
    setSending(true)
    try {
      const res = await fetch('/api/reports/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, report: modal.name, type: modal.type }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        // Fallback: open WhatsApp if API fails
        window.open(`https://wa.me/351919948986?text=${encodeURIComponent(`Olá, gostaria de receber o relatório "${modal.name}" da Agency Group. Email: ${email}`)}`, '_blank')
        setDone(true)
      }
    } catch {
      window.open(`https://wa.me/351919948986?text=${encodeURIComponent(`Olá, gostaria de receber o relatório "${modal.name}" da Agency Group. Email: ${email}`)}`, '_blank')
      setDone(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ background: '#0c1f15', minHeight: '100vh', color: '#f4f0e6' }}>

      {/* ── STYLES ─────────────────────────────────────────── */}
      <style>{`
        .rep-burger{display:none;flex-direction:column;justify-content:center;gap:5px;width:44px;height:44px;background:none;border:none;cursor:pointer;padding:10px;z-index:1001;flex-shrink:0}
        .rep-burger span{display:block;width:22px;height:1.5px;background:#c9a96e;transition:transform .3s,opacity .3s}
        .rep-burger.open span:nth-child(1){transform:translateY(6.5px) rotate(45deg)}
        .rep-burger.open span:nth-child(2){opacity:0}
        .rep-burger.open span:nth-child(3){transform:translateY(-6.5px) rotate(-45deg)}
        .rep-drawer{position:fixed;inset:0;z-index:999;pointer-events:none;opacity:0;transition:opacity .3s}
        .rep-drawer.open{pointer-events:all;opacity:1}
        .rep-drawer-ov{position:absolute;inset:0;background:rgba(4,10,6,.6);backdrop-filter:blur(4px)}
        .rep-drawer-panel{position:absolute;top:0;right:0;bottom:0;width:min(320px,85vw);background:#0c1f15;transform:translateX(100%);transition:transform .4s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;padding:80px 36px 48px;border-left:1px solid rgba(201,169,110,.12)}
        .rep-drawer.open .rep-drawer-panel{transform:translateX(0)}
        .rep-drawer-links{display:flex;flex-direction:column;gap:2px;margin-top:8px}
        .rep-drawer-links a{font-family:'Cormorant',serif;font-size:1.8rem;font-weight:300;color:#f4f0e6;letter-spacing:-.01em;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);text-decoration:none;transition:color .2s,padding-left .2s}
        .rep-drawer-links a:hover{color:#c9a96e;padding-left:8px}
        .rep-drawer-links a:last-child{border-bottom:none}
        .rep-drawer-cta{margin-top:auto;background:#c9a96e;color:#0c1f15;font-family:'DM Mono',monospace;font-size:.6rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;padding:16px 24px;text-align:center;text-decoration:none;display:block}
        .rep-nav-links-desktop{display:flex}
        .rep-modal-overlay{position:fixed;inset:0;background:rgba(4,10,6,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)}
        .rep-modal{background:#0c1f15;border:1px solid rgba(201,169,110,.2);max-width:480px;width:100%;padding:48px;position:relative}
        .rep-cta-btn{display:block;background:#c9a96e;color:#0c1f15;text-align:center;padding:12px;font-family:'Jost',sans-serif;font-size:.6rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;cursor:pointer;border:none;width:100%;transition:background .2s}
        .rep-cta-btn:hover{background:#b8935a}
        .rep-ghost-btn{display:block;background:transparent;color:#c9a96e;text-align:center;padding:12px;font-family:'Jost',sans-serif;font-size:.6rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;cursor:pointer;border:1px solid rgba(201,169,110,.35);width:100%;transition:border-color .2s}
        .rep-ghost-btn:hover{border-color:rgba(201,169,110,.7)}
        @media(max-width:960px){
          .rep-burger{display:flex!important}
          .rep-nav-links-desktop{display:none!important}
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(12,31,21,.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: '68px' }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.25rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>Agency<span style={{ color: '#c9a96e' }}>Group</span></Link>
        <div className="rep-nav-links-desktop" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {[['/', 'Início'], ['/imoveis', 'Imóveis'], ['/vender', 'Vender'], ['/investir', 'Investir'], ['/reports', 'Reports']].map(([href, label]) => (
            <Link key={href} href={href} style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: href === '/reports' ? '#c9a96e' : 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>{label}</Link>
          ))}
        </div>
        <button
          className={`rep-burger${menuOpen ? ' open' : ''}`}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          type="button"
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── MOBILE DRAWER ──────────────────────────────────── */}
      <div className={`rep-drawer${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <div className="rep-drawer-ov" onClick={() => setMenuOpen(false)} />
        <div className="rep-drawer-panel">
          <nav className="rep-drawer-links" aria-label="Menu mobile">
            <Link href="/" onClick={() => setMenuOpen(false)}>Início</Link>
            <Link href="/imoveis" onClick={() => setMenuOpen(false)}>Imóveis</Link>
            <Link href="/vender" onClick={() => setMenuOpen(false)}>Vender</Link>
            <Link href="/investir" onClick={() => setMenuOpen(false)}>Investir</Link>
            <Link href="/reports" onClick={() => setMenuOpen(false)}>Reports</Link>
          </nav>
          <Link href="/portal/login" className="rep-drawer-cta" onClick={() => setMenuOpen(false)}>Área Agentes →</Link>
        </div>
      </div>

      {/* ── EMAIL GATE MODAL ──────────────────────────────── */}
      {modal && (
        <div className="rep-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="rep-modal" role="dialog" aria-modal="true" aria-label="Solicitar relatório">
            <button
              type="button"
              onClick={closeModal}
              style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', color: 'rgba(244,240,230,.4)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
              aria-label="Fechar"
            >×</button>

            {done ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '3rem', color: '#c9a96e', fontWeight: 300, marginBottom: '16px' }}>✓</div>
                <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.8rem', color: '#f4f0e6', margin: '0 0 12px' }}>A caminho do seu email</h3>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.7, margin: '0 0 28px' }}>
                  Enviámos o relatório <strong style={{ color: '#f4f0e6' }}>&ldquo;{modal.name}&rdquo;</strong> para {email}. Verifique também a pasta de spam.
                </p>
                <button type="button" onClick={closeModal} className="rep-ghost-btn">Fechar</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', letterSpacing: '.2em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Relatório Gratuito
                </div>
                <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.6rem', color: '#f4f0e6', margin: '0 0 8px', lineHeight: 1.2 }}>{modal.name}</h3>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.45)', margin: '0 0 28px', lineHeight: 1.6 }}>
                  Enviamos o relatório directamente para o seu email. Sem spam, sem compromisso.
                </p>
                <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '6px' }}>Nome</label>
                    <input
                      type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="O seu nome"
                      style={{ width: '100%', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(201,169,110,.2)', color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.8rem', padding: '11px 14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '6px' }}>Email</label>
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com"
                      style={{ width: '100%', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(201,169,110,.2)', color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.8rem', padding: '11px 14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="rep-cta-btn"
                    style={{ marginTop: '8px', opacity: sending ? 0.6 : 1, cursor: sending ? 'not-allowed' : 'pointer' }}
                  >
                    {sending ? 'A enviar...' : 'Receber Relatório Gratuitamente →'}
                  </button>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.2)', textAlign: 'center', margin: 0 }}>
                    RGPD compliant · Sem spam · Cancelar a qualquer momento
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PAGE CONTENT ──────────────────────────────────── */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '128px 40px 96px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Inteligência de Mercado · 2026
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.1 }}>
            Relatórios de Mercado<br/><em>Exclusivos</em>
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', maxWidth: '560px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Análises rigorosas do mercado imobiliário português elaboradas pela equipa de research da Agency Group. Dados actualizados, metodologia transparente.
          </p>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['12', 'Relatórios'], ['2026', 'Dados Actualizados'], ['Gratuito', 'Para Todos']].map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.8rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Reports */}
        <div style={{ marginBottom: '80px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Relatórios por Zona
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {zoneReports.map(r => (
              <ZoneCard key={r.zona} report={r} onRequest={() => openModal(`Mercado ${r.zona} 2026`, 'zone')} />
            ))}
          </div>
        </div>

        {/* Thematic Reports */}
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Relatórios Temáticos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {thematicReports.map(r => (
              <ThematicCard key={r.title} report={r} onRequest={() => openModal(r.title, 'thematic')} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ZoneCard({ report, onRequest }: { report: ZoneReport; onRequest: () => void }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${report.color}40 0%, rgba(12,31,21,.8) 100%)`, border: '1px solid rgba(201,169,110,.12)', padding: '28px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{report.emoji}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '6px' }}>Relatório de Zona</div>
      <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.5rem', color: '#f4f0e6', margin: '0 0 16px' }}>Mercado {report.zona} 2026</h3>
      <div style={{ marginBottom: '20px' }}>
        {report.highlights.map((h, i) => (
          <div key={i} style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', color: 'rgba(244,240,230,.6)', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#c9a96e', fontSize: '.5rem' }}>→</span> {h}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid rgba(201,169,110,.1)' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{report.pages} pág · {report.updated}</div>
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', color: '#c9a96e' }}>{report.key_stat}</div>
      </div>
      <button type="button" onClick={onRequest} className="rep-cta-btn">Descarregar Grátis →</button>
    </div>
  )
}

function ThematicCard({ report, onRequest }: { report: ThematicReport; onRequest: () => void }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(201,169,110,.12)', padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '2rem' }}>{report.icon}</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', background: 'rgba(201,169,110,.08)', padding: '4px 10px', border: '1px solid rgba(201,169,110,.2)' }}>{report.tag}</div>
      </div>
      <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.3rem', color: '#f4f0e6', margin: '0 0 6px' }}>{report.title}</h3>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '16px' }}>{report.subtitle}</div>
      <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.68rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.65, margin: '0 0 20px' }}>{report.desc}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(201,169,110,.1)', marginBottom: '20px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{report.pages} páginas</div>
      </div>
      <button type="button" onClick={onRequest} className="rep-ghost-btn">Solicitar Relatório →</button>
    </div>
  )
}
