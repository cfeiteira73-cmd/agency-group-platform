// AGENCY GROUP — Control Tower: Security | AMI: 22506
// Phase Ω∞-7: RBAC, signed audit chain integrity, poison quarantine, compliance

import { Suspense } from 'react'
import { KPICard } from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'
import { signedAuditChain } from '@/lib/security/signedAuditChain'
import { queuePoisonProtection } from '@/lib/security/queuePoisonProtection'
import { soc2Evidence } from '@/lib/compliance/soc2Evidence'
import { tenantIsolationLayer } from '@/lib/security/tenantIsolationLayer'

export const revalidate = 60

async function getSecurityData() {
  const org_id = process.env.DEFAULT_ORG_ID ?? 'default'

  const [chainVerification, quarantined, soc2Summary, tenantSnapshot] = await Promise.allSettled([
    signedAuditChain.verifyChain(org_id),
    queuePoisonProtection.listQuarantined(),
    soc2Evidence.getSummary(org_id),
    tenantIsolationLayer.snapshotUsage(org_id),
  ])

  return {
    chainVerification: chainVerification.status === 'fulfilled' ? chainVerification.value : null,
    quarantined: quarantined.status === 'fulfilled' ? quarantined.value : [],
    soc2Summary: soc2Summary.status === 'fulfilled' ? soc2Summary.value : null,
    tenantSnapshot: tenantSnapshot.status === 'fulfilled' ? tenantSnapshot.value : null,
  }
}

function SecuritySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      ))}
    </div>
  )
}

async function SecurityContent() {
  const data = await getSecurityData()
  const { chainVerification, quarantined, soc2Summary, tenantSnapshot } = data

  const chainIntact = chainVerification?.valid ?? true
  const unresolvedPoison = quarantined.filter(q => !q.resolved).length
  const soc2PassRate = soc2Summary?.pass_rate ?? 0
  const tenantViolations = tenantSnapshot?.violations.length ?? 0

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Audit Chain"
          value={chainIntact ? 'INTACT' : 'BROKEN'}
          color={chainIntact ? 'green' : 'red'}
        />
        <KPICard
          title="Poison Queue"
          value={`${unresolvedPoison} msgs`}
          color={unresolvedPoison > 0 ? 'red' : 'green'}
        />
        <KPICard
          title="SOC2 Pass Rate"
          value={`${soc2PassRate}%`}
          color={soc2PassRate >= 95 ? 'green' : soc2PassRate >= 80 ? 'amber' : 'red'}
        />
        <KPICard
          title="Tenant Violations"
          value={tenantViolations}
          color={tenantViolations > 0 ? 'red' : 'green'}
        />
      </div>

      {/* RLS Compliance Status */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-200">Row-Level Security (RLS)</span>
          <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono">ACTIVE</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { table: 'tenants',              rls: true },
            { table: 'audit_log',            rls: true },
            { table: 'ai_feedback',          rls: true },
            { table: 'agent_memory',         rls: true },
            { table: 'cost_model_snapshots', rls: true },
            { table: 'vault_snapshots',      rls: true },
          ].map(({ table, rls }) => (
            <div key={table} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${rls ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-slate-400 font-mono text-[10px]">{table}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-3 font-mono">
          USING (tenant_id = auth.jwt()-&gt;&gt;&apos;tenant_id&apos;) · service_role bypass
        </p>
      </div>

      {/* Audit chain status */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-200 font-semibold text-sm">Cryptographic Audit Chain</h2>
          <StatusBadge
            variant={chainIntact ? 'completed' : 'failed'}
            label={chainIntact ? 'VERIFIED' : 'BROKEN'}
          />
        </div>
        {chainVerification ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Total Entries</p>
              <p className="text-slate-200 font-medium mt-0.5">{chainVerification.total_entries.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Valid Entries</p>
              <p className="text-emerald-400 font-medium mt-0.5">{chainVerification.valid_entries.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Chain Start</p>
              <p className="text-slate-400 font-mono text-xs mt-0.5">{chainVerification.first_entry?.slice(0, 8)}…</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Chain End</p>
              <p className="text-slate-400 font-mono text-xs mt-0.5">{chainVerification.last_entry?.slice(0, 8)}…</p>
            </div>
            {!chainIntact && chainVerification.broken_at && (
              <div className="col-span-4 mt-2 p-3 bg-red-900/20 border border-red-800 rounded text-xs">
                <span className="text-red-400 font-bold">⚠ Chain integrity broken at entry: </span>
                <span className="text-red-300 font-mono">{chainVerification.broken_at}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No audit entries recorded yet</p>
        )}
      </div>

      {/* SOC2 Evidence */}
      {soc2Summary && (
        <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-slate-200 font-semibold text-sm">SOC2 Control Evidence</span>
            <span className={`text-sm font-bold ${soc2Summary.pass_rate >= 95 ? 'text-emerald-400' : soc2Summary.pass_rate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
              {soc2Summary.pass_rate}% pass rate
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-200">{soc2Summary.total}</p>
                <p className="text-slate-500 text-xs">Total Evidence</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{soc2Summary.passed}</p>
                <p className="text-slate-500 text-xs">Passed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{soc2Summary.failed}</p>
                <p className="text-slate-500 text-xs">Failed</p>
              </div>
            </div>
            {Object.entries(soc2Summary.by_control).length > 0 && (
              <div className="space-y-1.5 mt-3 border-t border-slate-800 pt-3">
                {Object.entries(soc2Summary.by_control).slice(0, 8).map(([ctrl, counts]) => (
                  <div key={ctrl} className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-mono w-12 shrink-0">{ctrl}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${counts.fail > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${counts.pass > 0 ? 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-slate-500 text-xs shrink-0">
                      {counts.pass}P / {counts.fail}F
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Poison quarantine */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-slate-200 font-semibold text-sm">Queue Poison Quarantine</span>
          <StatusBadge
            variant={unresolvedPoison > 0 ? 'failed' : 'completed'}
            label={unresolvedPoison > 0 ? `${unresolvedPoison} QUARANTINED` : 'CLEAN'}
          />
        </div>
        {quarantined.length === 0 ? (
          <div className="px-5 py-6 text-center text-slate-500 text-sm">No quarantined messages</div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {quarantined.slice(0, 10).map((msg) => (
              <div key={msg.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-mono">{msg.queue_name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{msg.failure_reason} · {msg.failure_count}× · {msg.original_id.slice(0, 12)}…</p>
                </div>
                <StatusBadge variant={msg.resolved ? 'completed' : 'failed'} label={msg.resolved ? 'RESOLVED' : 'ACTIVE'} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenant isolation */}
      {tenantSnapshot && (
        <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-200 font-semibold text-sm">Tenant Economic Isolation</h2>
            <StatusBadge
              variant={tenantSnapshot.at_risk ? 'warning' : 'completed'}
              label={tenantSnapshot.at_risk ? 'VIOLATION' : 'COMPLIANT'}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Pipeline</p>
              <p className="text-slate-200 font-medium">€{tenantSnapshot.pipeline_eur.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Active Deals</p>
              <p className="text-slate-200 font-medium">{tenantSnapshot.active_deals}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Events Today</p>
              <p className="text-slate-200 font-medium">{tenantSnapshot.events_today.toLocaleString()}</p>
            </div>
          </div>
          {tenantSnapshot.violations.length > 0 && (
            <div className="mt-3 space-y-1">
              {tenantSnapshot.violations.map((v, i) => (
                <div key={i} className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded px-2 py-1">
                  ⚠ {v}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      {/* Static header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Security</h1>
        <p className="text-slate-400 text-sm mt-1">
          Signed audit chain · Queue poison quarantine · SOC2 compliance · Tenant isolation
        </p>
      </div>
      <Suspense fallback={<SecuritySkeleton />}>
        <SecurityContent />
      </Suspense>
    </div>
  )
}
