// AGENCY GROUP — Control Tower: Infrastructure Dependencies | AMI: 22506
// SPOF analysis · sovereignty score · fallback coverage

import { KPICard }    from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'
import {
  computeInfraOwnershipScore,
  type InfraDependency,
  type DependencyTier,
  type DependencyCategory,
} from '@/lib/reality/infraDependencyGraph'

export const revalidate = 60

// ─── Category icons ───────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<DependencyCategory, string> = {
  database:   '🗄',
  cache:      '⚡',
  ai:         '🤖',
  auth:       '🔐',
  messaging:  '✉',
  cdn:        '🌐',
  monitoring: '📊',
  automation: '⚙',
  runtime:    '☁',
  scraping:   '🕷',
  payments:   '💳',
  media:      '🎬',
  crm:        '📋',
}

// ─── Tier badge variant mapping ───────────────────────────────────────────────

const TIER_VARIANT = {
  critical: 'critical',
  high:     'high',
  medium:   'medium',
  low:      'low',
} as const satisfies Record<DependencyTier, 'critical' | 'high' | 'medium' | 'low'>

const TIER_ORDER: DependencyTier[] = ['critical', 'high', 'medium', 'low']

// ─── Classification label ─────────────────────────────────────────────────────

const CLASSIFICATION_LABEL: Record<string, string> = {
  self_sovereign: 'Self-Sovereign',
  hardened:       'Hardened',
  resilient:      'Resilient',
  fragile:        'Fragile',
}

const CLASSIFICATION_COLOR: Record<string, string> = {
  self_sovereign: 'text-emerald-400',
  hardened:       'text-green-400',
  resilient:      'text-amber-400',
  fragile:        'text-red-400',
}

// ─── Score bar color ──────────────────────────────────────────────────────────

function scoreBarColor(score: number): string {
  if (score > 90) return 'bg-emerald-500'
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

// ─── InfraContent (RSC) ───────────────────────────────────────────────────────

async function InfraContent() {
  const report = await computeInfraOwnershipScore(false)

  const {
    score,
    classification,
    total_deps,
    spof_count,
    configured_pct,
    dependencies,
    risk_factors,
    recommendations,
  } = report

  const spofs           = dependencies.filter(d => d.spof)
  const verifiedFallbacks = dependencies.filter(d => d.fallback !== null && d.configured)
  const unconfigured    = dependencies.filter(d => !d.configured)

  // Group by tier in defined order
  const byTier: Record<DependencyTier, InfraDependency[]> = {
    critical: [],
    high:     [],
    medium:   [],
    low:      [],
  }
  for (const dep of dependencies) {
    byTier[dep.tier].push(dep)
  }

  // Score breakdown
  const spofPenalty     = spofs.filter(s => s.ownership === 'external_managed').length * 25
  const criticalPenalty = dependencies.filter(d => d.tier === 'critical' && !d.configured).length * 10
  const highPenalty     = dependencies.filter(d => d.tier === 'high'     && !d.configured).length * 5
  const fallbackBonus   = Math.min(verifiedFallbacks.filter(d => d.ownership !== 'internal').length * 5, 30)

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Infrastructure Dependencies</h1>
        <p className="text-slate-400 text-sm mt-1">
          SPOF analysis · sovereignty score · fallback coverage
        </p>
      </div>

      {/* ── SPOF Alert Banner ── */}
      {spofs.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-400 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-300">
              {spofs.length} Single Point{spofs.length > 1 ? 's' : ''} of Failure Detected
            </p>
            <p className="text-xs text-red-400 mt-1">
              {spofs.map(s => s.name).join(' · ')} — no fallback configured
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Sovereignty Score"
          value={`${score}/100`}
          sub={CLASSIFICATION_LABEL[classification]}
          color={score > 90 ? 'green' : score >= 70 ? 'green' : score >= 50 ? 'amber' : 'red'}
        />
        <KPICard
          title="SPOF Count"
          value={spof_count}
          sub={spof_count > 0 ? 'critical risk' : 'no single points of failure'}
          color={spof_count > 0 ? 'red' : 'green'}
        />
        <KPICard
          title="Verified Fallbacks"
          value={verifiedFallbacks.length}
          sub={`of ${total_deps} dependencies`}
          color={verifiedFallbacks.length >= total_deps / 2 ? 'green' : 'amber'}
        />
        <KPICard
          title="Unconfigured"
          value={unconfigured.length}
          sub={`${configured_pct}% configured`}
          color={unconfigured.length === 0 ? 'green' : unconfigured.length <= 3 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Sovereignty Score Breakdown ── */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-5">
        <h2 className="text-slate-200 font-semibold text-sm mb-4">Sovereignty Score Breakdown</h2>

        {/* Score bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-3xl font-bold tabular-nums ${CLASSIFICATION_COLOR[classification]}`}>
              {score}
            </span>
            <span className={`text-sm font-semibold ${CLASSIFICATION_COLOR[classification]}`}>
              {CLASSIFICATION_LABEL[classification]}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Computation steps */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400">Base score</span>
            <span className="text-slate-200 font-mono">+100</span>
          </div>
          {spofPenalty > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">
                SPOF penalties
                <span className="text-slate-600 text-xs ml-2">
                  ({spofs.filter(s => s.ownership === 'external_managed').length} × −25pts)
                </span>
              </span>
              <span className="text-red-400 font-mono">−{spofPenalty}</span>
            </div>
          )}
          {criticalPenalty > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">
                Unconfigured critical deps
                <span className="text-slate-600 text-xs ml-2">
                  ({dependencies.filter(d => d.tier === 'critical' && !d.configured).length} × −10pts)
                </span>
              </span>
              <span className="text-red-400 font-mono">−{criticalPenalty}</span>
            </div>
          )}
          {highPenalty > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">
                Unconfigured high deps
                <span className="text-slate-600 text-xs ml-2">
                  ({dependencies.filter(d => d.tier === 'high' && !d.configured).length} × −5pts)
                </span>
              </span>
              <span className="text-red-400 font-mono">−{highPenalty}</span>
            </div>
          )}
          {fallbackBonus > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">
                Verified fallback bonus
                <span className="text-slate-600 text-xs ml-2">(capped at +30)</span>
              </span>
              <span className="text-emerald-400 font-mono">+{fallbackBonus}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 mt-1">
            <span className="text-slate-200 font-semibold">Final score</span>
            <span className={`text-xl font-bold font-mono ${CLASSIFICATION_COLOR[classification]}`}>
              {score}/100
            </span>
          </div>
        </div>
      </div>

      {/* ── Dependencies Table ── */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-slate-200 font-semibold text-sm">All Dependencies</span>
          <span className="text-slate-500 text-xs font-mono">{total_deps} services</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800/50">
                <th className="px-4 py-2.5 text-left font-medium">Service</th>
                <th className="px-4 py-2.5 text-left font-medium">Category</th>
                <th className="px-4 py-2.5 text-left font-medium">Tier</th>
                <th className="px-4 py-2.5 text-center font-medium">SPOF</th>
                <th className="px-4 py-2.5 text-left font-medium">Fallback</th>
                <th className="px-4 py-2.5 text-center font-medium">Configured</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ORDER.flatMap(tier =>
                byTier[tier].map((dep, i) => (
                  <tr
                    key={`${tier}-${i}`}
                    className={`border-b border-slate-800/30 hover:bg-[#1A1A24] transition-colors ${
                      dep.spof ? 'bg-red-950/10' : ''
                    }`}
                  >
                    {/* Service */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{CATEGORY_ICON[dep.category]}</span>
                        <div>
                          <p className="text-slate-200 font-medium">{dep.name}</p>
                          <p className="text-slate-600 text-[10px] mt-0.5 max-w-[180px] truncate" title={dep.description}>
                            {dep.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-2.5">
                      <span className="text-slate-400 font-mono capitalize">{dep.category}</span>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-2.5">
                      <StatusBadge variant={TIER_VARIANT[dep.tier]} label={dep.tier.toUpperCase()} size="xs" />
                    </td>

                    {/* SPOF */}
                    <td className="px-4 py-2.5 text-center">
                      {dep.spof
                        ? <span className="text-red-400 text-base" title="Single point of failure">🔴</span>
                        : <span className="text-slate-700">—</span>
                      }
                    </td>

                    {/* Fallback */}
                    <td className="px-4 py-2.5 max-w-[240px]">
                      {dep.fallback
                        ? <span className="text-slate-400 text-[11px] leading-snug line-clamp-2" title={dep.fallback}>{dep.fallback}</span>
                        : <span className="text-red-500 font-medium">None</span>
                      }
                    </td>

                    {/* Configured */}
                    <td className="px-4 py-2.5 text-center">
                      {dep.configured
                        ? <span className="text-emerald-400 text-base" title="All env vars present">✅</span>
                        : <span className="text-red-400 text-base" title={`Missing: ${dep.env_vars.filter(() => true).join(', ')}`}>❌</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Risk Factors & Recommendations ── */}
      {(risk_factors.length > 0 || recommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Risk factors */}
          {risk_factors.length > 0 && (
            <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-4">
              <h3 className="text-slate-200 font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="text-red-400">⚠</span> Risk Factors
              </h3>
              <ul className="space-y-1.5">
                {risk_factors.map((rf, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="text-red-500 shrink-0 mt-0.5">•</span>
                    <span>{rf}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-4">
              <h3 className="text-slate-200 font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="text-blue-400">→</span> Recommendations
              </h3>
              <ul className="space-y-1.5">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Footer timestamp ── */}
      <p className="text-[10px] text-slate-700 font-mono text-right">
        generated_at: {report.generated_at}
      </p>
    </div>
  )
}

// ─── Skeleton (used by loading.tsx) ──────────────────────────────────────────

export function InfraSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-56 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-80 bg-[#1A1A24] rounded animate-pulse" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>

      {/* Score breakdown */}
      <div className="h-48 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

      {/* Table */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
        <div className="h-10 border-b border-slate-800 animate-pulse bg-[#1A1A24]" />
        <div className="space-y-0">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-12 border-b border-slate-800/30 animate-pulse"
              style={{ animationDelay: `${i * 50}ms`, background: i % 2 === 0 ? '#0F0F17' : '#111118' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

import { Suspense } from 'react'

export default function InfraPage() {
  return (
    <Suspense fallback={<InfraSkeleton />}>
      <InfraContent />
    </Suspense>
  )
}
