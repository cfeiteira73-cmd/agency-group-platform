'use client'

import React from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Article, Section } from './articles'
import BlogRelatedListings from './BlogRelatedListings'
import BlogEmailCapture from './BlogEmailCapture'
import { track } from '@/lib/gtm'

interface BlogArticleProps {
  article: Article
  relatedArticles: Article[]
}

function renderSection(section: Section, idx: number) {
  switch (section.type) {
    case 'intro':
      return (
        <p key={idx} style={{
          fontFamily: "'Cormorant', serif",
          fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
          fontStyle: 'italic',
          fontWeight: 300,
          lineHeight: 1.75,
          color: '#1c4a35',
          marginBottom: '2rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid rgba(28,74,53,0.12)',
        }}>
          {section.text}
        </p>
      )

    case 'h2':
      return (
        <h2 key={idx} id={`section-${idx}`} style={{
          fontFamily: "'Cormorant', serif",
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          fontWeight: 300,
          color: '#0c1f15',
          lineHeight: 1.2,
          marginTop: '2.5rem',
          marginBottom: '1rem',
          letterSpacing: '-0.01em',
        }}>
          {section.text}
        </h2>
      )

    case 'h3':
      return (
        <h3 key={idx} style={{
          fontFamily: "'Cormorant', serif",
          fontSize: '1.25rem',
          fontWeight: 400,
          color: '#0c1f15',
          marginTop: '1.75rem',
          marginBottom: '0.75rem',
        }}>
          {section.text}
        </h3>
      )

    case 'p':
      return (
        <p key={idx} style={{
          fontSize: '0.9rem',
          lineHeight: 1.85,
          color: 'rgba(14,14,13,0.75)',
          marginBottom: '1.25rem',
        }}>
          {section.text}
        </p>
      )

    case 'ul':
      return (
        <ul key={idx} style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 1.5rem 0',
        }}>
          {section.items?.map((item, i) => (
            <li key={i} style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              padding: '0.6rem 0',
              borderBottom: '1px solid rgba(14,14,13,0.06)',
              fontSize: '0.87rem',
              lineHeight: 1.7,
              color: 'rgba(14,14,13,0.72)',
            }}>
              <span style={{ color: '#c9a96e', flexShrink: 0, marginTop: '0.15rem', fontSize: '0.75rem' }}>◆</span>
              {item}
            </li>
          ))}
        </ul>
      )

    case 'table':
      return (
        <div key={idx} style={{ overflowX: 'auto', marginBottom: '1.75rem' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
            fontFamily: "'Jost', sans-serif",
          }}>
            <thead>
              <tr style={{ background: '#1c4a35' }}>
                {section.headers?.map((h, i) => (
                  <th key={i} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: '#f4f0e6',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.52rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows?.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : 'rgba(28,74,53,0.03)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '10px 16px',
                      color: ci === 0 ? '#0c1f15' : 'rgba(14,14,13,0.65)',
                      fontWeight: ci === 0 ? 500 : 400,
                      borderBottom: '1px solid rgba(14,14,13,0.06)',
                      whiteSpace: ci === 0 ? 'nowrap' : 'normal',
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'highlight':
      return (
        <div key={idx} style={{
          borderLeft: '3px solid #c9a96e',
          background: 'rgba(201,169,110,0.07)',
          padding: '1.5rem',
          margin: '2rem 0',
          position: 'relative',
        }}>
          {section.label && (
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.5rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#c9a96e',
              marginBottom: '0.75rem',
              fontWeight: 400,
            }}>
              {section.label}
            </div>
          )}
          <p style={{
            fontSize: '0.88rem',
            lineHeight: 1.8,
            color: 'rgba(14,14,13,0.8)',
            margin: 0,
          }}>
            {section.text}
          </p>
        </div>
      )

    case 'cta':
      return (
        <div key={idx} style={{
          background: '#1c4a35',
          padding: '2rem',
          margin: '2.5rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <p style={{
            fontFamily: "'Cormorant', serif",
            fontSize: '1.2rem',
            fontWeight: 300,
            color: '#f4f0e6',
            margin: 0,
            lineHeight: 1.4,
          }}>
            {section.text}
          </p>
          <Link href="/#avm" style={{
            display: 'inline-block',
            background: '#c9a96e',
            color: '#0c1f15',
            padding: '12px 28px',
            textDecoration: 'none',
            fontFamily: "'DM Mono', monospace",
            fontSize: '0.55rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 400,
            alignSelf: 'flex-start',
            transition: 'background 0.3s',
          }}>
            Avaliação Gratuita →
          </Link>
        </div>
      )

    default:
      return null
  }
}

export default function BlogArticle({ article, relatedArticles }: BlogArticleProps) {
  const [activeSection, setActiveSection] = useState<string>('')

  const h2Sections = article.content
    .map((s, idx) => ({ ...s, idx }))
    .filter(s => s.type === 'h2')

  useEffect(() => {
    const handleScroll = () => {
      const sections = h2Sections.map(s => {
        const el = document.getElementById(`section-${s.idx}`)
        return el ? { id: `section-${s.idx}`, top: el.getBoundingClientRect().top } : null
      }).filter(Boolean)

      const active = sections.filter(s => s!.top <= 120).pop()
      if (active) setActiveSection(active!.id)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [h2Sections])

  const formattedDate = new Date(article.date).toLocaleDateString('pt-PT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const gradients: Record<string, string> = {
    'Guias de Compra': 'linear-gradient(135deg,#1c4a35,#0c1f15)',
    'Investimento': 'linear-gradient(135deg,#0c2030,#0c1f15)',
    'Compradores Internacionais': 'linear-gradient(135deg,#2e1f08,#0c1f15)',
    'Vistos & Legal': 'linear-gradient(135deg,#1a0a2e,#0c1f15)',
    'Mercado': 'linear-gradient(135deg,#1c2a0c,#0c1f15)',
  }
  const heroGradient = gradients[article.category] || 'linear-gradient(135deg,#1c4a35,#0c1f15)'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}

        .art-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:18px 56px;background:rgba(12,31,21,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(201,169,110,.12);display:flex;align-items:center;justify-content:space-between;gap:24px}
        .art-logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px;flex-shrink:0}
        .la{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#f4f0e6}
        .lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.68em;text-transform:uppercase;color:#c9a96e}
        .art-nav-links{display:flex;gap:28px;list-style:none}
        .art-nav-links a{font-size:.58rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,240,230,.5);text-decoration:none;transition:color .2s}
        .art-nav-links a:hover{color:#c9a96e}
        .art-nav-wa{background:#c9a96e;color:#0c1f15;padding:9px 20px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;flex-shrink:0}

        .art-hero{padding:130px 56px 72px;background:#0c1f15;position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;opacity:.6}
        .art-hero-inner{max-width:900px;margin:0 auto;position:relative;z-index:2}
        .art-cat-tag{display:inline-block;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.24em;text-transform:uppercase;color:#0c1f15;background:#c9a96e;padding:5px 12px;margin-bottom:24px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:24px}
        .art-meta-row{display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.14em;color:rgba(244,240,230,.45)}
        .art-meta-row .dot{color:#c9a96e}

        .art-layout{max-width:1200px;margin:0 auto;padding:56px 56px 80px;display:grid;grid-template-columns:1fr 300px;gap:64px;align-items:start}
        .art-content{background:#fff;padding:48px;border:1px solid rgba(14,14,13,.07)}
        .art-sidebar{position:sticky;top:90px;display:flex;flex-direction:column;gap:24px}

        .sidebar-block{background:#fff;border:1px solid rgba(14,14,13,.07);padding:28px}
        .sidebar-block-title{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.24em;text-transform:uppercase;color:rgba(14,14,13,.4);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid rgba(14,14,13,.07)}
        .sidebar-index-link{display:block;font-size:.75rem;color:rgba(14,14,13,.55);text-decoration:none;padding:6px 0;border-left:2px solid transparent;padding-left:10px;margin-left:-10px;transition:all .2s;line-height:1.4}
        .sidebar-index-link.active{border-left-color:#c9a96e;color:#0c1f15;font-weight:500}
        .sidebar-index-link:hover{color:#1c4a35;border-left-color:rgba(28,74,53,.3)}

        .related-card{display:block;text-decoration:none;padding:14px 0;border-bottom:1px solid rgba(14,14,13,.06)}
        .related-card:last-child{border-bottom:none}
        .related-cat{font-family:var(--font-dm-mono),monospace;font-size:.43rem;letter-spacing:.18em;text-transform:uppercase;color:#c9a96e;margin-bottom:4px}
        .related-title{font-family:var(--font-cormorant),serif;font-size:.95rem;font-weight:300;color:#0e0e0d;line-height:1.3;transition:color .2s}
        .related-card:hover .related-title{color:#1c4a35}

        .sidebar-wa{background:#1c4a35;padding:20px;text-align:center}
        .sidebar-wa p{font-family:var(--font-cormorant),serif;font-size:1.05rem;font-weight:300;color:#f4f0e6;margin-bottom:12px;line-height:1.35}
        .sidebar-wa a{display:inline-block;background:#c9a96e;color:#0c1f15;padding:10px 20px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.16em;text-transform:uppercase}

        .art-footer{background:#0c1f15;padding:40px 56px;border-top:1px solid rgba(201,169,110,.12)}
        .art-footer-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        .art-footer-links{display:flex;gap:24px;flex-wrap:wrap}
        .art-footer-links a{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,240,230,.35);text-decoration:none;transition:color .2s}
        .art-footer-links a:hover{color:#c9a96e}
        .art-footer-copy{font-family:var(--font-dm-mono),monospace;font-size:.45rem;letter-spacing:.12em;color:rgba(244,240,230,.2)}

        @media(max-width:900px){
          .art-nav{padding:14px 24px}
          .art-nav-links{display:none}
          .art-hero{padding:100px 24px 56px}
          .art-layout{grid-template-columns:1fr;padding:32px 24px 64px;gap:40px}
          .art-content{padding:28px 20px}
          .art-sidebar{position:static;top:auto}
          .art-footer{padding:32px 24px}
          .art-footer-inner{flex-direction:column;align-items:flex-start}
        }
      `}</style>

      {/* Nav */}
      <nav className="art-nav">
        <Link href="/" className="art-logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <ul className="art-nav-links">
          <li><Link href="/blog">← Blog</Link></li>
          <li><Link href="/imoveis">Imóveis</Link></li>
          <li><Link href="/#avm">AVM</Link></li>
          <li><Link href="/#nhr">NHR</Link></li>
        </ul>
        <a
          href="https://wa.me/351919948986"
          target="_blank"
          rel="noopener noreferrer"
          className="art-nav-wa"
        >
          WhatsApp →
        </a>
      </nav>

      {/* Hero */}
      <section className="art-hero" style={{ backgroundImage: heroGradient }}>
        <div className="art-hero-inner">
          <div className="art-cat-tag">{article.category}</div>
          <h1 className="art-h1">{article.title}</h1>
          <div className="art-meta-row">
            <span style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
              <span style={{ width:'18px', height:'18px', borderRadius:'50%', background:'rgba(201,169,110,.18)', border:'1px solid rgba(201,169,110,.3)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'#c9a96e', flexShrink:0, letterSpacing:'.04em' }}>AG</span>
              {article.author}
            </span>
            <span className="dot">·</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:'4px' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" opacity=".7"/>
                <path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".7"/>
              </svg>
              {article.readingTime} min
            </span>
            <span className="dot">·</span>
            <span>{formattedDate}</span>
            <span className="dot">·</span>
            <span>Agency Group AMI 22506</span>
            {article.zona && (
              <>
                <span className="dot">·</span>
                <span style={{ color: '#c9a96e' }}>{article.zona}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Layout */}
      <div className="art-layout">
        {/* Main content */}
        <article className="art-content">
          {article.content.map((section, idx) => {
            const total = article.content.length
            const midpoint = Math.floor(total / 2)
            const twoThirds = Math.floor(total * 0.67)
            return (
              <React.Fragment key={idx}>
                {renderSection(section, idx)}

                {/* Inline email capture at midpoint */}
                {idx === midpoint - 1 && (
                  <BlogEmailCapture
                    articleSlug={article.slug}
                    articleZona={article.zona}
                    variant="inline"
                  />
                )}

                {/* Related listings at 2/3 of article */}
                {idx === twoThirds - 1 && (
                  <BlogRelatedListings
                    articleSlug={article.slug}
                    articleZona={article.zona}
                    articleCategory={article.category}
                    articleKeywords={article.keywords}
                    maxListings={3}
                  />
                )}

                {/* Saved search CTA if buyer guide */}
                {idx === twoThirds && article.category !== 'Vistos & Legal' && (
                  <div style={{
                    border: '1px solid rgba(201,169,110,.22)',
                    background: 'rgba(201,169,110,.04)',
                    padding: '1.25rem 1.5rem',
                    margin: '1.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}>
                    <p style={{
                      fontFamily: "'Cormorant', serif", fontSize: '1rem',
                      fontWeight: 300, color: '#0c1f15', margin: 0, lineHeight: 1.4,
                    }}>
                      🔔 Ative alertas automáticos{article.zona ? ` para ${article.zona}` : ''}
                    </p>
                    <a
                      href="/imoveis"
                      onClick={() => track('blog_saved_search_clicked', {
                        article: article.slug,
                        zona: article.zona ?? '',
                      })}
                      style={{
                        background: '#1c4a35', color: '#c9a96e',
                        padding: '9px 18px', textDecoration: 'none',
                        fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                        letterSpacing: '.14em', textTransform: 'uppercase',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      Guardar Pesquisa →
                    </a>
                  </div>
                )}
              </React.Fragment>
            )
          })}

          {/* End-of-article email capture */}
          <BlogEmailCapture
            articleSlug={article.slug}
            articleZona={article.zona}
            variant="end-of-article"
          />

          {/* Article-end CTA */}
          <div style={{
            marginTop: '3rem',
            borderTop: '1px solid rgba(14,14,13,0.08)',
            paddingTop: '2.5rem',
            background: 'linear-gradient(135deg,#0c1f15,#1c4a35)',
            padding: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.48rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#c9a96e',
              marginBottom: '0.25rem',
            }}>
              Agency Group · AMI 22506
            </div>
            <p style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(1.25rem,2.5vw,1.65rem)',
              fontWeight: 300,
              color: '#f4f0e6',
              lineHeight: 1.35,
              margin: 0,
            }}>
              Tem questões sobre este mercado?<br />
              <span style={{ color: '#c9a96e' }}>Fale com um especialista — resposta em menos de 2h.</span>
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a
                href="https://wa.me/351919948986"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#c9a96e',
                  color: '#0c1f15',
                  padding: '13px 24px',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.52rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 400,
                  transition: 'opacity 0.2s',
                }}
              >
                WhatsApp →
              </a>
              <a
                href="/imoveis"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  color: 'rgba(244,240,230,0.7)',
                  padding: '13px 24px',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.52rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 400,
                  border: '1px solid rgba(244,240,230,0.2)',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
              >
                Ver Imóveis →
              </a>
            </div>
            <p style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.45rem',
              letterSpacing: '0.1em',
              color: 'rgba(244,240,230,0.3)',
              margin: 0,
            }}>
              Lisboa · Cascais · Porto · Algarve · Comporta · Madeira · Açores
            </p>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="art-sidebar">
          {h2Sections.length > 0 && (
            <div className="sidebar-block">
              <div className="sidebar-block-title">Índice</div>
              {h2Sections.map(s => (
                <a
                  key={s.idx}
                  href={`#section-${s.idx}`}
                  className={`sidebar-index-link${activeSection === `section-${s.idx}` ? ' active' : ''}`}
                >
                  {s.text}
                </a>
              ))}
            </div>
          )}

          {relatedArticles.length > 0 && (
            <div className="sidebar-block">
              <div className="sidebar-block-title">Artigos Relacionados</div>
              {relatedArticles.map(rel => (
                <Link key={rel.slug} href={`/blog/${rel.slug}`} className="related-card">
                  <div className="related-cat">{rel.category}</div>
                  <div className="related-title">{rel.title}</div>
                </Link>
              ))}
            </div>
          )}

          <div className="sidebar-wa">
            <p>Dúvidas sobre este mercado?</p>
            <a href="https://wa.me/351919948986" target="_blank" rel="noopener noreferrer">
              Falar no WhatsApp
            </a>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="art-footer">
        <div className="art-footer-inner">
          <div className="art-footer-links">
            <Link href="/blog">Blog</Link>
            <Link href="/imoveis">Imóveis</Link>
            <Link href="/relatorio-2026">Relatório 2026</Link>
            {article.zona && (
              <Link href={`/zonas/${article.zona.toLowerCase()}`}>{article.zona}</Link>
            )}
            <Link href="/#avm">AVM Gratuito</Link>
          </div>
          <span className="art-footer-copy">© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: article.title,
            description: article.description,
            author: {
              '@type': 'Person',
              name: article.author,
            },
            publisher: {
              '@type': 'Organization',
              name: 'Agency Group',
              url: 'https://agencygroup.pt',
            },
            datePublished: article.date,
            dateModified: article.date,
            mainEntityOfPage: `https://agencygroup.pt/blog/${article.slug}`,
          }),
        }}
      />
    </>
  )
}
