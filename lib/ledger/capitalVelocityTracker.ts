// Agency Group — Capital Velocity Tracker
// lib/ledger/capitalVelocityTracker.ts
// Measures how fast capital moves from intake → escrow → settlement.
// Velocity ratio = deployed / in-period capital (0–1 scale).
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ── Logger ─────────────────────────────────────────────────────────────────────

let log: {
  info: (m: string, c?: Record<string, unknown>) => void
  warn: (m: string, c?: Record<string, unknown>) => void
  error: (m: string, c?: Record<string, unknown>) => void
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('@/lib/observability/logger') as { logger: typeof log }
  log = logger
} catch {
  log = {
    info: (m, c) => console.log('[velocity]', m, c ?? {}),
    warn: (m, c) => console.warn('[velocity]', m, c ?? {}),
    error: (m, c) => console.error('[velocity]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const ZERO = BigInt(0)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapitalVelocitySnapshot {
  snapshot_id: string
  tenant_id: string
  period_start: string
  period_end: string
  capital_in_cents: bigint
  capital_deployed_cents: bigint
  capital_settled_cents: bigint
  capital_in_escrow_cents: bigint
  velocity_ratio: number
  avg_hold_days: number
  deals_in_period: number
  commission_earned_cents: bigint
  computed_at: string
}

interface CapitalVelocityRow {
  snapshot_id: string
  tenant_id: string
  period_start: string
  period_end: string
  capital_in_cents: string | number
  capital_deployed_cents: string | number
  capital_settled_cents: string | number
  capital_in_escrow_cents: string | number
  velocity_ratio: number | string
  avg_hold_days: number | string
  deals_in_period: number
  commission_earned_cents: string | number
  computed_at: string
}

interface EscrowRow {
  status: string
  expected_amount_cents: string | number
  actual_amount_cents: string | number | null
  deposited_at: string | null
  released_at: string | null
}

function rowToSnapshot(row: CapitalVelocityRow): CapitalVelocitySnapshot {
  return {
    ...row,
    capital_in_cents: BigInt(row.capital_in_cents ?? 0),
    capital_deployed_cents: BigInt(row.capital_deployed_cents ?? 0),
    capital_settled_cents: BigInt(row.capital_settled_cents ?? 0),
    capital_in_escrow_cents: BigInt(row.capital_in_escrow_cents ?? 0),
    velocity_ratio: Number(row.velocity_ratio),
    avg_hold_days: Number(row.avg_hold_days),
    commission_earned_cents: BigInt(row.commission_earned_cents ?? 0),
  }
}

// ── computeCapitalVelocity ────────────────────────────────────────────────────

export async function computeCapitalVelocity(
  tenantId: string = TENANT_ID,
  periodDays: number = 30
): Promise<CapitalVelocitySnapshot> {
  const periodEnd = new Date()
  const periodStart = new Date()
  periodStart.setDate(periodEnd.getDate() - periodDays)

  const { data: positions, error } = await (supabaseAdmin as any)
    .from('escrow_positions')
    .select('status, expected_amount_cents, actual_amount_cents, deposited_at, released_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (error) {
    log.error('[velocity] computeCapitalVelocity query failed', { error })
  }

  const rows = (positions as EscrowRow[] | null) ?? []

  let capitalIn = ZERO
  let capitalDeployed = ZERO
  let capitalSettled = ZERO
  let capitalInEscrow = ZERO
  let totalHoldDays = 0
  let holdCount = 0

  for (const row of rows) {
    const amount = BigInt(row.actual_amount_cents ?? row.expected_amount_cents ?? 0)
    capitalIn = capitalIn + amount

    if (row.status === 'RELEASED') {
      capitalSettled = capitalSettled + amount
      capitalDeployed = capitalDeployed + amount

      if (row.deposited_at && row.released_at) {
        const dep = new Date(row.deposited_at).getTime()
        const rel = new Date(row.released_at).getTime()
        const days = (rel - dep) / (1000 * 60 * 60 * 24)
        totalHoldDays += days
        holdCount++
      }
    } else if (row.status === 'IN_ESCROW' || row.status === 'DEPOSITED') {
      capitalInEscrow = capitalInEscrow + amount
      capitalDeployed = capitalDeployed + amount
    }
  }

  const velocityRatio =
    capitalIn > ZERO ? Number(capitalDeployed) / Number(capitalIn) : 0
  const avgHoldDays = holdCount > 0 ? totalHoldDays / holdCount : 0
  const dealsInPeriod = rows.length

  // Fetch commission earned in period
  const { data: commData } = await (supabaseAdmin as any)
    .from('journal_entries')
    .select('amount_cents')
    .eq('tenant_id', tenantId)
    .eq('credit_account_code', '4001')
    .gte('posted_at', periodStart.toISOString())
    .lte('posted_at', periodEnd.toISOString())

  const commissionEarned = (
    (commData as Array<{ amount_cents: string | number }> | null) ?? []
  ).reduce((sum, r) => sum + BigInt(r.amount_cents ?? 0), ZERO)

  const snapshotId = randomUUID()
  const computedAt = new Date().toISOString()

  const snapshot: CapitalVelocitySnapshot = {
    snapshot_id: snapshotId,
    tenant_id: tenantId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    capital_in_cents: capitalIn,
    capital_deployed_cents: capitalDeployed,
    capital_settled_cents: capitalSettled,
    capital_in_escrow_cents: capitalInEscrow,
    velocity_ratio: Math.min(1, Math.max(0, velocityRatio)),
    avg_hold_days: Math.round(avgHoldDays * 100) / 100,
    deals_in_period: dealsInPeriod,
    commission_earned_cents: commissionEarned,
    computed_at: computedAt,
  }

  // Persist snapshot (fire-and-forget)
  void (supabaseAdmin as any)
    .from('capital_velocity_snapshots')
    .insert({
      snapshot_id: snapshotId,
      tenant_id: tenantId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      capital_in_cents: Number(capitalIn),
      capital_deployed_cents: Number(capitalDeployed),
      capital_settled_cents: Number(capitalSettled),
      capital_in_escrow_cents: Number(capitalInEscrow),
      velocity_ratio: snapshot.velocity_ratio,
      avg_hold_days: snapshot.avg_hold_days,
      deals_in_period: dealsInPeriod,
      commission_earned_cents: Number(commissionEarned),
      computed_at: computedAt,
    })
    .catch((e: unknown) => console.warn('[velocity] persist snapshot', e))

  log.info('[velocity] snapshot computed', {
    period_days: periodDays,
    velocity_ratio: snapshot.velocity_ratio,
    deals: dealsInPeriod,
  })

  return snapshot
}

// ── getVelocityTrend ──────────────────────────────────────────────────────────

export async function getVelocityTrend(
  tenantId: string = TENANT_ID,
  periods: number = 6
): Promise<CapitalVelocitySnapshot[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('capital_velocity_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(periods)

  if (error || !data) {
    log.error('[velocity] getVelocityTrend query failed', { error })
    return []
  }

  return (data as CapitalVelocityRow[]).map(rowToSnapshot)
}
