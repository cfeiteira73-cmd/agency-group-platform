// AGENCY GROUP — SH-ROS | AMI: 22506
// AI Digest Mode — Morning briefing
export const revalidate = 3600

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ForecastScenario {
  label: string
  probability: number
  expectedRevenue: number
  commission: number
  color: string
  bgColor: string
  driver: string
}

interface Recommendation {
  number: number
  title: string
  body: string
  impact: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DATE_DISPLAY   = 'Thursday, 15 May 2026'
const GENERATED_TIME = '07:00 WET'
const NEXT_DIGEST_H  = 22

const HEADLINE = 'Pipeline €14.3M — CPCV closure window open. Critical action required before Friday.'

const NARRATIVE_PARAGRAPHS = [
  `Pipeline Story: Agency Group Portugal enters mid-May with a strong €14.3M active pipeline across 47 deals. 9 deals have closed month-to-date generating €89,400 in gross commission — tracking 18% above May forecast. The Cascais Quinta das Laranjeiras (€2.85M) is the highest-leverage deal in the portfolio: CPCV documentation is ready, buyer finance confirmed, but solicitor assignment remains unresolved. Every 24-hour delay at this stage carries statistical risk of deal collapse. Escalation is required today.`,

  `Momentum Story: Close rate for the rolling 30-day window stands at 24.1% against a Portugal market average of 18.0% — a 6.1 percentage point advantage that translates directly into commission yield per lead. Hot lead volume increased by 5 this week to 23 qualified leads scoring ≥80. Two new Gulf-segment prospects entered the pipeline (combined expected value €3.35M) driven by a Madeira Golden Visa inquiry. The Vilamoura Golf Villa second viewing is confirmed for Saturday — buyer has pre-approval at 110% of asking price. Probability of offer within 7 days: 74%.`,

  `Outlook: The 30-day forecast base case is €4.2M in expected transaction volume (risk-adjusted). If the Cascais CPCV completes this week and the Vilamoura offer materialises, the upside scenario (€5.8M) is reachable within 20 business days. Demand signals from North American and French buyer segments remain elevated — May historically sees a 12% uptick in foreign buyer activity as summer approaches. Recommend focusing agent capacity on lead scores ≥80 and pipeline deals with decision timelines inside 30 days.`,
]

const forecastScenarios: ForecastScenario[] = [
  {
    label: 'Base Case',
    probability: 0.60,
    expectedRevenue: 4_200_000,
    commission: 210_000,
    color: 'text-blue-300',
    bgColor: 'bg-blue-950/30 border-blue-800/40',
    driver: 'Cascais CPCV closes + 3 additional deals in pipeline',
  },
  {
    label: 'Upside',
    probability: 0.25,
    expectedRevenue: 5_800_000,
    commission: 290_000,
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-950/30 border-emerald-800/40',
    driver: 'Vilamoura offer + Príncipe Real counter-offer accepted + Gulf lead conversion',
  },
  {
    label: 'Downside',
    probability: 0.15,
    expectedRevenue: 2_600_000,
    commission: 130_000,
    color: 'text-red-300',
    bgColor: 'bg-red-950/30 border-red-800/40',
    driver: 'CPCV falls through + 2 long-cycle deals stall beyond 30-day window',
  },
]

const recommendations: Recommendation[] = [
  {
    number: 1,
    title: 'Resolve Cascais CPCV solicitor assignment within 24 hours',
    body: 'Assign a qualified solicitor to the Quinta das Laranjeiras transaction immediately. The 48-hour window before CPCV expiry is the critical risk factor in this pipeline. Failure to close this deal would reduce MTD commission by €142,500 and shift May performance from above-forecast to below.',
    impact: '€142,500 at risk',
  },
  {
    number: 2,
    title: 'Approve counter-offer on Penthouse Príncipe Real by Friday',
    body: 'A competing offer from Knight Frank closes the buyer\'s window on Friday. The price gap is €40,000 — within acceptable negotiating range given the deal value of €1.92M. Authorise Ana Costa to submit a counter at €1,880,000. Net commission impact of resolving: €96,000.',
    impact: '€96,000 opportunity',
  },
  {
    number: 3,
    title: 'Activate Gulf buyer segment with Madeira + Golden Visa package',
    body: 'Two Gulf-segment HNWIs have entered the pipeline via Madeira Golden Visa inquiry. Assign a dedicated concierge brief covering Madeira (€3,760/m²), residency timeline (5 years), and comparable transactions. Gulf buyers at this wealth tier average €1.2M deal size. Proactive engagement within 48 hours increases conversion probability by 34% per historical data.',
    impact: '+34% conversion uplift',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v.toFixed(0)}`
}

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DigestPage() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">AI Digest · Daily Briefing</p>
          <h1 className="text-2xl font-bold text-white">Good morning.</h1>
          <p className="text-sm text-slate-400 mt-0.5">{DATE_DISPLAY} · Generated at {GENERATED_TIME}</p>
        </div>
        <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-800/40 px-3 py-1.5 rounded-full font-mono">
          AI-GENERATED
        </span>
      </div>

      {/* Headline */}
      <div className="bg-[#111118] border border-slate-700 rounded-xl p-6">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Today&apos;s Headline</p>
        <p className="text-xl font-bold text-white leading-snug">{HEADLINE}</p>
      </div>

      {/* Revenue Narrative */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Revenue Narrative</h2>
        {NARRATIVE_PARAGRAPHS.map((para, i) => {
          const [label, ...rest] = para.split(': ')
          return (
            <p key={i} className="text-slate-400 text-sm leading-relaxed">
              <span className="text-slate-200 font-semibold">{label}: </span>
              {rest.join(': ')}
            </p>
          )
        })}
      </div>

      {/* Forecast Scenarios */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Forecast Scenarios — 30-Day
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/50">
                <th className="text-left py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">Scenario</th>
                <th className="text-right py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">Probability</th>
                <th className="text-right py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">Transaction Vol.</th>
                <th className="text-right py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">Commission</th>
                <th className="text-left py-2 pl-4 text-xs text-slate-500 font-medium uppercase tracking-wide">Key Driver</th>
              </tr>
            </thead>
            <tbody>
              {forecastScenarios.map(s => (
                <tr key={s.label} className="border-b border-slate-800/20">
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${s.bgColor} ${s.color}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className={`py-3 text-right font-bold ${s.color}`}>{pct(s.probability)}</td>
                  <td className="py-3 text-right text-white font-bold">{eur(s.expectedRevenue)}</td>
                  <td className="py-3 text-right text-emerald-400 font-semibold">{eur(s.commission)}</td>
                  <td className="py-3 pl-4 text-slate-500 text-xs">{s.driver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Probability-weighted expected commission: {eur(
            forecastScenarios.reduce((s, sc) => s + sc.probability * sc.commission, 0)
          )} · λ=0.95 attribution model · Portugal 210-day cycle calibration
        </p>
      </div>

      {/* Strategic Recommendations */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Strategic Recommendations
        </h2>
        <div className="space-y-4">
          {recommendations.map(rec => (
            <div key={rec.number} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                {rec.number}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h3 className="text-slate-200 font-semibold text-sm">{rec.title}</h3>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                    {rec.impact}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{rec.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-600 pb-4">
        <span>SH-ROS AI Digest · Agency Group Portugal · AMI 22506</span>
        <span>Next digest in {NEXT_DIGEST_H}h</span>
      </div>

    </div>
  )
}
