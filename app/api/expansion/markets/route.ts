// Agency Group — Market Intelligence & Selection API
// app/api/expansion/markets/route.ts
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import log from '@/lib/logger'
import {
  analyzeMarket,
  generateMarketIntelligenceReport,
  getMarketTrend,
} from '@/lib/expansion/marketIntelligenceEngine'
import {
  runMarketSelection,
  getExpansionPriorities,
} from '@/lib/expansion/marketSelectionEngine'
import {
  detectImbalances,
  getArbitrageOpportunities,
} from '@/lib/expansion/supplyDemandEngine'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')
  const country = searchParams.get('country')
  const city = searchParams.get('city')

  try {
    // Single market analysis: ?country=PT&city=Lisboa
    if (!mode && country && city) {
      const [intelligence, trend] = await Promise.all([
        analyzeMarket(country, city, tenantId),
        getMarketTrend(country, city, tenantId),
      ])
      return NextResponse.json({ intelligence, trend })
    }

    switch (mode) {
      case 'intelligence': {
        const report = await generateMarketIntelligenceReport(tenantId)
        return NextResponse.json(report)
      }

      case 'selection': {
        const report = await runMarketSelection(tenantId)
        return NextResponse.json(report)
      }

      case 'priorities': {
        const priorities = await getExpansionPriorities(tenantId)
        return NextResponse.json({ priorities, count: priorities.length })
      }

      case 'imbalances': {
        const report = await detectImbalances(tenantId)
        return NextResponse.json(report)
      }

      case 'arbitrage': {
        const opportunities = await getArbitrageOpportunities(tenantId)
        return NextResponse.json({ opportunities, count: opportunities.length })
      }

      default: {
        return NextResponse.json(
          {
            error: 'Invalid mode',
            available_modes: [
              'intelligence',
              'selection',
              'priorities',
              'imbalances',
              'arbitrage',
            ],
            single_market_usage: '?country=PT&city=Lisboa',
          },
          { status: 400 },
        )
      }
    }
  } catch (err) {
    log.error('[expansion/markets] GET error', err, { mode: mode ?? 'single', country, city })
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 },
    )
  }
}
