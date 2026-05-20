// app/control-tower/tenants/page.tsx
// Tenant Management — Control Tower
// RSC — reads tenants directly from Supabase

import { Suspense } from 'react'
import { listTenants } from '@/lib/tenant/registry'
import { getPlanFeatures } from '@/lib/tenant/planConfig'
import { getTenantBudgetStatus } from '@/lib/ai/tokenGovernor'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'

export const revalidate = 60

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  suspended: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const PLAN_COLORS: Record<string, string> = {
  unlimited:  'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  enterprise: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  growth:     'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  starter:    'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

type BudgetStatus = Awaited<ReturnType<typeof getTenantBudgetStatus>>

function TenantsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-white/5 animate-pulse" />
        ))}
      </div>
      <div className="bg-[#111118] border border-white/5 rounded-lg overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 border-b border-white/5 bg-[#1A1A24] animate-pulse" />
        ))}
      </div>
    </div>
  )
}

async function TenantsContent() {
  const tenants = await listTenants().catch(() => [])

  const budgetResults = await Promise.allSettled(
    tenants.map(t => getTenantBudgetStatus(t.id ?? t.slug, t.plan ?? 'starter'))
  )

  const budgetMap = new Map<string, BudgetStatus>()
  tenants.forEach((t, i) => {
    const result = budgetResults[i]
    if (result.status === 'fulfilled') {
      budgetMap.set(t.id ?? t.slug, result.value)
    }
  })

  const totalActive    = tenants.filter(t => t.status === 'active').length
  const enterprisePlus = tenants.filter(t => t.plan === 'enterprise' || t.plan === 'unlimited').length

  return (
    <>
      <p className="text-sm text-slate-400 -mt-6 mb-6">Multi-tenant SaaS registry — {tenants.length} tenants</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Tenants',    value: tenants.length,   color: 'text-white' },
          { label: 'Active',           value: totalActive,      color: 'text-emerald-400' },
          { label: 'Enterprise+',      value: enterprisePlus,   color: 'text-violet-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#111118] border border-white/5 rounded-lg p-4">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tenant list */}
      <div className="bg-[#111118] border border-white/5 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">All Tenants</h2>
          <span className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">Economics</span>
        </div>
        {tenants.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 text-sm">
            No tenants found. Run <code className="text-violet-400">ensureDefaultTenant()</code> to bootstrap.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tenants.map(tenant => {
              const features = getPlanFeatures(tenant.plan)
              const budget = budgetMap.get(tenant.id ?? tenant.slug)
              const barColor = !budget
                ? 'bg-slate-600'
                : budget.pct_used >= 95
                  ? 'bg-red-500'
                  : budget.pct_used >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              return (
                <div key={tenant.slug} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold uppercase">
                      {tenant.slug.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{tenant.name}</div>
                      <div className="text-xs text-slate-500">{tenant.slug} · {tenant.owner_email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Token Budget */}
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      {budget ? (
                        <>
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              variant={budget.status === 'healthy' ? 'ok' : budget.status}
                              size="xs"
                            />
                            <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                              {budget.tokens_used.toLocaleString()} / {budget.tokens_limit === -1 ? '∞' : budget.tokens_limit.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all`}
                              style={{ width: `${Math.min(budget.pct_used, 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[tenant.plan] ?? ''}`}>
                      {tenant.plan}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[tenant.status] ?? ''}`}>
                      {tenant.status}
                    </span>
                    <div className="text-xs text-slate-600">
                      {features.crmContacts === -1 ? '∞' : features.crmContacts.toLocaleString()} contacts
                    </div>
                    <div className="text-xs text-slate-600">
                      {new Date(tenant.created_at).toLocaleDateString('en-GB')}
                    </div>
                    <a
                      href={`/control-tower/economics/${tenant.id ?? tenant.slug}`}
                      className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                    >
                      Econ →
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Feature matrix */}
      <div className="mt-6 bg-[#111118] border border-white/5 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-slate-300">Plan Feature Matrix</h2>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-xs text-slate-400">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left pb-3 pr-8">Feature</th>
                {(['starter','growth','enterprise','unlimited'] as const).map(p => (
                  <th key={p} className="text-center pb-3 px-4">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {([
                ['AI Agents',         'aiAgents'],
                ['AI Streaming',      'aiStreaming'],
                ['AI Memory',         'aiMemory'],
                ['Causal Trace',      'causalTrace'],
                ['Event Replay',      'eventReplay'],
                ['Vault Access',      'vaultAccess'],
                ['Audit Log',         'auditLog'],
                ['WhatsApp',          'whatsappIntegration'],
                ['n8n Webhooks',      'n8nWebhooks'],
                ['Policy Tuning',     'policyTuning'],
              ] as const).map(([label, key]) => (
                <tr key={key}>
                  <td className="py-2 pr-8 text-slate-500">{label}</td>
                  {(['starter','growth','enterprise','unlimited'] as const).map(planId => {
                    const features = getPlanFeatures(planId)
                    const val = features[key as keyof typeof features]
                    return (
                      <td key={planId} className="text-center py-2 px-4">
                        {val === true ? (
                          <span className="text-emerald-400">✓</span>
                        ) : val === false ? (
                          <span className="text-slate-700">—</span>
                        ) : (
                          <span className="text-slate-300">{String(val)}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default function TenantsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 font-mono">
      {/* Static header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs text-slate-500 uppercase tracking-widest">SH-ROS Control Tower</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Tenant Management</h1>
      </div>
      <Suspense fallback={<TenantsSkeleton />}>
        <TenantsContent />
      </Suspense>
    </div>
  )
}
