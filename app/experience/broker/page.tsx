// AGENCY GROUP — SH-ROS | AMI: 22506
// Broker Mode — Field agents, mobile-first
export const revalidate = 60

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TodayAction {
  id: string
  label: string
  detail: string
  urgency: 'critical' | 'high' | 'normal'
}

interface MyLead {
  id: string
  name: string
  score: number
  expectedValue: number
  urgency: 'hot' | 'warm' | 'cool'
  note: string
}

interface PipelineStats {
  activeDeals: number
  pipelineValue: number
  myCloseRate: number
  teamAvgCloseRate: number
  dealsClosed: number
}

// ─── Data (Miguel Ferreira — Top Agent) ────────────────────────────────────────

const BROKER_NAME     = 'Miguel Ferreira'
const COMMISSION_MTD  = 34_200
const MONTHLY_TARGET  = 45_000
const COMMISSION_PCT  = Math.round((COMMISSION_MTD / MONTHLY_TARGET) * 100)

const todayActions: TodayAction[] = [
  {
    id: 'ta-001',
    label: 'Cascais CPCV — assign solicitor NOW',
    detail: '48h deadline. Deal: €2.85M. Commission: €142,500. No action = deal at risk.',
    urgency: 'critical',
  },
  {
    id: 'ta-002',
    label: 'Estoril Moradia — schedule notary pre-meeting',
    detail: 'Deal in due diligence 130 days. Time to close. Call Maria at Casais & Associados.',
    urgency: 'high',
  },
  {
    id: 'ta-003',
    label: 'Whitmore family — send Cascais portfolio',
    detail: 'UK buyers, score 94. Expected €1.8M. Send by 17:00 to maintain momentum.',
    urgency: 'normal',
  },
]

const myLeads: MyLead[] = [
  { id: 'ml-001', name: 'James & Sarah Whitmore (UK)', score: 94, expectedValue: 1_800_000, urgency: 'hot',  note: 'Cascais portfolio request today' },
  { id: 'ml-002', name: 'Stefan Müller (DE)',           score: 81, expectedValue: 980_000,  urgency: 'warm', note: 'Re-engage — 8 days no response' },
  { id: 'ml-003', name: 'Fatima Al-Rashidi (AE)',       score: 78, expectedValue: 2_200_000, urgency: 'hot', note: 'Madeira Golden Visa inquiry' },
  { id: 'ml-004', name: 'Chen Wei (CN)',                score: 71, expectedValue: 1_400_000, urgency: 'warm', note: 'Viewing follow-up needed' },
]

const pipeline: PipelineStats = {
  activeDeals: 12,
  pipelineValue: 7_450_000,
  myCloseRate: 0.28,
  teamAvgCloseRate: 0.235,
  dealsClosed: 4,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v.toFixed(0)}`
}

const urgencyActionColor = {
  critical: 'border-red-800/60 bg-red-950/20',
  high:     'border-orange-800/50 bg-orange-950/15',
  normal:   'border-slate-800 bg-[#111118]',
}

const urgencyLabelColor = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  normal:   'text-slate-500',
}

const urgencyLabel = {
  critical: '🔴 CRITICAL',
  high:     '🟠 HIGH',
  normal:   '⚪ TODAY',
}

const leadDot = {
  hot:  'bg-red-500',
  warm: 'bg-orange-400',
  cool: 'bg-blue-400',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrokerPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100 px-4 py-6 space-y-6 max-w-lg mx-auto">

      {/* Header */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Broker Mode</p>
        <h1 className="text-xl font-bold text-white">{BROKER_NAME}</h1>
        <p className="text-sm text-slate-400">Thursday, 15 May 2026</p>
      </div>

      {/* Commission Tracker */}
      <div className="bg-[#111118] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Commission MTD</p>
          <p className="text-xs text-slate-500">Target: {eur(MONTHLY_TARGET)}</p>
        </div>
        <p className="text-3xl font-bold text-white mb-1">{eur(COMMISSION_MTD)}</p>
        <p className="text-xs text-slate-500 mb-3">{COMMISSION_PCT}% of monthly target · {pipeline.dealsClosed} deals closed</p>
        {/* Progress bar */}
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${COMMISSION_PCT >= 100 ? 'bg-emerald-500' : COMMISSION_PCT >= 60 ? 'bg-blue-500' : 'bg-orange-500'}`}
            style={{ width: `${Math.min(COMMISSION_PCT, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">0</span>
          <span className="text-[10px] text-slate-600">{eur(MONTHLY_TARGET)}</span>
        </div>
        {COMMISSION_PCT < 100 && (
          <p className="text-xs text-slate-500 mt-2">
            {eur(MONTHLY_TARGET - COMMISSION_MTD)} remaining · {16 - 15} working days left
          </p>
        )}
      </div>

      {/* Today's Actions */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Today&apos;s Actions
        </h2>
        <div className="space-y-3">
          {todayActions.map(action => (
            <div
              key={action.id}
              className={`border rounded-xl p-4 ${urgencyActionColor[action.urgency]}`}
            >
              <div className="flex items-start gap-3">
                {/* Decorative checkbox */}
                <div className="w-5 h-5 rounded border border-slate-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-slate-200 font-semibold text-sm">{action.label}</p>
                    <span className={`text-[10px] font-bold flex-shrink-0 ${urgencyLabelColor[action.urgency]}`}>
                      {urgencyLabel[action.urgency]}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">{action.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My Hot Leads */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          My Hot Leads
        </h2>
        <div className="space-y-2">
          {myLeads.map(lead => (
            <div
              key={lead.id}
              className="bg-[#111118] border border-slate-800 rounded-xl p-4 flex items-center gap-3"
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${leadDot[lead.urgency]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-medium text-sm truncate">{lead.name}</p>
                <p className="text-slate-500 text-xs truncate">{lead.note}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-bold text-sm">{lead.score}</p>
                <p className="text-slate-500 text-[10px]">{eur(lead.expectedValue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My Pipeline Position */}
      <div className="bg-[#111118] border border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          My Pipeline Position
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-slate-500 text-xs">Active Deals</p>
            <p className="text-white text-2xl font-bold">{pipeline.activeDeals}</p>
          </div>
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-slate-500 text-xs">Pipeline Value</p>
            <p className="text-white text-2xl font-bold">{eur(pipeline.pipelineValue)}</p>
          </div>
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-slate-500 text-xs">My Close Rate</p>
            <p className="text-emerald-400 text-2xl font-bold">{(pipeline.myCloseRate * 100).toFixed(0)}%</p>
          </div>
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-slate-500 text-xs">Team Average</p>
            <p className="text-slate-300 text-2xl font-bold">{(pipeline.teamAvgCloseRate * 100).toFixed(0)}%</p>
          </div>
        </div>
        <p className="text-xs text-emerald-400 font-semibold mt-3 text-center">
          +{((pipeline.myCloseRate - pipeline.teamAvgCloseRate) * 100).toFixed(1)}pp above team average
        </p>
      </div>

    </div>
  )
}
