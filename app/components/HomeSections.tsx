// ─── HomeSections — Shared RSC sections (marquee → footer) ────────────────────
// Pure React Server Component — NO 'use client'.
// Consumed by BOTH the desktop page (app/page.tsx) and MobileHome.tsx.
// All interactive islands inside are client components imported here;
// Next.js handles the serialisation boundary automatically.
// Content data comes from app/lib/homeContent.ts (single source of truth).

import { Suspense } from 'react'
import Image from 'next/image'
import PressSection from './PressSection'
import { AIPropertySearch } from './AIPropertySearch'
import HomePropertiesSection from './HomePropertiesSection'
import HomeMortgage from './HomeMortgage'
import HomeAvaliacaoForm from './HomeAvaliacaoForm'
import HomeZoneCards from './HomeZoneCards'
import {
  HOME_MARQUEE,
  HOME_ZONES,
  HOME_MARKET_TICKER,
  HOME_CRED_STATS,
  HOME_TESTIMONIALS,
  HOME_REVIEW_STATS,
} from '../lib/homeContent'

export default function HomeSections() {
  return (
    <>
      {/* ── MARQUEE ───────────────────────────────────────────────────────── */}
      <div className="mq">
        <div className="mq-track">
          {[...Array(2)].map((_, rep) => (
            <span key={rep} style={{ display: 'contents' }}>
              {HOME_MARQUEE.map((item, i) => (
                <span key={`${rep}-${i}`} style={{ display: 'contents' }}>
                  <span className="mq-item">{item.zona} <span>{item.val}</span></span>
                  <span className="mq-sep"></span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── AI PROPERTY SEARCH — Sofia NLP ────────────────────────────────── */}
      <div className="sw" style={{ paddingTop: '40px', paddingBottom: '0' }}>
        <AIPropertySearch />
      </div>

      {/* ── SEARCH + PROPERTIES + CPCV (client island) ────────────────────── */}
      <Suspense fallback={null}>
        <HomePropertiesSection />
      </Suspense>

      {/* ── ZONAS ─────────────────────────────────────────────────────────── */}
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
            {HOME_ZONES.map(z => (
              <a key={z.c} href={`/zonas/${z.nome.toLowerCase()}`} className={`zc ${z.c}`}>
                <div className="zc-bg">
                  <Image
                    src={z.photo}
                    alt={z.nome}
                    fill
                    sizes="(max-width: 480px) 100vw, (max-width: 960px) 50vw, (max-width: 1280px) 50vw, 33vw"
                    style={{ objectFit: 'cover' }}
                    priority={z.c === 'z1'}
                  />
                </div>
                <div className="zc-ov"></div>
                <div className="zc-clip-overlay"></div>
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

      {/* Zone card click handler (client) */}
      <Suspense fallback={null}>
        <HomeZoneCards />
      </Suspense>

      {/* ── MARKET STATS TICKER ───────────────────────────────────────────── */}
      <div style={{ background: '#0c1f15', borderTop: '1px solid rgba(201,169,110,.1)', borderBottom: '1px solid rgba(201,169,110,.1)', overflow: 'hidden', padding: '0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', animation: 'tickerScroll 40s linear infinite', whiteSpace: 'nowrap', gap: '0' }}>
          {[...HOME_MARKET_TICKER, ...HOME_MARKET_TICKER.slice(0, 4)].map((s, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '20px', padding: '14px 32px', borderRight: '1px solid rgba(201,169,110,.1)', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(201,169,110,.6)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: '#c9a96e', lineHeight: 1 }}>{s.value}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.4)', letterSpacing: '.06em' }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <style>{`@keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      </div>

      {/* ── SIMULADOR DE CRÉDITO ───────────────────────────────────────────── */}
      <section id="simulador" style={{ background: '#f4f0e6', padding: '112px 0', borderBottom: '1px solid rgba(14,14,13,.08)' }}>
        <div className="sw">
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '10px' }}>Simulação · Crédito Habitação · Portugal</div>
            <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(2.2rem,3.8vw,3.8rem)', color: '#0e0e0d', lineHeight: 1.05, marginBottom: '12px', letterSpacing: '-.012em' }}>A Verdade <em style={{ fontStyle: 'italic', color: '#1c4a35' }}>Sobre o Crédito</em></h2>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.86rem', lineHeight: 1.8, color: 'rgba(14,14,13,.5)', maxWidth: '560px' }}>Simule com dados reais de mercado — Euribor actualizado, custos totais incluídos e cenários de stress-test, para decidir com clareza total.</p>
          </div>
          <Suspense fallback={null}>
            <HomeMortgage />
          </Suspense>
        </div>
      </section>

      {/* ── MARKET DATA ───────────────────────────────────────────────────── */}
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
                {[
                  '44% dos compradores nos mercados prime são internacionais',
                  'Lisboa entre as 5 cidades de luxo mais valorizadas do mundo',
                  'Valorização prevista +4 a +5.9% em 2026 — INE · Savills · Knight Frank',
                  'Avaliação proprietária com margem de 4–7%. A mais precisa do mercado.',
                ].map(t => (
                  <div key={t} className="mkt-feat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="mkt-zones fade-in" id="mktZones"></div>
          </div>
        </div>
      </section>

      {/* ── Market CTA ────────────────────────────────────────────────────── */}
      <div style={{ background: '#f4f0e6', padding: '32px 0', textAlign: 'center', borderBottom: '1px solid rgba(14,14,13,.06)' }}>
        <a href="#imoveis" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'gap .25s var(--ease-out)' }}>
          Explorar o Portfolio →
        </a>
      </div>

      {/* ── AVALIAÇÃO PRIVADA ─────────────────────────────────────────────── */}
      <section id="avaliacao" style={{ background: '#f4f0e6', padding: '112px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,169,110,.6), transparent)' }} />
        <div className="sw avaliacao-grid">
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '28px' }}>Avaliação Privada · Dados Reais · Sem Estimativas</div>
            <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: 'clamp(2.2rem,3.8vw,3.8rem)', fontWeight: 300, color: '#0e0e0d', lineHeight: 1.08, margin: '0 0 28px', letterSpacing: '-.01em' }}>
              O seu imóvel vale<br />quanto vale.<br /><em style={{ fontStyle: 'italic', color: '#1c4a35' }}>Não mais. Não menos.</em>
            </h2>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.92rem', fontWeight: 300, color: 'rgba(14,14,13,.55)', lineHeight: 1.78, marginBottom: '40px', maxWidth: '400px' }}>
              Avaliação proprietária calibrada com dados INE 2025 e transacções reais. Reservado a proprietários e investidores qualificados.
            </p>
            <a
              href="https://wa.me/351919948986?text=Gostaria+de+solicitar+uma+avalia%C3%A7%C3%A3o+privada+do+meu+im%C3%B3vel."
              target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#1c4a35', color: '#f4f0e6', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 400 }}
            >
              Pedir Avaliação Privada
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', marginTop: '12px' }}>
              ✓ ±4.2% precisão mediana · calibrado com 847 transacções Q1 2026
            </div>
          </div>
          <div style={{ background: '#fff', padding: '48px', boxShadow: '0 24px 80px rgba(14,14,13,.10),0 4px 16px rgba(14,14,13,.06)', borderTop: '2px solid var(--g)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '28px' }}>Pedido de Avaliação · Confidencial</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { id: 'avalNome', label: 'Nome', placeholder: 'O seu nome' },
                { id: 'avalTel', label: 'Telefone', placeholder: '+351 9XX XXX XXX' },
                { id: 'avalZona', label: 'Zona', placeholder: 'Ex: Lisboa, Cascais, Comporta...' },
              ].map(f => (
                <div key={f.id}>
                  <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.5)', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                  <input id={f.id} placeholder={f.placeholder} style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '1px solid rgba(14,14,13,.18)', fontFamily: "'Jost',sans-serif", fontSize: '.88rem', color: '#0e0e0d', outline: 'none', background: 'transparent', boxSizing: 'border-box', transition: 'border-color .3s' }} />
                </div>
              ))}
              <HomeAvaliacaoForm />
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center' }}>Resposta em menos de 2 horas · 100% confidencial</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BLOCO NHR ─────────────────────────────────────────────────────── */}
      <section className="editorial-2col" style={{ background: '#0c1f15', minHeight: '560px' }}>
        <div style={{ position: 'relative', minHeight: '560px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a0e08 0%, #3d1f0d 25%, #7a4020 45%, #c4844a 62%, #e8b87a 72%, #c99850 82%, #241005 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse 70% 50% at 45% 55%, rgba(232,184,122,.25) 0%, transparent 65%)', mixBlendMode: 'overlay' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, rgba(12,31,21,.95) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,31,21,.7) 0%, transparent 50%)' }} />
          <div style={{ position: 'absolute', bottom: '32px', left: '32px' }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: 'rgba(244,240,230,.6)', fontStyle: 'italic' }}>
              &ldquo;Quinta-feira à noite.<br />Mesa em Comporta.<br />20% flat. Para sempre.&rdquo;
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 64px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.7)', marginBottom: '28px' }}>NHR · IFICI · Residência Fiscal · Portugal</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: 'clamp(2.2rem,3.8vw,3.8rem)', fontWeight: 300, color: '#f4f0e6', lineHeight: 1.05, margin: '0 0 28px', letterSpacing: '-.012em' }}>
            Dez Anos de<br />Liberdade Fiscal.<br /><em style={{ fontStyle: 'italic', color: '#c9a96e' }}>Uma Vida Nova.</em>
          </h2>
          <div style={{ width: '36px', height: '1px', background: 'rgba(201,169,110,.4)', marginBottom: '28px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '44px' }}>
            {[
              '20% de taxa flat durante 10 anos — para quem escolhe Portugal como casa.',
              'Os seus rendimentos internacionais trabalham para si. Não para o Estado.',
              'A melhor qualidade de vida da Europa. Com a fiscalidade mais competitiva.',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '20px', height: '20px', border: '1px solid rgba(201,169,110,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" width="10"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.65, fontWeight: 300 }}>{t}</span>
              </div>
            ))}
          </div>
          <a
            href="https://wa.me/351919948986?text=Gostaria+de+falar+com+o+vosso+consultor+fiscal+sobre+NHR%2FIFICI."
            target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '16px 36px', background: 'transparent', border: '1px solid rgba(201,169,110,.4)', color: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 400, width: 'fit-content' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            Falar com o Consultor Fiscal
          </a>
        </div>
      </section>

      {/* ── ACESSO PRIVADO ─────────────────────────────────────────────────── */}
      <section className="editorial-2col" style={{ background: '#070f0a', minHeight: '640px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', minHeight: '640px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #0c0802 0%, #1a0e03 20%, #3d2008 45%, #c9862a 65%, #e8a84e 78%, #b87520 88%, #050300 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 68%, rgba(201,134,42,.35) 0%, transparent 60%)', mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(to top, rgba(7,15,10,.95) 0%, transparent 100%)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, rgba(7,15,10,.7) 0%, transparent 100%)' }} />
          <div style={{ position: 'absolute', bottom: '36px', left: '36px', right: '36px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(201,169,110,.7)', marginBottom: '8px' }}>Comporta · Herdade Privada · Off-Market</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 300, color: 'rgba(244,240,230,.75)', fontStyle: 'italic', lineHeight: 1.2 }}>
              &ldquo;Os imóveis mais extraordinários<br />nunca chegam ao mercado.&rdquo;
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 64px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(201,169,110,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,169,110,.025) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '6px 18px', border: '1px solid rgba(201,169,110,.22)', marginBottom: '40px' }}>
              <div style={{ width: '5px', height: '5px', background: '#c9a96e', borderRadius: '50%' }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.8)' }}>Off-Market · By Invitation Only</span>
            </div>
            <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: 'clamp(2.8rem,4.5vw,4.8rem)', fontWeight: 300, color: '#f4f0e6', lineHeight: 1.03, margin: '0 0 6px', letterSpacing: '-.01em' }}>Acesso</h2>
            <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: 'clamp(2.8rem,4.5vw,4.8rem)', fontWeight: 300, color: '#f4f0e6', lineHeight: 1.03, margin: '0 0 32px', letterSpacing: '-.01em', fontStyle: 'italic' }}>Privado</h2>
            <div style={{ width: '40px', height: '1px', background: 'rgba(201,169,110,.4)', marginBottom: '32px' }} />
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.9rem', fontWeight: 300, color: 'rgba(244,240,230,.38)', lineHeight: 1.8, marginBottom: '48px', maxWidth: '340px' }}>
              As propriedades mais extraordinárias<br />nunca chegam ao mercado público.<br />Chegam apenas a quem já conhecemos.
            </p>
            <a
              href="/off-market"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', padding: '17px 44px', background: 'transparent', border: '1px solid rgba(201,169,110,.42)', color: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 400, width: 'fit-content' }}
            >
              Pedir Acesso Exclusivo
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <div style={{ marginTop: '52px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.22)', textTransform: 'uppercase' }}>Agency Group · AMI 22506 · Acesso restrito</div>
          </div>
        </div>
      </section>

      {/* ── CREDENCIAIS ───────────────────────────────────────────────────── */}
      <section className="cred-section">
        <div className="cred-grid">
          {HOME_CRED_STATS.map(s => (
            <div key={s.label} className="cred-c fade-in">
              <div className="cred-n">{s.n}<sup>{s.sup}</sup></div>
              <div className="cred-l">{s.label}</div>
              <div className="cred-d">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Credenciais CTA ───────────────────────────────────────────────── */}
      <div style={{ background: '#0c1f15', padding: '40px 0', textAlign: 'center', borderTop: '1px solid rgba(201,169,110,.08)' }}>
        <a
          href="https://wa.me/351919948986?text=Bom%20dia%2C%20gostaria%20de%20falar%20com%20um%20consultor."
          target="_blank" rel="noreferrer"
          style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#c9a96e', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(201,169,110,.3)', padding: '13px 32px', transition: 'all .25s' }}
        >
          Falar com um Consultor
          <svg viewBox="0 0 24 24" fill="currentColor" width="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
        </a>
      </div>

      {/* ── AGENTES ───────────────────────────────────────────────────────── */}
      <section className="ag-section" id="agentes">
        <div className="ag-inner">
          <div className="ag-eye">Acesso Restrito · AMI 22506</div>
          <h2 className="ag-h2">Portal do Consultor</h2>
          <p className="ag-sub">Pipeline · CRM · Deal Radar · Relatórios · Off-Market.</p>
          <div className="ag-form">
            <a href="/portal" className="ag-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Aceder ao Portal →</a>
          </div>
          <div className="ag-ami">Agency Group · Mediação Imobiliária Lda · AMI 22506</div>
        </div>
      </section>

      {/* ── PRESS SECTION ─────────────────────────────────────────────────── */}
      <PressSection />

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="test-section" style={{ background: '#070f0a', borderTop: '1px solid rgba(201,169,110,.08)', padding: '112px 40px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', marginBottom: '16px' }}>Famílias de 14 Nacionalidades · 4.9/5</div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#f4f0e6', margin: '0 0 8px' }}>Eles chegaram.</h2>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#c9a96e', margin: 0 }}>Eles ficaram.</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="#c9a96e">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
          </div>
          <div className="test-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
            {HOME_TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(201,169,110,.1)', padding: '32px', position: 'relative', transition: 'border-color .2s' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '4rem', color: 'rgba(201,169,110,.2)', lineHeight: 0.8, marginBottom: '16px' }}>&ldquo;</div>
                <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
                  {Array.from({ length: t.rating }).map((_, s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#c9a96e">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', lineHeight: 1.7, color: 'rgba(244,240,230,.7)', margin: '0 0 24px', fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.5)', marginBottom: '16px', textTransform: 'uppercase' }}>{t.property}</div>
                <div style={{ borderTop: '1px solid rgba(201,169,110,.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontFamily: "'Jost', sans-serif", fontWeight: 600, fontSize: '.72rem', color: '#f4f0e6', marginBottom: '4px' }}>{t.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.4)' }}>{t.country} · {t.zone}</div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.25)', letterSpacing: '.08em' }}>{t.date}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', marginTop: '64px', flexWrap: 'wrap' }}>
            {HOME_REVIEW_STATS.map(b => (
              <div key={b.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '2rem', color: '#c9a96e', fontWeight: 300 }}>{b.val}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.4)', textTransform: 'uppercase', marginTop: '4px' }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT BAR ───────────────────────────────────────────────────── */}
      <div className="contact-bar" id="contacto">
        <div className="cb-inner">
          <div className="cb-items">
            <div className="cb-item"><span className="cb-lbl">Telefone</span><a href="tel:+351919948986" className="cb-val">+351 919 948 986</a></div>
            <div className="cb-item"><span className="cb-lbl">Email</span><a href="mailto:geral@agencygroup.pt" className="cb-val">geral@agencygroup.pt</a></div>
            <div className="cb-item"><span className="cb-lbl">Morada</span><span className="cb-val">Torre Soleil 1 B, Av. da República 120, 2780-158 Oeiras</span></div>
            <div className="cb-item"><span className="cb-lbl">Licença</span><span className="cb-val" style={{ color: 'var(--g)', fontWeight: 500 }}>AMI 22506</span></div>
          </div>
          <a href="https://wa.me/351919948986?text=Bom%20dia%2C%20gostaria%20de%20saber%20mais%20sobre%20im%C3%B3veis%20de%20luxo%20em%20Portugal." target="_blank" rel="noreferrer" className="wa-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            Falar Agora
          </a>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer>
        <div className="ft-inner">
          <div className="ft-top">
            <div>
              <div className="ft-la">Agency</div>
              <div className="ft-lg">Group</div>
              <p className="ft-tag">Portugal. Para quem não aceita menos.</p>
            </div>
            <div className="ft-col">
              <div className="ft-col-h">Zonas</div>
              <ul>
                <li><a href="/imoveis?zona=Lisboa">Lisboa</a></li>
                <li><a href="/imoveis?zona=Cascais">Cascais</a></li>
                <li><a href="/imoveis?zona=Comporta">Comporta</a></li>
                <li><a href="/imoveis?zona=Porto">Porto</a></li>
                <li><a href="/imoveis?zona=Algarve">Algarve</a></li>
                <li><a href="/imoveis?zona=Madeira">Madeira</a></li>
              </ul>
            </div>
            <div className="ft-col">
              <div className="ft-col-h">Serviços</div>
              <ul>
                <li><a href="/off-market">Off-Market</a></li>
                <li><a href="/portal">Portal Agentes</a></li>
                <li><a href="#contacto">NHR / Vistos</a></li>
                <li><a href="/#simulador">Simulador IMT</a></li>
              </ul>
            </div>
            <div className="ft-col">
              <div className="ft-col-h">Empresa</div>
              <ul>
                <li><a href="#contacto">Sobre Nós</a></li>
                <li><a href="#agentes">Agentes</a></li>
                <li><a href="/relatorio-2026" style={{ color: 'var(--gold)', fontWeight: 500 }}>Market Report 2026 ↗</a></li>
                <li><a href="mailto:geral@agencygroup.pt">Email</a></li>
              </ul>
            </div>
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
