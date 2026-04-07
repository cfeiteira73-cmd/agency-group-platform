import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'VAT Exemption Portugal Property 2026',
  description: 'Complete guide to VAT on new construction in Portugal 2026. Reduced rates, exemptions, tax planning for buyers of new-build properties. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/vat-exemption-portugal-property',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/vat-exemption-portugal-property',
      'en': 'https://www.agencygroup.pt/blog/vat-exemption-portugal-property',
    },
  },
  openGraph: {
    title: 'VAT Exemption Portugal Property 2026',
    description: 'Complete guide to VAT on new construction in Portugal 2026. Reduced rates, exemptions, tax planning.',
    url: 'https://www.agencygroup.pt/blog/vat-exemption-portugal-property',
    type: 'article',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'VAT Exemption Portugal Property 2026',
  description: 'Complete guide to VAT on new construction in Portugal 2026. Reduced rates, exemptions, tax planning for buyers of new-build properties.',
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
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/vat-exemption-portugal-property',
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
            <li aria-current="page">VAT Exemption Portugal Property</li>
          </ol>
        </nav>

        <article>
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              VAT Exemption Portugal Property 2026
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 April 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Understanding VAT (IVA in Portuguese) on property transactions in Portugal is one of the most critical — and most misunderstood — aspects of buying new-build real estate. Whether you are purchasing a T3 apartment in Lisbon for €800,000 or a luxury villa in the Algarve at €2.5M, the VAT treatment can differ dramatically and significantly affect your total acquisition cost.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">The Core Rule: Resale vs. New Construction</h2>
            <p>
              The fundamental distinction in Portuguese property VAT is between resale properties and new construction. Resale properties (second-hand homes) are generally exempt from VAT and instead subject to IMT (Imposto Municipal sobre Transmissões Onerosas de Imóveis) and Imposto de Selo. New construction properties sold by the developer, however, are typically subject to VAT at 23% — Portugal&apos;s standard rate — included in the purchase price.
            </p>
            <p>
              This means that when a developer lists a new apartment at €500,000, that price already incorporates 23% VAT on the construction component. Buyers do not pay IMT on the VAT-included portion, but there is overlap and complexity in how the land value is treated separately from the construction value.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Reduced VAT Rate: 6% for Affordable Housing</h2>
            <p>
              Portugal introduced a reduced VAT rate of 6% for new residential construction under specific affordability thresholds. As of 2026, this applies to new properties where the total value does not exceed €320,000 and the habitable area does not exceed 200m². For buyers in secondary cities or peripheral urban areas, this can represent a significant saving compared to the standard 23% rate.
            </p>
            <p>
              In practice, most new-build properties in Lisbon, Cascais, Porto, or the Algarve exceed these thresholds and therefore attract the full 23% standard rate. However, some developments in Porto&apos;s eastern parishes, certain Algarve inland locations, or smaller cities like Braga and Setúbal may qualify.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">VAT on Urban Rehabilitation Projects</h2>
            <p>
              One of the most significant VAT opportunities in Portuguese real estate is the 6% reduced rate applicable to rehabilitation works on old buildings (prédios urbanos em estado de degradação) or buildings over 30 years old. If you are purchasing a property with rehabilitation included in a developer&apos;s contract, or contracting renovation works yourself, qualifying rehabilitation works attract 6% VAT instead of 23%.
            </p>
            <p>
              This is particularly relevant in historic Lisbon neighbourhoods (Mouraria, Alfama, Mouraria, Intendente) and Porto&apos;s Bonfim or Campanhã districts, where property acquisition prices remain lower and rehabilitation grants from municipalities can further reduce effective costs.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">VAT Exemption: When It Applies</h2>
            <p>
              Full VAT exemption (isento de IVA) applies in the following scenarios for residential property:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Purchase of a resale/second-hand residential property between private individuals</li>
              <li>Purchase of a property that has been occupied or previously sold as a dwelling</li>
              <li>Certain transfers within corporate structures that meet specific conditions</li>
              <li>Properties acquired through public tender or judicial sale where specific conditions apply</li>
            </ul>
            <p>
              When VAT is exempt, the buyer instead pays IMT (0–8% on purchase price) and Imposto de Selo (0.8%). For high-value transactions, this can actually be more favourable than the VAT treatment of new-builds.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Tax Comparison Table: New Build vs. Resale</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Scenario</th>
                    <th className="text-right p-3">VAT</th>
                    <th className="text-right p-3">IMT</th>
                    <th className="text-right p-3">Stamp Duty</th>
                    <th className="text-right p-3">Total Tax Load</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">New build €500K (standard)</td>
                    <td className="p-3 text-right">23% (included)</td>
                    <td className="p-3 text-right">0%</td>
                    <td className="p-3 text-right">0.8%</td>
                    <td className="p-3 text-right text-orange-600">~€4,000</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">New build €500K (reduced)</td>
                    <td className="p-3 text-right">6% (included)</td>
                    <td className="p-3 text-right">0%</td>
                    <td className="p-3 text-right">0.8%</td>
                    <td className="p-3 text-right text-green-600">~€4,000</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Resale €500K</td>
                    <td className="p-3 text-right">Exempt</td>
                    <td className="p-3 text-right">6–8%</td>
                    <td className="p-3 text-right">0.8%</td>
                    <td className="p-3 text-right text-orange-600">€33,000–€44,000</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Rehabilitation works</td>
                    <td className="p-3 text-right">6%</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right text-green-600">Significant saving</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Strategic Tax Planning for Buyers</h2>
            <p>
              For buyers purchasing new-build properties above €320,000 — the vast majority of transactions in Lisbon, Cascais, Porto and the Algarve — the standard 23% VAT is embedded in the developer&apos;s price. This is non-negotiable in most cases, but informed buyers can structure offers to account for this and negotiate the base land value component separately.
            </p>
            <p>
              Corporate buyers (SPV structures) may have additional flexibility to recover input VAT if the property is designated for commercial rental (turismo de habitação, hostels, serviced apartments). This is a complex area requiring specialist Portuguese tax advice. Agency Group works with a network of certified accountants (ROCs) and tax lawyers experienced in cross-border property transactions.
            </p>
            <p>
              For personalised tax calculations on a specific property, use our{' '}
              <Link href="/api/nhr" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                NHR/IFICI calculator
              </Link>{' '}
              or browse properties at{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /imoveis
              </Link>.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Key Takeaways</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Resale residential properties are VAT-exempt; IMT and Stamp Duty apply instead</li>
              <li>New-build properties include 23% VAT in the developer&apos;s listed price</li>
              <li>Affordable new builds under €320,000 / 200m² qualify for reduced 6% rate</li>
              <li>Rehabilitation works on old buildings qualify for 6% VAT</li>
              <li>Corporate structures may recover input VAT on commercial rental properties</li>
              <li>Always obtain a full tax breakdown from your notary and ROC before committing</li>
            </ul>
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
