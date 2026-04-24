import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Best Areas in Lisbon for Expats 2026',
  description: 'Top neighbourhoods in Lisbon for American, British and French expats buying €500K–€2M. Príncipe Real, Chiado, Estrela, Belém, Campo de Ourique compared.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/best-areas-lisbon-expats-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/best-areas-lisbon-expats-2026',
      'en': 'https://www.agencygroup.pt/blog/best-areas-lisbon-expats-2026',
    },
  },
  openGraph: {
    title: 'Best Areas in Lisbon for Expats 2026',
    description: 'Top neighbourhoods in Lisbon for American, British and French expats buying €500K–€2M.',
    url: 'https://www.agencygroup.pt/blog/best-areas-lisbon-expats-2026',
    type: 'article',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Areas in Lisbon for Expats 2026',
    description: 'Top neighbourhoods in Lisbon for American, British and French expats buying €500K–€2M.',
    images: ['https://www.agencygroup.pt/blog/best-areas-lisbon-expats-2026'],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Best Areas in Lisbon for Expats 2026',
  description: 'Top neighbourhoods in Lisbon for American, British and French expats buying €500K–€2M. Príncipe Real, Chiado, Estrela, Belém, Campo de Ourique compared.',
  image: {
    '@type': 'ImageObject',
    url: 'https://www.agencygroup.pt/og-image.jpg',
    width: 1200,
    height: 630,
  },
  author: {
    '@type': 'Organization',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Agency Group',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.agencygroup.pt/logo.png',
      width: 200,
      height: 60,
    },
  },
  datePublished: '2026-04-07',
  dateModified: '2026-04-07',
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/best-areas-lisbon-expats-2026',
  inLanguage: 'en',
}

export default function BlogPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <main className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb">
          <ol className="flex text-sm text-gray-500 gap-2 mb-8">
            <li><Link href="/">Home</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href="/blog">Blog</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">Best Areas Lisbon Expats</li>
          </ol>
        </nav>

        <article>
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              Best Areas in Lisbon for Expats 2026
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 April 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Lisbon has firmly established itself as one of the world&apos;s most sought-after destinations for international buyers. With 169,812 transactions recorded in 2025 and luxury properties ranking in the global top 5, the question for most expats is not whether to buy — but where. This guide breaks down the five best neighbourhoods for American, British and French buyers with budgets between €500K and €2M.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Why Lisbon Outperforms in 2026</h2>
            <p>
              The Portuguese capital continues to attract a disproportionate share of high-net-worth international buyers. North Americans represent 16% of foreign buyers, French 13%, and British 9% — three nationalities that consistently gravitate toward Lisbon&apos;s historic centre. The average price per square metre in Lisbon reached €5,000/m² in 2026, with premium corridors pushing €8,000–€12,000/m² in the most desirable streets.
            </p>
            <p>
              The IFICI tax regime (formerly NHR) continues to attract professionals and retirees with reduced flat tax rates on qualifying foreign-source income. Combined with a Mediterranean climate, excellent international schools, and direct flights to New York, London, Paris and beyond, Lisbon delivers a quality of life that is increasingly difficult to replicate elsewhere in Western Europe at this price point.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">1. Príncipe Real — Lisbon&apos;s Most Coveted Address</h2>
            <p>
              Príncipe Real is the neighbourhood of choice for buyers who want the ultimate Lisbon prestige address. Characterised by 19th-century palacetes, wide tree-lined streets, independent boutiques and Michelin-starred restaurants, this is where the city&apos;s cultural elite lives. Prices range from €6,500 to €11,000/m², with premium T3 apartments starting at €950,000 and entire townhouses reaching €4M–€8M.
            </p>
            <p>
              American buyers in particular are drawn to Príncipe Real for its walkability, international community, and proximity to the French school (École Française de Lisbonne). The neighbourhood is compact, quiet, and exceptionally well-connected on foot to the Baixa, Chiado, and the Tagus riverfront.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">2. Chiado — Culture, Commerce and Capital Appreciation</h2>
            <p>
              Chiado has been the literary and cultural heart of Lisbon for centuries. Today it is also one of the strongest real estate markets in the city, with consistent capital appreciation of 12–18% year-on-year since 2022. The neighbourhood sits at the top of two hills overlooking the Tagus, with exceptional views available from upper-floor apartments.
            </p>
            <p>
              Entry-level T2 apartments in Chiado start around €650,000; renovated T3s in period buildings with river views command €1.2M–€2M. British buyers in particular appreciate the mature market, strong rental yields (4.5–6.5% gross for short-term AL rentals), and the presence of English-speaking services and the British Council nearby.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">3. Estrela — Residential Calm, Premium Value</h2>
            <p>
              Estrela is the neighbourhood many expats discover after initially looking at Príncipe Real — and often where they end up buying. It offers more space per euro, calmer streets, and some of the finest gardens in the city, anchored by the Jardim da Estrela. The Basilica da Estrela dominates the skyline and the area has a strong French community presence, with several French-speaking services and proximity to key consular offices.
            </p>
            <p>
              Prices in Estrela range from €4,800 to €7,500/m². A renovated T3 of 120m² will typically cost €650,000–€900,000 — representing better value than comparable Chiado or Príncipe Real stock. Capital appreciation is steady at 10–14% annually.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">4. Belém — Space, History and the Tagus</h2>
            <p>
              For buyers who prioritise space, architectural grandeur and proximity to the river, Belém is unmatched. Home to the UNESCO World Heritage Jerónimos Monastery and Torre de Belém, this western neighbourhood attracts buyers seeking larger villas and palaces with private gardens. Typical prices range from €4,200 to €6,800/m², with detached villas available from €1.2M upward.
            </p>
            <p>
              American family buyers and retirees frequently choose Belém for its lower density, parking availability, and the 5-minute drive to the A5 motorway linking Cascais. The Cascais line train also connects Belém directly to Cascais and Estoril in under 45 minutes.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">5. Campo de Ourique — The Neighbourhood Locals Keep Secret</h2>
            <p>
              Campo de Ourique is Lisbon&apos;s best-kept secret among discerning expat buyers. A residential village within the city, it has an exceptional local market (Mercado de Campo de Ourique), wide pavements, top-rated schools and one of the lowest crime rates in Lisbon. Prices remain 15–20% below comparable Chiado or Príncipe Real properties, creating genuine value.
            </p>
            <p>
              T2 apartments start from €480,000; renovated T3s run €680,000–€1.1M. The neighbourhood&apos;s authenticity — still home to many multi-generational Portuguese families — gives it a social fabric that pure tourist-driven areas like Baixa have lost.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Neighbourhood Comparison Table</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Neighbourhood</th>
                    <th className="text-right p-3">Price/m²</th>
                    <th className="text-right p-3">T3 Entry</th>
                    <th className="text-right p-3">YoY</th>
                    <th className="text-left p-3">Best For</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Príncipe Real</td>
                    <td className="p-3 text-right">€6,500–€11,000</td>
                    <td className="p-3 text-right">€950K+</td>
                    <td className="p-3 text-right text-green-700">+18%</td>
                    <td className="p-3">Prestige, Americans</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Chiado</td>
                    <td className="p-3 text-right">€5,500–€9,500</td>
                    <td className="p-3 text-right">€750K+</td>
                    <td className="p-3 text-right text-green-700">+15%</td>
                    <td className="p-3">Culture, British</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Estrela</td>
                    <td className="p-3 text-right">€4,800–€7,500</td>
                    <td className="p-3 text-right">€650K+</td>
                    <td className="p-3 text-right text-green-700">+12%</td>
                    <td className="p-3">Families, French</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Belém</td>
                    <td className="p-3 text-right">€4,200–€6,800</td>
                    <td className="p-3 text-right">€550K+</td>
                    <td className="p-3 text-right text-green-700">+11%</td>
                    <td className="p-3">Space, Retirees</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Campo de Ourique</td>
                    <td className="p-3 text-right">€4,000–€6,500</td>
                    <td className="p-3 text-right">€480K+</td>
                    <td className="p-3 text-right text-green-700">+10%</td>
                    <td className="p-3">Value, Locals</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Buying Process for Foreign Nationals</h2>
            <p>
              All foreign buyers must obtain a Portuguese tax number (NIF) before signing any purchase agreement. Agency Group coordinates this for international clients remotely through a fiscal representative. The typical purchase timeline runs 8–12 weeks from accepted offer to escritura (deed): offer and negotiation (1–2 weeks), CPCV promissory contract with 20–30% deposit (2–4 weeks), due diligence and financing (4–6 weeks), final deed (escritura).
            </p>
            <p>
              Transaction costs add approximately 6–9% on top of the purchase price: IMT property transfer tax (0–8% depending on value and type), Imposto de Selo stamp duty (0.8%), notary and land registry fees, plus agency commission of 5% + VAT (paid by the seller in most Portuguese transactions).
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">IFICI Tax Regime for New Residents</h2>
            <p>
              Buyers who establish tax residency in Portugal can benefit from the IFICI regime (Incentivo Fiscal à Investigação Científica e Inovação), which replaced the NHR regime in 2024. Under IFICI, qualifying individuals pay a flat 20% rate on Portuguese-source employment income and may benefit from preferential treatment on certain foreign-source income streams for up to 10 years. This is particularly attractive for American buyers who can structure their affairs to minimise their effective tax burden significantly below US rates on passive income.
            </p>

            <p className="mt-8">
              Browse our current listings across all five neighbourhoods at{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /imoveis
              </Link>
              {' '}or explore our neighbourhood guides at{' '}
              <Link href="/zonas" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /zonas
              </Link>.
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-[#1c4a35] text-white rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2">Agency Group · AMI 22506</h2>
              <p className="text-green-100 mb-4">
                Luxury real estate specialists in Portugal. Lisbon, Cascais, Porto, Algarve, Madeira.
              </p>
              <Link
                href="/imoveis"
                className="inline-block bg-[#c9a96e] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#a8843a] transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                View Available Properties →
              </Link>
            </div>
          </footer>
        </article>
      </main>
    </>
  )
}
