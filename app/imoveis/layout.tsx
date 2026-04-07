import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Imóveis de Luxo em Portugal | Agency Group',
  description: 'Descubra imóveis de luxo em Lisboa, Cascais, Algarve, Porto e Madeira. Apartamentos, moradias e propriedades premium de €500K a €10M+. Agency Group AMI 22506.',
  keywords: ['imóveis luxo portugal', 'apartamentos lisboa', 'moradias cascais', 'propriedades algarve', 'investimento imobiliário portugal'],
  alternates: {
    canonical: 'https://www.agencygroup.pt/imoveis',
    languages: {
      'pt': 'https://www.agencygroup.pt/imoveis',
      'en': 'https://www.agencygroup.pt/en/properties',
      'fr': 'https://www.agencygroup.pt/fr/proprietes',
      'de': 'https://www.agencygroup.pt/de/immobilien',
      'zh-Hans': 'https://www.agencygroup.pt/zh/fangchan',
      'ar': 'https://www.agencygroup.pt/ar/aqarat',
      'x-default': 'https://www.agencygroup.pt/imoveis',
    },
  },
  openGraph: {
    title: 'Imóveis de Luxo em Portugal | Agency Group',
    description: 'Descubra imóveis de luxo em Lisboa, Cascais, Algarve, Porto e Madeira. Agency Group AMI 22506.',
    url: 'https://www.agencygroup.pt/imoveis',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    type: 'website',
    images: [{
      url: 'https://www.agencygroup.pt/og-imoveis.jpg',
      width: 1200,
      height: 630,
      alt: 'Imóveis de Luxo Agency Group Portugal',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Imóveis de Luxo em Portugal | Agency Group',
    description: 'Descubra imóveis de luxo em Lisboa, Cascais, Algarve, Porto e Madeira.',
  },
}

export default function ImoveisLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
