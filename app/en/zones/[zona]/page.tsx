// =============================================================================
// Agency Group — EN Zone Pages /en/zones/[zona]
// Fixes hreflang orphan: these are referenced as English alternates in
// /zonas/[zona] pages but were previously 404 — hurting Google's coverage.
//
// Purpose: SEO-rich English landing pages targeting international buyers.
// Architecture: Pure RSC (no client JS) — fast, crawlable, pre-rendered.
// =============================================================================

import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'

// ─── Zone Data ────────────────────────────────────────────────────────────────

interface ZoneEN {
  name:         string
  namePT:       string  // for linking to /zonas/[zona]
  slug:         string
  pricePerSqm:  number
  primePrice:   number
  yoy:          number
  yield:        number
  yieldTur:     number
  emoji:        string
  region:       string
  headline:     string
  desc:         string
  highlights:   string[]
  buyerProfiles: string[]
  forecast:     string
  lat:          number
  lng:          number
  faq:          Array<{ q: string; a: string }>
}

const ZONES_EN: Record<string, ZoneEN> = {
  lisboa: {
    name: 'Lisbon', namePT: 'Lisboa', slug: 'lisboa',
    pricePerSqm: 5000, primePrice: 8500, yoy: 14, yield: 3.2, yieldTur: 4.8,
    emoji: '🏛', region: 'Greater Lisbon',
    headline: 'Buy Property in Lisbon, Portugal 2026',
    desc: 'Lisbon is a world-class prime real estate market. Consistently ranked among Europe\'s top 5 luxury destinations, the capital combines historic architecture with modern investment performance. Average price €5,000/m², prime at €8,500/m².',
    highlights: [
      '+14% YoY price appreciation in 2025',
      'Prime neighborhoods: Chiado, Príncipe Real, Avenidas Novas, Parque das Nações',
      'Average rental yield 3.2% — tourism yield 4.8%',
      'Top buyer nationalities: North American, French, British, Chinese, Brazilian',
      'NHR/IFICI tax regime available for qualifying residents',
    ],
    buyerProfiles: ['HNWI investors', 'Family offices', 'Remote workers (Digital Nomad Visa)', 'Retirees (D7 Passive Income Visa)'],
    forecast: '€5,800/m² by 2027 (+16%)',
    lat: 38.7169, lng: -9.1399,
    faq: [
      { q: 'What is the average property price in Lisbon in 2026?', a: 'The average price in Lisbon is €5,000/m² in 2026, with prime neighborhoods like Chiado and Príncipe Real reaching €8,500/m². Agency Group AMI 22506 offers free AVM valuations.' },
      { q: 'Can foreigners buy property in Lisbon?', a: 'Yes. There are no restrictions on foreign ownership in Portugal. EU and non-EU citizens may purchase freely. A Portuguese NIF (tax number) is required for the transaction.' },
      { q: 'What taxes apply when buying property in Lisbon?', a: 'IMT (Property Transfer Tax) ranges from 0% to 7.5% depending on property value and use. Stamp Duty (IS) is 0.8%. Annual IMI property tax is approximately 0.3–0.45% for urban properties.' },
      { q: 'What is the expected rental yield in Lisbon?', a: 'Gross rental yield in Lisbon averages 3.2% for long-term rentals and 4.8% for short-term/tourism rentals. Prime areas can achieve 5–6% with professional management.' },
    ],
  },
  cascais: {
    name: 'Cascais', namePT: 'Cascais', slug: 'cascais',
    pricePerSqm: 4713, primePrice: 7200, yoy: 12, yield: 3.8, yieldTur: 5.2,
    emoji: '🏖', region: 'Estoril Coast',
    headline: 'Buy Property in Cascais, Portugal 2026',
    desc: 'Cascais — the Portuguese Riviera. World-class golf, Atlantic beaches, and international schools make it the preferred address for expatriates and HNWI. 30 minutes from Lisbon Airport.',
    highlights: [
      '+12% YoY appreciation · 30 min from Lisbon Airport',
      'Premium areas: Cascais Village, Quinta da Marinha, Estoril, Birre',
      'Average rental yield 3.8% — tourism/summer 5.2%',
      'Top 3 European locations for American & British expatriates',
      'World-class golf: Quinta da Marinha, Oitavos Dunes (Golf Digest Top 10)',
    ],
    buyerProfiles: ['North American retirees', 'British families', 'Corporate relocations', 'Golf & lifestyle investors'],
    forecast: '€5,400/m² by 2027',
    lat: 38.6979, lng: -9.4215,
    faq: [
      { q: 'What is the average property price in Cascais in 2026?', a: 'Average price in Cascais is €4,713/m² in 2026, with premium beachfront and golf areas reaching €7,200/m². Agency Group specialises in exclusive Cascais properties.' },
      { q: 'Is Cascais a good investment?', a: 'Cascais consistently outperforms the national average with +12% YoY appreciation in 2025. Limited supply, international demand, and the Estoril coast lifestyle create strong long-term value.' },
      { q: 'What international schools are near Cascais?', a: 'The Cascais/Estoril area hosts several international schools including CAISL, Fieldwork Education, and the British School of Lisbon, making it popular with relocating families.' },
      { q: 'How far is Cascais from Lisbon Airport?', a: 'Cascais is 35–40 minutes from Lisbon Humberto Delgado International Airport via the A5 motorway, making it highly accessible for frequent travellers.' },
    ],
  },
  algarve: {
    name: 'Algarve', namePT: 'Algarve', slug: 'algarve',
    pricePerSqm: 3941, primePrice: 6500, yoy: 11, yield: 4.8, yieldTur: 7.2,
    emoji: '☀️', region: 'Southern Portugal',
    headline: 'Buy Property in the Algarve, Portugal 2026',
    desc: 'Europe\'s premier sun and golf destination. The Algarve offers the highest tourism rental yields in Portugal (7.2%) with consistent international demand from British, German, Irish, and Dutch buyers.',
    highlights: [
      'Europe\'s #1 golf destination — 40+ world-class courses',
      'Highest tourism yield in Portugal: 7.2% average',
      '+11% YoY price appreciation · 300 days of sunshine',
      'Premium areas: Golden Triangle (Vale do Lobo, Quinta do Lago, Vilamoura), Lagos, Carvoeiro',
      'Faro International Airport — direct flights from 150+ European cities',
    ],
    buyerProfiles: ['British & Irish retirees', 'German & Dutch investors', 'Holiday home buyers', 'Golf lifestyle buyers'],
    forecast: '€4,600/m² by 2027',
    lat: 37.0179, lng: -7.9307,
    faq: [
      { q: 'What is the average property price in the Algarve in 2026?', a: 'The Algarve average is €3,941/m² in 2026. Prime areas like Quinta do Lago and Vale do Lobo command €6,500+/m². Agency Group covers the entire Algarve coast.' },
      { q: 'What rental yield can I expect from an Algarve property?', a: 'Tourism/short-term rental yield averages 7.2% in the Algarve — the highest in Portugal. Premium resorts like Quinta do Lago can achieve 8–10% with professional management.' },
      { q: 'Is the Algarve a good retirement destination?', a: 'Yes. The Algarve is consistently ranked among Europe\'s top retirement destinations for its climate (300 days sunshine), healthcare, safety, cost of living, and English-speaking community.' },
      { q: 'What are the best areas to buy in the Algarve?', a: 'The Golden Triangle (Quinta do Lago, Vale do Lobo, Vilamoura) is prime for investment. Lagos and Carvoeiro offer strong lifestyle value. Tavira is emerging with strong appreciation.' },
    ],
  },
  porto: {
    name: 'Porto', namePT: 'Porto', slug: 'porto',
    pricePerSqm: 3643, primePrice: 5800, yoy: 12, yield: 4.1, yieldTur: 6.1,
    emoji: '🍷', region: 'Northern Portugal',
    headline: 'Buy Property in Porto, Portugal 2026',
    desc: 'Porto is Portugal\'s second city and fastest-growing tech hub. UNESCO World Heritage historic centre, vibrant cultural scene, and strong rental yields attract European and international investors.',
    highlights: [
      'UNESCO World Heritage centre — Ribeira & historic districts',
      '+12% YoY · Rising tech & startup ecosystem',
      'Average yield 4.1% · Tourism 6.1% in prime areas',
      'Premium areas: Foz do Douro, Boavista, Bonfim, Bairro das Artes',
      '30+ direct international flights from Francisco Sá Carneiro Airport',
    ],
    buyerProfiles: ['European millennials', 'Tech sector investors', 'Short-term rental investors', 'French & Brazilian buyers'],
    forecast: '€4,200/m² by 2027',
    lat: 41.1579, lng: -8.6291,
    faq: [
      { q: 'What is the property price in Porto in 2026?', a: 'Porto averages €3,643/m² in 2026, with premium riverside and coastal areas (Foz do Douro) reaching €5,800/m². 12% YoY growth reflects strong demand.' },
      { q: 'Is Porto a good investment compared to Lisbon?', a: 'Porto offers better value than Lisbon with comparable appreciation rates (12% vs 14% YoY) and higher rental yields (4.1% vs 3.2%). Lower entry price makes it attractive for first-time investors.' },
      { q: 'What are the best neighbourhoods to invest in Porto?', a: 'Foz do Douro leads for luxury. Bonfim and Bairro das Artes offer strong gentrification appreciation. Ribeira is prime for Airbnb. Boavista suits corporate professionals.' },
    ],
  },
  madeira: {
    name: 'Madeira', namePT: 'Madeira', slug: 'madeira',
    pricePerSqm: 3760, primePrice: 5200, yoy: 18, yield: 4.5, yieldTur: 6.8,
    emoji: '🌺', region: 'Madeira Island',
    headline: 'Buy Property in Madeira, Portugal 2026',
    desc: 'Madeira is Europe\'s fastest-growing island real estate market (+18% YoY). Favourable tax regime (Madeira Free Trade Zone), year-round mild climate, and growing digital nomad community create exceptional investment conditions.',
    highlights: [
      '+18% YoY — Europe\'s fastest-growing island market',
      'Madeira Free Trade Zone — competitive tax benefits',
      'Year-round mild climate (16°C–25°C)',
      'Digital nomad hub — international remote worker community',
      'Premium areas: Funchal, Calheta, Palheiro Estate, Porto Santo',
    ],
    buyerProfiles: ['Digital nomads', 'Tax-optimisation investors', 'European retirees', 'Remote working professionals'],
    forecast: '€4,400/m² by 2027',
    lat: 32.6669, lng: -16.9241,
    faq: [
      { q: 'What are the tax benefits of buying property in Madeira?', a: 'Madeira offers the Madeira International Business Centre (MIBC) with reduced corporate tax rates of 5% for eligible international companies. Personal income tax benefits also apply under NHR/IFICI regime.' },
      { q: 'Why is Madeira real estate growing so fast?', a: 'Madeira grew +18% in 2025 — the fastest in Europe. Drivers include post-pandemic digital nomad migration, limited supply, growing international flights, and Madeira Free Trade Zone incentives.' },
      { q: 'What is the best area to buy in Madeira?', a: 'Funchal (the capital) is the most liquid market. Palheiro Estate and Calheta offer luxury resort living. Porto Santo island offers the best value with future growth potential.' },
    ],
  },
  comporta: {
    name: 'Comporta', namePT: 'Comporta', slug: 'comporta',
    pricePerSqm: 4200, primePrice: 9500, yoy: 22, yield: 4.0, yieldTur: 6.5,
    emoji: '🌾', region: 'Alentejo Coast',
    headline: 'Buy Property in Comporta, Portugal 2026',
    desc: 'Comporta is the Portuguese St. Tropez — the most exclusive and fastest-appreciating market in Portugal (+22% YoY). Ultra-premium privacy, rice fields, pristine beaches, and limited supply attract A-list clientele.',
    highlights: [
      '+22% YoY — highest appreciation in Portugal 2025',
      'Ultra-prime properties €5M–€15M in Carvalhal & Brejos',
      'Total privacy · 30km pristine beaches · No mass tourism',
      '90 minutes from Lisbon — preferred for weekend retreats',
      'Limited supply — strict construction restrictions preserve exclusivity',
    ],
    buyerProfiles: ['Ultra-HNWI', 'Celebrities & private equity', 'Portuguese diaspora', 'Art world & creative elite'],
    forecast: '€5,200/m² by 2027 · Prime land €1,500+/m²',
    lat: 38.3817, lng: -8.7775,
    faq: [
      { q: 'Why is Comporta so expensive?', a: 'Comporta combines extreme scarcity (strict construction limits), premium privacy (no hotel chains), pristine nature, and proximity to Lisbon. Demand is overwhelmingly driven by global HNWI seeking discreet luxury.' },
      { q: 'What is the minimum budget for Comporta?', a: 'Entry-level Comporta properties start at €1.5M for a traditional Monte (farmhouse). Prime villas range €5M–€15M+. Land plots in premium areas sell at €1,000–€2,000/m².' },
      { q: 'Is Comporta a liquid market?', a: 'Transaction volumes are lower than urban markets but liquidity has improved significantly with growing international demand. Agency Group maintains a curated buyer list for off-market transactions.' },
    ],
  },
  sintra: {
    name: 'Sintra', namePT: 'Sintra', slug: 'sintra',
    pricePerSqm: 3200, primePrice: 5500, yoy: 9, yield: 3.5, yieldTur: 5.0,
    emoji: '🏰', region: 'Lisbon District',
    headline: 'Buy Property in Sintra, Portugal 2026',
    desc: 'Sintra — UNESCO World Heritage site with royal palaces, mountain estates, and just 25 minutes from Lisbon. Perfect for those seeking historic grandeur and natural beauty within easy reach of the capital.',
    highlights: [
      'UNESCO World Heritage Cultural Landscape',
      '25 minutes from Lisbon · 20 minutes from Cascais beaches',
      'Unique property types: quintas, palacetes, mountain villas',
      '+9% YoY · Yield 3.5% · Tourism premium for estate rentals',
      'Proximity to Cascais international schools and golf',
    ],
    buyerProfiles: ['Culture & heritage buyers', 'Remote workers seeking space', 'Boutique hotel investors', 'Portuguese nationals upgrading'],
    forecast: '€3,700/m² by 2027',
    lat: 38.7978, lng: -9.3895,
    faq: [
      { q: 'What types of property are available in Sintra?', a: 'Sintra offers diverse property types: historic quintas (country estates), palacetes (manor houses), modern villas on the hills, and traditional Portuguese homes in the village. Agency Group specialises in premium Sintra estates.' },
      { q: 'Is Sintra a good investment?', a: 'Sintra offers steady +9% YoY appreciation with the added benefit of UNESCO protection, which restricts new development and preserves long-term asset values.' },
    ],
  },
  ericeira: {
    name: 'Ericeira', namePT: 'Ericeira', slug: 'ericeira',
    pricePerSqm: 2800, primePrice: 4500, yoy: 15, yield: 4.2, yieldTur: 6.0,
    emoji: '🏄', region: 'Lisbon Coast',
    headline: 'Buy Property in Ericeira, Portugal 2026',
    desc: 'Ericeira is the World Surfing Reserve — one of only 11 in the world. 40 minutes from Lisbon, this charming village is growing rapidly as surfers, remote workers, and investors discover its unique combination of lifestyle and value.',
    highlights: [
      'World Surfing Reserve — global surf destination',
      '+15% YoY appreciation · 40 minutes from Lisbon',
      'Best value coastal property near Lisbon (€2,800/m²)',
      'Short-term rental yield 6.0% · Strong summer demand',
      'Growing international community of surfers & digital nomads',
    ],
    buyerProfiles: ['Surf lifestyle buyers', 'Lisbon commuters seeking coastal life', 'Airbnb investors', 'Young international buyers'],
    forecast: '€3,300/m² by 2027',
    lat: 38.9637, lng: -9.4178,
    faq: [
      { q: 'Why is Ericeira growing so fast?', a: 'Ericeira benefits from overflow from the Lisbon/Cascais market, its World Surfing Reserve status, excellent coastal access, and growing remote worker community. Supply remains constrained by protected natural areas.' },
      { q: 'What is the best area to buy in Ericeira?', a: 'Ericeira village centre commands the highest prices. Ribamar and São Lourenço offer emerging value. Oceanfront properties near Ribeira d\'Ilhas surf reserve are premium.' },
    ],
  },
}

// ─── Metadata generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(ZONES_EN).map(zona => ({ zona }))
}

export async function generateMetadata({ params }: { params: Promise<{ zona: string }> }): Promise<Metadata> {
  const { zona } = await params
  const z = ZONES_EN[zona]
  if (!z) return {}

  return {
    title:       `${z.headline} | Agency Group AMI 22506`,
    description: `${z.desc.slice(0, 160)} Agency Group AMI 22506 — Portugal's premier luxury real estate boutique.`,
    keywords:    `buy property ${z.name}, real estate ${z.name} Portugal, invest ${z.name}, luxury homes ${z.name} 2026, Agency Group`,
    alternates: {
      canonical: `https://www.agencygroup.pt/en/zones/${zona}`,
      languages: {
        'en':       `https://www.agencygroup.pt/en/zones/${zona}`,
        'pt':       `https://www.agencygroup.pt/zonas/${zona}`,
        'x-default': `https://www.agencygroup.pt/zonas/${zona}`,
      },
    },
    openGraph: {
      title:       `${z.headline} | Agency Group`,
      description: `${z.desc.slice(0, 200)} Average €${z.pricePerSqm.toLocaleString()}/m² · +${z.yoy}% YoY.`,
      type:        'website',
      url:         `https://www.agencygroup.pt/en/zones/${zona}`,
      siteName:    'Agency Group',
      locale:      'en_US',
      images: [{
        url:    `https://www.agencygroup.pt/api/og?title=${encodeURIComponent(`Property in ${z.name} 2026`)}&subtitle=${encodeURIComponent(`€${z.pricePerSqm.toLocaleString()}/m² · +${z.yoy}% YoY · Yield ${z.yield}%`)}`,
        width:  1200,
        height: 630,
        alt:    `Property in ${z.name}, Portugal 2026 — Agency Group`,
      }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${z.headline} | Agency Group`,
      description: `€${z.pricePerSqm.toLocaleString()}/m² · +${z.yoy}% YoY · Yield ${z.yield}% · Agency Group AMI 22506`,
    },
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function EnZonePage({ params }: { params: Promise<{ zona: string }> }) {
  const { zona } = await params
  const z = ZONES_EN[zona]
  if (!z) notFound()

  // ── JSON-LD ─────────────────────────────────────────────────────────────────

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',          item: 'https://www.agencygroup.pt/en' },
      { '@type': 'ListItem', position: 2, name: 'Zones',         item: 'https://www.agencygroup.pt/en' },
      { '@type': 'ListItem', position: 3, name: z.name,          item: `https://www.agencygroup.pt/en/zones/${zona}` },
    ],
  }

  const realEstateSchema = {
    '@context': 'https://schema.org',
    '@type':    'RealEstateAgent',
    '@id':      `https://www.agencygroup.pt/en/zones/${zona}#realestate`,
    name:       `Agency Group — Property in ${z.name}, Portugal`,
    description: z.desc,
    url:        `https://www.agencygroup.pt/en/zones/${zona}`,
    telephone:  '+351919948986',
    email:      'geral@agencygroup.pt',
    address: {
      '@type':           'PostalAddress',
      addressLocality:   z.name,
      addressRegion:     z.region,
      addressCountry:    'PT',
    },
    geo: {
      '@type':    'GeoCoordinates',
      latitude:   z.lat,
      longitude:  z.lng,
    },
    identifier: { '@type': 'PropertyValue', name: 'AMI', value: '22506' },
    areaServed: z.name,
    priceRange: '€€€€',
    sameAs:     'https://www.agencygroup.pt',
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: z.faq.map(({ q, a }) => ({
      '@type':         'Question',
      name:            q,
      acceptedAnswer:  { '@type': 'Answer', text: a },
    })),
  }

  const marketDataSchema = {
    '@context': 'https://schema.org',
    '@type':    'Dataset',
    name:       `${z.name} Real Estate Market Data 2026`,
    description: `Property prices, yields, and market trends for ${z.name}, Portugal in 2026`,
    url:        `https://www.agencygroup.pt/en/zones/${zona}`,
    creator:    { '@type': 'Organization', name: 'Agency Group', identifier: 'AMI 22506' },
    temporalCoverage: '2026',
    spatialCoverage:  z.name,
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Average Price per m²',      value: z.pricePerSqm,   unitCode: 'EUR' },
      { '@type': 'PropertyValue', name: 'Prime Price per m²',        value: z.primePrice,    unitCode: 'EUR' },
      { '@type': 'PropertyValue', name: 'Year-over-Year Appreciation', value: z.yoy,          unitCode: 'P1' },
      { '@type': 'PropertyValue', name: 'Gross Rental Yield',         value: z.yield,        unitCode: 'P1' },
      { '@type': 'PropertyValue', name: 'Tourism Rental Yield',       value: z.yieldTur,     unitCode: 'P1' },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(realEstateSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketDataSchema) }} />

      <main style={{ fontFamily: 'var(--font-jost, sans-serif)', color: '#0e0e0d', maxWidth: '900px', margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <ol style={{ listStyle: 'none', display: 'flex', gap: '8px', padding: 0, margin: 0, fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,0.4)' }}>
            <li><Link href="/en" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link></li>
            <li style={{ opacity: 0.4 }}>/</li>
            <li><Link href="/en" style={{ color: 'inherit', textDecoration: 'none' }}>Zones</Link></li>
            <li style={{ opacity: 0.4 }}>/</li>
            <li style={{ color: '#1c4a35' }}>{z.name}</li>
          </ol>
        </nav>

        {/* Hero */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.5rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,0.4)', marginBottom: '12px' }}>
            Agency Group · AMI 22506 · Market Intelligence 2026
          </div>
          <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300, fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.1, color: '#1c4a35', margin: '0 0 16px', letterSpacing: '0.02em' }}>
            {z.emoji} {z.headline}
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.75, color: 'rgba(14,14,13,0.7)', maxWidth: '720px', margin: 0 }}>
            {z.desc}
          </p>
          <div style={{ marginTop: '12px' }}>
            <Link href={`/zonas/${zona}`} style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.46rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c9a96e', textDecoration: 'none' }}>
              Ver página em Português →
            </Link>
          </div>
        </div>

        {/* Market Data Cards */}
        <section aria-labelledby="market-data-heading" style={{ marginBottom: '48px' }}>
          <h2 id="market-data-heading" style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.5rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,0.4)', marginBottom: '20px' }}>
            Market Data 2026
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Avg. Price/m²',   value: `€${z.pricePerSqm.toLocaleString()}`,    sub: 'Average 2026' },
              { label: 'Prime Price/m²',  value: `€${z.primePrice.toLocaleString()}`,      sub: 'Best locations' },
              { label: 'YoY Growth',      value: `+${z.yoy}%`,                             sub: '2025 appreciation' },
              { label: 'Rental Yield',    value: `${z.yield}%`,                            sub: 'Long-term gross' },
              { label: 'Tourism Yield',   value: `${z.yieldTur}%`,                         sub: 'Short-term gross' },
              { label: 'Forecast',        value: z.forecast.split(' ')[0],                 sub: z.forecast.split('(')[0].trim() },
            ].map(m => (
              <div key={m.label} style={{ border: '1px solid rgba(14,14,13,0.08)', padding: '16px', background: '#fff' }}>
                <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300, fontSize: '1.6rem', color: '#1c4a35', lineHeight: 1 }}>{m.value}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.42rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,0.4)', marginTop: '6px' }}>{m.label}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(14,14,13,0.45)', marginTop: '2px' }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Why Buy */}
        <section aria-labelledby="highlights-heading" style={{ marginBottom: '48px' }}>
          <h2 id="highlights-heading" style={{ fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300, fontSize: '1.8rem', color: '#1c4a35', marginBottom: '20px', letterSpacing: '0.02em' }}>
            Why Buy in {z.name}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {z.highlights.map((h, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '0.92rem', lineHeight: 1.6, color: 'rgba(14,14,13,0.75)' }}>
                <span style={{ color: '#c9a96e', flexShrink: 0, marginTop: '3px' }}>→</span>
                {h}
              </li>
            ))}
          </ul>
        </section>

        {/* Buyer Profiles */}
        <section aria-labelledby="buyers-heading" style={{ marginBottom: '48px' }}>
          <h2 id="buyers-heading" style={{ fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300, fontSize: '1.8rem', color: '#1c4a35', marginBottom: '16px', letterSpacing: '0.02em' }}>
            Who Buys in {z.name}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {z.buyerProfiles.map((p, i) => (
              <span key={i} style={{ padding: '5px 14px', border: '1px solid rgba(14,14,13,0.12)', fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.46rem', letterSpacing: '0.1em', color: 'rgba(14,14,13,0.6)' }}>
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" style={{ marginBottom: '48px' }}>
          <h2 id="faq-heading" style={{ fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300, fontSize: '1.8rem', color: '#1c4a35', marginBottom: '24px', letterSpacing: '0.02em' }}>
            Frequently Asked Questions — {z.name}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {z.faq.map((item, i) => (
              <details key={i} style={{ border: '1px solid rgba(14,14,13,0.08)', padding: '16px 20px' }}>
                <summary style={{ fontWeight: 500, fontSize: '0.92rem', cursor: 'pointer', color: '#0e0e0d', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {item.q}
                  <span style={{ color: '#c9a96e', flexShrink: 0, marginLeft: '12px' }}>+</span>
                </summary>
                <p style={{ marginTop: '12px', fontSize: '0.88rem', lineHeight: 1.7, color: 'rgba(14,14,13,0.7)', marginBottom: 0 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-heading" style={{ background: '#0c1f15', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.46rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.6)', marginBottom: '12px' }}>Agency Group · AMI 22506</div>
          <h2 id="cta-heading" style={{ fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300, fontSize: '2rem', color: '#f4f0e6', marginBottom: '8px', letterSpacing: '0.04em' }}>
            Looking to Buy in {z.name}?
          </h2>
          <p style={{ color: 'rgba(244,240,230,0.6)', fontSize: '0.9rem', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Our specialists have exclusive access to the best properties in {z.name}. Get your free market analysis today.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contacto" style={{ padding: '14px 28px', background: '#c9a96e', color: '#0c1f15', fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.5rem', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}>
              Contact an Expert
            </Link>
            <Link href={`/zonas/${zona}`} style={{ padding: '14px 28px', border: '1px solid rgba(201,169,110,0.4)', color: '#c9a96e', fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '0.5rem', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}>
              Versão Portuguesa
            </Link>
          </div>
        </section>

      </main>
    </>
  )
}
