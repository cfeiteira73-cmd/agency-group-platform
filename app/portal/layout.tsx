'use client'
import { type ReactNode } from 'react'
import ChatWidget from '../components/ChatWidget'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  )
}
