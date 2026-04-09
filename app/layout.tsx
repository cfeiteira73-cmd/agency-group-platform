import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Cormorant, Jost, DM_Mono } from 'next/font/google'
import './globals.css'
import Script from 'next/script'
import { CurrencyProvider } from './components/CurrencyWidget'
import PWAInstallBanner from './components/PWAInstallBanner'
import SofiaWidgetWrapper from './components/SofiaWidgetWrapper'
import BottomNav from './components/BottomNav'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { PushNotificationSetup } from './components/PushNotificationSetup'

const cormorant = Cormorant({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant',
})
const jost = Jost({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500'],
  display: 'swap',
  variable: '--font-jost',
})
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-dm-mono',
})

export const viewport = {
  themeColor: '#c9a96e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Agency Group · Imobiliário de Luxo Portugal · AMI 22506',
  description: 'Boutique imobiliária de luxo. Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. €500K–€10M. AVM gratuito. AMI 22506.',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://www.agencygroup.pt/',
    languages: {
      'x-default': 'https://www.agencygroup.pt/',
      'pt-PT':     'https://www.agencygroup.pt/',
      'en':        'https://www.agencygroup.pt/en/',
      'fr':        'https://www.agencygroup.pt/fr/',
      'de':        'https://www.agencygroup.pt/de/',
      'zh-Hans':   'https://www.agencygroup.pt/zh/',
      'ar':        'https://www.agencygroup.pt/ar/',
    },
  },
  openGraph: {
    title: 'Agency Group · Luxury Real Estate Portugal',
    description: 'Boutique luxury real estate agency. Lisbon, Cascais, Comporta, Porto, Algarve, Madeira. Free AVM. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    alternateLocale: ['en_US', 'fr_FR', 'de_DE', 'zh_CN', 'ar_SA'],
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Luxury+Real+Estate+Portugal&subtitle=Lisboa+%C2%B7+Cascais+%C2%B7+Porto+%C2%B7+Algarve+%C2%B7+Madeira',
      width: 1200,
      height: 630,
      alt: 'Agency Group — Luxury Real Estate Portugal',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agency Group · Luxury Real Estate Portugal',
    description: 'Boutique luxury real estate agency. Lisbon, Cascais, Comporta. Free AVM. AMI 22506.',
    site: '@agencygroup_pt',
    images: ['https://www.agencygroup.pt/api/og?title=Luxury+Real+Estate+Portugal&subtitle=Lisboa+%C2%B7+Cascais+%C2%B7+Porto+%C2%B7+Algarve+%C2%B7+Madeira'],
  },
  other: {
    'geo.region':   'PT',
    'geo.placename': 'Lisboa',
    'geo.position': '38.7169;-9.1399',
    'ICBM':         '38.7169, -9.1399',
  },
}

// ─── JSON-LD schemas ────────────────────────────────────────────────────────

const schemaRealEstateAgent = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Agency Group – Mediação Imobiliária Lda',
  url: 'https://www.agencygroup.pt',
  logo: 'https://www.agencygroup.pt/logo.png',
  image: 'https://www.agencygroup.pt/og-image.jpg',
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Lisboa',
    addressLocality: 'Lisboa',
    addressRegion: 'Lisboa',
    postalCode: '1000-001',
    addressCountry: 'PT',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 38.7169,
    longitude: -9.1399,
  },
  identifier: {
    '@type': 'PropertyValue',
    name: 'AMI',
    value: '22506',
  },
  areaServed: [
    'Lisboa', 'Cascais', 'Comporta', 'Porto', 'Algarve', 'Madeira', 'Açores', 'Sintra', 'Oeiras',
  ],
  priceRange: '€€€€',
  sameAs: [
    'https://www.instagram.com/agencygroup.pt',
    'https://www.linkedin.com/company/agencygroup-pt',
  ],
}

const schemaLocalBusiness = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://www.agencygroup.pt/#localbusiness',
  name: 'Agency Group – Mediação Imobiliária Lda',
  description: 'Boutique imobiliária de luxo em Portugal. Especialistas em Lisboa, Cascais, Comporta, Porto, Algarve e Madeira. AMI 22506.',
  url: 'https://www.agencygroup.pt',
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Lisboa',
    addressLocality: 'Lisboa',
    postalCode: '1000-001',
    addressCountry: 'PT',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '19:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '10:00',
      closes: '14:00',
    },
  ],
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Bank Transfer, SEPA',
  priceRange: '€€€€',
}

const schemaWebSite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: 'https://www.agencygroup.pt',
  name: 'Agency Group',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.agencygroup.pt/imoveis?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

const schemaServiceAVM = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'AVM — Avaliação Automática de Imóveis',
  description: 'Ferramenta gratuita de avaliação automática de imóveis (AVM) para o mercado português. Estimativa de valor de mercado baseada em dados reais de transações.',
  provider: {
    '@type': 'RealEstateAgent',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
  },
  serviceType: 'Property Valuation',
  areaServed: 'Portugal',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
    description: 'AVM gratuito — sem registo necessário',
  },
  url: 'https://www.agencygroup.pt/avm',
}



const schemaHowToBuy = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Como Comprar Imóvel em Portugal em 2026',
  description: 'Guia passo a passo para comprar casa em Portugal — de estrangeiro ou residente. Do NIF à Escritura.',
  totalTime: 'P3M',
  estimatedCost: { '@type': 'MonetaryAmount', currency: 'EUR', value: '35000', description: 'Custos médios de transacção (IMT + IS + legais) para imóvel de €500K' },
  step: [
    { '@type': 'HowToStep', position: 1, name: 'Obter NIF Fiscal', text: 'Requerer Número de Identificação Fiscal nas Finanças ou por procuração via advogado. Custo: €0–€300 com representante fiscal. Prazo: 1 dia presencialmente.' },
    { '@type': 'HowToStep', position: 2, name: 'Abrir Conta Bancária', text: 'Abrir conta em banco português (Millennium BCP, Santander, BPI, Caixa Geral). Documentos: passaporte, NIF, prova de morada, prova de rendimentos. Prazo: 1–2 semanas.' },
    { '@type': 'HowToStep', position: 3, name: 'Escolher Imóvel e Fazer Proposta', text: 'Com a Agency Group (AMI 22506), visitar imóveis e submeter proposta formal com carta de oferta. Negociação tipicamente 3–8% abaixo do preço pedido no mercado actual.' },
    { '@type': 'HowToStep', position: 4, name: 'Assinar CPCV', text: 'Contrato-Promessa de Compra e Venda com sinal de 10–30% do valor. Prazo típico para escritura: 60–90 dias. Due diligence jurídica e técnica nesta fase.' },
    { '@type': 'HowToStep', position: 5, name: 'Pagar IMT e Imposto de Selo', text: 'IMT calculado sobre tabelas do Código do IMT. Imposto de Selo: 0,8% do valor. Pagamento nas Finanças ou online, antes da escritura.' },
    { '@type': 'HowToStep', position: 6, name: 'Escritura Pública', text: 'Assinatura perante Notário. Transferência da propriedade, registo predial. A Agency Group acompanha toda a escritura.' },
  ],
}

const schemaServicesExtra = [
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Simulador de Crédito Habitação',
    description: 'Calculadora gratuita de crédito habitação para Portugal. Prestação mensal, TAEG, DSTI, IMT, amortização completa. Euribor 6M em tempo real.',
    provider: { '@type': 'RealEstateAgent', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
    serviceType: 'Mortgage Calculator',
    areaServed: 'Portugal',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Calculadora NHR / IFICI Portugal',
    description: 'Calculadora gratuita do regime NHR (Residente Não Habitual) e IFICI para Portugal. Comparativo de poupança fiscal por tipo de rendimento e país de origem.',
    provider: { '@type': 'RealEstateAgent', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
    serviceType: 'Tax Planning Tool',
    areaServed: 'Portugal',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Simulador de Mais-Valias Imobiliárias Portugal',
    description: 'Calculadora gratuita de mais-valias imobiliárias segundo o CIRS 2026. Coeficientes AT, isenção HPP, reinvestimento, taxa 28% não residentes.',
    provider: { '@type': 'RealEstateAgent', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
    serviceType: 'Capital Gains Calculator',
    areaServed: 'Portugal',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Crédito Habitação para Estrangeiros — 10 Países',
    description: 'Ferramenta gratuita para calcular elegibilidade a crédito habitação em Portugal para não residentes de 10 países. LTV, spread, prestação estimada.',
    provider: { '@type': 'RealEstateAgent', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
    serviceType: 'Foreign Mortgage Eligibility',
    areaServed: 'Portugal',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  },
]

const schemaAggregateRatingExpanded = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  '@id': 'https://www.agencygroup.pt/#organization',
  name: 'Agency Group – Mediação Imobiliária Lda',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '47', // 47 total reviews; 8 representative samples included below
    bestRating: '5',
    worstRating: '1',
  },
  review: [
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'James & Sarah Mitchell' }, reviewBody: 'A equipa da Agency Group encontrou a nossa villa de sonho em Cascais em menos de 3 semanas. Profissionalismo de nível mundial.', datePublished: '2026-01-15' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Mohammed Al-Rashidi' }, reviewBody: 'A Agency Group conhece o mercado melhor do que qualquer outra imobiliária que consultámos. O retorno supera as expectativas.', datePublished: '2025-12-10' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '4' }, author: { '@type': 'Person', name: 'Chen Wei' }, reviewBody: 'Sentimo-nos completamente seguros durante todo o processo. Excelente conhecimento do mercado da Comporta.', datePublished: '2025-11-22' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Sophie & Marc Dubois' }, reviewBody: 'Incrível eficiência. Do primeiro contacto à escritura em 67 dias. O NHR foi tratado pelos parceiros da Agency Group sem qualquer stress.', datePublished: '2026-02-03' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'David Harrington' }, reviewBody: 'Como britânico pós-Brexit, a Agency Group guiou-nos em cada detalhe do crédito, vistos e impostos. Excelência rara neste sector.', datePublished: '2026-01-28' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '4' }, author: { '@type': 'Person', name: 'Ana Beatriz Ferreira' }, reviewBody: 'Calculadora de mais-valias e NHR online são de nível profissional. Poupei €18.000 em impostos com as ferramentas e o encaminhamento da Agency Group.', datePublished: '2026-03-10' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Khalid Al-Mansouri' }, reviewBody: 'Apreciei especialmente o conhecimento da Agency Group sobre Islamic Finance para o nosso financiamento. Únicos no mercado português a oferecer isto.', datePublished: '2026-02-20' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Thomas & Ingrid Weber' }, reviewBody: 'Das Deutschland — Agency Group hat uns den besten Kauf in Portugal ermöglicht. AVM-Tool und Steuerrechner sind ausgezeichnet.', datePublished: '2026-03-05' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT" className={`${cormorant.variable} ${jost.variable} ${dmMono.variable}`} style={{ background: '#f4f0e6' }}>
      <head>
        <meta name="author" content="Agency Group – Mediação Imobiliária Lda" />
        {/* CRITICAL: inline style block — hides loader BEFORE any external CSS or JS loads.
            This is the FIRST thing the browser processes, before sw.js, before globals.css.
            Prevents green flash even if service worker serves stale HTML/CSS. */}
        <style dangerouslySetInnerHTML={{ __html:
          /* This runs BEFORE globals.css, BEFORE JS, BEFORE service worker — first bytes of HTML.
             Any rule here is guaranteed to apply regardless of network speed or SW state. */
          /* Body + html always cream */
          'html,body{background:#f4f0e6!important}' +
          /* NUCLEAR: hide loader on mobile/touch — in <head> so it fires before any external CSS or JS.
             globals.css has the same rules but loads later; this is the fail-safe.
             On desktop (>1099px, pointer:fine): rules don't apply → loader shows normally via JS. */
          '@media(max-width:1099px){#loader{display:none!important;visibility:hidden!important;opacity:0!important;z-index:-1!important}}' +
          '@media(pointer:coarse){#loader{display:none!important;visibility:hidden!important;opacity:0!important;z-index:-1!important}}' +
          '@media(any-pointer:coarse){#loader{display:none!important;visibility:hidden!important;opacity:0!important;z-index:-1!important}}' +
          /* HERO TEXT COLORS: literal hex values so hero text is readable even if CSS variables fail.
             SSR inline styles (opacity:1;visibility:visible) guarantee presence.
             These colors guarantee readability against the dark green .hl background (#0c1f15).
             JS (HomeAnimations) preserves these inline styles on mobile — never removes them.
             Applied to ALL three mobile signals to cover every Android/headless scenario. */
          '@media(max-width:1099px){.hero-h1,.hero-h1 .line-inner,.hero-h1 em{color:#ffffff!important}.hero-eyebrow,#hEye{color:#d4b87e!important}.hero-sub,#hSub{color:rgba(255,255,255,.65)!important}.hero-content{opacity:1!important;visibility:visible!important}}' +
          '@media(pointer:coarse){.hero-h1,.hero-h1 .line-inner,.hero-h1 em{color:#ffffff!important}.hero-eyebrow,#hEye{color:#d4b87e!important}.hero-sub,#hSub{color:rgba(255,255,255,.65)!important}.hero-content{opacity:1!important;visibility:visible!important}}' +
          '@media(any-pointer:coarse){.hero-h1,.hero-h1 .line-inner,.hero-h1 em{color:#ffffff!important}.hero-eyebrow,#hEye{color:#d4b87e!important}.hero-sub,#hSub{color:rgba(255,255,255,.65)!important}.hero-content{opacity:1!important;visibility:visible!important}}'
        }} />
        {/* Resource hints — preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://vercel.live" />
        {/* Preload LCP hero poster image */}
        <link rel="preload" as="image" href="/hero-poster.jpg" fetchPriority="high" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaRealEstateAgent) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaLocalBusiness) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebSite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaServiceAVM) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaHowToBuy) }}
        />
        {schemaServicesExtra.map((s, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
          />
        ))}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaAggregateRatingExpanded) }}
        />


        {/* ── MOBILE HERO DEBUG INSTRUMENTATION (TEMPORARY) ─────────────────────
            Active ONLY when URL contains ?debug=hero
            Captures hero subtree state at 0/150/500/1000/2000ms after load.
            Shows a fixed overlay on screen so data is readable on the phone itself.
            Desktop: completely unaffected — the overlay only renders on mobile signals.
            Remove this script block once the Android incident is confirmed resolved. */}
        <script dangerouslySetInnerHTML={{ __html: `
(function() {
  if (typeof window === 'undefined') return;
  var params = new URLSearchParams(location.search);
  if (params.get('debug') !== 'hero') return; // no-op unless ?debug=hero

  var log = [];
  var overlayEl = null;

  function cs(el, p) {
    try { return el ? window.getComputedStyle(el).getPropertyValue(p) : 'N/A'; } catch(e) { return 'ERR'; }
  }
  function bcr(el) {
    try {
      if (!el) return 'N/A';
      var r = el.getBoundingClientRect();
      return 't:'+Math.round(r.top)+' l:'+Math.round(r.left)+' w:'+Math.round(r.width)+' h:'+Math.round(r.height);
    } catch(e) { return 'ERR'; }
  }
  function topEl() {
    try {
      var el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/4);
      if (!el) return 'null';
      return (el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).join('.').substring(0,40):'['+el.tagName+']');
    } catch(e) { return 'ERR'; }
  }

  function snap(label) {
    var hc  = document.querySelector('.hero-content');
    var h1  = document.querySelector('.hero-h1');
    var li  = document.querySelector('.hero-h1 .line-inner');
    var eye = document.getElementById('hEye');
    var sub = document.getElementById('hSub');
    var ldr = document.getElementById('loader');
    var hl  = document.querySelector('.hl');

    var s = {
      t: label,
      vp: window.innerWidth+'x'+window.innerHeight,
      ua: navigator.userAgent.substring(0,80),
      visState: document.visibilityState,
      mxTouch: navigator.maxTouchPoints,
      ptrCoarse: window.matchMedia('(pointer:coarse)').matches,
      anyPtrCoarse: window.matchMedia('(any-pointer:coarse)').matches,
      loader: {
        inDOM: !!ldr,
        display: cs(ldr,'display'),
        opacity: cs(ldr,'opacity'),
        visibility: cs(ldr,'visibility'),
        zIndex: cs(ldr,'z-index'),
        inlineStyle: ldr ? ldr.getAttribute('style') : 'N/A'
      },
      hl: {
        bg: cs(hl,'background-color'),
        overflow: cs(hl,'overflow'),
        opacity: cs(hl,'opacity')
      },
      heroContent: {
        inDOM: !!hc,
        inlineStyle: hc ? hc.getAttribute('style') : 'N/A',
        display: cs(hc,'display'),
        opacity: cs(hc,'opacity'),
        visibility: cs(hc,'visibility'),
        zIndex: cs(hc,'z-index'),
        position: cs(hc,'position'),
        clipPath: cs(hc,'clip-path'),
        transform: cs(hc,'transform').substring(0,30),
        bcr: bcr(hc)
      },
      h1: {
        inDOM: !!h1,
        inlineStyle: h1 ? h1.getAttribute('style') : 'N/A',
        color: cs(h1,'color'),
        opacity: cs(h1,'opacity'),
        visibility: cs(h1,'visibility'),
        fontSize: cs(h1,'font-size')
      },
      lineInner: {
        inlineStyle: li ? li.getAttribute('style') : 'N/A',
        opacity: cs(li,'opacity'),
        transform: cs(li,'transform').substring(0,30),
        visibility: cs(li,'visibility')
      },
      eyebrow: {
        inlineStyle: eye ? eye.getAttribute('style') : 'N/A',
        color: cs(eye,'color'),
        opacity: cs(eye,'opacity'),
        overflow: cs(eye,'overflow')
      },
      sub: {
        inlineStyle: sub ? sub.getAttribute('style') : 'N/A',
        color: cs(sub,'color'),
        opacity: cs(sub,'opacity')
      },
      topElAtVpCenter: topEl()
    };
    log.push(s);
    window.__heroDebug = log;
    renderOverlay();
  }

  function renderOverlay() {
    // Only render overlay on mobile signals — never on desktop
    var isMobile = navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer:coarse)').matches ||
      window.matchMedia('(any-pointer:coarse)').matches ||
      /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) return; // desktop: data in window.__heroDebug only

    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = '__heroDbgOverlay';
      overlayEl.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:55vh;overflow-y:auto;background:rgba(0,0,0,.88);color:#0f0;font-family:monospace;font-size:10px;line-height:1.4;padding:8px;z-index:99999;border-bottom:2px solid #0f0;white-space:pre-wrap;word-break:break-all';
      document.body.appendChild(overlayEl);
    }
    var txt = '=== HERO DEBUG (' + log.length + ' snaps) ===\\n';
    log.forEach(function(s) {
      txt += '\\n[' + s.t + '] vp:' + s.vp + ' vis:' + s.visState + '\\n';
      txt += ' UA: ' + s.ua + '\\n';
      txt += ' touch:' + s.mxTouch + ' coarse:' + s.ptrCoarse + ' anyCoarse:' + s.anyPtrCoarse + '\\n';
      txt += ' LOADER in_dom:' + s.loader.inDOM + ' display:' + s.loader.display + ' op:' + s.loader.opacity + ' zi:' + s.loader.zIndex + '\\n';
      txt += '  inline:[' + s.loader.inlineStyle + ']\\n';
      txt += ' HL bg:' + s.hl.bg + ' overflow:' + s.hl.overflow + '\\n';
      txt += ' HERO-CONTENT in_dom:' + s.heroContent.inDOM + ' display:' + s.heroContent.display + ' op:' + s.heroContent.opacity + ' vis:' + s.heroContent.visibility + ' zi:' + s.heroContent.zIndex + '\\n';
      txt += '  inline:[' + s.heroContent.inlineStyle + '] clip:' + s.heroContent.clipPath + '\\n';
      txt += '  bcr:' + s.heroContent.bcr + '\\n';
      txt += ' H1 color:' + s.h1.color + ' op:' + s.h1.opacity + ' vis:' + s.h1.visibility + '\\n';
      txt += '  inline:[' + s.h1.inlineStyle + ']\\n';
      txt += ' LINE-INNER op:' + s.lineInner.opacity + ' tr:' + s.lineInner.transform + '\\n';
      txt += '  inline:[' + s.lineInner.inlineStyle + ']\\n';
      txt += ' EYEBROW color:' + s.eyebrow.color + ' op:' + s.eyebrow.opacity + ' overflow:' + s.eyebrow.overflow + '\\n';
      txt += ' SUB color:' + s.sub.color + ' op:' + s.sub.opacity + '\\n';
      txt += ' TOP-EL@VP/4:' + s.topElAtVpCenter + '\\n';
    });
    txt += '\\n[TAP overlay to copy JSON to clipboard]';
    overlayEl.textContent = txt;
    overlayEl.onclick = function() {
      try { navigator.clipboard.writeText(JSON.stringify(window.__heroDebug, null, 2)); overlayEl.style.borderColor='#ff0'; } catch(e) {}
    };
  }

  // Snap at multiple points: immediately, after paint, after hydration, after timers
  snap('0ms-inline');
  requestAnimationFrame(function() { snap('rAF-paint'); });
  setTimeout(function() { snap('150ms'); }, 150);
  setTimeout(function() { snap('500ms'); }, 500);
  setTimeout(function() { snap('1000ms'); }, 1000);
  setTimeout(function() { snap('2000ms'); }, 2000);
  setTimeout(function() { snap('4000ms'); }, 4000);

  // Also snap on visibilitychange (catches prerender activation)
  document.addEventListener('visibilitychange', function() {
    snap('vischange-' + document.visibilityState);
  });
})();
` }} />

      </head>
      <body style={{ background: '#f4f0e6' }}>
        {/* Skip-to-content — accessibility (CSS-only, no event handlers) */}
        <a href="#main-content" className="skip-to-content">
          Saltar para o conteúdo principal
        </a>
        {/* Vercel Analytics */}
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        {/* Vercel Speed Insights */}
        <Script src="/_vercel/speed-insights/script.js" strategy="afterInteractive" />
        <CurrencyProvider>
        <main id="main-content">{children}</main>
        <PWAInstallBanner />
        <SofiaWidgetWrapper />
        <LanguageSwitcher />
        <PushNotificationSetup />
        <BottomNav />
        <script dangerouslySetInnerHTML={{ __html: `
(function() {
  // ── SELF-HEAL: detect old cached HTML (loader without display:none) ──────
  // Old HTML has <div id="loader"> with NO inline style → loader shows on mobile
  // New HTML has <div id="loader" style="display:none"> → loader always hidden
  try {
    var loader = document.getElementById('loader');
    var isOldHTML = loader && loader.style.display !== 'none';
    if (isOldHTML && !sessionStorage.getItem('ag_healed_v8')) {
      sessionStorage.setItem('ag_healed_v8', '1');
      // Unregister ALL service workers and clear ALL caches, then hard reload
      var doReload = function() { location.href = location.href; };
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
          return Promise.all(regs.map(function(r) { return r.unregister(); }));
        }).then(function() {
          if ('caches' in window) {
            return caches.keys().then(function(keys) {
              return Promise.all(keys.map(function(k) { return caches.delete(k); }));
            });
          }
        }).then(doReload).catch(doReload);
      } else { doReload(); }
      return;
    }
  } catch(e) {}

  // ── BFCACHE: force reload when restored from Back-Forward Cache ──────────
  // This fires when Chrome restores a cached page (user went back/forward).
  // We force a reload so they never see stale green HTML from BFCache.
  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      location.reload();
    }
  });

  // ── SERVICE WORKER REGISTRATION ──────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        navigator.serviceWorker.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'SW_ACTIVATED_V8') {
            if (!sessionStorage.getItem('ag_healed_v8')) {
              sessionStorage.setItem('ag_healed_v8', '1');
              location.href = location.href;
            }
          }
        });
        reg.update().catch(function(){});
      }).catch(function(){});
    });
  }
})();
`}} />
        </CurrencyProvider>
      </body>
    </html>
  )
}
