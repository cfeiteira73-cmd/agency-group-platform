import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Cormorant, Jost, DM_Mono } from 'next/font/google'
import './globals.css'
import Script from 'next/script'
import { CurrencyProvider } from './components/CurrencyWidget'
import PWAInstallBanner from './components/PWAInstallBanner'

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
  themeColor: '#0c1f15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'AgencyGroup.App · Imobiliário de Luxo Portugal · AMI 22506',
  description: 'Boutique imobiliária de luxo. Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. €500K–€10M. AVM gratuito. AMI 22506.',
  robots: 'index, follow, max-image-preview:large',
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://www.agencygroup.pt/',
    languages: {
      'pt-PT':   'https://www.agencygroup.pt/',
      'en':      'https://www.agencygroup.pt/en/',
      'fr':      'https://www.agencygroup.pt/fr/',
      'de':      'https://www.agencygroup.pt/de/',
      'zh-Hans': 'https://www.agencygroup.pt/zh',
      'ar':      'https://www.agencygroup.pt/ar',
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
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630, alt: 'Agency Group — Luxury Real Estate Portugal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agency Group · Luxury Real Estate Portugal',
    description: 'Boutique luxury real estate agency. Lisbon, Cascais, Comporta. Free AVM. AMI 22506.',
    site: '@agencygroup_pt',
    images: ['https://www.agencygroup.pt/og-image.jpg'],
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


const schemaFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Como comprar uma casa em Portugal sendo estrangeiro?',
      acceptedAnswer: { '@type': 'Answer', text: 'O processo tem 5 passos: (1) Obter NIF fiscal numa Finanças ou com advogado — 1 dia; (2) Abrir conta bancária portuguesa — 1 semana; (3) Escolher imóvel e negociar proposta; (4) Assinar CPCV com sinal de 10–30%; (5) Escritura pública no Cartório Notarial. O processo total demora 2–3 meses. A Agency Group (AMI 22506) acompanha todo o processo.' },
    },
    {
      '@type': 'Question',
      name: 'Qual o preço por m² em Lisboa em 2026?',
      acceptedAnswer: { '@type': 'Answer', text: 'Em 2026 o preço médio em Lisboa ronda os €5.000–€6.500/m² dependendo da zona. Chiado e Santos: €6.200–7.500/m². Príncipe Real: €6.000–7.000/m². Alfama e Mouraria: €4.500–5.500/m². Valorização média anual de +17,6%. Fonte: Agency Group / INE 2026.' },
    },
    {
      '@type': 'Question',
      name: 'O que é o regime NHR e como se aplica em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'O NHR (Residente Não Habitual) oferece isenção de IRS sobre rendimentos de fonte estrangeira por 10 anos para novos residentes fiscais em Portugal. O regime IFICI (2024) substituiu parcialmente o NHR com taxa flat de 20% sobre rendimentos qualificados para profissionais de tecnologia, investigação e artes.' },
    },
    {
      '@type': 'Question',
      name: 'Qual a comissão da Agency Group na compra e venda de imóveis?',
      acceptedAnswer: { '@type': 'Answer', text: 'A Agency Group cobra 5% do valor de transação, pago 50% no CPCV e 50% na Escritura. A comissão é paga pelo vendedor salvo acordo em contrário. AMI 22506 — mediação imobiliária licenciada em Portugal.' },
    },
    {
      '@type': 'Question',
      name: 'Quais os custos de transação na compra de imóvel em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'Para habitação própria: IMT (0–7,5% consoante valor), Imposto de Selo 0,8%, registo predial ~€500, advogado ~€1.500–3.000. Para imóvel de €500K HPP: IMT ~€28.900 + IS €4.000 + custos legais ~€2.000 = ~€35.000 total (7% do valor). A Agency Group fornece simulação detalhada gratuita.' },
    },
    {
      '@type': 'Question',
      name: 'Qual a rentabilidade de imóveis para arrendamento em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yield bruta média em 2026: Lisboa 3,5–4,5%, Cascais 3,8–4,8%, Porto 4,0–5,5%, Algarve (sazonal) 5,0–8,0%, Comporta 4,5–6,0%. Yield líquida após custos e impostos tipicamente 2,5–4,0%. Valorização anual adicional +15–20% nas zonas prime.' },
    },
    {
      '@type': 'Question',
      name: 'O que é o IMT e quanto se paga na compra de um imóvel em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'O IMT (Imposto Municipal sobre Transmissões Onerosas de Imóveis) é calculado sobre o valor de compra. Para habitação própria permanente: isento até €97.064, taxa de 2% até €132.774, 5% até €181.034, 7% até €301.688, 8% até €578.598, e 6% acima desse valor (taxa única). Para investimento: 6% acima de €97.064. Use o simulador gratuito da Agency Group para calcular ao cêntimo.' },
    },
    {
      '@type': 'Question',
      name: 'Como funciona o Golden Visa em Portugal em 2026?',
      acceptedAnswer: { '@type': 'Answer', text: 'Desde Outubro 2023, o Golden Visa (ARI) deixou de aceitar investimento imobiliário directo em habitação nas áreas metropolitanas. As modalidades disponíveis em 2026 incluem: fundos de investimento qualificados (€500K mínimo), criação de emprego (10 postos), transferência de capital (€1,5M), investigação científica (€500K) e artes/cultura (€250K). Contacte a Agency Group para encaminhamento a advogados especializados.' },
    },
    {
      '@type': 'Question',
      name: 'Como se calculam as mais-valias imobiliárias em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'Mais-valia = (Preço Venda - Preço Compra × Coeficiente AT) - Despesas Compra - Despesas Venda - Obras (12 anos). Para residentes: 50% do ganho sujeito a englobamento IRS (Art. 43º CIRS). Para não residentes: taxa liberatória de 28% sobre 100% do ganho (Art. 72º CIRS). Isenção total para HPP se reinvestir noutra HPP (Art. 10º/5 CIRS). Use o calculador gratuito da Agency Group.' },
    },
    {
      '@type': 'Question',
      name: 'Os bancos portugueses financiam compradores estrangeiros?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim. Os bancos portugueses financiam não residentes com LTV entre 60–80% dependendo do país de origem: cidadãos UE (França, Alemanha, Brasil) até 80%; britânicos, americanos e emiratenses até 70%; chineses até 60%. Documentação exigida: prova de rendimentos, extractos bancários 6 meses, declaração fiscal do país de origem. Spread típico: 0,85–1,5% + Euribor 6M. A Agency Group tem parcerias com Millennium BCP, Santander e BPI.' },
    },
    {
      '@type': 'Question',
      name: 'O que é o Visto D7 e quem pode candidatar-se?',
      acceptedAnswer: { '@type': 'Answer', text: 'O Visto D7 (Rendimento Passivo) permite residência em Portugal a quem prove rendimentos regulares mínimos de €820/mês (salário mínimo nacional). Aceita rendimentos de pensões, arrendamentos, dividendos, juros ou trabalho remoto. O processo: obter NIF, conta bancária PT, arrendamento/propriedade, seguro saúde, e agendar na VFS Global ou Consulado. Aprovação em 60–90 dias. Compatível com regime NHR/IFICI para optimização fiscal.' },
    },
    {
      '@type': 'Question',
      name: 'Qual o melhor momento para comprar imóvel em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'Em 2026 o mercado valoriza +17,6% YoY com 169.812 transacções previstas. O prazo médio de venda é 210 dias. Os meses de Setembro a Novembro têm tipicamente mais oferta e menos compradores activos — ligeira vantagem negocial. O mercado de luxo (€1M+) em Lisboa está no top 5 mundial de valorização. A Agency Group recomenda agir agora em imóveis de valor — a janela histórica de spreads baixos Euribor pode fechar em 2026.' },
    },
  ],
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
    ratingValue: '4.9',
    reviewCount: '63',
    bestRating: '5',
    worstRating: '1',
  },
  review: [
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'James & Sarah Mitchell' }, reviewBody: 'A equipa da Agency Group encontrou a nossa villa de sonho em Cascais em menos de 3 semanas. Profissionalismo de nível mundial.', datePublished: '2026-01-15' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Mohammed Al-Rashidi' }, reviewBody: 'A Agency Group conhece o mercado melhor do que qualquer outra imobiliária que consultámos. O retorno supera as expectativas.', datePublished: '2025-12-10' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Chen Wei' }, reviewBody: 'Sentimo-nos completamente seguros durante todo o processo. Excelente conhecimento do mercado da Comporta.', datePublished: '2025-11-22' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Sophie & Marc Dubois' }, reviewBody: 'Incrível eficiência. Do primeiro contacto à escritura em 67 dias. O NHR foi tratado pelos parceiros da Agency Group sem qualquer stress.', datePublished: '2026-02-03' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'David Harrington' }, reviewBody: 'Como britânico pós-Brexit, a Agency Group guiou-nos em cada detalhe do crédito, vistos e impostos. Excelência rara neste sector.', datePublished: '2026-01-28' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Ana Beatriz Ferreira' }, reviewBody: 'Calculadora de mais-valias e NHR online são de nível profissional. Poupei €18.000 em impostos com as ferramentas e o encaminhamento da Agency Group.', datePublished: '2026-03-10' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Khalid Al-Mansouri' }, reviewBody: 'Apreciei especialmente o conhecimento da Agency Group sobre Islamic Finance para o nosso financiamento. Únicos no mercado português a oferecer isto.', datePublished: '2026-02-20' },
    { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: '5' }, author: { '@type': 'Person', name: 'Thomas & Ingrid Weber' }, reviewBody: 'Das Deutschland — Agency Group hat uns den besten Kauf in Portugal ermöglicht. AVM-Tool und Steuerrechner sind ausgezeichnet.', datePublished: '2026-03-05' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT" className={`${cormorant.variable} ${jost.variable} ${dmMono.variable}`}>
      <head>
        <meta name="author" content="Agency Group – Mediação Imobiliária Lda" />
        {/* Resource hints — preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://vercel.live" />
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
      <body>
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
