// app/partilhar/[id]/page.tsx
// Página pública com Open Graph tags — WhatsApp/iMessage/LinkedIn mostram foto + título
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PartilharClient from '../PartilharClient'

interface Props {
  params: Promise<{ id: string }>
}

interface SharedProperty {
  ref: string; nome: string; zona: string; bairro?: string; tipo: string
  preco: number; area: number; quartos: number; casasBanho: number
  badge?: string; descricao?: string; imagens?: string[]
}

async function getShare(id: string): Promise<SharedProperty | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('imovel_shares')
    .select('data')
    .eq('id', id)
    .gt('expires_at', new Date().toISOString())
    .single()
  return data?.data ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await getShare(id)

  if (!p) return { title: 'Imóvel | Agency Group' }

  const precoFmt = p.preco ? `€${p.preco.toLocaleString('pt-PT')}` : ''
  const localFmt = [p.zona, p.bairro].filter(Boolean).join(', ')
  const title = `${p.nome || p.ref} | Agency Group`
  const description = p.descricao
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
        images: [{ url: ogImage, width: 1200, height: 800, alt: p.nome || p.ref }],
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

export default async function PartilharIdPage({ params }: Props) {
  const { id } = await params
  const p = await getShare(id)
  // Encode para passar ao client component (compatível com a galeria existente)
  const d = p ? encodeURIComponent(JSON.stringify(p)) : undefined
  return <PartilharClient d={d} />
}
