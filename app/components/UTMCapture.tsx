'use client'
// Runs once on every page load — captures UTM params and stores first/last touch.
// Renders nothing. Import in app/layout.tsx.
import { useEffect } from 'react'
import { captureUTMs } from '@/lib/utm'

export default function UTMCapture() {
  useEffect(() => {
    captureUTMs()
  }, [])
  return null
}
