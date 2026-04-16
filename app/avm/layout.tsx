import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AVM — Avaliação Automática de Imóvel | Agency Group',
  description: 'Avaliação automática do seu imóvel em Portugal com IA. Dados reais de mercado, margem ±4.2%. Gratuito e imediato.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/avm',
  },
  openGraph: {
    title: 'AVM — Avaliação Automática de Imóvel | Agency Group',
    description: 'Avaliação automática do seu imóvel em Portugal com IA. Dados reais de mercado, margem ±4.2%. Gratuito e imediato.',
    url: 'https://www.agencygroup.pt/avm',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    type: 'website',
  },
}

export default function AVMLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
