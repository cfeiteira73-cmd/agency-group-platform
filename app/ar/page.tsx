import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عقارات فاخرة في البرتغال 2026 | Agency Group · AMI 22506',
  description: 'أفضل العقارات الفاخرة في البرتغال: لشبونة، كاشكايش، الألغارفي. استشارة عربية متخصصة. مزايا ضريبية NHR. تقييم مجاني.',
  robots: 'index, follow, max-image-preview:large',
  alternates: {
    canonical: 'https://agencygroup.pt/ar',
    languages: {
      'ar': 'https://agencygroup.pt/ar',
      'en': 'https://agencygroup.pt/en',
      'pt-PT': 'https://agencygroup.pt',
    },
  },
  openGraph: {
    title: 'عقارات فاخرة في البرتغال 2026 | Agency Group · AMI 22506',
    description: 'أفضل العقارات الفاخرة في البرتغال: لشبونة، كاشكايش، الألغارفي. استشارة عربية متخصصة.',
    type: 'website',
    url: 'https://agencygroup.pt/ar',
    locale: 'ar_AE',
  },
}

const schemaLocalBusiness = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://agencygroup.pt/#localbusiness-ar',
  name: 'Agency Group – وكالة عقارية مرخصة',
  description: 'وكالة عقارية متخصصة في الفخامة في البرتغال. خبراء في لشبونة، كاشكايش، كومبورتا، الألغارفي وماديرا. AMI 22506.',
  url: 'https://agencygroup.pt/ar',
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Lisboa',
    addressLocality: 'لشبونة',
    postalCode: '1000-001',
    addressCountry: 'PT',
  },
  identifier: {
    '@type': 'PropertyValue',
    name: 'AMI',
    value: '22506',
  },
  priceRange: '€€€€',
}

const schemaFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'هل يمكن للمواطنين الخليجيين شراء عقارات في البرتغال؟',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'نعم، لا توجد قيود على الأجانب في شراء العقارات في البرتغال. يمكن للمواطنين من دول الخليج ومن جميع أنحاء العالم شراء العقارات بحرية تامة مع حماية قانونية كاملة بموجب القانون الأوروبي.',
      },
    },
    {
      '@type': 'Question',
      name: 'ما هي الضرائب عند شراء عقار في البرتغال؟',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ضريبة النقل (IMT) 6.5%، طابع الدمغة 0.8%، والرسوم النوترية حوالي €2,000. لعقار بقيمة €1,000,000 تكون التكاليف الإجمالية حوالي €75,000 (7.5% من قيمة العقار).',
      },
    },
    {
      '@type': 'Question',
      name: 'هل البرتغال آمنة للاستثمار؟',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'نعم، البرتغال عضو في الاتحاد الأوروبي، تحتل المرتبة الثانية عالمياً في الأمان، وتتمتع بنظام قانوني شفاف وموثوق. الاستثمار العقاري محمي بالكامل بموجب القانون الأوروبي.',
      },
    },
    {
      '@type': 'Question',
      name: 'كيف يمكنني الحصول على التأشيرة مع شراء عقار؟',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'نقدم استشارات شاملة حول تأشيرات D7 وD8 وخيارات الإقامة المتاحة. تأشيرة D7 تتطلب دخلاً سلبياً بحد أدنى €760/شهر، بينما تأشيرة D8 للعمل عن بُعد تتطلب €3,040/شهر.',
      },
    },
  ],
}

export default function ArPage() {
  return (
    <div dir="rtl" lang="ar" style={{ fontFamily: "'Noto Kufi Arabic', 'Cairo', sans-serif", background: '#f4f0e6', color: '#0e0e0d', overflowX: 'hidden' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaLocalBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@300;400;500&family=Cairo:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{font-size:16px;overflow-x:hidden}
        body{-webkit-font-smoothing:antialiased}
        :root{--g:#1c4a35;--gd:#0c1f15;--gold:#c9a96e;--g2:#e2c99a;--cr:#f4f0e6;--ink2:rgba(14,14,13,.48)}
        .ar-nav{position:fixed;top:0;right:0;left:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.94);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .ar-logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .ar-la{font-family:'Cairo',sans-serif;font-weight:400;font-size:.95rem;letter-spacing:.04em;color:var(--g)}
        .ar-nav-links{display:flex;gap:32px;list-style:none;flex-direction:row-reverse}
        .ar-nav-links a{font-size:.72rem;font-weight:400;letter-spacing:.04em;color:var(--g);text-decoration:none;opacity:.55;transition:opacity .3s}
        .ar-nav-links a:hover{opacity:1}
        .ar-lang-sw{display:flex;gap:8px;align-items:center;flex-direction:row-reverse}
        .ar-lang-btn{font-size:.6rem;letter-spacing:.04em;padding:5px 10px;border:1px solid rgba(28,74,53,.25);background:transparent;color:var(--g);cursor:pointer;text-decoration:none;opacity:.55;transition:opacity .3s,background .3s}
        .ar-lang-btn.active,.ar-lang-btn:hover{opacity:1;background:rgba(28,74,53,.06)}
        .ar-hero{min-height:100vh;background:var(--gd);display:flex;align-items:flex-end;padding:0 80px 100px;position:relative;overflow:hidden}
        .ar-hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 85% 85%,rgba(28,74,53,.55),transparent 65%),linear-gradient(155deg,#081510,#1c4a35 55%,#0a1b10)}
        .ar-hero-content{position:relative;z-index:2;max-width:750px;text-align:right}
        .ar-hero-eyebrow{font-size:.72rem;letter-spacing:.04em;color:rgba(201,169,110,.7);margin-bottom:28px;display:flex;align-items:center;gap:16px;justify-content:flex-end}
        .ar-hero-eyebrow::after{content:'';width:28px;height:1px;background:var(--gold);flex-shrink:0}
        .ar-badge{display:inline-block;border:1px solid rgba(201,169,110,.4);padding:6px 16px;font-size:.7rem;color:rgba(201,169,110,.85);letter-spacing:.04em;margin-bottom:28px}
        .ar-hero-h1{font-weight:400;font-size:clamp(2.4rem,4.5vw,4rem);line-height:1.2;color:#fff;margin-bottom:24px}
        .ar-hero-h1 em{font-style:normal;color:var(--g2)}
        .ar-hero-sub{font-size:.95rem;line-height:2;color:rgba(255,255,255,.42);max-width:480px;margin-bottom:40px;margin-right:auto;margin-left:0}
        .ar-hero-stats-text{font-size:.8rem;color:rgba(201,169,110,.6);letter-spacing:.04em;margin-bottom:48px}
        .ar-hero-btns{display:flex;gap:18px;flex-wrap:wrap;justify-content:flex-end}
        .ar-btn-gold{display:inline-flex;align-items:center;gap:11px;background:var(--gold);color:var(--g);font-size:.72rem;font-weight:500;letter-spacing:.04em;padding:15px 32px;text-decoration:none;transition:background .3s,transform .3s}
        .ar-btn-gold:hover{background:var(--g2);transform:translateY(-2px)}
        .ar-btn-outline{display:inline-flex;align-items:center;background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.55);font-size:.7rem;font-weight:400;letter-spacing:.04em;padding:14px 26px;text-decoration:none;transition:all .3s}
        .ar-btn-outline:hover{color:#fff;border-color:rgba(255,255,255,.5)}
        .ar-mq{background:var(--g);padding:12px 0;overflow:hidden}
        .ar-mq-track{display:flex;white-space:nowrap;animation:mqAnimAr 32s linear infinite}
        @keyframes mqAnimAr{to{transform:translateX(50%)}}
        .ar-mq-item{display:inline-flex;align-items:center;gap:28px;padding:0 28px;font-size:.62rem;letter-spacing:.04em;color:rgba(255,255,255,.38);flex-shrink:0}
        .ar-mq-item span{color:var(--gold)}
        .ar-mq-sep{width:3px;height:3px;border-radius:50%;background:rgba(201,169,110,.4);flex-shrink:0}
        .ar-section{padding:100px 0}
        .ar-sw{max-width:1160px;margin:0 auto;padding:0 56px}
        .ar-sec-eye{font-size:.62rem;letter-spacing:.04em;color:var(--gold);opacity:.7;margin-bottom:16px;text-align:right}
        .ar-sec-h2{font-weight:400;font-size:clamp(1.8rem,3.2vw,2.8rem);line-height:1.2;color:var(--g);margin-bottom:36px;text-align:right}
        .ar-cards-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:48px}
        .ar-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:36px;text-align:right}
        .ar-card-icon{width:40px;height:40px;background:var(--g);display:flex;align-items:center;justify-content:center;margin-bottom:20px;margin-right:auto}
        .ar-card-title{font-weight:500;font-size:1.05rem;color:var(--g);margin-bottom:12px}
        .ar-card-desc{font-size:.88rem;line-height:1.9;color:var(--ink2)}
        .ar-table-wrap{overflow-x:auto;margin-top:48px}
        .ar-table{width:100%;border-collapse:collapse;text-align:right}
        .ar-table th{background:var(--gd);color:var(--gold);font-weight:400;font-size:.75rem;padding:14px 20px;letter-spacing:.04em;border-bottom:2px solid rgba(201,169,110,.25)}
        .ar-table td{padding:14px 20px;font-size:.85rem;border-bottom:1px solid rgba(14,14,13,.06);color:#0e0e0d}
        .ar-table tr:hover td{background:rgba(28,74,53,.03)}
        .ar-table td:first-child{font-weight:500;color:var(--g)}
        .ar-profiles-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:48px}
        .ar-profile{background:var(--gd);padding:40px 32px;text-align:right}
        .ar-profile-tag{font-size:.62rem;color:rgba(201,169,110,.5);letter-spacing:.04em;margin-bottom:12px}
        .ar-profile-title{font-weight:500;font-size:1.1rem;color:#fff;margin-bottom:12px}
        .ar-profile-budget{font-size:.8rem;color:var(--gold);margin-bottom:12px}
        .ar-profile-desc{font-size:.82rem;color:rgba(244,240,230,.45);line-height:1.8}
        .ar-visa-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:48px}
        .ar-visa-card{border:1px solid rgba(201,169,110,.25);padding:36px;text-align:right;background:rgba(201,169,110,.03)}
        .ar-visa-tag{font-size:.62rem;color:var(--gold);letter-spacing:.04em;margin-bottom:10px}
        .ar-visa-title{font-weight:500;font-size:1.1rem;color:var(--g);margin-bottom:10px}
        .ar-visa-req{font-size:.78rem;color:var(--ink2);margin-bottom:8px}
        .ar-visa-note{background:rgba(201,169,110,.08);border-right:3px solid var(--gold);padding:16px 20px;font-size:.82rem;color:var(--ink2);line-height:1.8;margin-top:32px;text-align:right}
        .ar-faq{margin-top:48px}
        .ar-faq-item{border-bottom:1px solid rgba(14,14,13,.08);padding:28px 0}
        .ar-faq-q{font-weight:500;font-size:.95rem;color:var(--g);margin-bottom:12px;text-align:right}
        .ar-faq-a{font-size:.85rem;line-height:1.9;color:var(--ink2);text-align:right}
        .ar-contact-bar{background:#0e0e0d;padding:64px 0}
        .ar-cb-inner{max-width:1160px;margin:0 auto;padding:0 56px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:32px}
        .ar-cb-items{display:flex;gap:48px;flex-wrap:wrap;flex-direction:row-reverse}
        .ar-cb-item{text-align:right}
        .ar-cb-lbl{font-size:.6rem;letter-spacing:.04em;color:rgba(255,255,255,.25);display:block;margin-bottom:4px}
        .ar-cb-val{font-size:.9rem;color:rgba(255,255,255,.7);text-decoration:none}
        .ar-wa-btn{display:inline-flex;align-items:center;gap:10px;background:#25D366;color:#fff;padding:14px 28px;text-decoration:none;font-size:.72rem;letter-spacing:.04em;transition:background .3s,transform .3s;flex-shrink:0}
        .ar-wa-btn:hover{background:#1ebe59;transform:translateY(-1px)}
        .ar-lang-note{font-size:.75rem;color:rgba(255,255,255,.3);margin-top:12px;text-align:right}
        .ar-footer{background:#080808;padding:32px 56px;display:flex;align-items:center;justify-content:space-between;flex-direction:row-reverse}
        .ar-footer p{font-size:.6rem;letter-spacing:.04em;color:rgba(255,255,255,.2)}
        @media(max-width:1000px){
          .ar-nav{padding:16px 24px}
          .ar-sw{padding-left:24px;padding-right:24px}
          .ar-hero{padding:0 24px 80px}
          .ar-hero-sub{margin-right:0}
          .ar-cards-grid{grid-template-columns:1fr}
          .ar-profiles-grid{grid-template-columns:1fr}
          .ar-visa-grid{grid-template-columns:1fr}
          .ar-cb-inner{padding:0 24px;flex-direction:column;align-items:flex-end}
          .ar-cb-items{gap:24px}
          .ar-footer{flex-direction:column;gap:16px;padding:24px;align-items:flex-end}
          .ar-nav-links{display:none}
        }
      `}</style>

      {/* Navigation */}
      <nav className="ar-nav">
        <div className="ar-lang-sw">
          <a href="/" className="ar-lang-btn">PT</a>
          <a href="/en" className="ar-lang-btn">EN</a>
          <a href="/ar" className="ar-lang-btn active">AR</a>
        </div>
        <ul className="ar-nav-links">
          <li><a href="#contact">تواصل معنا</a></li>
          <li><a href="#visa">التأشيرات</a></li>
          <li><a href="#markets">الأسواق</a></li>
          <li><a href="#why">لماذا البرتغال</a></li>
        </ul>
        <a href="/" className="ar-logo">
          <span className="ar-la">Agency Group</span>
        </a>
      </nav>

      {/* Hero Section */}
      <section className="ar-hero">
        <div className="ar-hero-bg"></div>
        <div className="ar-hero-content">
          <div className="ar-badge">وكالة مرخصة AMI 22506</div>
          <div className="ar-hero-eyebrow">لشبونة · البرتغال</div>
          <h1 className="ar-hero-h1">
            استثمر في البرتغال —<br/>
            <em>الوجهة الأولى للعقارات الفاخرة</em>
          </h1>
          <p className="ar-hero-sub">
            أفضل العقارات في لشبونة · كاشكايش · كومبورتا · الألغارفي
          </p>
          <p className="ar-hero-stats-text">
            169,000 صفقة · +17% نمو سنوي · المركز الخامس عالمياً في الفخامة
          </p>
          <div className="ar-hero-btns">
            <a href="#contact" className="ar-btn-gold">تواصل مع مستشارنا ←</a>
            <a href="#markets" className="ar-btn-outline">بيانات السوق</a>
          </div>
        </div>
      </section>

      {/* Market ticker */}
      <div className="ar-mq">
        <div className="ar-mq-track">
          {[...Array(2)].map((_, r) => (
            <span key={r} style={{ display: 'contents' }}>
              {[
                ['لشبونة', '€5,000/م²'],
                ['كاشكايش', '€4,713/م²'],
                ['كومبورتا', '€4,200/م²'],
                ['الألغارفي', '€3,941/م²'],
                ['ماديرا', '€3,760/م²'],
                ['البرتغال 2025', '+17.6%'],
              ].map(([zone, val], i) => (
                <span key={`${r}-${i}`} style={{ display: 'contents' }}>
                  <span className="ar-mq-item">{zone} <span>{val}</span></span>
                  <span className="ar-mq-sep"></span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Why Portugal */}
      <section className="ar-section" id="why" style={{ background: '#fff' }}>
        <div className="ar-sw">
          <div className="ar-sec-eye">مزايا الاستثمار</div>
          <h2 className="ar-sec-h2">لماذا البرتغال؟</h2>
          <div className="ar-cards-grid">
            <div className="ar-card">
              <div className="ar-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" width="18" height="18"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <div className="ar-card-title">مزايا ضريبية استثنائية</div>
              <p className="ar-card-desc">نظام NHR/IFICI: نسبة ضريبية ثابتة 20% فقط على الدخل المؤهل لمدة 10 سنوات. إعفاء كامل من الضريبة على الدخل الأجنبي في كثير من الحالات.</p>
            </div>
            <div className="ar-card">
              <div className="ar-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="ar-card-title">نمو قوي للاستثمار</div>
              <p className="ar-card-desc">نمو سنوي +17.6% في 2025، أعلى معدل في أوروبا. 169,812 معاملة عقارية. السوق الأكثر ديناميكية وجاذبية للاستثمار الأجنبي في القارة.</p>
            </div>
            <div className="ar-card">
              <div className="ar-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className="ar-card-title">أمان قانوني أوروبي</div>
              <p className="ar-card-desc">عضو الاتحاد الأوروبي منذ 1986، حماية قانونية كاملة للملكية، نظام قضائي مستقل وشفاف. المرتبة الثانية عالمياً في السلامة الشخصية.</p>
            </div>
            <div className="ar-card">
              <div className="ar-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              </div>
              <div className="ar-card-title">أسلوب حياة استثنائي</div>
              <p className="ar-card-desc">أفضل وجهات الفخامة عالمياً — المركز الخامس عالمياً. طقس مثالي، مطبخ عالمي المستوى، مجتمع دولي راقٍ، وبنية تحتية حديثة متكاملة.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Data Table */}
      <section className="ar-section" id="markets" style={{ background: 'var(--cr)' }}>
        <div className="ar-sw">
          <div className="ar-sec-eye">بيانات السوق 2026</div>
          <h2 className="ar-sec-h2">أسعار السوق والعوائد</h2>
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>المنطقة</th>
                  <th>متوسط السعر</th>
                  <th>النمو السنوي</th>
                  <th>العائد السنوي</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { zone: 'لشبونة', price: '€5,000/م²', yoy: '+14%', yield_: '3.2%' },
                  { zone: 'كاشكايش', price: '€4,713/م²', yoy: '+12%', yield_: '3.8%' },
                  { zone: 'كومبورتا', price: '€4,200/م²', yoy: '+22%', yield_: '4.0%' },
                  { zone: 'الألغارفي', price: '€3,941/م²', yoy: '+11%', yield_: '4.8%' },
                  { zone: 'ماديرا', price: '€3,760/م²', yoy: '+18%', yield_: '4.5%' },
                ].map((row) => (
                  <tr key={row.zone}>
                    <td>{row.zone}</td>
                    <td style={{ color: '#1c4a35', fontWeight: 500 }}>{row.price}</td>
                    <td style={{ color: '#c9a96e' }}>{row.yoy}</td>
                    <td>{row.yield_}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Investment Profiles */}
      <section className="ar-section" style={{ background: 'var(--gd)', padding: '80px 0' }}>
        <div className="ar-sw">
          <div className="ar-sec-eye" style={{ color: 'rgba(201,169,110,.7)' }}>ملفات المستثمرين</div>
          <h2 className="ar-sec-h2" style={{ color: '#f4f0e6' }}>من يستثمر في البرتغال؟</h2>
          <div className="ar-profiles-grid">
            <div className="ar-profile">
              <div className="ar-profile-tag">HNWI · أفراد الثروات العالية</div>
              <div className="ar-profile-title">عائلات ذات الثروات العالية</div>
              <div className="ar-profile-budget">€2M – €10M</div>
              <p className="ar-profile-desc">كومبورتا ولشبونة الفاخرة. فلل حصرية، شقق تاريخية مرممة، عقارات على الواجهة البحرية. متوسط وقت القرار 1-3 أشهر.</p>
            </div>
            <div className="ar-profile">
              <div className="ar-profile-tag">Family Offices · المكاتب العائلية</div>
              <div className="ar-profile-title">المكاتب العائلية</div>
              <div className="ar-profile-budget">€5M+</div>
              <p className="ar-profile-desc">تنويع المحفظة الاستثمارية، عقارات حصرية للتأجير الفاخر أو الاستخدام الخاص. عوائد مستقرة مع نمو رأسمالي طويل المدى.</p>
            </div>
            <div className="ar-profile">
              <div className="ar-profile-tag">Investors · المستثمرون العقاريون</div>
              <div className="ar-profile-title">المستثمرون العقاريون</div>
              <div className="ar-profile-budget">€500K – €3M</div>
              <p className="ar-profile-desc">عوائد إيجارية مرتفعة 4-8% سنوياً، تقدر رأس المال +17% سنوياً. الألغارفي وكاشكايش للتأجير الموسمي، لشبونة للتأجير طويل الأمد.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Visa Section */}
      <section className="ar-section" id="visa" style={{ background: '#fff' }}>
        <div className="ar-sw">
          <div className="ar-sec-eye">خيارات الإقامة</div>
          <h2 className="ar-sec-h2">خيارات الإقامة في البرتغال</h2>
          <div className="ar-visa-grid">
            <div className="ar-visa-card">
              <div className="ar-visa-tag">D7 VISA</div>
              <div className="ar-visa-title">تأشيرة الدخل السلبي</div>
              <p className="ar-visa-req">الحد الأدنى للدخل: <strong>€760/شهر</strong></p>
              <p className="ar-visa-req" style={{ fontSize: '.82rem', color: 'var(--ink2)', lineHeight: '1.8' }}>
                مثالية لأصحاب الدخل السلبي، المتقاعدين، وأصحاب العقارات المؤجرة. إقامة كاملة في البرتغال مع حق الوصول إلى منطقة شنغن.
              </p>
            </div>
            <div className="ar-visa-card">
              <div className="ar-visa-tag">D8 VISA</div>
              <div className="ar-visa-title">تأشيرة العمل عن بُعد</div>
              <p className="ar-visa-req">الحد الأدنى للدخل: <strong>€3,040/شهر</strong></p>
              <p className="ar-visa-req" style={{ fontSize: '.82rem', color: 'var(--ink2)', lineHeight: '1.8' }}>
                للعاملين عن بُعد ورواد الأعمال الرقميين. إقامة قانونية كاملة في البرتغال مع الاستفادة من نظام الضرائب التفضيلي NHR/IFICI.
              </p>
            </div>
          </div>
          <div className="ar-visa-note">
            <strong>ملاحظة مهمة:</strong> تأشيرة الذهب العقارية (Golden Visa) متوقفة للعقارات السكنية منذ 2023. بدائل متاحة — تواصل معنا للحصول على استشارة مخصصة حول أفضل خيار للإقامة لحالتك.
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="ar-section" style={{ background: 'var(--cr)' }}>
        <div className="ar-sw">
          <div className="ar-sec-eye">الأسئلة الشائعة</div>
          <h2 className="ar-sec-h2">أسئلة المستثمرين العرب</h2>
          <div className="ar-faq">
            {[
              {
                q: 'هل يمكن للمواطنين الخليجيين شراء عقارات في البرتغال؟',
                a: 'نعم، لا توجد قيود على الأجانب في شراء العقارات في البرتغال. يمكن للمواطنين من دول الخليج ومن جميع أنحاء العالم شراء العقارات بحرية تامة مع حماية قانونية كاملة بموجب القانون الأوروبي.',
              },
              {
                q: 'ما هي الضرائب عند شراء عقار في البرتغال؟',
                a: 'ضريبة النقل (IMT) 6.5%، طابع الدمغة 0.8%، والرسوم النوترية حوالي €2,000. لعقار بقيمة €1,000,000 تكون التكاليف الإجمالية حوالي €75,000. نقدم محاكاة مجانية وتفصيلية لكل صفقة.',
              },
              {
                q: 'هل البرتغال آمنة للاستثمار؟',
                a: 'نعم، البرتغال عضو في الاتحاد الأوروبي، تحتل المرتبة الثانية عالمياً في الأمان، وتتمتع بنظام قانوني شفاف وموثوق. الاستثمار العقاري محمي بالكامل بموجب القانون الأوروبي.',
              },
              {
                q: 'كيف يمكنني الحصول على التأشيرة مع شراء عقار؟',
                a: 'نقدم استشارات شاملة حول تأشيرات D7 وD8 وخيارات الإقامة المتاحة. تأشيرة D7 تتطلب دخلاً سلبياً بحد أدنى €760/شهر، بينما تأشيرة D8 للعمل عن بُعد تتطلب €3,040/شهر.',
              },
            ].map((item, idx) => (
              <div key={idx} className="ar-faq-item">
                <div className="ar-faq-q">{item.q}</div>
                <div className="ar-faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <div className="ar-contact-bar" id="contact">
        <div className="ar-cb-inner">
          <div className="ar-cb-items">
            <div className="ar-cb-item">
              <span className="ar-cb-lbl">هاتف</span>
              <a href="tel:+351919948986" className="ar-cb-val">+351 919 948 986</a>
            </div>
            <div className="ar-cb-item">
              <span className="ar-cb-lbl">البريد الإلكتروني</span>
              <a href="mailto:geral@agencygroup.pt" className="ar-cb-val">geral@agencygroup.pt</a>
            </div>
            <div className="ar-cb-item">
              <span className="ar-cb-lbl">الترخيص</span>
              <span className="ar-cb-val" style={{ color: '#c9a96e', fontWeight: 500 }}>AMI 22506</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <a
              href="https://wa.me/351919948986?text=مرحباً٪20أود٪20الاستفسار٪20عن٪20العقارات٪20الفاخرة٪20في٪20البرتغال"
              target="_blank"
              rel="noreferrer"
              className="ar-wa-btn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              تواصل معنا عبر واتساب
            </a>
            <p className="ar-lang-note">نتحدث العربية والإنجليزية والبرتغالية والفرنسية</p>
          </div>
        </div>
      </div>

      <footer className="ar-footer">
        <p>AMI 22506 · وكالة عقارية مرخصة في البرتغال</p>
        <p>© 2026 Agency Group – Mediação Imobiliária Lda · لشبونة، البرتغال</p>
      </footer>
    </div>
  )
}
