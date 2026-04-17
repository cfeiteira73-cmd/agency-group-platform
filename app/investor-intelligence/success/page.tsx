import { Suspense } from 'react'
import SuccessContent from './SuccessContent'

export const metadata = {
  title: 'Subscrição Activa | Investor Intelligence | Agency Group',
  robots: 'noindex',
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div style={{ background: '#0c1f15', minHeight: '100vh' }} />}>
      <SuccessContent />
    </Suspense>
  )
}
