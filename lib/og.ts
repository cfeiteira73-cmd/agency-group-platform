/**
 * OG image URL builder — generates dynamic Open Graph images via /api/og
 * Uses next/og ImageResponse at the edge for Agency Group brand visuals.
 */

const OG_BASE = 'https://www.agencygroup.pt/api/og'

export function buildOgImageUrl(params: {
  title: string
  subtitle?: string
  zone?: string
  price?: string
  type?: 'default' | 'property' | 'blog' | 'zone'
}): string {
  const url = new URL(OG_BASE)
  url.searchParams.set('title', params.title.slice(0, 80))
  if (params.subtitle) url.searchParams.set('subtitle', params.subtitle.slice(0, 80))
  if (params.zone)     url.searchParams.set('zone',     params.zone)
  if (params.price)    url.searchParams.set('price',    params.price)
  if (params.type)     url.searchParams.set('type',     params.type)
  return url.toString()
}
