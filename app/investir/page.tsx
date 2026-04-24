import type { Metadata } from 'next'
import InvestirClient from './InvestirClient'

export const metadata: Metadata = {
  title: 'Investir em Imóveis em Portugal 2026 — Yields 4–6% | Agency Group',
  description: 'Investimento imobiliário em Portugal: yields 4–6%, NHR/IFICI, Lisboa Top 5 Mundial. Estratégias buy-to-rent, turismo premium e value-add. Consulta gratuita. AMI 22506.',
  alternates: { canonical: 'https://www.agencygroup.pt/investir' },
  openGraph: {
    title: 'Investir em Imóveis em Portugal 2026 | Agency Group',
    description: 'Yields 4–6%. +17.6% valorização. NHR até 10 anos. O melhor mercado da Europa para investir.',
    url: 'https://www.agencygroup.pt/investir',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    type: 'website',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Investir+em+Portugal+2026&subtitle=Yields+4%E2%80%936%25+%C2%B7+NHR%2FIFICI+%C2%B7+Lisboa+Top+5+Mundial',
      width: 1200, height: 630,
      alt: 'Investir em Imóveis em Portugal 2026 — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Investir em Imóveis em Portugal 2026 | Agency Group',
    description: 'Yields 4–6%. +17.6% valorização. NHR até 10 anos. O melhor mercado da Europa.',
    images: ['https://www.agencygroup.pt/api/og?title=Investir+em+Portugal+2026&subtitle=Yields+4%E2%80%936%25+%C2%B7+NHR%2FIFICI+%C2%B7+Lisboa+Top+5+Mundial'],
  },
}

export default function InvestirPage() {
  return <InvestirClient />
}
