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
  },
}

export default function InvestirPage() {
  return <InvestirClient />
}
