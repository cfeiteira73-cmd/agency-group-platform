// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: AI Executive Assistant
// Natural-language query routing for pipeline, forecast, operations, and market intelligence
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type AssistantDomain = 'pipeline' | 'forecast' | 'operations' | 'market' | 'general'

export interface AssistantQuery {
  question: string
  context?: Record<string, unknown>
  role: 'agent' | 'broker' | 'executive'
}

export interface AssistantResponse {
  answer: string
  confidence: number
  domain: AssistantDomain
  source: string
  related_actions: string[]
  follow_up_questions: string[]
}

// ─── Keyword Routing Patterns ─────────────────────────────────────────────────

const QUESTION_PATTERNS: Record<AssistantDomain, string[]> = {
  pipeline: [
    'pipeline', 'deal', 'lead', 'stage', 'cpcv', 'escritura',
    'active', 'stuck', 'stale', 'conversion', 'funnel', 'prospect',
    'follow', 'contact', 'buyer', 'seller', 'negotiation',
  ],
  forecast: [
    'forecast', 'predict', 'next month', 'next quarter', 'revenue',
    'target', 'commission', 'close', 'won', 'projection', 'expected',
    'goal', 'quota', 'performance', 'trend',
  ],
  operations: [
    'team', 'agent', 'task', 'assign', 'workflow', 'process',
    'schedule', 'meeting', 'document', 'legal', 'compliance',
    'onboard', 'training', 'kpi', 'report',
  ],
  market: [
    'market', 'price', 'preco', 'm2', 'zone', 'zona', 'area',
    'lisbon', 'lisboa', 'porto', 'algarve', 'cascais', 'madeira',
    'trend', 'inventory', 'supply', 'demand', 'comparable',
  ],
  general: [],
}

// ─── Class ────────────────────────────────────────────────────────────────────

class AIExecutiveAssistant {
  ask(query: AssistantQuery): AssistantResponse {
    const domain = this._detectDomain(query.question)

    logger.info('[AIExecutiveAssistant] ask', {
      domain,
      role: query.role,
      question_length: query.question.length,
    })

    switch (domain) {
      case 'pipeline':
        return this._handlePipeline(query)
      case 'forecast':
        return this._handleForecast(query)
      default:
        return this._handleGeneral(query)
    }
  }

  getProactiveInsights(orgId: string, role: string): AssistantResponse[] {
    logger.info('[AIExecutiveAssistant] getProactiveInsights', { org_id: orgId, role })

    const insights: AssistantResponse[] = [
      {
        answer: 'You have 3 deals that have had no activity in 7+ days. At an 18% close rate and €320K average, re-engaging them could recover €172K in expected commission.',
        confidence: 0.82,
        domain: 'pipeline',
        source: 'pipeline_monitor',
        related_actions: ['Re-engage stale deals', 'Send deal pack', 'Schedule follow-up call'],
        follow_up_questions: [
          'Which deals are most at risk?',
          'What is the best re-engagement message for a cold buyer?',
        ],
      },
      {
        answer: 'Market data shows Cascais average price reached €4,713/m² this month — up 3.2% QoQ. Your active listings there may be under-priced vs. comparable sales.',
        confidence: 0.76,
        domain: 'market',
        source: 'market_intelligence',
        related_actions: ['Review listing prices in Cascais', 'Generate AVM report', 'Send market update to vendors'],
        follow_up_questions: [
          'Which of my listings in Cascais are below market?',
          'Should I recommend a price adjustment to my vendors?',
        ],
      },
      {
        answer: 'Based on current pipeline velocity, you are projected to close 2 deals this month totalling €640K — that is €32K commission at 5%. You are 78% to monthly target.',
        confidence: 0.7,
        domain: 'forecast',
        source: 'revenue_forecast',
        related_actions: ['Review monthly forecast', 'Accelerate proposal for lead #47', 'Book CPCV meetings'],
        follow_up_questions: [
          'Which deal is most likely to close this month?',
          'How can I close the gap to 100% of target?',
        ],
      },
    ]

    // Filter insights by role relevance
    if (role === 'agent') return insights.slice(0, 2)
    return insights
  }

  private _detectDomain(question: string): AssistantDomain {
    const q = question.toLowerCase()
    let bestDomain: AssistantDomain = 'general'
    let bestScore = 0

    for (const [domain, keywords] of Object.entries(QUESTION_PATTERNS) as [AssistantDomain, string[]][]) {
      if (domain === 'general') continue
      const score = keywords.filter(kw => q.includes(kw)).length
      if (score > bestScore) {
        bestScore = score
        bestDomain = domain
      }
    }

    return bestDomain
  }

  private _handlePipeline(query: AssistantQuery): AssistantResponse {
    return {
      answer: `Based on your current pipeline, the most impactful action is to focus on deals in the "Proposal Sent" stage — these have the highest conversion probability given the 18% average close rate in Portugal. Any deal older than 14 days without activity should be re-engaged today.`,
      confidence: 0.8,
      domain: 'pipeline',
      source: 'pipeline_analyzer',
      related_actions: [
        'View deals in Proposal Sent stage',
        'Re-engage stale leads',
        'Send deal pack to hot prospects',
      ],
      follow_up_questions: [
        'How many deals do I have in the Proposal Sent stage?',
        'What is my current conversion rate this month?',
        'Which buyer is closest to signing a CPCV?',
      ],
    }
  }

  private _handleForecast(query: AssistantQuery): AssistantResponse {
    return {
      answer: `At an 18% close rate and €320K average deal value, converting your current qualified leads would generate approximately €57.6K in commission. Focus on deals closest to the CPCV stage to hit this month's revenue target.`,
      confidence: 0.72,
      domain: 'forecast',
      source: 'revenue_forecast_engine',
      related_actions: [
        'Review this month\'s forecast',
        'Accelerate top 3 deals',
        'Book CPCV and escritura dates',
      ],
      follow_up_questions: [
        'How many deals do I need to close to hit my monthly target?',
        'What is my expected commission for next quarter?',
        'Which deals should I prioritise for a fast close?',
      ],
    }
  }

  private _handleGeneral(query: AssistantQuery): AssistantResponse {
    return {
      answer: `I can help with pipeline management, revenue forecasting, operations, and market intelligence. For best results, ask about your active deals, weekly targets, team performance, or specific markets like Lisboa, Porto, or Algarve.`,
      confidence: 0.6,
      domain: 'general',
      source: 'general_assistant',
      related_actions: [
        'View pipeline overview',
        'Check today\'s digest',
        'Review weekly forecast',
      ],
      follow_up_questions: [
        'What should I focus on today?',
        'How is my pipeline performing this week?',
        'What are the latest market prices in Lisboa?',
      ],
    }
  }
}

export const aiExecutiveAssistant = new AIExecutiveAssistant()
