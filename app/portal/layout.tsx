import type { Metadata } from 'next'
import { type ReactNode } from 'react'
import ChatWidget from '../components/ChatWidget'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  )
}
