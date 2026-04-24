// =============================================================================
// OFF-MARKET — Agency Group
// Invite-only pre-market access page
// Captures lead → CRM before WhatsApp
// =============================================================================

import type { Metadata } from 'next'
import OffMarketClient from './OffMarketClient'

export const metadata: Metadata = {
  title: 'Imóveis Off-Market — Acesso Privado | Agency Group',
  description: 'Propriedades exclusivas que nunca chegam ao mercado público. Acesso reservado a clientes seleccionados da Agency Group. Solicite acesso privado.',
  robots: { index: false, follow: false }, // Not indexed — by design, exclusive
  alternates: {
    canonical: 'https://www.agencygroup.pt/off-market',
  },
  openGraph: {
    title: 'Imóveis Off-Market — Acesso Privado | Agency Group',
    description: 'Propriedades que nunca chegam ao mercado público. Acesso por convite.',
    url: 'https://www.agencygroup.pt/off-market',
    siteName: 'Agency Group',
    locale: 'pt_PT',
    type: 'website',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Im%C3%B3veis+Off-Market&subtitle=Acesso+Privado+%C2%B7+Propriedades+Exclusivas+%C2%B7+Por+Convite',
      width: 1200, height: 630,
      alt: 'Imóveis Off-Market — Acesso Privado — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Imóveis Off-Market — Acesso Privado | Agency Group',
    description: 'Propriedades que nunca chegam ao mercado público. Acesso por convite.',
    images: ['https://www.agencygroup.pt/api/og?title=Im%C3%B3veis+Off-Market&subtitle=Acesso+Privado+%C2%B7+Propriedades+Exclusivas+%C2%B7+Por+Convite'],
  },
}

export default function OffMarketPage() {
  return <OffMarketClient />
}
