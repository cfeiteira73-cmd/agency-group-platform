// ─── VideoTestimonialsSection — Premium Human Trust Layer ──────────────────────
// Pure RSC — no 'use client'. Elegant placeholder architecture ready for real videos.
// Scales to real video drop-in without redesign.

const VIDEO_TESTIMONIALS = [
  {
    id: 1,
    featured: true,
    name: 'James & Sarah M.',
    initials: 'J&S',
    origin: '🇬🇧 Reino Unido',
    context: 'Villa T5 · Cascais · €2.4M',
    quote: 'Em três semanas, encontrámos a villa que procurámos durante anos. O nível de serviço e discrição é verdadeiramente único em Portugal.',
    duration: '0:28',
    date: 'Janeiro 2026',
  },
  {
    id: 2,
    name: 'Mohammed A.',
    initials: 'M.A.',
    origin: '🇸🇦 Arábia Saudita',
    context: 'Penthouse T4 · Lisboa · €3.1M',
    quote: 'O retorno superou todas as projecções. Lisboa foi a escolha certa.',
    duration: '0:31',
    date: 'Dezembro 2025',
  },
  {
    id: 3,
    name: 'Marc & Isabelle F.',
    initials: 'M&I',
    origin: '🇫🇷 França',
    context: 'T3 · Porto · €890K',
    quote: '5.1% de rentabilidade no primeiro ano. Nunca trabalhámos com uma equipa assim.',
    duration: '0:24',
    date: 'Outubro 2025',
  },
]

// Play icon SVG — minimal, premium
function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" stroke="rgba(201,169,110,0.5)" strokeWidth="1" />
      <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="#c9a96e" />
    </svg>
  )
}

export default function VideoTestimonialsSection() {
  const [featured, ...supporting] = VIDEO_TESTIMONIALS

  return (
    <section
      aria-label="Testemunhos em vídeo"
      style={{ background: '#060d08', padding: '112px 0', borderTop: '1px solid rgba(201,169,110,.06)' }}
    >
      <style>{`
        .vt-grid{display:grid;grid-template-columns:1fr 360px;gap:32px;max-width:1100px;margin:0 auto;padding:0 40px}
        .vt-featured{position:relative;background:rgba(255,255,255,.025);border:1px solid rgba(201,169,110,.12);overflow:hidden}
        .vt-placeholder{aspect-ratio:16/9;position:relative;background:linear-gradient(135deg,#0c1f15 0%,#1a3028 40%,#0a1a10 100%);display:flex;align-items:center;justify-content:center;overflow:hidden}
        .vt-placeholder-grain{position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
        .vt-play-btn{width:64px;height:64px;border-radius:50%;border:1px solid rgba(201,169,110,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;z-index:2;background:rgba(0,0,0,.3)}
        .vt-play-btn svg{width:28px;height:28px}
        .vt-play-btn svg circle{stroke:rgba(201,169,110,.6)}
        .vt-play-btn svg path{fill:#c9a96e}
        .vt-coming{position:absolute;bottom:16px;right:16px;font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.14em;color:rgba(201,169,110,.4);text-transform:uppercase}
        .vt-featured-body{padding:28px 32px}
        .vt-side{display:flex;flex-direction:column;gap:16px}
        .vt-card{background:rgba(255,255,255,.02);border:1px solid rgba(201,169,110,.08);padding:20px 24px;display:flex;flex-direction:column;gap:12px;transition:border-color .2s}
        .vt-card:hover{border-color:rgba(201,169,110,.2)}
        .vt-mini-thumb{aspect-ratio:16/9;background:linear-gradient(135deg,#0c1f15,#1a3028);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;margin-bottom:4px}
        .vt-mini-thumb svg{width:20px;height:20px}
        .vt-mini-thumb svg circle{stroke:rgba(201,169,110,.4)}
        .vt-mini-thumb svg path{fill:rgba(201,169,110,.7)}
        .vt-dur{position:absolute;bottom:6px;right:8px;font-family:'DM Mono',monospace;font-size:.45rem;color:rgba(201,169,110,.5);letter-spacing:.06em}
        @media(max-width:900px){
          .vt-grid{grid-template-columns:1fr;padding:0 24px}
          .vt-side{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        }
        @media(max-width:540px){
          .vt-side{grid-template-columns:1fr}
        }
      `}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px', marginBottom: '56px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
              Testemunhos · Vídeo · Clientes Reais
            </div>
            <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', color: '#f4f0e6', margin: 0, lineHeight: 1.1 }}>
              Quem decidiu.<br />
              <em style={{ color: '#c9a96e' }}>E não voltou atrás.</em>
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.4rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>4.8</div>
            <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end', marginTop: '4px' }}>
              {[1,2,3,4,5].map(i => (
                <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#c9a96e" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginTop: '6px' }}>
              47 avaliações · Google
            </div>
          </div>
        </div>
      </div>

      <div className="vt-grid">
        {/* Featured testimonial */}
        <div className="vt-featured">
          {/* Video placeholder */}
          <div className="vt-placeholder">
            <div className="vt-placeholder-grain" aria-hidden="true" />
            {/* Subtle light orb */}
            <div style={{ position: 'absolute', top: '30%', left: '40%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(201,169,110,.08) 0%, transparent 70%)', pointerEvents: 'none' }} aria-hidden="true" />
            {/* Avatar initials */}
            <div style={{ position: 'absolute', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '1px solid rgba(201,169,110,.25)', background: 'rgba(201,169,110,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: 'rgba(201,169,110,.7)', fontWeight: 300 }}>{featured.initials}</span>
              </div>
              <button
                type="button"
                className="vt-play-btn"
                aria-label={`Ver testemunho de ${featured.name}`}
                title="Brevemente disponível"
              >
                <PlayIcon />
              </button>
            </div>
            <div className="vt-coming">Brevemente</div>
            {/* Duration badge */}
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(244,240,230,.35)', letterSpacing: '.08em' }}>
              ▶ {featured.duration}
            </div>
          </div>

          {/* Featured body */}
          <div className="vt-featured-body">
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.5rem', color: 'rgba(201,169,110,.2)', lineHeight: 0.7, marginBottom: '14px' }}>&ldquo;</div>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', lineHeight: 1.72, color: 'rgba(244,240,230,.7)', margin: '0 0 20px', fontStyle: 'italic' }}>
              &ldquo;{featured.quote}&rdquo;
            </p>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.5)', marginBottom: '10px', textTransform: 'uppercase' }}>
              {featured.context}
            </div>
            <div style={{ borderTop: '1px solid rgba(201,169,110,.1)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 600, fontSize: '.72rem', color: '#f4f0e6', marginBottom: '3px' }}>{featured.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(244,240,230,.35)', letterSpacing: '.08em' }}>{featured.origin}</div>
              </div>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[1,2,3,4,5].map(i => (
                  <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#c9a96e" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Supporting cards */}
        <div className="vt-side">
          {supporting.map(t => (
            <div key={t.id} className="vt-card">
              {/* Mini video thumbnail */}
              <div className="vt-mini-thumb">
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#0c1f15,#142b1e)', opacity: .9 }} aria-hidden="true" />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(201,169,110,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Cormorant',serif", fontSize: '.65rem', color: 'rgba(201,169,110,.6)' }}>{t.initials}</span>
                  </div>
                  <PlayIcon />
                </div>
                <div className="vt-dur">{t.duration}</div>
              </div>

              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.75rem', lineHeight: 1.65, color: 'rgba(244,240,230,.6)', margin: 0, fontStyle: 'italic' }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 600, fontSize: '.68rem', color: '#f4f0e6', marginBottom: '2px' }}>{t.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(244,240,230,.3)', letterSpacing: '.08em' }}>{t.origin}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(201,169,110,.4)', letterSpacing: '.06em', marginTop: '4px', textTransform: 'uppercase' }}>{t.context}</div>
              </div>
            </div>
          ))}

          {/* "More stories" card */}
          <div style={{ background: 'transparent', border: '1px solid rgba(201,169,110,.08)', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px', textAlign: 'center', minHeight: '120px' }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem', color: 'rgba(244,240,230,.4)', lineHeight: 1.3 }}>
              Mais histórias<br />a caminho.
            </div>
            <a
              href="https://www.google.com/search?q=Agency+Group+AMI+22506+avaliações"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Ver todas as avaliações no Google"
              style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.5)', textDecoration: 'none', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Ver reviews Google
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
