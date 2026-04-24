import type { Metadata } from 'next'
import VenderClient from './VenderClient'

export const metadata: Metadata = {
  title: 'Vender Imóvel em Portugal — Avaliação Gratuita | Agency Group',
  description: 'Venda o seu imóvel ao preço justo com a Agency Group. Avaliação gratuita, compradores qualificados de 40+ países, processo discreto do início à escritura. AMI 22506.',
  alternates: { canonical: 'https://www.agencygroup.pt/vender' },
  openGraph: {
    title: 'Vender Imóvel em Portugal | Agency Group',
    description: 'Compradores qualificados. €285M+ em vendas. Discrição total. Avaliação gratuita em 24h.',
    url: 'https://www.agencygroup.pt/vender',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    type: 'website',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Vender+Im%C3%B3vel+em+Portugal&subtitle=Avalia%C3%A7%C3%A3o+Gratuita+%C2%B7+Compradores+Qualificados+40%2B+Pa%C3%ADses',
      width: 1200, height: 630,
      alt: 'Vender Imóvel em Portugal — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vender Imóvel em Portugal | Agency Group',
    description: 'Compradores qualificados. €285M+ em vendas. Discrição total. Avaliação gratuita em 24h.',
    images: ['https://www.agencygroup.pt/api/og?title=Vender+Im%C3%B3vel+em+Portugal&subtitle=Avalia%C3%A7%C3%A3o+Gratuita+%C2%B7+Compradores+Qualificados+40%2B+Pa%C3%ADses'],
  },
}

export default function VenderPage() {
  return <VenderClient />
}
