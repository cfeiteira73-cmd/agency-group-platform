import type { Metadata } from 'next'
import RelatorioClient from './RelatorioClient'

export const metadata: Metadata = {
  title: 'Relatório Mercado Imobiliário Portugal 2026 — Agency Group',
  description: 'O relatório mais completo do mercado imobiliário de luxo em Portugal. Lisboa, Cascais, Algarve, Porto, Madeira, Comporta — dados, preços e tendências 2026.',
  openGraph: {
    title: 'Relatório Mercado Imobiliário Portugal 2026 — Agency Group',
    description: 'O relatório mais completo do mercado imobiliário de luxo em Portugal. Dados, preços e tendências 2026.',
    type: 'website',
    url: 'https://www.agencygroup.pt/relatorio-2026',
    siteName: 'Agency Group',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Relat%C3%B3rio+2026&subtitle=Mercado+Imobili%C3%A1rio+de+Luxo+Portugal+%E2%80%94+Lisboa+%C2%B7+Algarve+%C2%B7+Porto+%C2%B7+Madeira',
      width: 1200,
      height: 630,
      alt: 'Relatório Mercado Imobiliário Portugal 2026 — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Relatório Mercado Imobiliário Portugal 2026',
    description: 'Dados exclusivos: preços por zona, yields, perfil de comprador e forecast 2027.',
    images: ['https://www.agencygroup.pt/api/og?title=Relat%C3%B3rio+2026&subtitle=Mercado+Imobili%C3%A1rio+de+Luxo+Portugal+%E2%80%94+Lisboa+%C2%B7+Algarve+%C2%B7+Porto+%C2%B7+Madeira'],
  },
  alternates: {
    canonical: 'https://www.agencygroup.pt/relatorio-2026',
  },
}

export default function Relatorio2026Page() {
  return <RelatorioClient />
}
