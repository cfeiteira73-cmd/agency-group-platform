import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Property Management Portugal 2026',
  description: 'Complete guide to property management in Portugal 2026. Rental yields 4–6%, AL Airbnb licence, property managers, costs, legal requirements. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/property-management-portugal',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/property-management-portugal',
      'en': 'https://www.agencygroup.pt/blog/property-management-portugal',
    },
  },
  openGraph: {
    title: 'Property Management Portugal 2026',
    description: 'Complete guide to property management in Portugal. Rental yields 4–6%, AL licence, legal requirements.',
    url: 'https://www.agencygroup.pt/blog/property-management-portugal',
    type: 'article',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Property Management Portugal 2026',
    description: 'Complete guide to property management in Portugal. Rental yields 4–6%, AL licence, legal requirements.',
    images: ['https://www.agencygroup.pt/blog/property-management-portugal'],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Property Management Portugal 2026',
  description: 'Complete guide to property management in Portugal 2026. Rental yields 4–6%, AL Airbnb licence, property managers, costs, legal requirements.',
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
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/property-management-portugal',
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
            <li aria-current="page">Property Management Portugal</li>
          </ol>
        </nav>

        <article>
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              Property Management Portugal 2026: Complete Investor Guide
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 April 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Owning investment property in Portugal is one thing — managing it profitably from abroad is another. Whether you are running a short-term Airbnb operation in Lisbon, a medium-term rental in Cascais, or a long-term residential let in Porto, understanding the Portuguese property management landscape is essential to protecting your yield and your asset.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">The Two Rental Models: AL vs. Long-Term</h2>
            <p>
              Portugal distinguishes clearly between two rental models for residential property: <strong>Alojamento Local (AL)</strong> — the short-term / holiday rental model governed by the Tourism Act — and long-term rental (arrendamento habitacional) governed by the Civil Code and the NRAU (New Urban Rental Regime).
            </p>
            <p>
              Each model has fundamentally different yield profiles, management requirements, regulatory frameworks and tax treatments. The choice between them should be driven by your investment thesis, location, property type and appetite for management intensity.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Alojamento Local (AL): Short-Term Rental</h2>
            <p>
              AL licences permit property owners to rent furnished accommodation for periods of up to 30 days per guest. This is the model underpinning Airbnb, Booking.com and VRBO operations in Portugal. Gross yields on well-managed AL properties in Lisbon, Cascais and the Algarve typically run 5–8%, with premium properties in high-demand locations reaching 10–12% in peak season.
            </p>
            <p>
              To operate legally as AL in Portugal, you must:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Register with the local council (Câmara Municipal) and obtain a licence number</li>
              <li>Comply with safety requirements (fire extinguisher, first aid kit, emergency contacts, complaint book)</li>
              <li>Collect tourist tax (taxa turística) from guests — varies by municipality (€1–€4 per person per night)</li>
              <li>Comply with condominium regulations — many condominiums in Lisbon have voted to ban or restrict AL</li>
              <li>Report guest stays to SEF (immigration authority) within 3 days</li>
              <li>Submit quarterly or annual VAT returns if above the €85,000 threshold</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Long-Term Rental: Stability and Simplicity</h2>
            <p>
              Long-term residential rental in Portugal offers lower yields (4–5.5% gross in prime locations) but significantly lower management overhead, no AL licence requirements, and greater stability of income. The NRAU framework protects both landlord and tenant, with notice periods of 2 months for tenants and 2–4 months for landlords depending on contract duration.
            </p>
            <p>
              Taxation on long-term rental income is straightforward: a flat rate of 25% IRS on net rental income (gross rent minus allowable deductions including IMI, condominium fees, insurance, depreciation and maintenance costs). This compares favourably with AL, where income is taxed at a rate of 35% on net income under category B (self-employment income) unless you opt for the simplified regime.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Property Management Costs in Portugal</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Service</th>
                    <th className="text-right p-3">AL (Short-Term)</th>
                    <th className="text-right p-3">Long-Term</th>
                    <th className="text-left p-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Management fee</td>
                    <td className="p-3 text-right">20–30% of revenue</td>
                    <td className="p-3 text-right">1 month/year</td>
                    <td className="p-3 text-sm text-gray-500">Full-service</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Cleaning</td>
                    <td className="p-3 text-right">€40–€100/stay</td>
                    <td className="p-3 text-right">N/A</td>
                    <td className="p-3 text-sm text-gray-500">Per turnover</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Linen/laundry</td>
                    <td className="p-3 text-right">€15–€40/stay</td>
                    <td className="p-3 text-right">N/A</td>
                    <td className="p-3 text-sm text-gray-500">If provided</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Maintenance reserve</td>
                    <td className="p-3 text-right">5–8% of revenue</td>
                    <td className="p-3 text-right">5% of revenue</td>
                    <td className="p-3 text-sm text-gray-500">Annual budget</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">IMI (council tax)</td>
                    <td className="p-3 text-right">0.3–0.8% VPT</td>
                    <td className="p-3 text-right">0.3–0.8% VPT</td>
                    <td className="p-3 text-sm text-gray-500">Annual</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Condominium fees</td>
                    <td className="p-3 text-right">€50–€300/month</td>
                    <td className="p-3 text-right">€50–€300/month</td>
                    <td className="p-3 text-sm text-gray-500">By building</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Choosing a Property Manager</h2>
            <p>
              For international investors, engaging a professional property manager is almost always advisable. A good property manager in Portugal will handle guest communications, check-ins, cleaning coordination, maintenance calls, local tax compliance, and tourist tax collection — freeing you to be a truly passive investor.
            </p>
            <p>
              When evaluating property managers, ask specifically:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Do they hold an AMI licence (required for real estate brokerage in Portugal)?</li>
              <li>Do they handle SEF guest registration for AL properties?</li>
              <li>How do they handle maintenance emergencies at 2am?</li>
              <li>What OTA channels do they list on (Airbnb, Booking.com, direct)?</li>
              <li>What is their average occupancy rate for comparable properties in the same area?</li>
              <li>Do they provide monthly financial statements and access to your performance dashboard?</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Typical Yields by Location</h2>
            <p>
              Based on Agency Group&apos;s transaction data and market intelligence for 2026:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li><strong>Lisbon historic centre (AL):</strong> 5.5–8% gross; high demand year-round</li>
              <li><strong>Cascais / Estoril (AL + medium-term):</strong> 4.5–7% gross; strong in summer</li>
              <li><strong>Algarve coast (AL):</strong> 6–10% gross; highly seasonal (May–October peak)</li>
              <li><strong>Porto (long-term):</strong> 5–6.5% gross; stable year-round demand</li>
              <li><strong>Madeira (AL):</strong> 6–9% gross; year-round tourist demand</li>
            </ul>

            <p className="mt-8">
              Agency Group provides end-to-end support for investment property acquisition and management referrals. Browse current investment properties at{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /imoveis
              </Link>
              {' '}or explore zones at{' '}
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
