// Agency Group — Component Coverage Auditor
// lib/dashboard/componentCoverageAudit.ts
// TypeScript strict — 0 errors
//
// Audits portal component quality:
// - Which sections have real data vs empty/mock
// - Which API calls are returning data
// - Component render health (errors, timeouts)

import { supabaseAdmin } from '@/lib/supabase'

function uuidv4(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentCoverageReport {
  report_id: string
  tenant_id: string

  sections: {
    section: string
    api_endpoint: string | null
    last_api_call_at: string | null
    avg_response_ms: number | null
    error_rate_pct: number
    data_present: boolean
    record_count: number | null
  }[]

  dead_sections: string[]
  hot_sections: string[]

  coverage_score: number

  generated_at: string
}

// ---------------------------------------------------------------------------
// Internal map: resource_type slug → section label + API endpoint
// ---------------------------------------------------------------------------

interface SectionMapping {
  section: string
  resource_type: string
  api_endpoint: string
}

const SECTION_MAPPINGS: SectionMapping[] = [
  { section: 'dashboard',    resource_type: 'analytics_dashboard', api_endpoint: '/api/analytics/dashboard' },
  { section: 'crm',          resource_type: 'crm',                 api_endpoint: '/api/crm' },
  { section: 'deals',        resource_type: 'deals',               api_endpoint: '/api/deals' },
  { section: 'imoveis',      resource_type: 'properties',          api_endpoint: '/api/properties' },
  { section: 'contacts',     resource_type: 'contacts',            api_endpoint: '/api/contacts' },
  { section: 'matches',      resource_type: 'matches',             api_endpoint: '/api/matches' },
  { section: 'deal-packs',   resource_type: 'deal_packs',          api_endpoint: '/api/deal-packs' },
  { section: 'agenda',       resource_type: 'booking',             api_endpoint: '/api/booking' },
  { section: 'analytics',    resource_type: 'analytics',           api_endpoint: '/api/analytics' },
  { section: 'campanhas',    resource_type: 'campanhas',           api_endpoint: '/api/campanhas' },
  { section: 'investidores', resource_type: 'investors',           api_endpoint: '/api/investors' },
  { section: 'outbound',     resource_type: 'contacts_bulk',       api_endpoint: '/api/contacts/bulk' },
  { section: 'avm',          resource_type: 'avm',                 api_endpoint: '/api/avm' },
  { section: 'marketing',    resource_type: 'marketing',           api_endpoint: '/api/marketing' },
  { section: 'governance',   resource_type: 'governance',          api_endpoint: '/api/governance' },
]

// ---------------------------------------------------------------------------
// checkSectionUsage — queries access_decisions_log grouped by resource_type
// ---------------------------------------------------------------------------

interface AccessLogRow {
  resource_type: string
  decision: string
  created_at: string
  response_ms?: number | null
}

export async function checkSectionUsage(
  tenantId: string
): Promise<ComponentCoverageReport['sections']> {
  const db = supabaseAdmin as any

  // Fetch last 7 days of access log data
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logRows } = await db
    .from('access_decisions_log')
    .select('resource_type, decision, created_at, response_ms')
    .eq('tenant_id', tenantId)
    .gte('created_at', cutoff)
    .limit(10000)

  const rows: AccessLogRow[] = logRows ?? []

  // Group by resource_type
  const grouped: Record<string, AccessLogRow[]> = {}
  for (const row of rows) {
    const rt = row.resource_type ?? 'unknown'
    if (!grouped[rt]) grouped[rt] = []
    grouped[rt].push(row)
  }

  return SECTION_MAPPINGS.map(mapping => {
    const sectionRows = grouped[mapping.resource_type] ?? []

    if (sectionRows.length === 0) {
      return {
        section:         mapping.section,
        api_endpoint:    mapping.api_endpoint,
        last_api_call_at: null,
        avg_response_ms: null,
        error_rate_pct:  0,
        data_present:    false,
        record_count:    0,
      }
    }

    // Sort by date descending to find last call
    const sorted = [...sectionRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const last_api_call_at = sorted[0].created_at

    // Average response time
    const withMs = sectionRows.filter(r => r.response_ms != null)
    const avg_response_ms = withMs.length > 0
      ? Math.round(withMs.reduce((sum, r) => sum + (r.response_ms ?? 0), 0) / withMs.length)
      : null

    // Error rate
    const errorRows = sectionRows.filter(r =>
      r.decision === 'denied' || r.decision === 'error'
    )
    const error_rate_pct = Math.round((errorRows.length / sectionRows.length) * 100)

    return {
      section:          mapping.section,
      api_endpoint:     mapping.api_endpoint,
      last_api_call_at,
      avg_response_ms,
      error_rate_pct,
      data_present:     sectionRows.length > 0,
      record_count:     sectionRows.length,
    }
  })
}

// ---------------------------------------------------------------------------
// identifyDeadSections — sections with 0 recent API calls
// ---------------------------------------------------------------------------

export function identifyDeadSections(
  sections: ComponentCoverageReport['sections']
): string[] {
  return sections
    .filter(s => !s.data_present || s.record_count === 0)
    .map(s => s.section)
}

// ---------------------------------------------------------------------------
// identifyHotSections — top 5 sections by call volume
// ---------------------------------------------------------------------------

function identifyHotSections(
  sections: ComponentCoverageReport['sections']
): string[] {
  return [...sections]
    .filter(s => (s.record_count ?? 0) > 0)
    .sort((a, b) => (b.record_count ?? 0) - (a.record_count ?? 0))
    .slice(0, 5)
    .map(s => s.section)
}

// ---------------------------------------------------------------------------
// persistReport
// ---------------------------------------------------------------------------

export async function persistReport(report: ComponentCoverageReport): Promise<void> {
  const db = supabaseAdmin as any
  await db.from('component_coverage_reports').insert({
    id:             report.report_id,
    tenant_id:      report.tenant_id,
    sections:       report.sections,
    dead_sections:  report.dead_sections,
    hot_sections:   report.hot_sections,
    coverage_score: report.coverage_score,
    generated_at:   report.generated_at,
  })
}

// ---------------------------------------------------------------------------
// runComponentCoverageAudit — main entry point
// ---------------------------------------------------------------------------

export async function runComponentCoverageAudit(
  tenantId: string
): Promise<ComponentCoverageReport> {
  const sections     = await checkSectionUsage(tenantId)
  const dead_sections = identifyDeadSections(sections)
  const hot_sections  = identifyHotSections(sections)

  const total   = sections.length
  const active  = sections.filter(s => s.data_present).length
  const coverage_score = total > 0 ? Math.round((active / total) * 100) : 0

  const report: ComponentCoverageReport = {
    report_id:      uuidv4(),
    tenant_id:      tenantId,
    sections,
    dead_sections,
    hot_sections,
    coverage_score,
    generated_at:   new Date().toISOString(),
  }

  await persistReport(report)
  return report
}
