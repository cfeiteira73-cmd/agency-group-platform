/**
 * /unsupported-browser
 *
 * Shown when Internet Explorer or Edge IE Mode is detected trying to access
 * the portal. This is a static page — no 'use client', no auth, no JS required.
 * It must be freely reachable by IE without triggering any redirect loop.
 */
export const metadata = {
  title: 'Browser não suportado · Agency Group',
  robots: 'noindex',
}

export default function UnsupportedBrowser() {
  return (
    <html lang="pt">
      <body style={{ margin: 0, background: '#0c1f15', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif', padding: '24px' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>

          {/* Brand */}
          <p style={{ margin: '0 0 8px', fontSize: '0.5rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.6)' }}>
            Agency Group · AMI 22506
          </p>

          {/* Icon */}
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '1.4rem' }}>
            ⚠
          </div>

          {/* Heading */}
          <h1 style={{ margin: '0 0 16px', fontWeight: 300, fontSize: '1.5rem', color: '#f4f0e6', letterSpacing: '0.03em', lineHeight: 1.2 }}>
            Browser não suportado
          </h1>

          {/* Primary message */}
          <p style={{ margin: '0 0 12px', fontSize: '0.9rem', lineHeight: 1.8, color: 'rgba(244,240,230,0.75)' }}>
            Este portal não suporta <strong style={{ color: '#f4f0e6' }}>Internet Explorer</strong>.
          </p>
          <p style={{ margin: '0 0 28px', fontSize: '0.85rem', lineHeight: 1.75, color: 'rgba(244,240,230,0.6)' }}>
            Para aceder ao Dashboard, utilize <strong style={{ color: '#c9a96e' }}>Google Chrome</strong> ou <strong style={{ color: '#c9a96e' }}>Microsoft Edge</strong>.
          </p>

          {/* IE Mode hint */}
          <p style={{ margin: '0 0 36px', fontSize: '0.75rem', lineHeight: 1.7, color: 'rgba(244,240,230,0.4)', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.12)', padding: '12px 16px' }}>
            Se estiver a usar o <em>modo Internet Explorer</em> no Edge,<br />
            abra este portal no modo normal do Edge.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="microsoft-edge://"
              style={{ display: 'inline-block', background: '#c9a96e', color: '#0c1f15', padding: '13px 28px', textDecoration: 'none', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}
            >
              Abrir no Edge →
            </a>
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', background: 'transparent', border: '1px solid rgba(201,169,110,0.4)', color: 'rgba(201,169,110,0.8)', padding: '13px 28px', textDecoration: 'none', fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase' }}
            >
              Instalar Chrome
            </a>
          </div>

          {/* Footer */}
          <p style={{ marginTop: '40px', fontSize: '0.5rem', color: 'rgba(244,240,230,0.18)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Agency Group · Mediação Imobiliária Lda · AMI 22506
          </p>

        </div>
      </body>
    </html>
  )
}
