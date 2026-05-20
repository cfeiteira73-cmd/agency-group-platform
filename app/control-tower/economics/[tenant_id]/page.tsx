// app/control-tower/economics/[tenant_id]/page.tsx
// Per-Tenant Economics Drill-Down — SH-ROS Control Tower
// RSC — no 'use client'
//
// Displays: cost/day, cost/request, revenue/request, margin,
//           efficiency score, cost breakdown bars, volume metrics,
//           efficiency signal + action banners.
//
// TypeScript strict — 0 errors

import { Suspense } from 'react'
import { computeTenantEconomics, type TenantEconomics } from '@/lib/billing/costModelEngine'
import { KPICard } from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'

export const revalidate = 60

// ─── Helpers ──────────────────────────────────────────────────────────────────

function costPerDayColor(v: number): 'red' | 'amber' | 'green' {
  if (v > 5) return 'red'
  if (v > 1) return 'amber'
  return 'green'
}

function marginColor(v: number): 'green' | 'amber' | 'red' {
  if (v >= 60) return 'green'
  if (v >= 0)  return 'amber'
  return 'red'
}

function efficiencyColor(v: number): 'green' | 'amber' | 'red' {
  if (v >= 70) return 'green'
  if (v >= 40) return 'amber'
  return 'red'
}

function efficiencyVariant(v: number): 'ok' | 'warning' | 'critical' {
  if (v >= 70) return 'ok'
  if (v >= 40) return 'warning'
  return 'critical'
}

function fmt6(n: number): string {
  // Show 6 significant decimal places for micro-EUR values
  if (n === 0) return '€0'
  if (n >= 0.01) return `€${n.toFixed(4)}`
  return `€${n.toFixed(6)}`
}

function barWidth(cost: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.min(100, Math.round((cost / total) * 100))}%`
}

function barPct(cost: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((cost / total) * 100)}%`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function EconomicsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header meta */}
      <div className="space-y-2">
        <div className="h-3 w-40 bg-zinc-800/60 rounded" />
        <div className="h-6 w-72 bg-zinc-800/50 rounded" />
        <div className="h-3 w-56 bg-zinc-800/40 rounded" />
      </div>

      {/* Row 1: 6 KPI cards */}
      <div className="grid grid-cols-6 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-zinc-800/50 rounded-xl" />
        ))}
      </div>

      {/* Row 2: 3 panels */}
      <div className="grid grid-cols-3 gap-6">
        <div className="h-52 bg-zinc-800/40 rounded-lg" />
        <div className="h-52 bg-zinc-800/40 rounded-lg" />
        <div className="h-52 bg-zinc-800/40 rounded-lg" />
      </div>

      {/* Row 3: action banners */}
      <div className="space-y-3">
        <div className="h-16 bg-zinc-800/30 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Async content (does all DB work) ────────────────────────────────────────

interface EconomicsContentProps {
  tenantId: string
}

async function EconomicsContent({ tenantId }: EconomicsContentProps) {
  const period = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  let econ: TenantEconomics | null = null
  let fetchError = false

  try {
    econ = await computeTenantEconomics(tenantId)
  } catch {
    fetchError = true
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (fetchError || !econ) {
    return (
      <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-lg p-5">
        <p className="text-amber-300 text-sm font-medium">Economics data unavailable — check SUPABASE env vars.</p>
        <p className="text-amber-400/60 text-xs mt-1">
          Ensure <code className="text-amber-300">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="text-amber-300">SUPABASE_SERVICE_ROLE_KEY</code> are set.
        </p>
      </div>
    )
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const totalCost    = econ.total_cost_eur
  const aiPct        = barPct(econ.ai_cost_eur,      totalCost)
  const infraPct     = barPct(econ.infra_cost_eur,   totalCost)
  const storagePct   = barPct(econ.storage_cost_eur, totalCost)

  const effScore     = econ.efficiency_score
  const effColorCls  = effScore >= 70 ? 'text-green-400' : effScore >= 40 ? 'text-amber-400' : 'text-red-400'

  return (
    <>
      {/* Header meta (data-dependent timestamps) */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs text-slate-500 uppercase tracking-widest">SH-ROS Control Tower</span>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Cost · Revenue · Efficiency · Period:{' '}
          <span className="text-slate-300">{period}</span>
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          Computed at {new Date(econ.computed_at).toLocaleString('en-GB')} · {econ.period_days} days
        </p>
      </div>

      {/* ── Row 1: Core Economics KPIs ────────────────────────────────────────── */}
      <div className="grid grid-cols-6 lg:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="Cost / Day"
          value={`€${econ.cost_per_day.toFixed(4)}`}
          sub="EUR per calendar day"
          color={costPerDayColor(econ.cost_per_day)}
          mono
        />
        <KPICard
          title="Cost / Request"
          value={fmt6(econ.cost_per_request)}
          sub="micro-EUR per API call"
          color={econ.cost_per_request > 0.01 ? 'amber' : 'green'}
          mono
        />
        <KPICard
          title="Revenue / Request"
          value={fmt6(econ.revenue_per_request)}
          sub="EUR attributed per call"
          color={econ.revenue_per_request > 0 ? 'green' : 'default'}
          mono
        />
        <KPICard
          title="Margin"
          value={`${econ.margin.toFixed(1)}%`}
          sub="(revenue − cost) / revenue"
          color={marginColor(econ.margin)}
          mono
        />
        <KPICard
          title="Efficiency Score"
          value={`${econ.efficiency_score}/100`}
          sub="composite: margin + revenue + cost/req"
          color={efficiencyColor(econ.efficiency_score)}
          mono
        />
        <KPICard
          title="Period Days"
          value={econ.period_days}
          sub="days in measurement window"
          color="default"
          mono
        />
      </div>

      {/* ── Row 2: Cost Breakdown · Volume · Efficiency ───────────────────────── */}
      <div className="grid grid-cols-3 gap-6 mb-6">

        {/* Left: Cost Breakdown bars */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Cost Breakdown</h2>
          <div className="space-y-4">

            {/* AI Cost */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-purple-300">AI Cost</span>
                <span className="font-mono text-slate-300">
                  €{econ.ai_cost_eur.toFixed(4)} <span className="text-slate-500">({aiPct})</span>
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: barWidth(econ.ai_cost_eur, totalCost) }}
                />
              </div>
            </div>

            {/* Infra Cost */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-300">Infra Cost</span>
                <span className="font-mono text-slate-300">
                  €{econ.infra_cost_eur.toFixed(4)} <span className="text-slate-500">({infraPct})</span>
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: barWidth(econ.infra_cost_eur, totalCost) }}
                />
              </div>
            </div>

            {/* Storage Cost */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Storage Cost</span>
                <span className="font-mono text-slate-300">
                  €{econ.storage_cost_eur.toFixed(4)} <span className="text-slate-500">({storagePct})</span>
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500 rounded-full"
                  style={{ width: barWidth(econ.storage_cost_eur, totalCost) }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between text-xs">
              <span className="text-slate-500">Total Cost</span>
              <span className="font-mono text-white font-bold">€{totalCost.toFixed(4)}</span>
            </div>
          </div>
        </div>

        {/* Middle: Volume Metrics */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Volume Metrics</h2>
          <div className="space-y-3">
            {(
              [
                ['API Calls',       econ.api_calls.toLocaleString()],
                ['Revenue Total',   `€${econ.revenue_eur.toFixed(2)}`],
                ['Total Cost',      `€${econ.total_cost_eur.toFixed(2)}`],
                ['AI Cost',         `€${econ.ai_cost_eur.toFixed(4)}`],
                ['Infra Cost',      `€${econ.infra_cost_eur.toFixed(4)}`],
                ['Storage Cost',    `€${econ.storage_cost_eur.toFixed(4)}`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="font-mono text-slate-300">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Efficiency Signal */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Efficiency Signal</h2>

          {/* Big score number */}
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className={`text-7xl font-bold font-mono leading-none ${effColorCls}`}>
              {effScore}
            </div>
            <div className="text-slate-500 text-xs mt-2">out of 100</div>
            <div className="mt-3">
              <StatusBadge variant={efficiencyVariant(effScore)} size="sm" />
            </div>
          </div>

          {/* Score interpretation */}
          <div className="border-t border-slate-800 pt-4 space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Score Interpretation</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-slate-400"><span className="text-green-400 font-mono">70–100</span> Profitable</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="text-slate-400"><span className="text-amber-400 font-mono">40–69</span> Marginal</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-slate-400"><span className="text-red-400 font-mono">0–39</span> Critical</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Row 3: Action Banners ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {econ.margin < 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
            <span className="text-amber-400 text-lg leading-none mt-0.5">⚠</span>
            <div>
              <p className="text-amber-300 text-sm font-semibold">Cost exceeds revenue — consider haiku model routing</p>
              <p className="text-amber-400/60 text-xs mt-0.5">
                Margin is {econ.margin.toFixed(1)}%. Route non-critical flows to claude-haiku to reduce AI cost.
              </p>
            </div>
          </div>
        )}

        {econ.efficiency_score < 40 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-400 text-lg leading-none mt-0.5">⛔</span>
            <div>
              <p className="text-red-300 text-sm font-semibold">Critical inefficiency — AI routing throttle recommended</p>
              <p className="text-red-400/60 text-xs mt-0.5">
                Efficiency score is {econ.efficiency_score}/100. Enable token budget throttling in tokenGovernor.
              </p>
            </div>
          </div>
        )}

        {econ.efficiency_score >= 70 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-3">
            <span className="text-emerald-400 text-lg leading-none mt-0.5">✓</span>
            <div>
              <p className="text-emerald-300 text-sm font-semibold">Economically healthy — no action required</p>
              <p className="text-emerald-400/60 text-xs mt-0.5">
                Efficiency score {econ.efficiency_score}/100, margin {econ.margin.toFixed(1)}%. Operating within healthy parameters.
              </p>
            </div>
          </div>
        )}

        {/* Fallback: marginal but not critical */}
        {econ.efficiency_score >= 40 && econ.efficiency_score < 70 && econ.margin >= 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
            <span className="text-amber-400 text-lg leading-none mt-0.5">◈</span>
            <div>
              <p className="text-amber-300 text-sm font-semibold">Marginal efficiency — monitor closely</p>
              <p className="text-amber-400/60 text-xs mt-0.5">
                Efficiency score {econ.efficiency_score}/100. Consider optimising AI model selection and reducing automation overhead.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { tenant_id: string }
}

export default function TenantEconomicsPage({ params }: Props) {
  const tenantId = params.tenant_id

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 font-mono">
      {/* Back link */}
      <a
        href="/control-tower/tenants"
        className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 mb-6 transition-colors"
      >
        ← All Tenants
      </a>

      {/* Header (static — renders immediately) */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white">Economics: {tenantId}</h1>
      </div>

      {/* Async content with Suspense */}
      <Suspense fallback={<EconomicsSkeleton />}>
        <EconomicsContent tenantId={tenantId} />
      </Suspense>
    </div>
  )
}
