// Agency Group — Component Isolator
// lib/control-plane/componentIsolator.ts
// Marks portal components as HEALTHY/DEGRADED/ISOLATED in control plane registry.
// Other systems check this registry before routing requests.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { Issue } from './autodiagnosticEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComponentStatus = 'HEALTHY' | 'DEGRADED' | 'ISOLATED' | 'UNKNOWN'

export interface ComponentHealthRecord {
  component: string
  status: ComponentStatus
  reason: string
  isolation_started_at: string | null
  last_seen_healthy_at: string | null
  tenant_id: string
}

// ─── Safety guardrail ─────────────────────────────────────────────────────────
// Components that must NEVER be auto-isolated — require human decision only.

const HUMAN_DECISION_ONLY = new Set(['auth', 'deals', 'ledger', 'payments'])

function requiresHumanDecision(component: string): boolean {
  return HUMAN_DECISION_ONLY.has(component.toLowerCase())
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function setComponentStatus(
  tenantId: string,
  component: string,
  status: ComponentStatus,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString()

  const record: Record<string, unknown> = {
    tenant_id: tenantId,
    component,
    status,
    reason,
    updated_at: now,
  }

  if (status === 'ISOLATED') {
    record['isolation_started_at'] = now
  }

  if (status === 'HEALTHY') {
    record['last_seen_healthy_at'] = now
    record['isolation_started_at'] = null
  }

  try {
    const { error } = await (supabaseAdmin as any)
      .from('component_health_overrides')
      .upsert(record, { onConflict: 'tenant_id,component' })

    if (error) {
      log.warn('[componentIsolator] setComponentStatus upsert failed', {
        component,
        status,
        error: error.message,
        tenant_id: tenantId,
      })
    } else {
      log.info('[componentIsolator] Component status set', {
        component,
        status,
        reason,
        tenant_id: tenantId,
      })
    }
  } catch (err) {
    log.warn('[componentIsolator] setComponentStatus exception', {
      component,
      error: err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
    })
  }
}

export async function getComponentStatus(
  tenantId: string,
  component: string,
): Promise<ComponentStatus> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('component_health_overrides')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('component', component)
      .maybeSingle()

    if (error || !data) return 'UNKNOWN'

    const status = data.status as ComponentStatus
    if (['HEALTHY', 'DEGRADED', 'ISOLATED', 'UNKNOWN'].includes(status)) {
      return status
    }
    return 'UNKNOWN'
  } catch (err) {
    log.warn('[componentIsolator] getComponentStatus exception', {
      component,
      error: err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
    })
    return 'UNKNOWN'
  }
}

export async function listIsolatedComponents(tenantId: string): Promise<ComponentHealthRecord[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('component_health_overrides')
      .select('component, status, reason, isolation_started_at, last_seen_healthy_at, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'ISOLATED')
      .order('isolation_started_at', { ascending: false })

    if (error) {
      log.warn('[componentIsolator] listIsolatedComponents failed', {
        error: error.message,
        tenant_id: tenantId,
      })
      return []
    }

    return (data ?? []).map((row: any) => ({
      component: row.component,
      status: row.status as ComponentStatus,
      reason: row.reason ?? '',
      isolation_started_at: row.isolation_started_at ?? null,
      last_seen_healthy_at: row.last_seen_healthy_at ?? null,
      tenant_id: row.tenant_id,
    }))
  } catch (err) {
    log.warn('[componentIsolator] listIsolatedComponents exception', {
      error: err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
    })
    return []
  }
}

export async function autoIsolateFromIssues(
  issues: Issue[],
  tenantId: string,
): Promise<void> {
  const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL')
  if (criticalIssues.length === 0) return

  const processedComponents = new Set<string>()

  for (const issue of criticalIssues) {
    const component = issue.component
    if (processedComponents.has(component)) continue
    processedComponents.add(component)

    // Safety guardrail: never auto-isolate auth, deals, ledger, payments
    if (requiresHumanDecision(component)) {
      log.warn('[componentIsolator] CRITICAL issue on protected component — human decision required', {
        component,
        message: issue.message,
        tenant_id: tenantId,
      })
      // Still record the status as DEGRADED so it's visible, but not ISOLATED
      void setComponentStatus(
        tenantId,
        component,
        'DEGRADED',
        `CRITICAL issue detected — awaiting human decision: ${issue.message}`,
      )
      continue
    }

    log.warn('[componentIsolator] Auto-isolating component due to CRITICAL issue', {
      component,
      message: issue.message,
      tenant_id: tenantId,
    })

    void setComponentStatus(
      tenantId,
      component,
      'ISOLATED',
      `Auto-isolated due to CRITICAL issue: ${issue.message}`,
    )
  }
}
