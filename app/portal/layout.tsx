'use client'
import ChatWidget from '../components/ChatWidget'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  )
}
