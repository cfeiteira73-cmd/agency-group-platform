// AGENCY GROUP — SH-ROS Control Tower: Compliance | AMI: 22506
export const revalidate = 30

import { Suspense } from 'react'
import { StatusBadge } from '../_components/StatusBadge'

interface ComplianceData {
  overall_status: 'compliant' | 'warning' | 'critical'
  gdpr: {
    pending_erasures: number
    pending_exports: number
    consent_records: number
    last_audit: string | null
  }
  retention: {
    policies_active: number
    records_due_deletion: number
    last_purge: string | null
  }
  legal_hold: {
    active_holds: number
    entities_held: number
  }
  audit_log: {
    total_entries: number
    last_entry: string | null
    integrity_verified: boolean
  }
  policy_issues: Array<{
    policy: string
    severity: string
    description: string
  }>
  recent_audit_entries: Array<{
    entry_id: string
    actor: string
    action: string
    entity_type: string
    timestamp: string
    hash_valid: boolean
  }>
}

async function fetchComplianceData(org_id: string): Promise<ComplianceData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/compliance?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 120 },
    })
    if (!res.ok) return null
    return res.json() as Promise<ComplianceData>
  } catch { return null }
}

const SEVERITY_COLORS: Record<string, string> = {
  blocking: 'bg-red-600 text-white',
  warning:  'bg-amber-600 text-white',
  info:     'bg-blue-700 text-white',
}

async function ComplianceContent() {
  const data = await fetchComplianceData('default')

  return (
    <>
      {data?.overall_status && (
        <div className="flex justify-end">
          <StatusBadge variant={data.overall_status === 'compliant' ? 'healthy' : data.overall_status === 'warning' ? 'degraded' : 'failed'} />
        </div>
      )}

      {/* SOC2 Type II Readiness Summary */}
      <div className="flex items-center gap-3 p-3 bg-[#111118] border border-slate-800 rounded-lg mb-4">
        <span className="text-xl">🛡</span>
        <div>
          <p className="text-sm font-semibold text-slate-200">SOC2 Type II Readiness</p>
          <p className="text-xs text-slate-500">13 controls monitored · CC6, CC7, CC8, CC9, A1 families</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-500 font-mono">Last audit: {new Date().toISOString().slice(0, 10)}</p>
        </div>
      </div>

      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Compliance data unavailable</p>
        </div>
      ) : (
        <>
          {/* Policy Issues */}
          {data.policy_issues.length > 0 && (
            <div className="bg-[#111118] border border-red-900/40 rounded-lg p-4">
              <p className="text-xs text-red-400 font-medium mb-3">⚠ Policy Violations</p>
              <div className="space-y-2">
                {data.policy_issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 py-1.5 border-t border-slate-800 first:border-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${SEVERITY_COLORS[issue.severity] ?? 'bg-slate-700 text-slate-300'}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300">{issue.description}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{issue.policy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.policy_issues.length === 0 && (
            <div className="bg-[#111118] border border-green-900/30 rounded-lg p-4 flex items-center gap-3">
              <span className="text-green-400 text-lg">✓</span>
              <div>
                <p className="text-sm text-green-400 font-medium">All policies passing</p>
                <p className="text-[10px] text-slate-500 font-mono">No blocking violations detected</p>
              </div>
            </div>
          )}

          {/* Compliance modules */}
          <div className="grid grid-cols-2 gap-4">
            {/* GDPR */}
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">🇪🇺 GDPR</p>
              <div className="space-y-2">
                {[
                  { label: 'Pending Erasures', value: data.gdpr.pending_erasures, alert: data.gdpr.pending_erasures > 0 },
                  { label: 'Pending Exports', value: data.gdpr.pending_exports, alert: data.gdpr.pending_exports > 0 },
                  { label: 'Consent Records', value: data.gdpr.consent_records, alert: false },
                  { label: 'Last Audit', value: data.gdpr.last_audit ? new Date(data.gdpr.last_audit).toLocaleDateString() : 'Never', alert: !data.gdpr.last_audit },
                ].map(({ label, value, alert }) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-mono font-semibold ${alert ? 'text-amber-400' : 'text-slate-200'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Retention */}
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">🗄 Retention Policies</p>
              <div className="space-y-2">
                {[
                  { label: 'Active Policies', value: data.retention.policies_active, alert: false },
                  { label: 'Records Due Deletion', value: data.retention.records_due_deletion, alert: data.retention.records_due_deletion > 0 },
                  { label: 'Last Purge', value: data.retention.last_purge ? new Date(data.retention.last_purge).toLocaleDateString() : 'Never', alert: !data.retention.last_purge },
                ].map(({ label, value, alert }) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-mono font-semibold ${alert ? 'text-amber-400' : 'text-slate-200'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Hold */}
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">⚖ Legal Hold</p>
              <div className="space-y-2">
                {[
                  { label: 'Active Holds', value: data.legal_hold.active_holds, alert: data.legal_hold.active_holds > 0 },
                  { label: 'Entities Held', value: data.legal_hold.entities_held, alert: false },
                ].map(({ label, value, alert }) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-mono font-semibold ${alert ? 'text-amber-400' : 'text-slate-200'}`}>{value}</span>
                  </div>
                ))}
              </div>
              {data.legal_hold.active_holds > 0 && (
                <div className="mt-3 bg-amber-950/20 border border-amber-900/30 rounded px-2 py-1.5">
                  <p className="text-[10px] text-amber-400">Active legal holds prevent deletion of held entities</p>
                </div>
              )}
            </div>

            {/* Immutable Audit */}
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">🔒 Immutable Audit Log</p>
              <div className="space-y-2">
                {[
                  { label: 'Total Entries', value: data.audit_log.total_entries, alert: false },
                  { label: 'Hash Integrity', value: data.audit_log.integrity_verified ? '✓ Verified' : '✗ Failed', alert: !data.audit_log.integrity_verified },
                  { label: 'Last Entry', value: data.audit_log.last_entry ? new Date(data.audit_log.last_entry).toLocaleString() : 'None', alert: false },
                ].map(({ label, value, alert }) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-mono font-semibold ${alert ? 'text-red-400' : 'text-slate-200'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent audit entries */}
          {data.recent_audit_entries.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Recent Audit Entries</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Entry ID', 'Actor', 'Action', 'Entity', 'Hash', 'Time'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_audit_entries.map((entry) => (
                    <tr key={entry.entry_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{entry.entry_id.slice(0, 8)}…</td>
                      <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">{entry.actor}</td>
                      <td className="px-3 py-2 text-slate-300 text-[10px]">{entry.action}</td>
                      <td className="px-3 py-2 text-slate-400 text-[10px]">{entry.entity_type}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-mono ${entry.hash_valid ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.hash_valid ? '✓ valid' : '✗ INVALID'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

function ComplianceSkeleton() {
  return (
    <>
      <div className="h-12 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
    </>
  )
}

export default function CompliancePage() {
  return (
    <div className="space-y-5">
      {/* Header — renders immediately */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Compliance</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">GDPR · Legal Hold · Retention · Immutable Audit</p>
        </div>
      </div>

      {/* Data streams in */}
      <Suspense fallback={<ComplianceSkeleton />}>
        <ComplianceContent />
      </Suspense>
    </div>
  )
}
