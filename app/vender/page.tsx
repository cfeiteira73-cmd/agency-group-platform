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
  },
}

export default function VenderPage() {
  return <VenderClient />
}
