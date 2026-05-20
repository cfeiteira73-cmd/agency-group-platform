// Agency Group — Kafka Health & Lag Status API
// app/api/kafka/health/route.ts
// TypeScript strict — 0 errors
//
// GET /api/kafka/health
// Auth: requirePortalAuth
// Returns: cluster status, consumer group lag, topic counts

export const runtime = 'nodejs'

import { type NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { detectConsumerLag, type ConsumerGroupLag } from '@/lib/events/lagDetector'

// ─── Response shape ───────────────────────────────────────────────────────────

interface KafkaHealthResponse {
  status: 'ok' | 'degraded' | 'critical' | 'not_configured'
  message?: string
  groups?: ConsumerGroupLag[]
  total_lag?: number
  checked_at: string
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth gate
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const checkedAt = new Date().toISOString()

  // 2. Short-circuit when Kafka is not configured
  if (!process.env.KAFKA_BROKERS) {
    const body: KafkaHealthResponse = {
      status:     'not_configured',
      message:    'Set KAFKA_BROKERS to enable Kafka monitoring',
      checked_at: checkedAt,
    }
    return NextResponse.json(body, { status: 200 })
  }

  // 3. Fetch consumer group lag with a 5-second timeout
  let groups: ConsumerGroupLag[] = []

  try {
    const lagPromise      = detectConsumerLag()
    const timeoutPromise  = new Promise<ConsumerGroupLag[]>((_, reject) =>
      setTimeout(() => reject(new Error('lag detection timeout')), 5_000),
    )
    groups = await Promise.race([lagPromise, timeoutPromise])
  } catch (err) {
    // Timeout or unexpected error — return degraded rather than 500
    console.warn(
      `[KafkaHealth] lag detection failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    const body: KafkaHealthResponse = {
      status:     'degraded',
      message:    `Lag detection unavailable: ${err instanceof Error ? err.message : String(err)}`,
      groups:     [],
      total_lag:  0,
      checked_at: checkedAt,
    }
    return NextResponse.json(body, { status: 200 })
  }

  // 4. Compute aggregate status
  const totalLag = groups.reduce((sum, g) => sum + g.totalLag, 0)

  const hasCritical = groups.some((g) => g.status === 'critical')
  const hasWarning  = groups.some((g) => g.status === 'warning')
  const overallStatus: 'ok' | 'degraded' | 'critical' = hasCritical
    ? 'critical'
    : hasWarning
      ? 'degraded'
      : 'ok'

  const body: KafkaHealthResponse = {
    status:     overallStatus,
    groups,
    total_lag:  totalLag,
    checked_at: checkedAt,
  }

  return NextResponse.json(body, { status: 200 })
}
