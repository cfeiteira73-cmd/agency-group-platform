'use client'
import { SessionProvider } from 'next-auth/react'
import ChatWidget from '../components/ChatWidget'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ChatWidget />
    </SessionProvider>
  )
}
