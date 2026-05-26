// Agency Group — Institutional Market Data API
// app/api/institutional/market-data/route.ts
//
// External-facing institutional API endpoint.
// Banks, family offices, sovereign wealth funds, and institutional investors
// consume the platform's authoritative market data outputs (OLI, Pricing
// Benchmark, ICS, LVI, Supply Dominance scores).
//
// GET  /api/institutional/market-data?market=Lisboa — latest package
// POST /api/institutional/market-data — admin actions (publish-all, get-feed-metrics)
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import {
  validateInstitutionalKey,
  checkRateLimit,
  recordApiCall,
} from '@/lib/institutional/institutionalApiKeyEngine'
import {
  getLatestPackage,
  assembleMarketDataPackage,
  publishMarketDataPackages,
} from '@/lib/institutional/marketDataPublishingEngine'
import { getDeliveryMetrics } from '@/lib/institutional/institutionalDataFeed'
import { logger as log } from '@/lib/observability/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─── safeCompare ──────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startMs = Date.now()
  const endpoint = '/api/institutional/market-data'

  // ── Auth: validate institutional API key ─────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  const { valid, client, reason } = await validateInstitutionalKey(apiKey, endpoint)

  if (!valid || !client) {
    return NextResponse.json(
      { error: 'Unauthorized', reason: reason ?? 'Invalid API key' },
      { status: 401 },
    )
  }

  // ── Check endpoint allowed ───────────────────────────────────────────────────
  const allowed = client.allowed_endpoints ?? []
  const hasAccess =
    allowed.length === 0 ||
    allowed.some((ep: string) => endpoint.startsWith(ep) || ep === '*')

  if (!hasAccess) {
    void recordApiCall(client.id, endpoint, Date.now() - startMs, 403)
    return NextResponse.json(
      { error: 'Forbidden', reason: 'Endpoint not in allowed list' },
      { status: 403 },
    )
  }

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const rateCheck = await checkRateLimit(client.id, client.tier)

  if (!rateCheck.allowed) {
    void recordApiCall(client.id, endpoint, Date.now() - startMs, 429)
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        reason: 'Rate limit exceeded',
        retry_after_seconds: 60,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(
            client.rate_limit_per_minute,
          ),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        },
      },
    )
  }

  // ── Query params ─────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') ?? 'Lisboa'
  const city = searchParams.get('city') ?? market
  const format = searchParams.get('format') ?? 'JSON'

  log.info('[institutional-api] GET request', {
    client_id: client.id,
    institution: client.institution_name,
    tier: client.tier,
    market,
    format,
  })

  try {
    // Try to get cached/published package first
    let pkg = await getLatestPackage(market)

    // If no valid cached package, assemble on-demand
    if (!pkg) {
      pkg = await assembleMarketDataPackage(market, city)
    }

    // Filter data based on client access level
    const accessLevel = client.data_access_level

    if (accessLevel === 'BASIC') {
      pkg = {
        ...pkg,
        investment_confidence_score: null,
        liquidity_velocity_index: null,
        supply_dominance: null,
      }
    } else if (accessLevel === 'STANDARD') {
      pkg = {
        ...pkg,
        liquidity_velocity_index: null,
        supply_dominance: null,
      }
    } else if (accessLevel === 'PREMIUM') {
      pkg = {
        ...pkg,
        supply_dominance: null,
      }
    }
    // PLATINUM: no filtering

    const responseMs = Date.now() - startMs
    void recordApiCall(client.id, endpoint, responseMs, 200)

    return NextResponse.json(
      {
        data: pkg,
        meta: {
          institution: client.institution_name,
          tier: client.tier,
          access_level: accessLevel,
          rate_limit_remaining: rateCheck.remaining,
          response_ms: responseMs,
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': String(client.rate_limit_per_minute),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
          'X-Package-Hash': pkg.package_hash,
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    const responseMs = Date.now() - startMs
    void recordApiCall(client.id, endpoint, responseMs, 500)

    log.info('[institutional-api] GET error', { err: String(err) })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Admin actions require internal Bearer auth
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const expectedKey =
    process.env.API_SECRET_KEY ?? process.env.INTERNAL_API_KEY ?? ''

  if (!token || !safeCompare(token, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  log.info('[institutional-api] POST action', { action })

  try {
    if (action === 'publish-all') {
      const result = await publishMarketDataPackages()
      return NextResponse.json({
        data: {
          published: result.published,
          failed: result.failed,
          published_at: new Date().toISOString(),
          markets: result.packages.map((p) => ({
            market: p.market,
            package_id: p.package_id,
            package_hash: p.package_hash,
            valid_until: p.valid_until,
          })),
        },
      })
    }

    if (action === 'get-feed-metrics') {
      const metrics = await getDeliveryMetrics()
      return NextResponse.json({ data: metrics })
    }

    if (action === 'subscribe') {
      // Subscription management is handled via the Supabase admin dashboard
      // or a dedicated subscription management endpoint
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message:
            'Feed subscription management is handled via the institutional onboarding process. Contact your relationship manager.',
        },
        { status: 501 },
      )
    }

    return NextResponse.json(
      {
        error: 'Bad Request',
        reason: `Unknown action: ${action ?? '(none)'}. Valid actions: publish-all, get-feed-metrics, subscribe`,
      },
      { status: 400 },
    )
  } catch (err) {
    log.info('[institutional-api] POST error', { action, err: String(err) })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
