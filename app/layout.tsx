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
          /* Body + html always cream — shows during any loading state, before globals.css loads */
          'html,body{background:#f4f0e6!important}'
          /* NOTE: #loader CSS is intentionally NOT here.
             The loader div has SSR inline style="display:none" which keeps it hidden before JS.
             JS (HomeLoader.tsx) explicitly sets display:flex ONLY on true desktop (no touch).
             Do NOT add display:flex!important here — it overrides SSR display:none on mobile. */
          /* NOTE: #main-content>div:only-child rule removed — it could hide page content
             if React wraps children in a single div during SSR/hydration. */
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
