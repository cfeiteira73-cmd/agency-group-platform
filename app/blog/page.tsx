import type { Metadata } from 'next'
import Link from 'next/link'
import { BreadcrumbJsonLd } from '@/app/components/BreadcrumbJsonLd'
import { ARTICLES } from './[slug]/articles'

export const metadata: Metadata = {
  title: 'Blog · Mercado Imobiliário Portugal 2026 · Agency Group',
  description: 'Análises de mercado, guias de compra, NHR/IFICI, zonas premium Portugal 2026. Lisboa, Cascais, Comporta, Algarve, Madeira. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog',
    languages: {
      'pt': 'https://www.agencygroup.pt/blog',
      'en': 'https://www.agencygroup.pt/en/blog',
      'x-default': 'https://www.agencygroup.pt/blog',
    },
  },
  openGraph: {
    title: 'Blog · Mercado Imobiliário Portugal 2026',
    description: 'Análises de mercado, guias de compra e fiscalidade para investidores em Portugal.',
    type: 'website',
    url: 'https://www.agencygroup.pt/blog',
  },
}

// Sort articles by date descending
const SORTED_ARTICLES = [...ARTICLES].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
)

const CATEGORY_GRADIENTS: Record<string, string> = {
  'Guias de Compra':     'linear-gradient(135deg,#1c4a35,#0c1f15)',
  'Fiscalidade':         'linear-gradient(135deg,#2e1f08,#0c1f15)',
  'Investimento':        'linear-gradient(135deg,#0c2030,#0c1f15)',
  'Mercado de Luxo':     'linear-gradient(135deg,#1a0a2e,#0c1f15)',
  'Compradores Internacionais': 'linear-gradient(135deg,#1a2030,#0c1f15)',
  'Legal & Fiscal':      'linear-gradient(135deg,#2a1a08,#0c1f15)',
  'Mercado':             'linear-gradient(135deg,#0c2020,#0c1f15)',
  'Tendências':          'linear-gradient(135deg,#1c1040,#0c1f15)',
  'Guias Internacionais':'linear-gradient(135deg,#102030,#0c1f15)',
  'Ferramentas':         'linear-gradient(135deg,#0c2c1a,#0c1f15)',
}

function getGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? 'linear-gradient(135deg,#1c4a35,#0c1f15)'
}

export default function BlogPage() {
  const featured = SORTED_ARTICLES[0]
  const rest = SORTED_ARTICLES.slice(1)

  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: 'Início', url: 'https://www.agencygroup.pt' },
        { name: 'Blog', url: 'https://www.agencygroup.pt/blog' },
      ]} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.94);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .nav-links{display:flex;gap:32px;list-style:none}
        .nav-links a{font-size:.6rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:#1c4a35;text-decoration:none;opacity:.6;transition:opacity .3s}
        .nav-links a:hover{opacity:1}
        .blog-hero{padding:160px 0 80px;background:#0c1f15;position:relative;overflow:hidden}
        .blog-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 20% 80%,rgba(28,74,53,.5),transparent)}
        .blog-hero-inner{max-width:1160px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .blog-eyebrow{font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.35em;text-transform:uppercase;color:rgba(201,169,110,.7);margin-bottom:24px}
        .blog-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2.5rem,5vw,4rem);font-weight:300;color:#f4f0e6;line-height:1.08;letter-spacing:-.01em;margin-bottom:20px}
        .blog-h1 em{font-style:italic;color:#c9a96e}
        .blog-sub{font-size:.85rem;color:rgba(244,240,230,.45);max-width:480px;line-height:1.8}
        .blog-count{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-top:16px}
        .blog-body{max-width:1160px;margin:0 auto;padding:80px 56px}
        .blog-featured-wrap{margin-bottom:64px}
        .article-featured{background:#fff;border:1px solid rgba(14,14,13,.08);overflow:hidden;text-decoration:none;display:grid;grid-template-columns:1.2fr 1fr;transition:transform .3s,box-shadow .3s}
        .article-featured:hover{transform:translateY(-3px);box-shadow:0 20px 60px rgba(14,14,13,.1)}
        .art-img{min-height:320px}
        .art-body{padding:48px}
        .art-badge{display:inline-block;background:#c9a96e;color:#0c1f15;font-family:var(--font-dm-mono),monospace;font-size:.42rem;letter-spacing:.2em;text-transform:uppercase;padding:4px 12px;margin-bottom:16px}
        .art-cat{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.22em;text-transform:uppercase;color:#c9a96e;margin-bottom:12px}
        .art-title{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:#0e0e0d;line-height:1.2;margin-bottom:12px}
        .art-excerpt{font-size:.83rem;line-height:1.78;color:rgba(14,14,13,.55);margin-bottom:20px}
        .art-meta{display:flex;align-items:center;gap:16px;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.12em;color:rgba(14,14,13,.35)}
        .art-meta span{color:#1c4a35;font-weight:500}
        .blog-section-title{font-family:var(--font-cormorant),serif;font-size:1.6rem;font-weight:300;color:#0e0e0d;margin-bottom:40px;padding-bottom:16px;border-bottom:1px solid rgba(14,14,13,.08)}
        .blog-grid-all{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
        .article-card{background:#fff;border:1px solid rgba(14,14,13,.08);overflow:hidden;text-decoration:none;display:block;transition:transform .3s,box-shadow .3s}
        .article-card:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(14,14,13,.08)}
        .art-card-img{height:160px}
        .art-card-body{padding:24px}
        .art-card-title{font-family:var(--font-cormorant),serif;font-size:1.15rem;font-weight:300;color:#0e0e0d;line-height:1.3;margin-bottom:8px}
        .art-card-excerpt{font-size:.78rem;line-height:1.7;color:rgba(14,14,13,.5);margin-bottom:12px}
        .blog-cta{background:#1c4a35;padding:80px 56px;text-align:center}
        .blog-cta-h{font-family:var(--font-cormorant),serif;font-size:2.5rem;font-weight:300;color:#f4f0e6;margin-bottom:16px}
        .blog-cta-h em{color:#c9a96e;font-style:italic}
        .blog-cta-p{font-size:.85rem;color:rgba(244,240,230,.55);margin-bottom:32px}
        .blog-cta-btn{display:inline-block;background:#c9a96e;color:#0c1f15;padding:15px 40px;text-decoration:none;font-size:.63rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;transition:background .3s}
        .blog-cta-btn:hover{background:#e2c99a}
        footer{background:#0e0e0d;padding:40px 56px;text-align:center}
        footer p{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.18em;color:rgba(255,255,255,.25)}
        @media(max-width:1024px){
          .blog-grid-all{grid-template-columns:repeat(2,1fr)}
          .article-featured{grid-template-columns:1fr}
          .art-img{min-height:240px}
        }
        @media(max-width:800px){
          nav{padding:16px 24px}
          .blog-hero-inner,.blog-body{padding-left:24px;padding-right:24px}
          .blog-grid-all{grid-template-columns:1fr}
          .blog-cta{padding:60px 24px}
          footer{padding:32px 24px}
        }
      `}</style>

      <nav id="blogNav" className="solid">
        <Link href="/" className="logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <ul className="nav-links">
          <li><Link href="/imoveis">Imóveis</Link></li>
          <li><Link href="/#avaliacao">AVM</Link></li>
          <li><Link href="/#simulador">Crédito</Link></li>
          <li><Link href="/#nhr">NHR</Link></li>
          <li><Link href="/reports">Reports</Link></li>
        </ul>
        <button
          className="nav-burger"
          id="blogBurger"
          aria-label="Abrir menu"
          aria-expanded="false"
          type="button"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className="nav-drawer" id="blogDrawer">
        <div className="nav-drawer-ov" id="blogDrawerOv" />
        <div className="nav-drawer-panel">
          <nav className="nav-drawer-links" aria-label="Menu mobile">
            <Link href="/">Início</Link>
            <Link href="/imoveis">Imóveis</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/#simulador">Crédito</Link>
            <Link href="/reports">Reports</Link>
            <Link href="/#contacto">Contacto</Link>
          </nav>
          <a href="https://wa.me/351919948986" target="_blank" rel="noopener noreferrer" className="nav-drawer-cta">Contacto →</a>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var burger=document.getElementById('blogBurger');
          var drawer=document.getElementById('blogDrawer');
          var ov=document.getElementById('blogDrawerOv');
          if(!burger||!drawer)return;
          function open(){burger.classList.add('open');drawer.classList.add('open');burger.setAttribute('aria-expanded','true');burger.setAttribute('aria-label','Fechar menu')}
          function close(){burger.classList.remove('open');drawer.classList.remove('open');burger.setAttribute('aria-expanded','false');burger.setAttribute('aria-label','Abrir menu')}
          burger.addEventListener('click',function(){drawer.classList.contains('open')?close():open()});
          ov.addEventListener('click',close);
          document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
        })();
      ` }} />

      <section className="blog-hero">
        <div className="blog-hero-inner">
          <div className="blog-eyebrow">Insights · Mercado Imobiliário Portugal 2026</div>
          <h1 className="blog-h1">
            Análises que<br/>
            <em>orientam decisões</em><br/>
            de milhões.
          </h1>
          <p className="blog-sub">
            Dados INE/AT, Savills, Knight Frank. 169.812 transacções. +17,6%.
            Lisboa Top 5 Mundial. O mercado por dentro.
          </p>
          <p className="blog-count">{SORTED_ARTICLES.length} artigos publicados</p>
        </div>
      </section>

      <div className="blog-body">
        {/* Featured article */}
        <div className="blog-featured-wrap">
          <Link href={`/blog/${featured.slug}`} className="article-featured">
            <div className="art-img" style={{ background: getGradient(featured.category) }} />
            <div className="art-body">
              <div className="art-badge">Destaque</div>
              <div className="art-cat">{featured.category}</div>
              <h2 className="art-title">{featured.title}</h2>
              <p className="art-excerpt">{featured.description}</p>
              <div className="art-meta">
                <span>{featured.readingTime} min leitura</span>
                <span>·</span>
                <span>{new Date(featured.date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                {featured.zona && <><span>·</span><span>{featured.zona}</span></>}
              </div>
            </div>
          </Link>
        </div>

        {/* All remaining articles */}
        <h2 className="blog-section-title">Todos os artigos</h2>
        <div className="blog-grid-all">
          {rest.map(art => (
            <Link key={art.slug} href={`/blog/${art.slug}`} className="article-card">
              <div className="art-card-img" style={{ background: getGradient(art.category) }} />
              <div className="art-card-body">
                <div className="art-cat">{art.category}</div>
                <h3 className="art-card-title">{art.title}</h3>
                <p className="art-card-excerpt">{art.description.substring(0, 110)}…</p>
                <div className="art-meta">
                  <span>{art.readingTime} min</span>
                  <span>·</span>
                  <span>{new Date(art.date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <section className="blog-cta">
        <h2 className="blog-cta-h">Pronto para <em>actuar</em>?</h2>
        <p className="blog-cta-p">Ver o portfolio actual ou falar directamente com um consultor — sem formulários, sem espera.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/imoveis" className="blog-cta-btn">Ver Portfolio →</Link>
          <a href="https://wa.me/351919948986?text=Olá,%20li%20o%20blog%20da%20Agency%20Group%20e%20quero%20saber%20mais." target="_blank" rel="noopener noreferrer" className="blog-cta-btn" style={{ background: '#25D366', borderColor: '#25D366' }}>Falar com Consultor →</a>
        </div>
        <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid rgba(201,169,110,0.12)' }}>
          <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '.62rem', letterSpacing: '.08em', color: 'rgba(201,169,110,.6)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Para proprietários
          </p>
          <p className="blog-cta-p" style={{ marginBottom: '20px', fontSize: '.82rem' }}>
            Está a considerar vender em Portugal?<br />Podemos avaliar o seu ativo de forma confidencial.
          </p>
          <Link href="/off-market" className="blog-cta-btn" style={{ background: 'transparent', color: '#c9a96e', border: '1px solid rgba(201,169,110,.4)' }}>
            Avaliação Confidencial →
          </Link>
        </div>
      </section>

      <footer>
        <p>© 2026 Agency Group – Mediação Imobiliária Lda · NIPC 516.833.960 · AMI 22506 · Lisboa</p>
      </footer>
    </>
  )
}
