'use client'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

const SofiaAgentWidget = dynamic(() => import('./SofiaAgentWidget'), { ssr: false })

export default function SofiaWidgetWrapper() {
  const pathname = usePathname()
  // Don't show Sofia on blog/faq pages (reduces bundle on content pages)
  if (pathname?.startsWith('/blog') || pathname?.startsWith('/faq')) return null
  return <SofiaAgentWidget />
}
