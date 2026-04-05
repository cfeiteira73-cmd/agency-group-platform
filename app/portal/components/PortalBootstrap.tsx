'use client'
import { useLiveData } from '../hooks/useLiveData'

export function PortalBootstrap() {
  useLiveData()
  return null  // invisible component, just runs the hook
}
