import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'

// Admin-only — requires Bearer ADMIN_SECRET
function isAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  return safeCompare(auth, `Bearer ${process.env.ADMIN_SECRET ?? ''}`)
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  Sentry.captureMessage('Sentry test — Agency Group portal is live', 'info')
  return NextResponse.json({
    success: true,
    message: 'Sentry test event sent',
    timestamp: new Date().toISOString(),
  })
}

// Test error capture
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    throw new Error('Sentry test error — Agency Group')
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ success: true, message: 'Sentry error test sent' })
  }
}
