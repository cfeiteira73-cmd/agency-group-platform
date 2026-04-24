import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '404 — Página não encontrada | Agency Group',
  description: 'A página que procura não existe ou foi movida. Explore imóveis de luxo em Portugal com a Agency Group — AMI 22506.',
  robots: { index: false, follow: true },
}

const QUICK_LINKS = [
  { label: 'Imóveis',          href: '/imoveis',       sub: 'Catálogo completo' },
  { label: 'Blog',             href: '/blog',          sub: 'Mercado & insights' },
  { label: 'Contacto',         href: '/contacto',      sub: 'Falar com um consultor' },
  { label: 'AVM Gratuita',     href: '/#avaliacao',    sub: 'Avalie o seu imóvel' },
]

export default function NotFound() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300&family=DM+Mono:wght@300;400&display=swap');
        .nf-link { display:flex; flex-direction:column; gap:2px; padding:14px 20px; border:1px solid rgba(201,169,110,.15); background:rgba(201,169,110,.04); text-decoration:none; transition:border-color .2s, background .2s; }
        .nf-link:hover { border-color:rgba(201,169,110,.35); background:rgba(201,169,110,.08); }
        .nf-label { font-family:'DM Mono',monospace; font-size:.58rem; letter-spacing:.14em; text-transform:uppercase; color:#c9a96e; }
        .nf-sub { font-family:'DM Mono',monospace; font-size:.5rem; letter-spacing:.08em; color:rgba(244,240,230,.4); }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          background: '#060d08',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0',
          padding: '40px 24px',
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {/* Top brand label */}
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            letterSpacing: '.28em',
            textTransform: 'uppercase',
            color: 'rgba(201,169,110,.5)',
            marginBottom: '32px',
          }}
        >
          Agency Group · AMI 22506
        </div>

        {/* Large 404 */}
        <div
          style={{
            fontFamily: "'Cormorant',serif",
            fontSize: 'clamp(5rem, 18vw, 10rem)',
            fontWeight: 300,
            color: 'rgba(201,169,110,.12)',
            lineHeight: 1,
            letterSpacing: '-.02em',
            marginBottom: '-16px',
            userSelect: 'none',
          }}
          aria-hidden="true"
        >
          404
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Cormorant',serif",
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 300,
            color: '#f4f0e6',
            margin: '0 0 12px',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          Página não encontrada
        </h1>

        <p
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.58rem',
            letterSpacing: '.1em',
            color: 'rgba(244,240,230,.4)',
            textAlign: 'center',
            marginBottom: '40px',
            maxWidth: '340px',
            lineHeight: 1.8,
          }}
        >
          Esta página não existe ou foi movida.<br />
          Explore o nosso site abaixo.
        </p>

        {/* Separator */}
        <div
          style={{
            width: '40px',
            height: '1px',
            background: 'rgba(201,169,110,.25)',
            marginBottom: '28px',
          }}
        />

        {/* Quick links grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            width: '100%',
            maxWidth: '400px',
            marginBottom: '36px',
          }}
        >
          {QUICK_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="nf-link">
              <span className="nf-label">{l.label}</span>
              <span className="nf-sub">{l.sub}</span>
            </Link>
          ))}
        </div>

        {/* Primary CTA */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            color: '#c9a96e',
            border: '1px solid rgba(201,169,110,.4)',
            padding: '12px 28px',
            fontFamily: "'DM Mono',monospace",
            fontSize: '.52rem',
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'border-color .2s, background .2s',
          }}
        >
          ← Início
        </Link>
      </div>
    </>
  )
}
