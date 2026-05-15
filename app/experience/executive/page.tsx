// AGENCY GROUP — SH-ROS | AMI: 22506
// Executive Mode — Managing Directors and Partners
export const revalidate = 60

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KPI {
  label: string
  value: string
  sub: string
  delta?: string
  deltaPositive?: boolean
}

interface Opportunity {
  id: string
  name: string
  value: number
  stage: string
  urgency: 'critical' | 'high' | 'medium'
  reason: string
  agent: string
  daysOpen: number
}

// ─── Mock data (Portugal-calibrated) ──────────────────────────────────────────

const DATE_LABEL = 'Thursday, 15 May 2026'
const PIPELINE_STATUS = 'STRONG'

const kpis: KPI[] = [
  { label: 'Pipeline Value',    value: '€14.3M',  sub: '47 active deals',           delta: '+€2.1M',  deltaPositive: true  },
  { label: 'Commission MTD',    value: '€89,400', sub: '9 deals closed',             delta: '+18%',    deltaPositive: true  },
  { label: 'Hot Leads',         value: '23',      sub: 'score ≥ 80',                delta: '+5',      deltaPositive: true  },
  { label: 'Close Rate 30d',    value: '24.1%',   sub: 'vs 18% market avg',          delta: '+6.1pp',  deltaPositive: true  },
  { label: 'Deals Active',      value: '47',      sub: 'across all stages',          delta: '+3',      deltaPositive: true  },
  { label: 'Expected Revenue',  value: '€4.2M',   sub: 'risk-adjusted, 90d',         delta: '↑ trend', deltaPositive: true  },
]

const opportunities: Opportunity[] = [
  {
    id: 'opp-001',
    name: 'Quinta das Laranjeiras — Cascais',
    value: 2_850_000,
    stage: 'CPCV Pending',
    urgency: 'critical',
    reason: 'CPCV deadline in 48h. Buyer solicitor not yet confirmed. €142,500 commission at risk.',
    agent: 'Miguel Ferreira',
    daysOpen: 187,
  },
  {
    id: 'opp-002',
    name: 'Penthouse Príncipe Real — Lisboa',
    value: 1_920_000,
    stage: 'Offer Negotiation',
    urgency: 'high',
    reason: 'Competing offer received from Knight Frank. Price gap €40K. Counter-offer window closes Friday.',
    agent: 'Ana Costa',
    daysOpen: 94,
  },
  {
    id: 'opp-003',
    name: 'Golf Villa Vilamoura — Algarve',
    value: 1_450_000,
    stage: 'Second Viewing',
    urgency: 'medium',
    reason: 'American buyer family returning for second viewing Saturday. Pre-approval letter confirmed. High conversion probability.',
    agent: 'Pedro Santos',
    daysOpen: 41,
  },
]

const REVENUE_NARRATIVE = `Pipeline running 18% ahead of May forecast. 9 deals closed MTD generating €89,400 in commission. Critical: CPCV closure on Cascais Quinta required within 48 hours — delegate to Miguel Ferreira immediately.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v.toFixed(0)}`
}

const urgencyConfig = {
  critical: { bar: 'bg-red-500',    badge: 'bg-red-950/60 text-red-300 border-red-800/50',    label: 'CRITICAL' },
  high:     { bar: 'bg-orange-500', badge: 'bg-orange-950/60 text-orange-300 border-orange-800/50', label: 'HIGH'     },
  medium:   { bar: 'bg-blue-500',   badge: 'bg-blue-950/60 text-blue-300 border-blue-800/50',  label: 'WATCH'    },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutivePage() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Executive Mode</p>
          <h1 className="text-2xl font-bold text-white">Good morning, Carlos.</h1>
          <p className="text-sm text-slate-400 mt-0.5">{DATE_LABEL} · Agency Group Portugal</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-sm font-semibold">Pipeline: {PIPELINE_STATUS}</span>
        </div>
      </div>

      {/* Revenue Narrative */}
      <div className="bg-[#111118] border-l-4 border-blue-500 border border-slate-800 rounded-lg p-5">
        <p className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold mb-2">AI Revenue Narrative</p>
        <p className="text-slate-200 text-base leading-relaxed font-medium">&ldquo;{REVENUE_NARRATIVE}&rdquo;</p>
        <div className="mt-3 flex gap-4">
          <a href="/experience/digest" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View full forecast →
          </a>
          <a href="/experience/operator" className="text-xs text-slate-400 hover:text-slate-300 transition-colors">
            Delegate to operators →
          </a>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-[#111118] border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{kpi.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{kpi.value}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-slate-500 text-xs">{kpi.sub}</p>
              {kpi.delta && (
                <span className={`text-xs font-semibold ${kpi.deltaPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kpi.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Top Opportunities */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Opportunity Radar — Top 3
        </h2>
        <div className="space-y-3">
          {opportunities.map(opp => {
            const cfg = urgencyConfig[opp.urgency]
            return (
              <div key={opp.id} className="bg-[#111118] border border-slate-800 rounded-lg p-5 flex gap-4">
                <div className={`w-1 rounded-full flex-shrink-0 ${cfg.bar}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-slate-100 font-semibold text-sm">{opp.name}</h3>
                      <p className="text-slate-500 text-xs mt-0.5">{opp.agent} · {opp.daysOpen} days open · {opp.stage}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="text-white font-bold text-sm">{eur(opp.value)}</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">{opp.reason}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <a href="/experience/digest"    className="hover:text-slate-300 transition-colors">Full AI Digest →</a>
        <span className="text-slate-700">·</span>
        <a href="/experience/operator"  className="hover:text-slate-300 transition-colors">Operator Dashboard →</a>
        <span className="text-slate-700">·</span>
        <a href="/control-tower/revenue" className="hover:text-slate-300 transition-colors">Control Tower →</a>
      </div>

    </div>
  )
}
