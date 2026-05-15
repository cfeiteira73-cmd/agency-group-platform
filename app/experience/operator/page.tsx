// AGENCY GROUP — SH-ROS | AMI: 22506
// Operator Mode — Senior brokers managing the team
export const revalidate = 30

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Deal {
  id: string
  name: string
  value: number
  stage: string
  daysActive: number
  agent: string
  nextAction: string
  stageColor: string
}

interface HotLead {
  id: string
  name: string
  score: number
  expectedValue: number
  nextAction: string
  urgency: 'critical' | 'high' | 'medium'
}

interface AgentSummary {
  name: string
  deals: number
  commissionMTD: number
  closeRate: number
  status: 'on_track' | 'behind' | 'ahead'
}

interface PendingAction {
  id: string
  priority: 1 | 2 | 3
  instruction: string
  revenueImpact: number
  timeEstimate: string
}

// ─── Mock data (Portugal-calibrated) ──────────────────────────────────────────

const PIPELINE_HEALTH = 'STRONG'
const PIPELINE_HEALTH_COLOR = 'text-emerald-400'

const deals: Deal[] = [
  {
    id: 'deal-001',
    name: 'Quinta Laranjeiras — Cascais',
    value: 2_850_000,
    stage: 'CPCV Pending',
    daysActive: 187,
    agent: 'M. Ferreira',
    nextAction: 'Confirm solicitor by Thursday EOD',
    stageColor: 'bg-red-500/20 text-red-300',
  },
  {
    id: 'deal-002',
    name: 'Penthouse Príncipe Real — Lisboa',
    value: 1_920_000,
    stage: 'Offer Negotiation',
    daysActive: 94,
    agent: 'A. Costa',
    nextAction: 'Counter-offer submission by Friday 18:00',
    stageColor: 'bg-orange-500/20 text-orange-300',
  },
  {
    id: 'deal-003',
    name: 'Golf Villa Vilamoura — Algarve',
    value: 1_450_000,
    stage: 'Second Viewing',
    daysActive: 41,
    agent: 'P. Santos',
    nextAction: 'Confirm Saturday 10:00 viewing slot',
    stageColor: 'bg-blue-500/20 text-blue-300',
  },
  {
    id: 'deal-004',
    name: 'T4 Lapa — Lisboa',
    value: 890_000,
    stage: 'Proposal Sent',
    daysActive: 22,
    agent: 'R. Neves',
    nextAction: 'Follow up — no response in 5 days',
    stageColor: 'bg-yellow-500/20 text-yellow-300',
  },
  {
    id: 'deal-005',
    name: 'Moradia Estoril — Cascais',
    value: 2_100_000,
    stage: 'Due Diligence',
    daysActive: 130,
    agent: 'M. Ferreira',
    nextAction: 'Schedule notary pre-meeting',
    stageColor: 'bg-purple-500/20 text-purple-300',
  },
]

const hotLeads: HotLead[] = [
  { id: 'hl-001', name: 'James & Sarah Whitmore (UK)', score: 94, expectedValue: 1_800_000, nextAction: 'Send Cascais portfolio PDF today', urgency: 'critical' },
  { id: 'hl-002', name: 'Famille Dubois (FR)',          score: 88, expectedValue: 1_200_000, nextAction: 'Arrange Alfama viewing this week',  urgency: 'high'     },
  { id: 'hl-003', name: 'Wang Lei (CN)',                 score: 82, expectedValue: 2_400_000, nextAction: 'Golden Visa eligibility brief',    urgency: 'high'     },
  { id: 'hl-004', name: 'David & Rachel Cohen (US)',    score: 79, expectedValue: 950_000,   nextAction: 'Re-engage after 12-day silence',  urgency: 'medium'   },
]

const agents: AgentSummary[] = [
  { name: 'Miguel Ferreira', deals: 12, commissionMTD: 34_200, closeRate: 0.28, status: 'ahead'    },
  { name: 'Ana Costa',       deals: 9,  commissionMTD: 27_800, closeRate: 0.23, status: 'on_track' },
  { name: 'Pedro Santos',    deals: 7,  commissionMTD: 18_400, closeRate: 0.19, status: 'on_track' },
]

const pendingActions: PendingAction[] = [
  { id: 'pa-001', priority: 1, instruction: 'Escalate Cascais CPCV to director — solicitor confirmation overdue by 24h', revenueImpact: 142_500, timeEstimate: '15 min' },
  { id: 'pa-002', priority: 2, instruction: 'Approve counter-offer for Penthouse Príncipe Real — gap €40K, buyer expires Friday', revenueImpact: 96_000, timeEstimate: '30 min' },
  { id: 'pa-003', priority: 3, instruction: 'Assign Dubois Alfama viewing to Ana Costa — schedule this week to maintain momentum', revenueImpact: 60_000, timeEstimate: '10 min' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v.toFixed(0)}`
}

const urgencyDot: Record<HotLead['urgency'], string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-blue-500',
}

const statusBadge: Record<AgentSummary['status'], string> = {
  ahead:    'bg-emerald-500/15 text-emerald-400',
  on_track: 'bg-blue-500/15 text-blue-400',
  behind:   'bg-red-500/15 text-red-400',
}

const statusLabel: Record<AgentSummary['status'], string> = {
  ahead: 'Ahead', on_track: 'On Track', behind: 'Behind',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorPage() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Operator Mode</p>
          <h1 className="text-2xl font-bold text-white">Pipeline Operations</h1>
          <p className="text-sm text-slate-400 mt-0.5">Real-time deal management · Agency Group Portugal</p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-semibold ${PIPELINE_HEALTH_COLOR}`}>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          Pipeline: {PIPELINE_HEALTH}
        </div>
      </div>

      {/* Active Deals Table */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/70">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Active Deals ({deals.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/50">
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">Deal</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">Value</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">Stage</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">Days</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">Agent</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => (
                <tr key={deal.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-3 text-slate-200 font-medium max-w-[200px] truncate">{deal.name}</td>
                  <td className="px-4 py-3 text-right text-white font-bold whitespace-nowrap">{eur(deal.value)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deal.stageColor}`}>
                      {deal.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 text-xs font-mono">{deal.daysActive}d</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{deal.agent}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">{deal.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hot Leads + Team Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Hot Leads Queue */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Hot Leads Queue ({hotLeads.length})
          </h2>
          <div className="space-y-3">
            {hotLeads.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 p-3 bg-slate-800/25 rounded-md">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot[lead.urgency]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{lead.name}</p>
                  <p className="text-slate-500 text-xs truncate">{lead.nextAction}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-sm font-bold">{lead.score}</p>
                  <p className="text-slate-500 text-[10px]">{eur(lead.expectedValue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Activity */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Team Activity — MTD
          </h2>
          <div className="space-y-3">
            {agents.map(agent => (
              <div key={agent.name} className="p-3 bg-slate-800/25 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-200 text-sm font-medium">{agent.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge[agent.status]}`}>
                    {statusLabel[agent.status]}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span><strong className="text-slate-300">{agent.deals}</strong> deals</span>
                  <span><strong className="text-slate-300">{eur(agent.commissionMTD)}</strong> commission</span>
                  <span><strong className="text-slate-300">{(agent.closeRate * 100).toFixed(0)}%</strong> close rate</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Pending Actions — Revenue Impact
        </h2>
        <div className="space-y-3">
          {pendingActions.map(action => (
            <div key={action.id} className="flex items-start gap-3 p-3 bg-slate-800/25 rounded-md">
              <div className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                action.priority === 1 ? 'bg-red-600 text-white' :
                action.priority === 2 ? 'bg-orange-600 text-white' :
                'bg-slate-600 text-slate-200'
              }`}>
                {action.priority}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm leading-relaxed">{action.instruction}</p>
                <div className="flex gap-4 mt-1.5">
                  <span className="text-slate-500 text-xs">{action.timeEstimate}</span>
                  <span className="text-emerald-400 text-xs font-semibold">+{eur(action.revenueImpact)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between text-xs text-slate-500">
          <span>Total revenue impact if actioned today</span>
          <span className="text-emerald-400 font-semibold">
            +{eur(pendingActions.reduce((s, a) => s + a.revenueImpact, 0))}
          </span>
        </div>
      </div>

    </div>
  )
}
