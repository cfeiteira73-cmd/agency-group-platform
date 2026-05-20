// app/control-tower/economics/page.tsx
// Tenant Economics Dashboard — SH-ROS Control Tower
// Shows: cost breakdown, cost-to-revenue, quota status, upgrade triggers
// RSC — no 'use client'

import { Suspense } from 'react'
import { computeTenantCostBreakdown, detectUpgradeTrigger } from '@/lib/billing/costModelEngine'
import { aggregateTenantUsage } from '@/lib/billing/stripeReporter'

export const revalidate = 60

async function EconomicsContent() {
  const tenantId = 'agency-group'
  const [breakdown, usage] = await Promise.all([
    computeTenantCostBreakdown(tenantId).catch(() => null),
    aggregateTenantUsage(tenantId).catch(() => null),
  ])

  const upgrade = breakdown ? detectUpgradeTrigger(breakdown, 'unlimited') : null

  const marginColor = !breakdown?.margin_pct ? 'text-slate-500' :
    breakdown.margin_pct > 80 ? 'text-emerald-400' :
    breakdown.margin_pct > 50 ? 'text-amber-400' : 'text-red-400'

  return (
    <>
      {breakdown && (
        <p className="text-xs text-slate-600 font-mono">
          Source: usage_events + causal_trace · {breakdown.period_start?.slice(0, 10)} → {breakdown.period_end?.slice(0, 10)}
        </p>
      )}

      {/* Cost KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'AI Cost',     value: `€${breakdown?.ai_cost_eur?.toFixed(2)    ?? '—'}`, color: 'text-violet-300' },
          { label: 'Infra Cost',  value: `€${breakdown?.infra_cost_eur?.toFixed(2)  ?? '—'}`, color: 'text-blue-300' },
          { label: 'Total Cost',  value: `€${breakdown?.total_cost_eur?.toFixed(2)  ?? '—'}`, color: 'text-white' },
          { label: 'Margin',      value: breakdown?.margin_pct != null ? `${breakdown.margin_pct}%` : '—', color: marginColor },
        ].map(stat => (
          <div key={stat.label} className="bg-[#111118] border border-white/5 rounded-lg p-4">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}

        {/* Revenue vs Cost bar */}
        {breakdown?.revenue_eur != null && breakdown.total_cost_eur != null && (
          <div className="col-span-4 bg-[#111118] border border-white/5 rounded-lg p-4 mt-0">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Revenue vs Cost</span>
              <span className="font-mono">
                €{breakdown.revenue_eur.toFixed(2)} revenue · €{breakdown.total_cost_eur.toFixed(2)} cost
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
              {breakdown.revenue_eur > 0 && (
                <>
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (breakdown.total_cost_eur / breakdown.revenue_eur) * 100)}%` }}
                    title="Cost"
                  />
                  <div
                    className="h-full bg-blue-500/40"
                    style={{ width: `${Math.max(0, 100 - (breakdown.total_cost_eur / breakdown.revenue_eur) * 100)}%` }}
                    title="Net margin"
                  />
                </>
              )}
            </div>
            <div className="flex gap-4 mt-1.5">
              <span className="text-[10px] text-slate-500 flex items-center gap-1"><span className="inline-block w-2 h-1.5 bg-emerald-500 rounded" />Cost</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1"><span className="inline-block w-2 h-1.5 bg-blue-500/40 rounded" />Net margin</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Cost breakdown */}
        <div className="bg-[#111118] border border-white/5 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Cost Breakdown</h2>
          <div className="space-y-3">
            {breakdown ? (
              [
                ['AI Tokens (input)',  breakdown.ai_tokens_input.toLocaleString()],
                ['AI Tokens (output)', breakdown.ai_tokens_output.toLocaleString()],
                ['API Calls',         breakdown.api_calls.toLocaleString()],
                ['WhatsApp Messages', breakdown.whatsapp_messages.toLocaleString()],
                ['Emails Sent',       breakdown.emails_sent.toLocaleString()],
                ['Automation Runs',   breakdown.automation_runs.toLocaleString()],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-300 font-mono">{value}</span>
              </div>
            )) : (
              <p className="text-xs text-slate-600">No data available</p>
            )}
          </div>
        </div>

        {/* Usage stats */}
        <div className="bg-[#111118] border border-white/5 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Usage Summary</h2>
          {usage ? (
            <div className="space-y-3">
              {(
                [
                  ['AI Tokens',        (usage.ai_tokens_total ?? 0).toLocaleString()],
                  ['API Calls',        (usage.api_calls_total ?? 0).toLocaleString()],
                  ['Automation Runs',  (usage.automation_runs ?? 0).toLocaleString()],
                  ['WhatsApp',         (usage.whatsapp_messages ?? 0).toLocaleString()],
                  ['Deal Packs',       (usage.deal_packs_gen ?? 0).toLocaleString()],
                  ['Est. Cost',        `€${(usage.estimated_cost_eur ?? 0).toFixed(4)}`],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-300">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Usage data unavailable</p>
          )}
        </div>
      </div>

      {/* Upgrade trigger */}
      {upgrade?.should_upgrade && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-sm font-bold">Upgrade Trigger Detected</span>
          </div>
          <p className="text-xs text-amber-300">{upgrade.reason}</p>
          <p className="text-xs text-amber-400/60 mt-1">Recommended plan: <strong>{upgrade.recommended_plan}</strong></p>
        </div>
      )}

      {/* Revenue vs cost */}
      <div className="bg-[#111118] border border-white/5 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Revenue vs Cost (current month)</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold text-emerald-400">€{breakdown?.revenue_eur?.toLocaleString() ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Revenue (from causal trace)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">€{breakdown?.total_cost_eur?.toFixed(2) ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Total Cost</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${marginColor}`}>
              {breakdown?.margin_pct != null ? `${breakdown.margin_pct}%` : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">Gross Margin</div>
          </div>
        </div>
      </div>
    </>
  )
}

function EconomicsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-10 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 gap-6">
        <div className="h-56 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
        <div className="h-56 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
      </div>
      <div className="h-32 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
    </>
  )
}

export default function EconomicsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      {/* Header — renders immediately */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500 uppercase tracking-widest">SH-ROS Control Tower</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Tenant Economics</h1>
        <p className="text-sm text-slate-400 mt-1">Cost model · revenue · margins · quota · {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Data streams in */}
      <Suspense fallback={<EconomicsSkeleton />}>
        <EconomicsContent />
      </Suspense>
    </div>
  )
}
