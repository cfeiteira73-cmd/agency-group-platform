import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'

export async function GET() {
  Sentry.captureMessage('Sentry test — Agency Group portal is live', 'info')
  return NextResponse.json({
    success: true,
    message: 'Sentry test event sent',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}

// Test error capture
export async function POST() {
  try {
    throw new Error('Sentry test error — Agency Group')
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({
      success: true,
      message: 'Sentry error test sent',
    })
  }
}
