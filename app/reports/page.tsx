import type { Metadata } from 'next'
import ReportsClient from './ReportsClient'

export const metadata: Metadata = {
  title: 'Relatórios de Mercado Imobiliário Portugal 2026 — Agency Group',
  description: 'Descarregue relatórios exclusivos do mercado imobiliário de luxo em Portugal: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. Dados 2026.',
  alternates: { canonical: 'https://www.agencygroup.pt/reports' },
  openGraph: {
    title: 'Relatórios de Mercado Imobiliário Portugal 2026 — Agency Group',
    description: 'Descarregue relatórios exclusivos do mercado imobiliário de luxo em Portugal. Dados 2026.',
    type: 'website',
    url: 'https://www.agencygroup.pt/reports',
    siteName: 'Agency Group',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Relat%C3%B3rios+de+Mercado+2026&subtitle=Portugal+%C2%B7+Lisboa+%C2%B7+Cascais+%C2%B7+Algarve+%C2%B7+Madeira',
      width: 1200,
      height: 630,
      alt: 'Relatórios de Mercado Imobiliário Portugal 2026 — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Relatórios de Mercado Imobiliário Portugal 2026',
    description: 'Relatórios exclusivos: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. Dados 2026.',
    images: ['https://www.agencygroup.pt/api/og?title=Relat%C3%B3rios+de+Mercado+2026&subtitle=Portugal+%C2%B7+Lisboa+%C2%B7+Cascais+%C2%B7+Algarve+%C2%B7+Madeira'],
  },
}

const ZONE_REPORTS = [
  { zona: 'Lisboa',    pages: 24, updated: 'Março 2026',    price_range: '€890K–€6.5M',  key_stat: '+14% YoY', color: '#1c3a5e', emoji: '🏛️', highlights: ['Top 5 Luxury Mundial (Savills 2026)', '€5.000/m² média', '4.2% yield bruto', 'Procura: EUA 16%, FR 13%, UK 9%'] },
  { zona: 'Cascais',   pages: 18, updated: 'Março 2026',    price_range: '€1.35M–€3.8M', key_stat: '+12% YoY', color: '#0e2a3a', emoji: '🏖️', highlights: ['Riviera Portuguesa', '€4.713/m² média', 'TASIS + CAISL escolas', 'Resorts golf exclusivos'] },
  { zona: 'Comporta',  pages: 16, updated: 'Fevereiro 2026',price_range: '€2.8M–€6.5M',  key_stat: '+22% YoY', color: '#2a1e0a', emoji: '🌾', highlights: ['O Hamptons Português', '€6.500/m² prime', '5.8% yield turismo', 'Natureza protegida por lei'] },
  { zona: 'Porto',     pages: 20, updated: 'Março 2026',    price_range: '€520K–€1.25M', key_stat: '+12% YoY', color: '#2a1505', emoji: '🍷', highlights: ['Melhor yield de Portugal', '€3.643/m² média', 'Foz Douro premium', 'Aeroporto directo NYC/GRU'] },
  { zona: 'Algarve',   pages: 22, updated: 'Março 2026',    price_range: '€1.1M–€4.2M',  key_stat: '+11% YoY', color: '#2a1a05', emoji: '☀️', highlights: ['300 dias de sol/ano', '4.8% yield médio', 'Vale do Lobo + Quinta do Lago', 'Nobel International School'] },
  { zona: 'Madeira',   pages: 14, updated: 'Fevereiro 2026',price_range: '€980K–€1.45M', key_stat: '+18% YoY', color: '#0a2a1e', emoji: '🌺', highlights: ['IFICI elegível', '€3.760/m² média', 'Nova construção 2024-2026', 'Único aeroporto Europa'] },
  { zona: 'Sintra',    pages: 16, updated: 'Janeiro 2026',  price_range: '€1.2M–€2.8M',  key_stat: '+9% YoY',  color: '#1e2a0a', emoji: '🏰', highlights: ['UNESCO World Heritage', '€3.200/m² média', 'Quintas históricas séc. XIX', 'A5: Lisboa 30 min'] },
  { zona: 'Ericeira',  pages: 12, updated: 'Fevereiro 2026',price_range: '€650K–€1.1M',  key_stat: '+15% YoY', color: '#0a1e2a', emoji: '🏄', highlights: ['World Surf Reserve', 'Yield turístico 6%', 'Comunidade criativa emergente', 'A21: Lisboa 40 min'] },
]

const THEMATIC_REPORTS = [
  { title: 'Guia NHR / IFICI 2026',         subtitle: 'Regime Fiscal para Residentes Não Habituais',        pages: 28, icon: '📋', tag: 'Fiscal',       desc: 'Tudo sobre o regime de residentes não habituais e o novo IFICI. Comparação de 12 países, casos práticos e simulações.' },
  { title: 'Guia do Comprador Estrangeiro',  subtitle: 'Comprar Imóvel em Portugal: Passo a Passo',          pages: 32, icon: '🌍', tag: 'Jurídico',     desc: 'Do NIF à Escritura. CPCV, IMT, IS, custos, advogados, bancos. Tudo o que precisa de saber para comprar em Portugal.' },
  { title: 'Outlook Investimento 2026-2030', subtitle: 'Perspectivas e Oportunidades no Mercado Português',  pages: 36, icon: '📈', tag: 'Investimento',  desc: 'Análise macroeconómica, yields projectados, zonas emergentes, factores de risco e estratégias de portfolio para os próximos 5 anos.' },
  { title: 'Luxury Market Portugal 2026',    subtitle: 'O Segmento Premium €1M+ em Análise Profunda',        pages: 44, icon: '💎', tag: 'Luxo',          desc: 'Perfil do comprador de luxo, tendências arquitectónicas, zonas ultra-prime, e porque Lisboa entrou no Top 5 Mundial de Savills.' },
]

export default function ReportsPage() {
  return <ReportsClient zoneReports={ZONE_REPORTS} thematicReports={THEMATIC_REPORTS} />
}
