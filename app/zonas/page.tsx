import { redirect } from 'next/navigation'

// /zonas has no index — redirect to the first zone or to the home page
export default function ZonasIndex() {
  redirect('/invest-in-portugal-real-estate')
}

export const metadata = {
  title: 'Portugal Real Estate Zones | Agency Group',
  description: 'Discover premium real estate zones in Portugal: Lisbon, Cascais, Algarve, Porto, Sintra and more.',
}
