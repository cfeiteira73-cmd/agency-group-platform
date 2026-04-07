import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comprare Casa in Portogallo 2026',
  description: 'Guida completa per acquistare casa in Portogallo nel 2026. NHR/IFICI, processo di acquisto, costi, zone migliori per acquirenti italiani. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/comprare-casa-portogallo-guida',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/comprare-casa-portogallo-guida',
      'it': 'https://www.agencygroup.pt/blog/comprare-casa-portogallo-guida',
    },
  },
  openGraph: {
    title: 'Comprare Casa in Portogallo 2026',
    description: 'Guida completa per acquistare casa in Portogallo. NHR/IFICI, processo, costi, zone migliori.',
    url: 'https://www.agencygroup.pt/blog/comprare-casa-portogallo-guida',
    type: 'article',
    locale: 'it_IT',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Comprare Casa in Portogallo 2026',
  description: 'Guida completa per acquistare casa in Portogallo nel 2026. NHR/IFICI, processo di acquisto, costi, zone migliori per acquirenti italiani.',
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
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/comprare-casa-portogallo-guida',
  inLanguage: 'it',
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
            <li aria-current="page">Comprare Casa Portogallo</li>
          </ol>
        </nav>

        <article lang="it">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              Comprare Casa in Portogallo 2026: Guida Completa per Italiani
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 Aprile 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Il mercato immobiliare portoghese è diventato uno dei più attraenti d&apos;Europa per gli acquirenti italiani. Con prezzi ancora inferiori rispetto alle principali città italiane, un clima eccellente, una qualità della vita elevata e un regime fiscale agevolato (IFICI), il Portogallo offre opportunità difficilmente replicabili altrove nel 2026.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Perché il Portogallo Attira gli Italiani nel 2026</h2>
            <p>
              Gli acquirenti italiani rappresentano un segmento in forte crescita nel mercato immobiliare portoghese. Pur non essendo ancora tra le prime cinque nazionalità straniere, il numero di transazioni da parte di cittadini italiani è cresciuto del 34% tra il 2023 e il 2025. Le ragioni sono molteplici:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Prezzi ancora accessibili rispetto a Roma, Milano o Firenze</li>
              <li>Regime IFICI con tassazione agevolata al 20% per residenti non abituali</li>
              <li>Clima atlantico con 300 giorni di sole all&apos;anno</li>
              <li>Ottima connettività aerea verso l&apos;Italia (Milano, Roma, Bologna, Venezia)</li>
              <li>Qualità della vita, sicurezza e sanità pubblica di alto livello</li>
              <li>Possibilità di mantenere la residenza fiscale italiana o scegliere il regime portoghese</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Prezzi nelle Principali Zone nel 2026</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Zona</th>
                    <th className="text-right p-3">Prezzo/m²</th>
                    <th className="text-right p-3">T3 Tipico</th>
                    <th className="text-right p-3">YoY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Lisbona centro</td>
                    <td className="p-3 text-right">€5.000</td>
                    <td className="p-3 text-right">€600K–€1,2M</td>
                    <td className="p-3 text-right text-green-700">+18%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Cascais</td>
                    <td className="p-3 text-right">€4.713</td>
                    <td className="p-3 text-right">€550K–€1,1M</td>
                    <td className="p-3 text-right text-green-700">+22%</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Algarve</td>
                    <td className="p-3 text-right">€3.941</td>
                    <td className="p-3 text-right">€450K–€900K</td>
                    <td className="p-3 text-right text-green-700">+15%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Porto</td>
                    <td className="p-3 text-right">€3.643</td>
                    <td className="p-3 text-right">€380K–€700K</td>
                    <td className="p-3 text-right text-green-700">+12%</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Madeira</td>
                    <td className="p-3 text-right">€3.760</td>
                    <td className="p-3 text-right">€400K–€800K</td>
                    <td className="p-3 text-right text-green-700">+31%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Il Regime IFICI: Vantaggio Fiscale per i Nuovi Residenti</h2>
            <p>
              Il regime IFICI (Incentivo Fiscal à Investigação Científica e Inovação) ha sostituito il precedente NHR nel 2024 e rappresenta ancora un vantaggio fiscale significativo per chi stabilisce la residenza fiscale in Portogallo. I principali benefici includono:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Aliquota flat del 20% sui redditi da lavoro dipendente e autonomo di fonte portoghese</li>
              <li>Possibile esenzione su redditi di fonte estera (pensioni, dividendi, royalties) per 10 anni</li>
              <li>Nessuna doppia imposizione grazie alla convenzione Italia-Portogallo</li>
              <li>Applicazione per persone fisiche che non sono state residenti fiscali in Portogallo negli ultimi 5 anni</li>
            </ul>
            <p>
              Per i pensionati italiani con pensioni INPS o INPDAP, il regime può portare a risparmi fiscali molto significativi. Si consiglia di consultare un commercialista specializzato in fiscalità internazionale prima di procedere con il trasferimento di residenza.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Il Processo di Acquisto Passo per Passo</h2>
            <p>
              Il processo di acquisto immobiliare in Portogallo è ben regolamentato e relativamente semplice per gli acquirenti stranieri, a patto di seguire i passaggi corretti:
            </p>
            <ol className="list-decimal pl-6 space-y-3 my-4">
              <li>
                <strong>Ottenere il NIF (Numero di Identificazione Fiscale):</strong> Equivalente al codice fiscale italiano, è obbligatorio per qualsiasi transazione. Può essere ottenuto presso le Finanças locali o tramite un rappresentante fiscale anche prima di arrivare in Portogallo.
              </li>
              <li>
                <strong>Aprire un conto corrente portoghese:</strong> Non obbligatorio ma fortemente raccomandato. La maggior parte delle banche portoghesi (Millennium BCP, Caixa Geral, Santander Totta) accetta clienti stranieri.
              </li>
              <li>
                <strong>Proposta di acquisto e negoziazione:</strong> Una volta identificato l&apos;immobile, Agency Group gestisce la negoziazione del prezzo e delle condizioni.
              </li>
              <li>
                <strong>CPCV (Contrato Promessa de Compra e Venda):</strong> Equivalente al compromesso italiano. Prevede il versamento di una caparra (tipicamente 20–30%) e fissa data e condizioni dell&apos;atto definitivo.
              </li>
              <li>
                <strong>Due diligence e finanziamento:</strong> Verifica catastale, ipoteche, abusi edilizi. Le banche portoghesi concedono mutui agli stranieri fino all&apos;80% del valore di perizia.
              </li>
              <li>
                <strong>Escritura (Atto Definitivo):</strong> Stipulato davanti a notaio, conclude il trasferimento di proprietà.
              </li>
            </ol>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Costi di Transazione da Considerare</h2>
            <p>
              Come in Italia, l&apos;acquisto immobiliare in Portogallo comporta costi aggiuntivi rispetto al prezzo di vendita. Per un immobile di €500.000, i costi tipici includono:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>IMT (tassa di trasferimento): 0–8% — su €500K circa €25.000–€30.000</li>
              <li>Imposto de Selo (imposta di bollo): 0,8% — circa €4.000</li>
              <li>Notaio e registro: €1.500–€3.000</li>
              <li>Avvocato (se utilizzato): €2.000–€5.000</li>
              <li>Commissione agenzia: solitamente a carico del venditore in Portogallo</li>
            </ul>
            <p>
              Il totale dei costi aggiuntivi si aggira tipicamente tra il 6% e il 9% del prezzo di acquisto — inferiore a quanto previsto in molte regioni italiane.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Zone Preferite dagli Italiani</h2>
            <p>
              Gli acquirenti italiani mostrano preferenze abbastanza definite. Lisbona (specialmente Chiado, Príncipe Real e Estrela) attrae principalmente professionisti e imprenditori. L&apos;Algarve è la scelta preferita per la seconda casa e per chi cerca rendimenti da affitto. La Madeira sta emergendo come alternativa interessante con la sua crescita record del 31% nel 2025 e lo status di zona franca per alcune attività.
            </p>
            <p>
              Scopri le nostre proprietà disponibili in tutte le zone del Portogallo visitando{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                la nostra selezione di immobili
              </Link>
              {' '}o le nostre{' '}
              <Link href="/zonas" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                guide alle zone
              </Link>.
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-[#1c4a35] text-white rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2">Agency Group · AMI 22506</h2>
              <p className="text-green-100 mb-4">
                Specialisti in immobiliare di lusso in Portogallo. Lisbona, Cascais, Porto, Algarve, Madeira.
              </p>
              <Link
                href="/imoveis"
                className="inline-block bg-[#c9a96e] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#a8843a] transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                Vedi Immobili Disponibili →
              </Link>
            </div>
          </footer>
        </article>
      </main>
    </>
  )
}
