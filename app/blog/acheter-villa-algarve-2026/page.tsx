import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Acheter une Villa en Algarve 2026',
  description: 'Guide complet pour les acheteurs français en Algarve 2026. Vila do Bispo, Aljezur, Lagos, rendements locatifs, fiscalité NHR/IFICI. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/acheter-villa-algarve-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/acheter-villa-algarve-2026',
      'fr': 'https://www.agencygroup.pt/blog/acheter-villa-algarve-2026',
    },
  },
  openGraph: {
    title: 'Acheter une Villa en Algarve 2026',
    description: 'Guide complet pour les acheteurs français en Algarve. Vila do Bispo, Aljezur, Lagos, rendements, fiscalité.',
    url: 'https://www.agencygroup.pt/blog/acheter-villa-algarve-2026',
    type: 'article',
    locale: 'fr_FR',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Acheter une Villa en Algarve 2026',
  description: 'Guide complet pour les acheteurs français en Algarve 2026. Vila do Bispo, Aljezur, Lagos, rendements locatifs, fiscalité NHR/IFICI.',
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
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/acheter-villa-algarve-2026',
  inLanguage: 'fr',
}

export default function BlogPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <main className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Fil d'Ariane">
          <ol className="flex text-sm text-gray-500 gap-2 mb-8">
            <li><Link href="/">Home</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href="/blog">Blog</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">Acheter Villa Algarve</li>
          </ol>
        </nav>

        <article lang="fr">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              Acheter une Villa en Algarve 2026 : Guide pour Acheteurs Français
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 avril 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              L&apos;Algarve est la destination de villégiature la plus prisée du Portugal — et l&apos;une des plus recherchées d&apos;Europe. Les acheteurs français représentent 13% des acquéreurs étrangers au Portugal, avec une concentration particulièrement forte en Algarve. Ce guide vous présente le marché 2026, les meilleures zones, les rendements locatifs et les aspects fiscaux essentiels.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Le Marché de l&apos;Algarve en 2026</h2>
            <p>
              L&apos;Algarve affiche un prix moyen de €3.941/m² en 2026, en hausse de 15% sur un an. Mais ce chiffre masque de grandes disparités entre les zones : le Triangle d&apos;Or (Vilamoura, Vale do Lobo, Quinta do Lago) affiche des prix de €6.000 à €12.000/m², tandis que les zones rurales de Monchique ou de l&apos;Alentejo côtier restent accessibles à €1.500–€2.500/m².
            </p>
            <p>
              Le marché est structurellement déséquilibré : une offre limitée (stock de villas de standing en recul de 22% depuis 2022) face à une demande internationale soutenue. Cette dynamique continue de soutenir les prix, même dans un contexte de taux d&apos;intérêt plus élevés qu&apos;en 2021–2022.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Les Zones Phares pour les Acheteurs Français</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Lagos — La Côte Dorée de l&apos;Algarve</h3>
            <p>
              Lagos est la ville qui séduit le plus les acheteurs français en Algarve. Son centre historique, ses plages spectaculaires (Praia da Luz, Meia Praia), sa marina animée et son atmosphère cosmopolite en font un choix évident. Les prix des villas à Lagos vont de €650.000 pour une maison de 3 chambres en périphérie à €3,5M pour une villa de prestige avec vue mer. Les rendements locatifs en saison haute (mai–octobre) atteignent 8–12% brut.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Vila do Bispo — Nature et Authenticité</h3>
            <p>
              Vila do Bispo, dans l&apos;extrémité sud-ouest du Portugal (Costa Vicentina), attire un profil d&apos;acheteur français différent : amoureux de nature, de surf et de tranquillité. Les prix y sont encore 40–50% inférieurs à Lagos ou Sagres, avec des villas de 4 chambres disponibles entre €450.000 et €900.000. La zone bénéficie d&apos;une protection naturelle (Parc Naturel du Sud-Ouest Alentéjan) qui garantit l&apos;absence de sur-développement.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Aljezur — La Destination Montante</h3>
            <p>
              Aljezur est la révélation des dernières années. Ce village authentique de 6.000 habitants, à l&apos;écart des circuits touristiques de masse, a vu ses prix progresser de 28% en 2025. Des fermes restaurées (quintas), des villas contemporaines et des propriétés avec terres y sont encore disponibles à des prix de €350.000 à €1,2M — représentant une fenêtre d&apos;opportunité que beaucoup de nos clients français ont saisie.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Tableau Comparatif des Zones</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Zone</th>
                    <th className="text-right p-3">Prix/m²</th>
                    <th className="text-right p-3">Villa T4</th>
                    <th className="text-right p-3">Rendement</th>
                    <th className="text-right p-3">YoY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Triangle d&apos;Or</td>
                    <td className="p-3 text-right">€6.000–€12.000</td>
                    <td className="p-3 text-right">€1,5M–€5M</td>
                    <td className="p-3 text-right">4–6%</td>
                    <td className="p-3 text-right text-green-700">+12%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Lagos</td>
                    <td className="p-3 text-right">€3.500–€6.000</td>
                    <td className="p-3 text-right">€650K–€3,5M</td>
                    <td className="p-3 text-right">6–12%</td>
                    <td className="p-3 text-right text-green-700">+17%</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Vila do Bispo</td>
                    <td className="p-3 text-right">€2.200–€4.000</td>
                    <td className="p-3 text-right">€450K–€900K</td>
                    <td className="p-3 text-right">7–11%</td>
                    <td className="p-3 text-right text-green-700">+22%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Aljezur</td>
                    <td className="p-3 text-right">€1.800–€3.500</td>
                    <td className="p-3 text-right">€350K–€1,2M</td>
                    <td className="p-3 text-right">8–13%</td>
                    <td className="p-3 text-right text-green-700">+28%</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Tavira / Est</td>
                    <td className="p-3 text-right">€2.500–€4.500</td>
                    <td className="p-3 text-right">€400K–€1,5M</td>
                    <td className="p-3 text-right">5–9%</td>
                    <td className="p-3 text-right text-green-700">+14%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Fiscalité pour les Résidents Français</h2>
            <p>
              La convention fiscale franco-portugaise évite la double imposition. Pour les acheteurs français qui souhaitent s&apos;installer au Portugal, le régime IFICI (anciennement RNH) offre des avantages significatifs :
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Taux forfaitaire de 20% sur les revenus de source portugaise (emploi, activité indépendante)</li>
              <li>Exonération potentielle sur certains revenus de source étrangère (dividendes, plus-values, retraites selon conditions)</li>
              <li>Durée du régime : 10 ans non renouvelable</li>
              <li>Condition : ne pas avoir été résident fiscal portugais au cours des 5 dernières années</li>
            </ul>
            <p>
              Pour les acheteurs qui conservent leur résidence fiscale en France (résidence secondaire uniquement), les revenus locatifs portugais sont imposés au Portugal à 25% du revenu net, avec crédit d&apos;impôt en France pour éviter la double imposition.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Le Processus d&apos;Achat en Pratique</h2>
            <p>
              Agency Group accompagne les acheteurs français de la recherche à la remise des clés. Notre équipe francophone gère l&apos;intégralité du processus : identification des biens hors marché, négociation, coordination avec le notaire, gestion des formalités administratives (NIF, compte bancaire portugais) et mise en relation avec des avocats, notaires et experts-comptables bilingues.
            </p>
            <p>
              Découvrez notre sélection de villas en Algarve sur{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                notre portail immobilier
              </Link>
              {' '}ou consultez nos guides de zones sur{' '}
              <Link href="/zonas" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /zonas
              </Link>.
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-[#1c4a35] text-white rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2">Agency Group · AMI 22506</h2>
              <p className="text-green-100 mb-4">
                Spécialistes de l&apos;immobilier de luxe au Portugal. Lisbonne, Cascais, Porto, Algarve, Madère.
              </p>
              <Link
                href="/imoveis"
                className="inline-block bg-[#c9a96e] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#a8843a] transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                Voir les Propriétés Disponibles →
              </Link>
            </div>
          </footer>
        </article>
      </main>
    </>
  )
}
