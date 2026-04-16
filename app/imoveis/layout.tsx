import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Imóveis de Luxo em Portugal | Agency Group',
  description: 'Catálogo de imóveis de luxo em Portugal 2026: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. Filtros avançados, mapa, comparação. Preços €500K–€10M. AMI 22506.',
  keywords: ['imóveis luxo portugal 2026', 'apartamentos luxo lisboa', 'moradias cascais comprar', 'propriedades algarve 2026', 'investimento imobiliário portugal', 'comprar casa portugal', 'imoveis cascais', 'imoveis lisboa luxo'],
  alternates: {
    canonical: 'https://www.agencygroup.pt/imoveis',
    languages: {
      'pt': 'https://www.agencygroup.pt/imoveis',
      'en': 'https://www.agencygroup.pt/en/imoveis',
      'x-default': 'https://www.agencygroup.pt/imoveis',
    },
  },
  openGraph: {
    title: 'Imóveis de Luxo em Portugal 2026 | Agency Group · AMI 22506',
    description: 'Catálogo de imóveis de luxo em Portugal: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. Preços €500K–€10M. AMI 22506.',
    url: 'https://www.agencygroup.pt/imoveis',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    alternateLocale: ['en_US'],
    type: 'website',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Im%C3%B3veis+de+Luxo+Portugal+2026&subtitle=Lisboa+%C2%B7+Cascais+%C2%B7+Comporta+%C2%B7+Algarve',
      width: 1200,
      height: 630,
      alt: 'Imóveis de Luxo Agency Group Portugal 2026',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Imóveis de Luxo em Portugal 2026 | Agency Group',
    description: 'Catálogo premium: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. €500K–€10M. AMI 22506.',
    site: '@agencygroup_pt',
  },
}

export default function ImoveisLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
