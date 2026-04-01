import type { Metadata } from 'next'
import './globals.css'
import ChatWidget from './components/ChatWidget'
import { CurrencyProvider } from './components/CurrencyWidget'

export const viewport = {
  themeColor: '#1c4a35',
}

export const metadata: Metadata = {
  title: 'Agency Group · Imobiliário de Luxo Portugal · AMI 22506',
  description: 'Boutique imobiliária de luxo. Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. €500K–€10M. AVM gratuito. AMI 22506.',
  robots: 'index, follow, max-image-preview:large',
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://agencygroup.pt/',
    languages: {
      'pt-PT':   'https://agencygroup.pt/',
      'en':      'https://agencygroup.pt/en/',
      'fr':      'https://agencygroup.pt/fr/',
      'de':      'https://agencygroup.pt/de',
      'zh-Hans': 'https://agencygroup.pt/zh',
      'ar':      'https://agencygroup.pt/ar',
    },
  },
  openGraph: {
    title: 'Agency Group · Luxury Real Estate Portugal',
    description: 'Boutique luxury real estate agency. Lisbon, Cascais, Comporta, Porto, Algarve, Madeira. Free AVM. AMI 22506.',
    type: 'website',
    url: 'https://agencygroup.pt/',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    alternateLocale: ['en_US', 'fr_FR'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agency Group · Luxury Real Estate Portugal',
    description: 'Boutique luxury real estate agency. Lisbon, Cascais, Comporta. Free AVM. AMI 22506.',
    site: '@agencygroup_pt',
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
  url: 'https://agencygroup.pt',
  logo: 'https://agencygroup.pt/logo.png',
  image: 'https://agencygroup.pt/og-image.jpg',
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
  '@id': 'https://agencygroup.pt/#localbusiness',
  name: 'Agency Group – Mediação Imobiliária Lda',
  description: 'Boutique imobiliária de luxo em Portugal. Especialistas em Lisboa, Cascais, Comporta, Porto, Algarve e Madeira. AMI 22506.',
  url: 'https://agencygroup.pt',
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
  url: 'https://agencygroup.pt',
  name: 'Agency Group',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://agencygroup.pt/imoveis?q={search_term_string}',
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
    url: 'https://agencygroup.pt',
  },
  serviceType: 'Property Valuation',
  areaServed: 'Portugal',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
    description: 'AVM gratuito — sem registo necessário',
  },
  url: 'https://agencygroup.pt/avm',
}

const schemaAggregateRating = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  '@id': 'https://agencygroup.pt/#organization',
  name: 'Agency Group – Mediação Imobiliária Lda',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '47',
    bestRating: '5',
    worstRating: '1',
  },
  review: [
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      author: { '@type': 'Person', name: 'James & Sarah Mitchell' },
      reviewBody: 'A equipa da Agency Group encontrou a nossa villa de sonho em Cascais em menos de 3 semanas. Profissionalismo de nível mundial.',
      datePublished: '2026-01-15',
    },
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      author: { '@type': 'Person', name: 'Mohammed Al-Rashidi' },
      reviewBody: 'A Agency Group conhece o mercado melhor do que qualquer outra imobiliária que consultámos. O retorno supera as expectativas.',
      datePublished: '2025-12-10',
    },
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      author: { '@type': 'Person', name: 'Chen Wei' },
      reviewBody: 'Sentimo-nos completamente seguros durante todo o processo. Excelente conhecimento do mercado da Comporta.',
      datePublished: '2025-11-22',
    },
  ],
}

const schemaFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Como comprar uma casa em Portugal sendo estrangeiro?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O processo tem 5 passos: (1) Obter NIF fiscal numa Finanças ou com advogado — 1 dia; (2) Abrir conta bancária portuguesa — 1 semana; (3) Escolher imóvel e negociar proposta; (4) Assinar CPCV com sinal de 10–30%; (5) Escritura pública no Cartório Notarial. O processo total demora 2–3 meses. A Agency Group (AMI 22506) acompanha todo o processo.',
      },
    },
    {
      '@type': 'Question',
      name: 'Qual o preço por m² em Lisboa em 2026?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Em 2026 o preço médio em Lisboa ronda os €5.000–€6.500/m² dependendo da zona. Chiado e Santos: €6.200–7.500/m². Príncipe Real: €6.000–7.000/m². Alfama e Mouraria: €4.500–5.500/m². Valorização média anual de +17,6%. Fonte: Agency Group / INE 2026.',
      },
    },
    {
      '@type': 'Question',
      name: 'O que é o regime NHR e como se aplica em Portugal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O NHR (Residente Não Habitual) oferece isenção de IRS sobre rendimentos de fonte estrangeira por 10 anos para novos residentes fiscais em Portugal. O regime IFICI (2024) substituiu parcialmente o NHR com taxa flat de 20% sobre rendimentos qualificados para profissionais de tecnologia, investigação e artes. Consulte a Agency Group para encaminhamento a advogados fiscais parceiros.',
      },
    },
    {
      '@type': 'Question',
      name: 'Qual a comissão da Agency Group na compra e venda de imóveis?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A Agency Group cobra 5% do valor de transação, pago 50% no CPCV e 50% na Escritura. A comissão é paga pelo vendedor salvo acordo em contrário. AMI 22506 — mediação imobiliária licenciada em Portugal.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quais os custos de transação na compra de imóvel em Portugal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Para habitação própria: IMT (0–7,5% consoante valor), Imposto de Selo 0,8%, registo predial ~€500, advogado ~€1.500–3.000. Para imóvel de €500K a comprar habitação própria: IMT ~€28.900 + IS €4.000 + custos legais ~€2.000 = ~€35.000 total em custos de aquisição (7% do valor). A Agency Group fornece simulação detalhada gratuita.',
      },
    },
    {
      '@type': 'Question',
      name: 'Qual a rentabilidade de imóveis para arrendamento em Portugal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yield bruta média em 2026: Lisboa 3,5–4,5%, Cascais 3,8–4,8%, Porto 4,0–5,5%, Algarve (sazonal) 5,0–8,0%, Comporta 4,5–6,0%. Yield líquida após custos e impostos tipicamente 2,5–4,0%. Valorização anual adicional +15–20% nas zonas prime. A Agency Group faz análise detalhada de ROI para investidores.',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        {/* Hreflang alternate language links */}
        <link rel="alternate" hrefLang="pt-PT"   href="https://agencygroup.pt/" />
        <link rel="alternate" hrefLang="en"      href="https://agencygroup.pt/en/" />
        <link rel="alternate" hrefLang="fr"      href="https://agencygroup.pt/fr/" />
        <link rel="alternate" hrefLang="de"      href="https://agencygroup.pt/de" />
        <link rel="alternate" hrefLang="zh-Hans" href="https://agencygroup.pt/zh" />
        <link rel="alternate" hrefLang="ar"      href="https://agencygroup.pt/ar" />
        <link rel="alternate" hrefLang="x-default" href="https://agencygroup.pt/" />

        {/* Geo meta tags */}
        <meta name="geo.region"   content="PT" />
        <meta name="geo.placename" content="Lisboa" />
        <meta name="geo.position" content="38.7169;-9.1399" />
        <meta name="ICBM"         content="38.7169, -9.1399" />

        {/* Twitter Card (supplement Next.js metadata) */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@agencygroup_pt" />
        <meta name="twitter:title"       content="Agency Group · Luxury Real Estate Portugal" />
        <meta name="twitter:description" content="Boutique luxury real estate agency. Lisbon, Cascais, Comporta. Free AVM. AMI 22506." />
        <meta name="twitter:image"       content="https://agencygroup.pt/og-image.jpg" />

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaAggregateRating) }}
        />

        {/* Vercel Analytics — no package needed */}
        <script src="/_vercel/insights/script.js" defer />

        {/* Vercel Speed Insights — no package needed */}
        <script src="/_vercel/speed-insights/script.js" defer />
      </head>
      <body>
        <CurrencyProvider>
        {children}
        <ChatWidget />
        <script dangerouslySetInnerHTML={{ __html: `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
`}} />
        </CurrencyProvider>
      </body>
    </html>
  )
}
