import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '葡萄牙买房2026 | Agency Group · 顶级房产顾问 · AMI 22506',
  description: '葡萄牙顶级房产：里斯本、卡斯凯什、阿尔加维。华语专业服务。NHR税务优化。免费房产估价AVM。',
  robots: 'index, follow, max-image-preview:large',
  alternates: {
    canonical: 'https://agencygroup.pt/zh',
    languages: {
      'zh-Hans': 'https://agencygroup.pt/zh',
      'pt-PT':   'https://agencygroup.pt',
      'en':      'https://agencygroup.pt/en',
    },
  },
  openGraph: {
    title: '葡萄牙顶级房产 2026 · Agency Group · AMI 22506',
    description: '里斯本、卡斯凯什、阿尔加维顶级房产。华语专业顾问。NHR税务优化。AMI 22506。',
    type: 'website',
    url: 'https://agencygroup.pt/zh',
  },
}

const MARKET_DATA = [
  { zone: '里斯本 Lisboa',      pm2: '€5,000/m²',  yoy: '+14%', desc: '全球豪宅Top 5' },
  { zone: '卡斯凯什 Cascais',   pm2: '€4,713/m²',  yoy: '+14%', desc: '大西洋岸精英生活' },
  { zone: '阿尔加维 Algarve',   pm2: '€3,941/m²',  yoy: '+18%', desc: '高尔夫·阳光·300天' },
  { zone: '波尔图 Porto',       pm2: '€3,643/m²',  yoy: '+13%', desc: '历史名城·投资价值' },
  { zone: '马德拉 Madeira',     pm2: '€3,760/m²',  yoy: '+20%', desc: '永恒春天之岛' },
  { zone: '孔波尔塔 Comporta',  pm2: '€11,000/m²', yoy: '+28%', desc: '欧洲最后净土' },
]

const FAQ = [
  {
    q: '中国人在葡萄牙买房有什么限制吗？',
    a: '没有限制。葡萄牙对外国人购房完全开放，无论国籍。购房流程：(1) 申请NIF税务号码；(2) 开立葡萄牙银行账户；(3) 签署CPCV购房预约合同并支付10–30%定金；(4) 公证处完成最终过户(Escritura)。全程约2–3个月。Agency Group(AMI 22506)提供全程中文服务。',
  },
  {
    q: '葡萄牙购房需要缴纳哪些税？',
    a: '主要购房税费：IMT房产转让税(最高6.5%，根据房价计算)，Imposto de Selo印花税0.8%，土地注册费约€500，公证费约€500，律师费约€1,500–3,000。以€500,000房产为例：总税费约€35,000，占房价7%。Agency Group提供免费税费模拟测算。',
  },
  {
    q: '什么是NHR税务制度？中国买家适用吗？',
    a: 'NHR(非惯常居民制度)是葡萄牙为吸引新居民设立的优惠税务制度：成为葡萄牙税务居民后，前10年享受境外收入免税或统一20%税率，远低于中国个税最高45%。2024年推出的IFICI制度适用于科技、研究及创意行业专业人士。Agency Group可为您对接专业税务律师。',
  },
  {
    q: '买房后可以申请葡萄牙签证或居留吗？',
    a: '可以。葡萄牙提供多种签证选择：D7被动收入签证（适合有稳定收入来源者，无最低购房金额要求）；D8数字游民签证；对于在葡萄牙有实质性投资的申请人，可咨询具体移民方案。Agency Group与持牌移民律师紧密合作，提供一站式服务。',
  },
]

const schemaLD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://agencygroup.pt/zh#localbusiness',
  name: 'Agency Group – Mediação Imobiliária Lda',
  description: '葡萄牙顶级房产顾问。提供中文专业服务。里斯本、卡斯凯什、阿尔加维、马德拉豪华房产。AMI 22506执照。',
  url: 'https://agencygroup.pt/zh',
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Lisboa',
    addressCountry: 'PT',
  },
  identifier: { '@type': 'PropertyValue', name: 'AMI', value: '22506' },
  areaServed: ['Lisboa', 'Cascais', 'Algarve', 'Porto', 'Madeira', 'Comporta'],
  availableLanguage: [
    { '@type': 'Language', name: 'Chinese' },
    { '@type': 'Language', name: 'Portuguese' },
    { '@type': 'Language', name: 'English' },
  ],
}

const schemaFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function ZhPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaLD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{font-size:16px;overflow-x:hidden}
        body{font-family:var(--font-jost),'PingFang SC','Noto Sans SC',sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        :root{--g:#1c4a35;--gd:#0c1f15;--gold:#c9a96e;--g2:#e2c99a;--cr:#f4f0e6;--ink2:rgba(14,14,13,.48)}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.94);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:var(--g)}
        .lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.68em;text-transform:uppercase;color:var(--g);margin-left:.1em}
        .lang-sw{display:flex;gap:8px;align-items:center}
        .lang-btn{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.15em;text-transform:uppercase;padding:5px 10px;border:1px solid rgba(28,74,53,.25);background:transparent;color:var(--g);cursor:pointer;text-decoration:none;opacity:.55;transition:opacity .3s,background .3s}
        .lang-btn.active,.lang-btn:hover{opacity:1;background:rgba(28,74,53,.06)}
        .hero{min-height:100vh;background:var(--gd);display:flex;align-items:flex-end;padding:0 80px 100px;position:relative;overflow:hidden}
        .hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 15% 85%,rgba(28,74,53,.55),transparent 65%),linear-gradient(155deg,#081510,#1c4a35 55%,#0a1b10)}
        .hero-content{position:relative;z-index:2;max-width:700px}
        .hero-eye{font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.28em;text-transform:uppercase;color:rgba(201,169,110,.7);margin-bottom:32px;display:flex;align-items:center;gap:16px}
        .hero-eye::before{content:'';width:28px;height:1px;background:var(--gold);flex-shrink:0}
        .hero-h1{font-family:var(--font-cormorant),serif;font-weight:300;font-size:clamp(2.4rem,5vw,4.2rem);line-height:1.1;color:#fff;letter-spacing:.02em;margin-bottom:28px}
        .hero-h1-zh{font-size:clamp(1.8rem,4vw,3.2rem);font-weight:300;color:#fff;line-height:1.3;margin-bottom:8px;letter-spacing:.05em}
        .hero-h1-sub{font-family:var(--font-dm-mono),monospace;font-size:.6rem;letter-spacing:.22em;color:rgba(201,169,110,.6);margin-bottom:32px}
        .hero-sub{font-size:.88rem;line-height:1.85;color:rgba(255,255,255,.42);max-width:420px;margin-bottom:48px;letter-spacing:.03em}
        .hero-btns{display:flex;gap:18px;flex-wrap:wrap}
        .btn-gold{display:inline-flex;align-items:center;gap:11px;background:var(--gold);color:var(--g);font-size:.63rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:15px 32px;text-decoration:none;transition:background .3s,transform .3s}
        .btn-gold:hover{background:var(--g2);transform:translateY(-2px)}
        .btn-outline{display:inline-flex;align-items:center;background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.55);font-size:.6rem;font-weight:400;letter-spacing:.12em;text-transform:uppercase;padding:14px 26px;text-decoration:none;transition:all .3s}
        .btn-outline:hover{color:#fff;border-color:rgba(255,255,255,.5)}
        .hero-stats{position:absolute;right:80px;bottom:100px;z-index:2;display:flex;flex-direction:column;gap:32px}
        .hs-n{font-family:var(--font-cormorant),serif;font-size:2.2rem;font-weight:300;color:#fff;line-height:1;letter-spacing:-.02em}
        .hs-n em{font-style:normal;color:var(--gold);font-size:1.3rem}
        .hs-l{font-size:.55rem;letter-spacing:.12em;color:rgba(255,255,255,.32);margin-top:4px}
        .stats-bar{background:var(--g);padding:40px 80px;display:flex;gap:64px;flex-wrap:wrap}
        .stat-item{flex:1;min-width:140px}
        .stat-n{font-family:var(--font-cormorant),serif;font-size:2.8rem;font-weight:300;color:#fff;line-height:1}
        .stat-n em{font-style:normal;color:var(--gold);font-size:1.6rem}
        .stat-l{font-size:.55rem;letter-spacing:.1em;color:rgba(255,255,255,.35);margin-top:6px}
        .section{padding:100px 0}
        .sw{max-width:1160px;margin:0 auto;padding:0 56px}
        .sec-eye{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);opacity:.7;margin-bottom:16px}
        .sec-h2{font-family:var(--font-cormorant),serif;font-weight:300;font-size:clamp(2rem,3.5vw,3rem);line-height:1.08;color:var(--g);margin-bottom:12px}
        .sec-h2-zh{font-size:clamp(1.6rem,3vw,2.4rem);font-weight:300;color:var(--g);margin-bottom:32px;letter-spacing:.06em;line-height:1.3}
        .why-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-top:40px}
        .why-card{background:var(--gd);padding:36px 24px}
        .why-icon{font-size:1.8rem;margin-bottom:16px}
        .why-title-zh{font-size:1rem;font-weight:400;color:var(--gold);margin-bottom:8px;letter-spacing:.08em}
        .why-title-en{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(201,169,110,.4);margin-bottom:12px}
        .why-desc{font-size:.82rem;line-height:1.85;color:rgba(244,240,230,.5);letter-spacing:.02em}
        .why-highlight{font-family:var(--font-dm-mono),monospace;font-size:.65rem;color:#fff;margin-top:12px;letter-spacing:.08em}
        .zones-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:40px}
        .zone-card{background:var(--gd);padding:32px 24px;position:relative;overflow:hidden}
        .zone-card::before{content:'';position:absolute;inset:0;background:rgba(28,74,53,.4);opacity:0;transition:opacity .4s}
        .zone-card:hover::before{opacity:1}
        .zc-tag{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,169,110,.5);margin-bottom:12px}
        .zc-name{font-size:1.1rem;font-weight:400;color:var(--cr);margin-bottom:10px;letter-spacing:.06em;line-height:1.4}
        .zc-data{display:flex;gap:16px;margin-bottom:8px}
        .zc-pm2{font-family:var(--font-dm-mono),monospace;font-size:.65rem;color:var(--gold)}
        .zc-yoy{font-family:var(--font-dm-mono),monospace;font-size:.65rem;color:rgba(244,240,230,.4)}
        .zc-desc{font-size:.78rem;color:rgba(244,240,230,.38);line-height:1.6;letter-spacing:.04em}
        .nhr-banner{background:var(--gd);padding:80px 0}
        .nhr-inner{max-width:1160px;margin:0 auto;padding:0 56px;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
        .nhr-left .sec-h2{color:var(--cr)}
        .nhr-left .sec-h2-zh{color:var(--cr)}
        .nhr-left .sec-eye{color:rgba(201,169,110,.7)}
        .nhr-left p{font-size:.88rem;line-height:1.85;color:rgba(244,240,230,.5);margin-bottom:28px;letter-spacing:.02em}
        .nhr-left a{display:inline-block;background:var(--gold);color:var(--g);padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;transition:background .3s}
        .nhr-left a:hover{background:var(--g2)}
        .nhr-right{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .nhr-stat{background:rgba(255,255,255,.04);border:1px solid rgba(201,169,110,.12);padding:24px}
        .ns-country-zh{font-size:.85rem;color:rgba(244,240,230,.4);margin-bottom:4px;letter-spacing:.06em}
        .ns-rate{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:rgba(244,240,230,.7);line-height:1;margin-bottom:4px}
        .ns-arrow{font-size:.9rem;color:var(--gold);margin-bottom:4px}
        .ns-pt{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:var(--gold);line-height:1}
        .faq-section{padding:80px 0;background:var(--cr)}
        .faq-list{margin-top:40px;display:flex;flex-direction:column;gap:0}
        .faq-item{border-bottom:1px solid rgba(14,14,13,.1);padding:28px 0}
        .faq-q{font-size:1rem;font-weight:400;color:var(--g);margin-bottom:12px;letter-spacing:.04em;line-height:1.5}
        .faq-a{font-size:.85rem;line-height:1.85;color:var(--ink2);letter-spacing:.02em}
        .wechat-note{display:inline-flex;align-items:center;gap:8px;background:rgba(28,74,53,.08);border:1px solid rgba(28,74,53,.15);padding:10px 18px;font-size:.8rem;color:var(--g);letter-spacing:.04em;margin-top:16px}
        .contact-bar{background:#0e0e0d;padding:48px 0}
        .cb-inner{max-width:1160px;margin:0 auto;padding:0 56px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:32px}
        .cb-items{display:flex;gap:40px;flex-wrap:wrap}
        .cb-lbl{font-size:.55rem;letter-spacing:.12em;color:rgba(255,255,255,.25);display:block;margin-bottom:4px}
        .cb-val{font-size:.88rem;color:rgba(255,255,255,.7);text-decoration:none}
        .wa-btn{display:inline-flex;align-items:center;gap:10px;background:#25D366;color:#fff;padding:13px 28px;text-decoration:none;font-size:.68rem;letter-spacing:.1em;transition:background .3s,transform .3s;flex-shrink:0}
        .wa-btn:hover{background:#1ebe59;transform:translateY(-1px)}
        footer{background:#080808;padding:32px 56px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        footer p{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(255,255,255,.2)}
        .footer-zh{font-size:.55rem;letter-spacing:.06em;color:rgba(201,169,110,.4)}
        @media(max-width:1000px){
          nav{padding:16px 24px}
          .sw{padding-left:24px;padding-right:24px}
          .stats-bar{padding:32px 24px;gap:32px}
          .hero{padding:0 24px 80px}
          .hero-stats{display:none}
          .why-grid{grid-template-columns:1fr 1fr}
          .zones-grid{grid-template-columns:1fr}
          .nhr-inner{padding-left:24px;padding-right:24px;grid-template-columns:1fr}
          .nhr-right{grid-template-columns:repeat(2,1fr)}
          .cb-inner{padding-left:24px;padding-right:24px}
          .cb-items{gap:20px}
          footer{padding:24px}
        }
        @media(max-width:600px){
          .why-grid{grid-template-columns:1fr}
          .nhr-right{grid-template-columns:1fr 1fr}
        }
      `}</style>

      {/* Navigation */}
      <nav>
        <Link href="/" className="logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <div className="lang-sw">
          <Link href="/"    className="lang-btn">PT</Link>
          <Link href="/en"  className="lang-btn">EN</Link>
          <Link href="/fr"  className="lang-btn">FR</Link>
          <Link href="/de"  className="lang-btn">DE</Link>
          <Link href="/zh"  className="lang-btn active">中文</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <div className="hero-eye">Lisboa · Portugal · AMI 22506</div>
          <div className="hero-h1-zh">葡萄牙顶级房产</div>
          <h1 className="hero-h1">
            里斯本 · 卡斯凯什 · 阿尔加维
          </h1>
          <div className="hero-h1-sub">LUXURY REAL ESTATE · CHINESE-SPEAKING ADVISORS</div>
          <p className="hero-sub">
            专业华语房产顾问 · AMI 22506执照<br/>
            €500K–€10M · 全程中文服务<br/>
            NHR税务优化 · 欧盟法律保障
          </p>
          <div className="hero-btns">
            <Link href="/#avaliacao" className="btn-gold">免费房产估价 AVM →</Link>
            <Link href="/#deal-radar" className="btn-outline">Deal Radar 16D</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <div className="hs-n">169<em>K</em></div>
            <div className="hs-l">2025年成交笔数</div>
          </div>
          <div>
            <div className="hs-n">+17<em>%</em></div>
            <div className="hs-l">年涨幅</div>
          </div>
          <div>
            <div className="hs-n">Top<em>5</em></div>
            <div className="hs-l">全球豪宅排名</div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="stats-bar">
        {[
          { n: '169', e: 'K',  l: '2025年成交笔数' },
          { n: '+17', e: '%',  l: '年均涨幅' },
          { n: 'Top', e: '5',  l: '全球豪宅' },
          { n: '44',  e: '%',  l: '国际买家占比' },
        ].map(s => (
          <div key={s.l} className="stat-item">
            <div className="stat-n">{s.n}<em>{s.e}</em></div>
            <div className="stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Why Portugal */}
      <section className="section">
        <div className="sw">
          <div className="sec-eye">投资葡萄牙 · Portugal 2026</div>
          <h2 className="sec-h2">为何选择</h2>
          <div className="sec-h2-zh">葡萄牙？</div>
          <div className="why-grid">
            <div className="why-card">
              <div className="why-icon">🏛</div>
              <div className="why-title-zh">税务优化 NHR / IFICI</div>
              <div className="why-title-en">Tax Optimization</div>
              <p className="why-desc">成为葡萄牙税务居民，前10年享受境外收入统一税率20%，远低于国内最高45%个税，实现合法税务优化。</p>
              <div className="why-highlight">统一税率 20%</div>
            </div>
            <div className="why-card">
              <div className="why-icon">📈</div>
              <div className="why-title-zh">资产保值增值</div>
              <div className="why-title-en">Asset Appreciation</div>
              <p className="why-desc">2025年年涨幅+17.6%，里斯本入选全球豪宅Top 5。欧元资产对冲汇率风险，稳健增值。</p>
              <div className="why-highlight">+17.6% · 2025年</div>
            </div>
            <div className="why-card">
              <div className="why-icon">⚖</div>
              <div className="why-title-zh">欧盟成员国</div>
              <div className="why-title-en">EU Legal Security</div>
              <p className="why-desc">葡萄牙是欧盟成员国，完善法律体系保障产权安全。公证过户制度，透明土地注册，资产有保障。</p>
              <div className="why-highlight">EU法律 · 产权保障</div>
            </div>
            <div className="why-card">
              <div className="why-icon">🌟</div>
              <div className="why-title-zh">高品质生活</div>
              <div className="why-title-en">Quality of Life</div>
              <p className="why-desc">全球最安全国家之一。优质教育资源，国际学校，地中海气候，美食文化，子女成长最佳环境。</p>
              <div className="why-highlight">全球最安全 Top 10</div>
            </div>
          </div>
        </div>
      </section>

      {/* Market zones */}
      <section className="section" style={{ background: '#fff', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="sw">
          <div className="sec-eye">市场数据 · Portugal 2026</div>
          <h2 className="sec-h2">核心区域</h2>
          <div className="sec-h2-zh">房价一览</div>
          <div className="zones-grid">
            {MARKET_DATA.map(z => (
              <div key={z.zone} className="zone-card">
                <div className="zc-tag">Premium Market</div>
                <div className="zc-name">{z.zone}</div>
                <div className="zc-data">
                  <span className="zc-pm2">{z.pm2}</span>
                  <span className="zc-yoy">{z.yoy}</span>
                </div>
                <div className="zc-desc">{z.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NHR / Tax Banner */}
      <section className="nhr-banner" id="shuiwu">
        <div className="nhr-inner">
          <div className="nhr-left">
            <div className="sec-eye">税务制度 · NHR / IFICI</div>
            <h2 className="sec-h2" style={{ color: 'var(--cr)' }}>10年</h2>
            <div className="sec-h2-zh" style={{ color: 'var(--gold)' }}>优惠税率</div>
            <p>
              葡萄牙NHR(非惯常居民)制度是全球最具吸引力的税务优惠方案之一。
              新居民前10年可享受境外收入统一20%税率或免税。
              适合有海外收入、投资收益的高净值人士。
            </p>
            <Link href="/blog/nhr-ifici-guia-completo">阅读完整指南 →</Link>
          </div>
          <div className="nhr-right">
            {[
              { country: '中国',    from: '35–45%', to: '20%' },
              { country: '英国',    from: '40–45%', to: '20%' },
              { country: '美国',    from: '32–37%', to: '20%' },
              { country: '德国',    from: '37–47%', to: '20%' },
            ].map(n => (
              <div key={n.country} className="nhr-stat">
                <div className="ns-country-zh">{n.country}</div>
                <div className="ns-rate">{n.from}</div>
                <div className="ns-arrow">↓ NHR</div>
                <div className="ns-pt">{n.to}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="wenti">
        <div className="sw">
          <div className="sec-eye">常见问题 · 华语专业解答</div>
          <h2 className="sec-h2">常见问题</h2>
          <div className="faq-list">
            {FAQ.map(f => (
              <div key={f.q} className="faq-item">
                <div className="faq-q">{f.q}</div>
                <p className="faq-a">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact bar */}
      <div className="contact-bar" id="lianxi">
        <div className="cb-inner">
          <div className="cb-items">
            <div><span className="cb-lbl">电话</span><a href="tel:+351919948986" className="cb-val">+351 919 948 986</a></div>
            <div><span className="cb-lbl">邮箱</span><a href="mailto:geral@agencygroup.pt" className="cb-val">geral@agencygroup.pt</a></div>
            <div><span className="cb-lbl">办公室</span><span className="cb-val">Amoreiras Square, 里斯本</span></div>
            <div><span className="cb-lbl">执照</span><span className="cb-val" style={{ color: 'var(--gold)', fontWeight: 500 }}>AMI 22506</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
            <a
              href="https://wa.me/351919948986?text=%E6%82%A8%E5%A5%BD%EF%BC%8C%E6%88%91%E5%AF%B9%E8%91%A1%E8%90%84%E7%89%99%E6%88%BF%E4%BA%A7%E6%8A%95%E8%B5%84%E6%84%9F%E5%85%B4%E8%B6%A3%EF%BC%8C%E5%B8%8C%E6%9C%9B%E4%BA%86%E8%A7%A3%E6%9B%B4%E5%A4%9A%E4%BF%A1%E6%81%AF%E3%80%82"
              target="_blank"
              rel="noreferrer"
              className="wa-btn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp咨询
            </a>
            <div className="wechat-note">
              <span>💬</span>
              <span>微信咨询也可 · WeChat available</span>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <p>© 2026 Agency Group – Mediação Imobiliária Lda · NIPC 516.833.960 · Lisboa, Portugal</p>
        <p className="footer-zh">AMI 22506 · 华语专业服务 · 持牌房产顾问</p>
      </footer>
    </>
  )
}
