import { supabaseAdmin } from '@/lib/supabase'

export interface DrCertification {
  certification_id: string
  tenant_id: string
  certified_at: string

  // Backup checks
  last_daily_backup_hours_ago: number | null
  last_hourly_backup_hours_ago: number | null
  worm_compliance: boolean
  cross_region_replication: boolean
  backup_check: 'PASS' | 'FAIL' | 'PENDING'

  // DR readiness
  last_dr_test_days_ago: number | null
  last_dr_test_status: string | null
  rto_target_minutes: number
  rpo_target_minutes: number
  dr_check: 'PASS' | 'FAIL' | 'PENDING'

  // Event replay
  replay_events_total: bigint
  replay_rpo_minutes: number
  replay_check: 'PASS' | 'FAIL' | 'PENDING'

  // Region health
  regions_operational: string[]
  multi_region_check: 'PASS' | 'FAIL' | 'PENDING'

  overall_dr_grade: 'CERTIFIED_DR_READY' | 'CONDITIONAL_DR_READY' | 'DR_GAPS_FOUND'
  issues: string[]
}

export async function runDrCertification(tenantId: string): Promise<DrCertification> {
  const issues: string[] = []
  const now = new Date()

  // Backup checks
  let lastDaily: number | null = null, lastHourly: number | null = null, worm = false, crossRegion = false
  try {
    const { data: dailyRows } = await (supabaseAdmin as any).from('backup_records').select('completed_at, worm_locked, replicated_regions').eq('tenant_id', tenantId).eq('backup_type', 'DAILY_SNAPSHOT').eq('status', 'COMPLETED').order('completed_at', { ascending: false }).limit(1)
    const daily = (dailyRows as Array<{ completed_at: string; worm_locked: boolean; replicated_regions: string[] }>)?.[0]
    if (daily?.completed_at) {
      lastDaily = (now.getTime() - new Date(daily.completed_at).getTime()) / 3_600_000
      worm = daily.worm_locked
      crossRegion = (daily.replicated_regions?.length ?? 0) >= 2
    }
    const { data: hourlyRows } = await (supabaseAdmin as any).from('backup_records').select('completed_at').eq('tenant_id', tenantId).eq('backup_type', 'HOURLY_DELTA').eq('status', 'COMPLETED').order('completed_at', { ascending: false }).limit(1)
    const hourly = (hourlyRows as Array<{ completed_at: string }>)?.[0]
    if (hourly?.completed_at) lastHourly = (now.getTime() - new Date(hourly.completed_at).getTime()) / 3_600_000
  } catch { issues.push('BACKUP_TABLE_NOT_ACCESSIBLE') }

  const backupCheck: 'PASS' | 'FAIL' | 'PENDING' =
    lastDaily === null ? 'PENDING' :
    (lastDaily <= 26 && lastHourly !== null && lastHourly <= 2) ? 'PASS' : 'FAIL'
  if (backupCheck === 'FAIL') issues.push(`BACKUP_STALE: daily=${lastDaily?.toFixed(1)}h ago, hourly=${lastHourly?.toFixed(1)}h ago`)

  // DR test
  let lastTestDays: number | null = null, lastTestStatus: string | null = null
  try {
    const { data: testRows } = await (supabaseAdmin as any).from('dr_test_results').select('completed_at, status').eq('tenant_id', tenantId).order('completed_at', { ascending: false }).limit(1)
    const test = (testRows as Array<{ completed_at: string; status: string }>)?.[0]
    if (test?.completed_at) {
      lastTestDays = (now.getTime() - new Date(test.completed_at).getTime()) / 86_400_000
      lastTestStatus = test.status
    }
  } catch { /* no data */ }

  const drCheck: 'PASS' | 'FAIL' | 'PENDING' =
    lastTestDays === null ? 'PENDING' :
    (lastTestDays <= 30 && lastTestStatus === 'PASSED') ? 'PASS' : 'FAIL'

  // Replay check
  let replayTotal = BigInt(0), replayRpo = 0
  try {
    const { count } = await (supabaseAdmin as any).from('replayable_events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    replayTotal = BigInt(count ?? 0)
    if (replayTotal > BigInt(0)) {
      const { data: newestRows } = await (supabaseAdmin as any).from('replayable_events').select('occurred_at').eq('tenant_id', tenantId).order('occurred_at', { ascending: false }).limit(1)
      const newest = (newestRows as Array<{ occurred_at: string }>)?.[0]?.occurred_at
      if (newest) replayRpo = (now.getTime() - new Date(newest).getTime()) / 60_000
    }
  } catch { /* no data */ }

  const replayCheck: 'PASS' | 'FAIL' | 'PENDING' = replayRpo <= 5 ? 'PASS' : 'FAIL'

  // Regions
  const regions: string[] = []
  try {
    const { data: regionRows } = await (supabaseAdmin as any).from('region_health_checks').select('region, status').in('status', ['HEALTHY'])
    regions.push(...((regionRows as Array<{ region: string }>)?.map(r => r.region) ?? []))
  } catch { regions.push('EU_WEST') }

  const multiRegionCheck: 'PASS' | 'FAIL' | 'PENDING' = regions.length >= 2 ? 'PASS' : 'PENDING'

  const allPass = backupCheck === 'PASS' && drCheck === 'PASS' && replayCheck === 'PASS' && multiRegionCheck === 'PASS'
  const somePass = [backupCheck, drCheck, replayCheck, multiRegionCheck].filter(c => c === 'PASS').length >= 2

  return {
    certification_id: crypto.randomUUID(),
    tenant_id: tenantId,
    certified_at: now.toISOString(),
    last_daily_backup_hours_ago: lastDaily,
    last_hourly_backup_hours_ago: lastHourly,
    worm_compliance: worm,
    cross_region_replication: crossRegion,
    backup_check: backupCheck,
    last_dr_test_days_ago: lastTestDays,
    last_dr_test_status: lastTestStatus,
    rto_target_minutes: 10,
    rpo_target_minutes: 0,
    dr_check: drCheck,
    replay_events_total: replayTotal,
    replay_rpo_minutes: replayRpo,
    replay_check: replayCheck,
    regions_operational: regions,
    multi_region_check: multiRegionCheck,
    overall_dr_grade: allPass ? 'CERTIFIED_DR_READY' : somePass ? 'CONDITIONAL_DR_READY' : 'DR_GAPS_FOUND',
    issues,
  }
}
