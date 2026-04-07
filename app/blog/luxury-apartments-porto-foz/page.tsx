import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Luxury Apartments Porto Foz 2026',
  description: 'Foz do Douro premium real estate market 2026. €3,500–5,000/m², buyer profile, top streets, investment returns. Porto luxury guide by Agency Group AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/luxury-apartments-porto-foz',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/luxury-apartments-porto-foz',
      'en': 'https://www.agencygroup.pt/blog/luxury-apartments-porto-foz',
    },
  },
  openGraph: {
    title: 'Luxury Apartments Porto Foz 2026',
    description: 'Foz do Douro premium real estate market 2026. €3,500–5,000/m², buyer profile, top streets.',
    url: 'https://www.agencygroup.pt/blog/luxury-apartments-porto-foz',
    type: 'article',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Luxury Apartments Porto Foz 2026',
  description: 'Foz do Douro premium real estate market 2026. €3,500–5,000/m², buyer profile, top streets, investment returns.',
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
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/luxury-apartments-porto-foz',
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
            <li aria-current="page">Luxury Apartments Porto Foz</li>
          </ol>
        </nav>

        <article>
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              Luxury Apartments Porto Foz 2026
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 April 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Foz do Douro is Porto&apos;s most prestigious residential address — a coastal enclave where the Douro River meets the Atlantic Ocean, lined with Belle Époque mansions, early 20th-century villas and an increasing number of contemporary luxury apartment developments. In 2026, Foz commands the highest prices in the Porto Metropolitan Area, consistently 35–55% above the city average of €3,643/m².
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Understanding the Foz Market</h2>
            <p>
              The Foz market is best understood as three distinct sub-markets: Foz Velha (Old Foz), Foz Nova (New Foz), and Nevogilde. Each has its own character, price range and buyer profile, though all share the premium positioning that distinguishes them from Porto&apos;s wider market.
            </p>
            <p>
              Porto&apos;s overall market recorded a 12% year-on-year appreciation in 2025, but Foz consistently outperformed, delivering 16–22% appreciation on premium stock. The key driver has been a surge in international buyers — particularly French, British and Brazilian nationals — who have identified Foz as offering better value per square metre than equivalent Lisbon addresses while providing genuine Atlantic coast living.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Foz Velha — Authentic Prestige</h2>
            <p>
              Foz Velha (historic Foz) centres on the Praça Guilherme Gomes Fernandes and the narrow streets running down to the Avenida do Brasil oceanfront promenade. Properties here are predominantly late 19th- and early 20th-century bourgeois houses, many divided into luxury apartments or converted into boutique guesthouses. Prices range from €4,200 to €6,500/m².
            </p>
            <p>
              A renovated T3 apartment of 130m² in Foz Velha will typically command €560,000–€840,000. The best buildings directly facing the ocean or the river mouth can push to €8,000–€10,000/m² for penthouse units with panoramic views. This is the Foz preferred by established local families and discreet international buyers who value character over modernity.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Nevogilde — Where New Luxury Lives</h2>
            <p>
              Nevogilde is the preferred address for new-build luxury developments in the Foz area. Located between Foz Velha and Matosinhos, it has seen the development of several world-class residential projects in the past five years: Condominium complexes with underground parking, concierge services, swimming pools and gymnasium facilities are increasingly common here.
            </p>
            <p>
              New-build apartments in Nevogilde range from €4,500 to €7,500/m², with penthouses in the finest developments reaching €9,000–€11,000/m². A T4 duplex penthouse with private terrace and sea views will typically sell for €1.5M–€2.8M. Brazilian and American buyers are particularly active in this segment, often purchasing as primary residences or high-yield short-term rentals.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Top Streets and Key Addresses</h2>
            <p>
              Among the most sought-after addresses in the Foz corridor:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li><strong>Avenida do Brasil</strong> — The oceanfront promenade, maximum prestige and views</li>
              <li><strong>Rua de Diu</strong> — Classic residential street in Foz Velha, quiet and well-kept</li>
              <li><strong>Avenida Montevideu</strong> — Wide boulevard, mix of historic villas and modern developments</li>
              <li><strong>Rua de Nevogilde</strong> — Heart of the Nevogilde luxury new-build corridor</li>
              <li><strong>Avenida da Boavista</strong> — Main arterial road connecting Foz to Porto centre, lower prices but excellent accessibility</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Price and Returns Comparison</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Sub-Area</th>
                    <th className="text-right p-3">Price/m²</th>
                    <th className="text-right p-3">T3 Range</th>
                    <th className="text-right p-3">Gross Yield</th>
                    <th className="text-right p-3">YoY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Foz Velha</td>
                    <td className="p-3 text-right">€4,200–€6,500</td>
                    <td className="p-3 text-right">€560K–€840K</td>
                    <td className="p-3 text-right">4.2–5.8%</td>
                    <td className="p-3 text-right text-green-700">+18%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Nevogilde</td>
                    <td className="p-3 text-right">€4,500–€7,500</td>
                    <td className="p-3 text-right">€600K–€975K</td>
                    <td className="p-3 text-right">4.5–6.2%</td>
                    <td className="p-3 text-right text-green-700">+22%</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Foz Nova</td>
                    <td className="p-3 text-right">€3,800–€5,500</td>
                    <td className="p-3 text-right">€500K–€720K</td>
                    <td className="p-3 text-right">4.0–5.5%</td>
                    <td className="p-3 text-right text-green-700">+16%</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Porto Average</td>
                    <td className="p-3 text-right">€3,643</td>
                    <td className="p-3 text-right">€290K–€480K</td>
                    <td className="p-3 text-right">5.0–7.0%</td>
                    <td className="p-3 text-right text-green-700">+12%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Buyer Profile: Who Is Buying in Foz?</h2>
            <p>
              The typical Foz buyer in 2026 is 42–58 years old, internationally mobile, and is either relocating to Porto permanently or acquiring a second home. Three nationalities dominate: French buyers represent the largest foreign segment (drawn by the proximity of the French school Lycée Français Charles Lepierre and cultural affinity), followed by Brazilians leveraging language advantage and IFICI tax incentives, and British buyers diversifying post-Brexit European portfolios.
            </p>
            <p>
              Average transaction values in Foz run 60–80% above Porto&apos;s city-wide average of €3,643/m², reflecting the concentration of the most discerning buyers in this coastal corridor. Agency Group handles a significant share of Foz transactions for international clients — contact us to access off-market listings and pre-market opportunities in this neighbourhood.
            </p>

            <p className="mt-8">
              Explore Foz and Porto luxury listings at{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /imoveis
              </Link>
              {' '}or discover Porto&apos;s neighbourhoods at{' '}
              <Link href="/zonas" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /zonas
              </Link>.
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-[#1c4a35] text-white rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2">Agency Group · AMI 22506</h2>
              <p className="text-green-100 mb-4">
                Specialists in luxury real estate in Portugal. Lisboa, Cascais, Porto, Algarve, Madeira.
              </p>
              <Link
                href="/imoveis"
                className="inline-block bg-[#c9a96e] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#a8843a] transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                Ver Imóveis Disponíveis →
              </Link>
            </div>
          </footer>
        </article>
      </main>
    </>
  )
}
