// ─── /app/partilhar/page.tsx — Server wrapper com Open Graph meta tags ────────
// generateMetadata corre no servidor → WhatsApp/iMessage/LinkedIn vêem a preview
// O componente client (PartilharClient) trata da galeria interativa

import type { Metadata } from 'next'
import PartilharClient from './PartilharClient'

interface Props {
  searchParams: Promise<{ d?: string }>
}

interface SharedProperty {
  ref: string
  nome: string
  zona: string
  bairro?: string
  tipo: string
  preco: number
  area: number
  quartos: number
  casasBanho: number
  badge?: string
  descricao?: string
  imagens?: string[]
}

function decode(d: string): SharedProperty | null {
  try {
    return JSON.parse(decodeURIComponent(d))
  } catch {
    return null
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const p = params.d ? decode(params.d) : null

  if (!p) {
    return {
      title: 'Imóvel | Agency Group',
      description: 'Agency Group — Mediação Imobiliária de Luxo',
    }
  }

  const precoFmt = p.preco
    ? `€${p.preco.toLocaleString('pt-PT')}`
    : ''
  const localFmt = [p.zona, p.bairro].filter(Boolean).join(', ')
  const title = `${p.nome || p.ref} | Agency Group`
  const description =
    p.descricao
      ? p.descricao.slice(0, 160)
      : `${p.tipo} em ${localFmt} · ${p.area}m² · ${p.quartos} quartos · ${precoFmt}`

  const ogImage = p.imagens?.[0]

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Agency Group',
      locale: 'pt_PT',
      ...(ogImage && {
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 800,
            alt: p.nome || p.ref,
          },
        ],
      }),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  }
}

export default async function PartilharPage({ searchParams }: Props) {
  const params = await searchParams
  return <PartilharClient d={params.d} />
}
