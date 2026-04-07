import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Imóveis nos Açores: Guia Investidor 2026',
  description: 'Guia completo de investimento imobiliário nos Açores 2026. São Miguel, Pico, Faial, €1.952/m², crescimento 15% YoY, turismo de natureza. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/acores-imoveis-investimento',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/acores-imoveis-investimento',
      'pt': 'https://www.agencygroup.pt/blog/acores-imoveis-investimento',
    },
  },
  openGraph: {
    title: 'Imóveis nos Açores: Guia Investidor 2026',
    description: 'São Miguel, Pico, Faial. €1.952/m², crescimento 15% YoY, turismo de natureza.',
    url: 'https://www.agencygroup.pt/blog/acores-imoveis-investimento',
    type: 'article',
    locale: 'pt_PT',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630 }],
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Imóveis nos Açores: Guia Investidor 2026',
  description: 'Guia completo de investimento imobiliário nos Açores 2026. São Miguel, Pico, Faial, €1.952/m², crescimento 15% YoY.',
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
  mainEntityOfPage: 'https://www.agencygroup.pt/blog/acores-imoveis-investimento',
  inLanguage: 'pt-PT',
}

export default function BlogPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <main className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Caminho de navegação">
          <ol className="flex text-sm text-gray-500 gap-2 mb-8">
            <li><Link href="/">Home</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href="/blog">Blog</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">Imóveis Açores</li>
          </ol>
        </nav>

        <article lang="pt">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#1c4a35] leading-tight mb-4">
              Imóveis nos Açores: Guia do Investidor 2026
            </h1>
            <p className="text-gray-500 text-sm">
              <time dateTime="2026-04-07">7 de Abril de 2026</time> · Agency Group · AMI 22506
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Os Açores são o segredo mais bem guardado do imobiliário português. Com um preço médio de €1.952/m² — o mais baixo de todas as regiões portuguesas — e um crescimento de 15% em 2025, o arquipélago atlântico oferece uma janela de oportunidade que poucos investidores nacionais e internacionais aproveitaram ainda. Este guia apresenta as melhores ilhas, zonas e estratégias para o investidor informado em 2026.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Porque os Açores São Diferentes</h2>
            <p>
              Os Açores são um mercado fundamentalmente diferente de qualquer outro destino português. Trata-se de um arquipélago de 9 ilhas, espalhado por mais de 600 km no Atlântico Norte, com uma população total de apenas 240.000 habitantes. O turismo é o motor económico dominante — e é precisamente o crescimento exponencial do turismo sustentável e de natureza que está a impulsionar o mercado imobiliário.
            </p>
            <p>
              Ao contrário de Lisboa ou do Algarve, onde o mercado está amplamente maturado e os preços reflectem já um elevado prémio internacional, os Açores estão num estágio inicial da curva de valorização. Os investidores que identificaram este padrão em mercados como Madeira (2018–2020) ou Comporta (2016–2019) sabem o que significa — e as oportunidades existem ainda nos Açores com horizonte de 3 a 7 anos.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">As Ilhas de Maior Interesse para Investidores</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">São Miguel — O Mercado Principal</h3>
            <p>
              São Miguel, a maior ilha do arquipélago e sede da capital Ponta Delgada, é o mercado mais líquido e o ponto de entrada natural para a maioria dos investidores. Ponta Delgada tem uma oferta crescente de apartamentos renovados no centro histórico, moradias nas encostas da Lagoa das Sete Cidades, e alguns projectos de turismo rural de excelência na costa sul. Os preços variam entre €1.400 e €2.800/m², com as melhores localizações na marginal de Ponta Delgada a atingir €3.500/m².
            </p>
            <p>
              A procura de arrendamento de curta duração em São Miguel tem crescido 40% ao ano desde 2022, impulsionada pela explosão do turismo de natureza e pelo crescente tráfego de visitas das comunidades açorianas nos EUA e Canadá. As taxas de ocupação de AL em São Miguel situam-se entre os 70% e 85% nos meses de verão, com rendimentos brutos de 8–14% nas melhores propriedades.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Pico — Vinho, Vulcão e Valor</h3>
            <p>
              A ilha do Pico, com o pico vulcânico mais alto de Portugal (2.351 m), é a segunda ilha de maior interesse para investidores. A sua vitivinicultura única — as vinhas crescem em currais de lava a metros do mar — está classificada como Património Mundial da UNESCO, conferindo um prestígio cultural raro. O Aeroporto do Pico tem ligações regulares a Lisboa, e a proximidade à ilha do Faial (20 minutos de barco) torna a combinação das duas ilhas particularmente atractiva.
            </p>
            <p>
              Os preços no Pico são os mais baixos entre as ilhas mais procuradas — €900 a €1.800/m² — com casas de pedra restauradas disponíveis por €150.000 a €350.000 e quintas com terreno por €200.000 a €600.000. Para investidores com horizonte de 5 a 10 anos, o Pico representa provavelmente a melhor relação risco/retorno do mercado português.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Faial — A Ilha do Triângulo</h3>
            <p>
              O Faial, com a sua capital Horta e a famosa marina que é escala obrigatória das travessias transatlânticas, tem um mercado imobiliário mais dinâmico que o Pico. A marina de Horta atrai uma comunidade náutica internacional que procura base fixa ou alojamento temporário de qualidade. Preços entre €1.200 e €2.200/m², com apartamentos renovados em Horta disponíveis por €180.000 a €420.000.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Tabela de Preços e Potencial por Ilha</h2>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1c4a35] text-white">
                    <th className="text-left p-3">Ilha</th>
                    <th className="text-right p-3">Preço/m²</th>
                    <th className="text-right p-3">Casa T3</th>
                    <th className="text-right p-3">Rendimento AL</th>
                    <th className="text-right p-3">YoY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">São Miguel (Ponta Delgada)</td>
                    <td className="p-3 text-right">€1.400–€2.800</td>
                    <td className="p-3 text-right">€168K–€336K</td>
                    <td className="p-3 text-right">8–14%</td>
                    <td className="p-3 text-right text-green-700">+18%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Terceira (Angra do Heroísmo)</td>
                    <td className="p-3 text-right">€1.200–€2.200</td>
                    <td className="p-3 text-right">€144K–€264K</td>
                    <td className="p-3 text-right">7–12%</td>
                    <td className="p-3 text-right text-green-700">+15%</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-medium">Faial (Horta)</td>
                    <td className="p-3 text-right">€1.200–€2.200</td>
                    <td className="p-3 text-right">€144K–€264K</td>
                    <td className="p-3 text-right">7–11%</td>
                    <td className="p-3 text-right text-green-700">+12%</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-3 font-medium">Pico</td>
                    <td className="p-3 text-right">€900–€1.800</td>
                    <td className="p-3 text-right">€108K–€216K</td>
                    <td className="p-3 text-right">6–10%</td>
                    <td className="p-3 text-right text-green-700">+10%</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium">Flores / Corvo</td>
                    <td className="p-3 text-right">€500–€1.200</td>
                    <td className="p-3 text-right">€60K–€144K</td>
                    <td className="p-3 text-right">5–9%</td>
                    <td className="p-3 text-right text-green-700">+8%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Turismo de Natureza como Motor Estrutural</h2>
            <p>
              O turismo de natureza e de aventura é o grande impulsionador do mercado imobiliário açoriano. O arquipélago recebeu mais de 950.000 turistas em 2025 — um crescimento de 52% face a 2019 — e as projecções apontam para 1,3 milhões em 2028. A proposta de valor única dos Açores — whale watching, mergulho com manta-raias, caminhadas na caldeira do Faial, surf no Pico, termas naturais nas Furnas — não tem equivalente no mercado europeu.
            </p>
            <p>
              Esta afluência turística crescente, combinada com uma oferta de alojamento de qualidade ainda muito insuficiente (menos de 15.000 camas de turismo certificadas para 9 ilhas), cria um desequilíbrio estrutural que sustenta os rendimentos de AL e pressiona os preços de imóveis em alta.
            </p>

            <h2 className="text-2xl font-bold text-[#1c4a35] mt-10 mb-4">Financiamento e Processo de Compra</h2>
            <p>
              O processo de compra nos Açores é idêntico ao do continente — NIF, CPCV com sinal de 20–30%, escritura pública. As principais diferenças operacionais prendem-se com a menor disponibilidade de serviços especializados nas ilhas menores, tempos de resposta mais longos de entidades públicas (Conservatória do Registo Predial, Finanças), e logística de visitas e inspecções que requer planeamento cuidadoso.
            </p>
            <p>
              Os bancos portugueses concedem financiamento para imóveis nos Açores até 80% do valor de avaliação, mas as margens de risco aplicadas são ligeiramente superiores às do continente, reflectindo a menor liquidez do mercado insular. A Caixa Geral de Depósitos tem a maior presença bancária no arquipélago e é frequentemente a instituição preferida para financiamento local.
            </p>

            <p className="mt-8">
              Explore os nossos imóveis nos Açores em{' '}
              <Link href="/imoveis" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /imoveis
              </Link>
              {' '}ou descubra as zonas insulares em{' '}
              <Link href="/zonas" className="text-[#1c4a35] font-semibold underline hover:text-[#c9a96e] transition-colors">
                /zonas
              </Link>.
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-[#1c4a35] text-white rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2">Agency Group · AMI 22506</h2>
              <p className="text-green-100 mb-4">
                Especialistas em imobiliário de luxo em Portugal. Lisboa, Cascais, Porto, Algarve, Madeira, Açores.
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
