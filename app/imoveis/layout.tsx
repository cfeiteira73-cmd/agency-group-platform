import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Imóveis Luxo Portugal 2026 | Lisboa, Cascais, Comporta | Agency Group',
  description: 'Descubra 20 imóveis de luxo em Portugal: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira, Sintra e Ericeira. Agency Group AMI 22506 — mediação boutique €500K–€10M.',
  openGraph: {
    title: 'Imóveis de Luxo Portugal 2026 | Agency Group',
    description: 'Portfolio exclusivo de imóveis em Lisboa, Cascais, Comporta e Algarve. Penhíouses, villas, quintas e herdades de €500K a €6.5M.',
    url: 'https://www.agencygroup.pt/imoveis',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://www.agencygroup.pt/og-image.jpg', width: 1200, height: 630, alt: 'Imóveis de Luxo Portugal — Agency Group' }],
  },
  alternates: { canonical: 'https://www.agencygroup.pt/imoveis' },
}

export default function ImoveisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
