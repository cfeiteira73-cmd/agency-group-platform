// AGENCY GROUP — SH-ROS | AMI: 22506
// Executive Copilot — natural-language query interface for C-suite intelligence
// Portugal 2026: €3.076/m² median · 210 days avg close · 18% close rate · 5% commission
// =============================================================================

import { logger } from '@/lib/observability/logger'
import { randomUUID } from 'crypto'
import { executiveDigest } from './executiveDigest'
import { revenueNarrator } from './revenueNarrator'
import { opportunityRadar } from './opportunityRadar'
import { operationalSummarizer } from './operationalSummarizer'
import { strategicForecastDigest } from './strategicForecastDigest'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Constants ─────────────────────────────────────────────────────────────────

const AVG_DEAL_VALUE = 320_000
const MONTHLY_TARGET = 50_000
const SESSION_TTL_MS = 30 * 60 * 1000  // 30 minutes

// ─── Interfaces ────────────────────────────────────────────────────────────────

export type QueryIntent =
  | 'revenue_status'
  | 'pipeline_health'
  | 'top_risks'
  | 'top_opportunities'
  | 'forecast'
  | 'team_performance'
  | 'market_intel'
  | 'general'

export interface CopilotMessage {
  message_id: string
  role: 'user' | 'copilot'
  content: string
  intent?: QueryIntent
  timestamp: Date
}

export interface CopilotSession {
  session_id: string
  org_id: string
  user_role: string
  messages: CopilotMessage[]
  started_at: Date
  last_active: Date
}

export interface CopilotResponse {
  message: string
  intent: QueryIntent
  confidence: number
  data_summary?: string
  suggested_actions: string[]
  follow_up_prompts: string[]
}

// ─── Intent Keyword Map ───────────────────────────────────────────────────────

export const INTENT_KEYWORDS: Record<QueryIntent, string[]> = {
  revenue_status: [
    'revenue', 'commission', 'comissão', 'earning', 'money', 'income',
    'mtd', 'month to date', 'how much', 'target', 'objetivo', 'sales',
    'faturação', 'receita',
  ],
  pipeline_health: [
    'pipeline', 'deals', 'negócios', 'active', 'ativo', 'leads', 'funnel',
    'stage', 'fase', 'progression', 'progressão', 'health', 'saúde',
    'how many deals', 'quantos negócios',
  ],
  top_risks: [
    'risk', 'risco', 'danger', 'perigo', 'threat', 'ameaça', 'concern',
    'preocupação', 'problem', 'problema', 'issue', 'warn', 'alert',
    'alertas', 'critical', 'crítico',
  ],
  top_opportunities: [
    'opportunity', 'oportunidade', 'win', 'ganhar', 'hot lead', 'best',
    'melhor', 'radar', 'signal', 'sinal', 'upside', 'potential', 'potencial',
    'prioritise', 'priorizar',
  ],
  forecast: [
    'forecast', 'previsão', 'predict', 'prever', 'projection', 'projeção',
    'future', 'futuro', 'next month', 'próximo mês', 'quarter', 'trimestre',
    'scenario', 'cenário', 'estimate', 'estimativa', '90d', '180d', '30d',
  ],
  team_performance: [
    'team', 'equipa', 'agent', 'agente', 'performance', 'desempenho',
    'productivity', 'produtividade', 'activity', 'atividade', 'follow up',
    'follow-up', 'who', 'quem', 'leaderboard',
  ],
  market_intel: [
    'market', 'mercado', 'price', 'preço', 'trend', 'tendência', 'portugal',
    'lisbon', 'lisboa', 'algarve', 'cascais', 'porto', 'madeira', 'açores',
    'competitor', 'concorrente', 'supply', 'demand', 'procura', 'oferta',
    '€/m²', 'per sqm',
  ],
  general: [],
}

// ─── Executive Copilot ────────────────────────────────────────────────────────

export class ExecutiveCopilot {
  private sessions: Map<string, CopilotSession> = new Map()

  /**
   * Start a new copilot session for an organisation and user role.
   */
  startSession(orgId: string, userRole: string = 'executive'): CopilotSession {
    const session: CopilotSession = {
      session_id: randomUUID(),
      org_id: orgId,
      user_role: userRole,
      messages: [],
      started_at: new Date(),
      last_active: new Date(),
    }

    this.sessions.set(session.session_id, session)

    logger.info('[ExecutiveCopilot] Session started', {
      route: 'executive/copilot',
      correlation_id: orgId,
    })

    // Add greeting
    const greeting = this._buildGreeting(orgId, userRole)
    session.messages.push({
      message_id: randomUUID(),
      role: 'copilot',
      content: greeting,
      intent: 'general',
      timestamp: new Date(),
    })

    return session
  }

  /**
   * Process a user message and return a structured copilot response.
   */
  chat(sessionId: string, userMessage: string): CopilotResponse {
    const session = this.sessions.get(sessionId)

    if (!session) {
      logger.warn('[ExecutiveCopilot] Session not found', {
        route: 'executive/copilot',
        correlation_id: sessionId,
      })
      return this._notFoundResponse()
    }

    // Update last active timestamp
    session.last_active = new Date()

    // Record user message
    const intent = this.detectIntent(userMessage)
    session.messages.push({
      message_id: randomUUID(),
      role: 'user',
      content: userMessage,
      intent,
      timestamp: new Date(),
    })

    // Build response
    const response = this._buildResponse(intent, session.org_id)

    // Record copilot reply
    session.messages.push({
      message_id: randomUUID(),
      role: 'copilot',
      content: response.message,
      intent,
      timestamp: new Date(),
    })

    return response
  }

  /**
   * Detect the intent of a user message using keyword matching.
   * Returns the intent with the highest keyword match count, defaulting to 'general'.
   */
  detectIntent(message: string): QueryIntent {
    const lower = message.toLowerCase()
    let bestIntent: QueryIntent = 'general'
    let bestCount = 0

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [QueryIntent, string[]][]) {
      if (intent === 'general') continue
      const count = keywords.filter(kw => lower.includes(kw)).length
      if (count > bestCount) {
        bestCount = count
        bestIntent = intent
      }
    }

    return bestIntent
  }

  /**
   * End a session and remove it from memory.
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    logger.info('[ExecutiveCopilot] Session ended', {
      route: 'executive/copilot',
      correlation_id: sessionId,
    })
  }

  /**
   * Return the full message history for a session.
   */
  getSessionHistory(sessionId: string): CopilotMessage[] {
    return this.sessions.get(sessionId)?.messages ?? []
  }

  // ─── Private response builders ────────────────────────────────────────────────

  private _buildResponse(intent: QueryIntent, orgId: string): CopilotResponse {
    const handlers: Record<QueryIntent, () => CopilotResponse> = {
      revenue_status: () => this._handleRevenueStatus(orgId),
      pipeline_health: () => this._handlePipelineHealth(orgId),
      top_risks: () => this._handleTopRisks(orgId),
      top_opportunities: () => this._handleTopOpportunities(orgId),
      forecast: () => this._handleForecast(orgId),
      team_performance: () => this._handleTeamPerformance(orgId),
      market_intel: () => this._handleMarketIntel(),
      general: (msg = '') => this._handleGeneral(msg),
    }

    return (handlers[intent] ?? handlers.general)()
  }

  private _handleRevenueStatus(orgId: string): CopilotResponse {
    const brief = executiveDigest.generate(orgId)
    const narrative = revenueNarrator.narrate(orgId, '30d')
    const commissionKpi = brief.kpis.find(k => k.name === 'commission_mtd')
    const pipelineKpi = brief.kpis.find(k => k.name === 'pipeline_value')

    const commission = (commissionKpi?.value as number) ?? 0
    const pipeline = (pipelineKpi?.value as number) ?? 0
    const targetPct = Math.round((commission / MONTHLY_TARGET) * 100)

    return {
      message: `Revenue status as of today:\n\n` +
        `• Commission MTD: €${commission.toLocaleString('pt-PT')} (${targetPct}% of €${MONTHLY_TARGET.toLocaleString('pt-PT')} target)\n` +
        `• Pipeline: €${pipeline.toLocaleString('pt-PT')}\n` +
        `• Status: ${brief.overall_status.replace('_', ' ')}\n\n` +
        `${narrative.one_liner}`,
      intent: 'revenue_status',
      confidence: 0.92,
      data_summary: `Commission MTD: €${commission.toLocaleString('pt-PT')} | Pipeline: €${pipeline.toLocaleString('pt-PT')} | Status: ${brief.overall_status}`,
      suggested_actions: brief.recommended_actions.slice(0, 3),
      follow_up_prompts: [
        'What are the top risks to hitting the monthly target?',
        'Which deals should I focus on to close this month?',
        'Show me the 90-day revenue forecast',
      ],
    }
  }

  private _handlePipelineHealth(orgId: string): CopilotResponse {
    const ops = operationalSummarizer.summarize(orgId)
    const brief = executiveDigest.generate(orgId)
    const pipelineKpi = brief.kpis.find(k => k.name === 'pipeline_value')
    const dealsKpi = brief.kpis.find(k => k.name === 'deals_active')

    const pipelineVal = (pipelineKpi?.value as number) ?? 0
    const dealsActive = (dealsKpi?.value as number) ?? 0

    const bottleneckText = ops.bottlenecks.length > 0
      ? `\n\nBottlenecks:\n${ops.bottlenecks.map(b => `• ${b}`).join('\n')}`
      : '\n\nNo critical bottlenecks detected.'

    return {
      message: `Pipeline health overview:\n\n` +
        `• Active deals: ${dealsActive}\n` +
        `• Total pipeline value: €${pipelineVal.toLocaleString('pt-PT')}\n` +
        `• Health score: ${ops.health_score}/100 (${ops.overall_health})\n` +
        `• Observation: ${ops.observation}` +
        bottleneckText,
      intent: 'pipeline_health',
      confidence: 0.89,
      data_summary: `${dealsActive} deals · €${pipelineVal.toLocaleString('pt-PT')} · Score ${ops.health_score}/100`,
      suggested_actions: ops.quick_fixes.slice(0, 3),
      follow_up_prompts: [
        'What are the deals most at risk of stalling?',
        'How can I improve lead velocity?',
        'What is the revenue forecast for the next 90 days?',
      ],
    }
  }

  private _handleTopRisks(orgId: string): CopilotResponse {
    const brief = executiveDigest.generate(orgId)
    const criticalAlerts = brief.alerts.filter(a => a.severity === 'critical')
    const warningAlerts = brief.alerts.filter(a => a.severity === 'warning')

    const riskLines = brief.top_risks.map((r, i) => `${i + 1}. ${r}`).join('\n')
    const alertSummary = criticalAlerts.length > 0
      ? `\n\n${criticalAlerts.length} critical alert(s) require immediate action.`
      : warningAlerts.length > 0
        ? `\n\n${warningAlerts.length} warning(s) detected — monitor closely.`
        : '\n\nNo critical alerts at this time.'

    return {
      message: `Top risks identified:\n\n${riskLines}${alertSummary}`,
      intent: 'top_risks',
      confidence: 0.87,
      data_summary: `${criticalAlerts.length} critical · ${warningAlerts.length} warnings`,
      suggested_actions: brief.recommended_actions.slice(0, 3),
      follow_up_prompts: [
        'What should I do to mitigate these risks?',
        'What is the downside forecast scenario?',
        'Which deals are at risk of being lost?',
      ],
    }
  }

  private _handleTopOpportunities(orgId: string): CopilotResponse {
    const scan = opportunityRadar.scan(orgId)
    const top3 = scan.signals.slice(0, 3)

    const signalLines = top3.map((s, i) =>
      `${i + 1}. [${s.urgency.toUpperCase()}] ${s.title} — ${s.description} (Action: ${s.recommended_action})`
    ).join('\n\n')

    return {
      message: `Top ${top3.length} opportunities detected:\n\n${signalLines}\n\n` +
        `Total opportunity value: €${Math.round(scan.total_opportunity_eur).toLocaleString('pt-PT')} expected commission.`,
      intent: 'top_opportunities',
      confidence: 0.85,
      data_summary: `${scan.signals.length} signals · €${Math.round(scan.total_opportunity_eur).toLocaleString('pt-PT')} total opportunity`,
      suggested_actions: top3.map(s => s.recommended_action),
      follow_up_prompts: [
        'Which hot leads should I call today?',
        'How do I convert a stale deal back to active?',
        'Show me the full opportunity radar scan',
      ],
    }
  }

  private _handleForecast(orgId: string): CopilotResponse {
    const forecast = strategicForecastDigest.generate(orgId, '90d')

    return {
      message: `90-day strategic forecast (confidence: ${Math.round(forecast.confidence * 100)}%):\n\n` +
        `• Base case (${Math.round(forecast.base_case.probability * 100)}%): ` +
        `${forecast.base_case.expected_deals} deals → €${forecast.base_case.expected_revenue_eur.toLocaleString('pt-PT')} commission\n` +
        `• Upside case (${Math.round(forecast.upside_case.probability * 100)}%): ` +
        `${forecast.upside_case.expected_deals} deals → €${forecast.upside_case.expected_revenue_eur.toLocaleString('pt-PT')} commission\n` +
        `• Downside case (${Math.round(forecast.downside_case.probability * 100)}%): ` +
        `${forecast.downside_case.expected_deals} deals → €${forecast.downside_case.expected_revenue_eur.toLocaleString('pt-PT')} commission\n\n` +
        `Key driver: ${forecast.key_drivers[0]}`,
      intent: 'forecast',
      confidence: forecast.confidence,
      data_summary: `Base: €${forecast.base_case.expected_revenue_eur.toLocaleString('pt-PT')} | Upside: €${forecast.upside_case.expected_revenue_eur.toLocaleString('pt-PT')} | Downside: €${forecast.downside_case.expected_revenue_eur.toLocaleString('pt-PT')}`,
      suggested_actions: forecast.strategic_recommendations.slice(0, 3),
      follow_up_prompts: [
        'What are the key conditions for the upside scenario?',
        'How do I de-risk the downside forecast?',
        'Show me the 180-day forecast',
      ],
    }
  }

  private _handleTeamPerformance(orgId: string): CopilotResponse {
    const ops = operationalSummarizer.summarize(orgId)
    const teamIndicator = ops.indicators.find(i => i.category === 'team')

    return {
      message: `Team performance summary:\n\n` +
        `• Overall operational health: ${ops.overall_health} (${ops.health_score}/100)\n` +
        (teamIndicator
          ? `• ${teamIndicator.name.replace(/_/g, ' ')}: ${teamIndicator.value} (target: ${teamIndicator.threshold})\n`
          : '') +
        `• Observation: ${ops.observation}\n\n` +
        `Note: Detailed per-agent breakdowns are available in the Portal dashboard.`,
      intent: 'team_performance',
      confidence: 0.75,
      data_summary: `Health score: ${ops.health_score}/100 · ${ops.overall_health}`,
      suggested_actions: ops.quick_fixes.slice(0, 3),
      follow_up_prompts: [
        'Which agents have overdue follow-ups?',
        'What is the team close rate vs baseline?',
        'How can I improve team productivity?',
      ],
    }
  }

  private _handleMarketIntel(): CopilotResponse {
    return {
      message: `Portugal luxury real estate market — 2026 snapshot:\n\n` +
        `• Median price: €3.076/m² (+17.6% YoY)\n` +
        `• Transactions: 169,812 per year\n` +
        `• Avg time on market: 210 days\n` +
        `• Luxury Lisboa: top 5 worldwide\n\n` +
        `Key buyer segments:\n` +
        `• €500K–€3M: North Americans (16%), French (13%), British (9%), Chinese (8%)\n` +
        `• €100K–€500K: Portuguese, Brazilian, Angolan, French\n` +
        `• €3M+: Family offices, HNWI global, Middle East, Asian\n\n` +
        `Regional price index:\n` +
        `• Lisboa €5.000/m² · Cascais €4.713 · Algarve €3.941 · Porto €3.643 · Madeira €3.760 · Açores €1.952`,
      intent: 'market_intel',
      confidence: 0.95,
      data_summary: 'Portugal 2026 market data',
      suggested_actions: [
        'Target North American and French buyers for €500K–€1M Cascais/Algarve listings',
        'Position Madeira (€3.760/m²) as value opportunity vs Lisboa for cost-conscious HNWI',
        'Activate Açores listings for entry-level investor segment (€1.952/m²)',
      ],
      follow_up_prompts: [
        'Which micro-market has the strongest price growth?',
        'How do I target French buyers specifically?',
        'What is the forecast for Algarve prices?',
      ],
    }
  }

  private _handleGeneral(message: string): CopilotResponse {
    return {
      message: `I'm your Agency Group executive copilot. I can help you with:\n\n` +
        `• Revenue status & commission tracking\n` +
        `• Pipeline health & deal analysis\n` +
        `• Top opportunities & priority signals\n` +
        `• Risk identification & alerts\n` +
        `• 30/90/180-day strategic forecasts\n` +
        `• Portugal market intelligence\n` +
        `• Team performance overview\n\n` +
        `What would you like to know?`,
      intent: 'general',
      confidence: 1.0,
      suggested_actions: [
        'Ask about your current pipeline health',
        'Request today\'s top opportunities',
        'Get the 90-day revenue forecast',
      ],
      follow_up_prompts: [
        'What is my revenue status this month?',
        'What are the top opportunities I should act on today?',
        'Show me the 90-day forecast',
        'What are the main risks to hitting my target?',
      ],
    }
  }

  private _buildGreeting(orgId: string, userRole: string): string {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    return `${greeting}. I'm your Agency Group executive copilot (AMI 22506). ` +
      `I have real-time access to your pipeline, revenue metrics, opportunity radar, and Portugal market data. ` +
      `How can I help you today?`
  }

  private _notFoundResponse(): CopilotResponse {
    return {
      message: 'Session not found or has expired. Please start a new session.',
      intent: 'general',
      confidence: 1.0,
      suggested_actions: ['Start a new copilot session'],
      follow_up_prompts: [],
    }
  }
}

export const executiveCopilot = new ExecutiveCopilot()
