import type { Metadata } from 'next'
import Link from 'next/link'
import { BreadcrumbJsonLd } from '@/app/components/BreadcrumbJsonLd'

export const metadata: Metadata = {
  title: 'Blog · Mercado Imobiliário Portugal 2026 · Agency Group',
  description: 'Análises de mercado, guias de compra, NHR/IFICI, zonas premium Portugal 2026. Lisboa, Cascais, Comporta, Algarve, Madeira. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog',
    languages: {
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

const ARTICLES = [
  {
    slug: 'comprar-casa-portugal-2026',
    category: 'Guia de Compra',
    title: 'Comprar Casa em Portugal 2026: O Guia Definitivo',
    excerpt: 'NIF, conta bancária, CPCV, escritura — o processo completo de ponta a ponta. IMT, IS, custos reais. O que mudou em 2026.',
    readTime: '12 min',
    date: '2026-03-01',
    image_gradient: 'linear-gradient(135deg,#1c4a35,#0c1f15)',
    featured: true,
  },
  {
    slug: 'nhr-ifici-guia-completo',
    category: 'Fiscalidade',
    title: 'NHR vs IFICI 2024: Guia Completo para Estrangeiros em Portugal',
    excerpt: '10 anos de tributação reduzida. Como funciona, quem pode candidatar-se, diferenças entre NHR clássico e IFICI 2024. Comparação com UK, EUA, França.',
    readTime: '15 min',
    date: '2026-02-15',
    image_gradient: 'linear-gradient(135deg,#2e1f08,#0c1f15)',
    featured: true,
  },
  {
    slug: 'investir-imoveis-portugal',
    category: 'Investimento',
    title: 'Investir em Imobiliário em Portugal: Yields, ROI e Zonas em 2026',
    excerpt: 'Comporta +28%, Quinta do Lago yield 2.8%, Lisboa yield 3.8%. Análise zona a zona. Onde investir em 2026 para maximizar retorno.',
    readTime: '10 min',
    date: '2026-01-20',
    image_gradient: 'linear-gradient(135deg,#0c2030,#0c1f15)',
    featured: false,
  },
  {
    slug: 'mercado-luxo-portugal-2026',
    category: 'Mercado de Luxo',
    title: 'Mercado de Luxo em Portugal 2026: Lisboa Top 5 Mundial',
    excerpt: 'Lisboa Top 5 Savills, Comporta +28%, Quinta do Lago €12.000/m². Análise completa do mercado prime — zonas, compradores internacionais e previsões 2026.',
    readTime: '12 min',
    date: '2026-02-15',
    image_gradient: 'linear-gradient(135deg,#1a0a2e,#0c1f15)',
    featured: false,
  },
]

export default function BlogPage() {
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
        .blog-body{max-width:1160px;margin:0 auto;padding:80px 56px}
        .blog-grid{display:grid;grid-template-columns:2fr 1fr;gap:48px;align-items:start}
        .article-featured{background:#fff;border:1px solid rgba(14,14,13,.08);overflow:hidden;text-decoration:none;display:block;transition:transform .3s,box-shadow .3s}
        .article-featured:hover{transform:translateY(-3px);box-shadow:0 20px 60px rgba(14,14,13,.1)}
        .art-img{height:280px}
        .art-body{padding:36px}
        .art-cat{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.22em;text-transform:uppercase;color:#c9a96e;margin-bottom:12px}
        .art-title{font-family:var(--font-cormorant),serif;font-size:1.6rem;font-weight:300;color:#0e0e0d;line-height:1.2;margin-bottom:12px}
        .art-excerpt{font-size:.83rem;line-height:1.78;color:rgba(14,14,13,.55);margin-bottom:20px}
        .art-meta{display:flex;align-items:center;gap:16px;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.12em;color:rgba(14,14,13,.35)}
        .art-meta span{color:#1c4a35;font-weight:500}
        .blog-sidebar{display:flex;flex-direction:column;gap:24px}
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
        @media(max-width:800px){
          nav{padding:16px 24px}
          .blog-hero-inner,.blog-body{padding-left:24px;padding-right:24px}
          .blog-grid{grid-template-columns:1fr}
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
        </div>
      </section>

      <div className="blog-body">
        <div className="blog-grid">
          {/* Featured article */}
          <Link href={`/blog/${ARTICLES[0].slug}`} className="article-featured">
            <div className="art-img" style={{background: ARTICLES[0].image_gradient}}></div>
            <div className="art-body">
              <div className="art-cat">{ARTICLES[0].category}</div>
              <h2 className="art-title">{ARTICLES[0].title}</h2>
              <p className="art-excerpt">{ARTICLES[0].excerpt}</p>
              <div className="art-meta">
                <span>{ARTICLES[0].readTime} leitura</span>
                <span>·</span>
                <span>{new Date(ARTICLES[0].date).toLocaleDateString('pt-PT', {year:'numeric',month:'long',day:'numeric'})}</span>
              </div>
            </div>
          </Link>

          {/* Sidebar articles */}
          <div className="blog-sidebar">
            {ARTICLES.slice(1).map(art => (
              <Link key={art.slug} href={`/blog/${art.slug}`} className="article-card">
                <div className="art-card-img" style={{background: art.image_gradient}}></div>
                <div className="art-card-body">
                  <div className="art-cat">{art.category}</div>
                  <h3 className="art-card-title">{art.title}</h3>
                  <p className="art-card-excerpt">{art.excerpt.substring(0,120)}...</p>
                  <div className="art-meta">
                    <span>{art.readTime} leitura</span>
                    <span>·</span>
                    <span>{new Date(art.date).toLocaleDateString('pt-PT', {year:'numeric',month:'short',day:'numeric'})}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className="blog-cta">
        <h2 className="blog-cta-h">Pronto para <em>actuar</em>?</h2>
        <p className="blog-cta-p">Avaliação AVM gratuita. Deal Radar 16D. Simulador de crédito. Tudo numa plataforma.</p>
        <Link href="/#avaliacao" className="blog-cta-btn">Avaliar Imóvel Agora →</Link>
      </section>

      <footer>
        <p>© 2026 Agency Group – Mediação Imobiliária Lda · NIPC 516.833.960 · AMI 22506 · Lisboa</p>
      </footer>
    </>
  )
}
