// AGENCY GROUP — SH-ROS | AMI: 22506

export interface ListingRevenueSummary {
  property_id: string
  listing_price_eur: number
  avm_base_eur: number
  days_on_market: number
  demand_score: number
  inquiry_count: number
}

export interface AgentPerformanceSummary {
  agent_id: string
  deals_closed: number
  total_commission_eur: number
  avg_days_to_close: number
  listings_active: number
  conversion_rate: number
}

export interface RevenueLeakageItem {
  property_id: string
  leakage_type: 'overpriced' | 'underpriced' | 'stale' | 'low_demand' | 'missing_photos'
  estimated_leakage_eur: number
  priority: 'critical' | 'high' | 'medium'
  action_required: string
}

export interface AgentRankEntry {
  agent_id: string
  rank: number
  revenue_score: number
  total_commission_eur: number
  efficiency_score: number
  performance_label: 'elite' | 'strong' | 'developing' | 'needs_support'
}

export interface ExecutiveRevenueSnapshot {
  generated_at: Date
  total_leakage_eur_monthly: number
  leakage_items: RevenueLeakageItem[]
  agent_rankings: AgentRankEntry[]
  top_agent_id: string | null
  predicted_monthly_revenue_eur: number
  predicted_quarterly_revenue_eur: number
  revenue_confidence: number
  narrative: string
  top_opportunities: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(eur: number): string {
  if (eur >= 1_000_000) {
    return `€${(eur / 1_000_000).toFixed(1)}M`
  }
  if (eur >= 1_000) {
    return `€${Math.round(eur / 1_000)}K`
  }
  return `€${Math.round(eur)}`
}

function priorityFromLeakage(leakageEur: number): RevenueLeakageItem['priority'] {
  if (leakageEur >= 5_000) return 'critical'
  if (leakageEur >= 2_000) return 'high'
  return 'medium'
}

// ---------------------------------------------------------------------------
// detectRevenueLeakage
// ---------------------------------------------------------------------------

export function detectRevenueLeakage(
  listings: ListingRevenueSummary[],
): RevenueLeakageItem[] {
  const items: RevenueLeakageItem[] = []

  for (const listing of listings) {
    const { property_id, listing_price_eur, avm_base_eur, days_on_market, demand_score, inquiry_count } = listing

    // Overpriced: listing > avm * 1.1
    if (avm_base_eur > 0 && listing_price_eur > avm_base_eur * 1.1) {
      const leakage = ((listing_price_eur - avm_base_eur * 1.05) * 0.05) / 12
      const rounded = Math.round(leakage)
      if (rounded > 0) {
        items.push({
          property_id,
          leakage_type: 'overpriced',
          estimated_leakage_eur: rounded,
          priority: priorityFromLeakage(rounded),
          action_required: `Reduzir o preço de lista para próximo de ${fmt(avm_base_eur * 1.05)} (valor AVM). Preço actual ${fmt(listing_price_eur)} está ${Math.round((listing_price_eur / avm_base_eur - 1) * 100)}% acima do mercado.`,
        })
      }
    }

    // Stale: DOM > 180
    if (days_on_market > 180) {
      const leakage = Math.round((listing_price_eur * 0.05 * 0.1) / 12)
      if (leakage > 0) {
        items.push({
          property_id,
          leakage_type: 'stale',
          estimated_leakage_eur: leakage,
          priority: priorityFromLeakage(leakage),
          action_required: `Imóvel há ${days_on_market} dias no mercado. Rever estratégia de preço, marketing e apresentação. Custo de oportunidade estimado: ${fmt(leakage)}/mês.`,
        })
      }
    }

    // Low demand: demand_score < 30
    if (demand_score < 30) {
      const leakage = Math.round((listing_price_eur * 0.05 * 0.08) / 12)
      if (leakage > 0) {
        items.push({
          property_id,
          leakage_type: 'low_demand',
          estimated_leakage_eur: leakage,
          priority: priorityFromLeakage(leakage),
          action_required: `Score de procura baixo (${demand_score}/100). Activar campanhas digitais, destacar nas plataformas e rever posicionamento.`,
        })
      }
    }

    // Missing photos: no inquiries after 14 days
    if (inquiry_count === 0 && days_on_market > 14) {
      const leakage = Math.round((listing_price_eur * 0.05 * 0.05) / 12)
      if (leakage > 0) {
        items.push({
          property_id,
          leakage_type: 'missing_photos',
          estimated_leakage_eur: leakage,
          priority: priorityFromLeakage(leakage),
          action_required: `Sem contactos após ${days_on_market} dias. Verificar qualidade das fotos e descrição. Agendar sessão fotográfica profissional.`,
        })
      }
    }
  }

  // Sort by estimated leakage descending
  return items.sort((a, b) => b.estimated_leakage_eur - a.estimated_leakage_eur)
}

// ---------------------------------------------------------------------------
// rankAgents
// ---------------------------------------------------------------------------

export function rankAgents(
  agents: AgentPerformanceSummary[],
): AgentRankEntry[] {
  const scored = agents.map((agent) => {
    const commissionComponent = (agent.total_commission_eur / 10_000) * 0.4
    const conversionComponent = (agent.conversion_rate * 100) * 0.3
    const speedComponent = (1 / Math.max(agent.avg_days_to_close, 1)) * 5_000 * 0.3

    const rawScore = commissionComponent + conversionComponent + speedComponent
    const revenue_score = Math.round(Math.max(0, Math.min(100, rawScore)))

    const efficiency_score =
      agent.listings_active > 0
        ? Math.round(agent.total_commission_eur / agent.listings_active)
        : 0

    const performance_label: AgentRankEntry['performance_label'] =
      revenue_score > 75
        ? 'elite'
        : revenue_score > 50
          ? 'strong'
          : revenue_score > 25
            ? 'developing'
            : 'needs_support'

    return {
      agent_id: agent.agent_id,
      rank: 0, // assigned below
      revenue_score,
      total_commission_eur: agent.total_commission_eur,
      efficiency_score,
      performance_label,
    }
  })

  // Sort desc by revenue_score, then assign rank
  scored.sort((a, b) => b.revenue_score - a.revenue_score)
  scored.forEach((entry, idx) => {
    entry.rank = idx + 1
  })

  return scored
}

// ---------------------------------------------------------------------------
// predictRevenue
// ---------------------------------------------------------------------------

export function predictRevenue(
  listings: ListingRevenueSummary[],
  agents: AgentPerformanceSummary[],
): { monthly: number; quarterly: number; confidence: number } {
  void agents // agents reserved for future calibration

  const monthly = listings.reduce((sum, l) => {
    return sum + l.listing_price_eur * 0.05 * (l.demand_score / 100) * 0.08
  }, 0)

  const quarterly = monthly * 3 * 0.85
  const confidence = Math.min(0.85, listings.length / 20)

  return {
    monthly: Math.round(monthly),
    quarterly: Math.round(quarterly),
    confidence: Math.round(confidence * 1000) / 1000,
  }
}

// ---------------------------------------------------------------------------
// buildExecutiveSnapshot
// ---------------------------------------------------------------------------

export function buildExecutiveSnapshot(
  listings: ListingRevenueSummary[],
  agents: AgentPerformanceSummary[],
): ExecutiveRevenueSnapshot {
  const leakage_items = detectRevenueLeakage(listings)
  const total_leakage_eur_monthly = leakage_items.reduce(
    (sum, item) => sum + item.estimated_leakage_eur,
    0,
  )

  const agent_rankings = rankAgents(agents)
  const top_agent = agent_rankings[0] ?? null

  const { monthly, quarterly, confidence } = predictRevenue(listings, agents)

  const totalActivePipeline = listings.reduce(
    (sum, l) => sum + l.listing_price_eur,
    0,
  )

  const overpricedCount = leakage_items.filter(
    (i) => i.leakage_type === 'overpriced',
  ).length

  const staleCount = leakage_items.filter(
    (i) => i.leakage_type === 'stale',
  ).length

  const topAgentCommission =
    top_agent !== null
      ? agents.find((a) => a.agent_id === top_agent.agent_id)?.total_commission_eur ?? 0
      : 0

  // Build narrative
  const narrativeParts: string[] = []

  narrativeParts.push(
    `Pipeline com ${fmt(totalActivePipeline)} em ${listings.length} imóvel${listings.length !== 1 ? 's' : ''} activo${listings.length !== 1 ? 's' : ''}.`,
  )

  if (overpricedCount > 0) {
    narrativeParts.push(
      `${overpricedCount} listagem${overpricedCount !== 1 ? 's' : ''} com preço acima do mercado ${overpricedCount !== 1 ? 'custam' : 'custa'} ~${fmt(total_leakage_eur_monthly)}/mês em receita perdida.`,
    )
  } else if (leakage_items.length > 0) {
    narrativeParts.push(
      `Fuga de receita estimada em ${fmt(total_leakage_eur_monthly)}/mês — intervenção recomendada em ${leakage_items.length} propriedade${leakage_items.length !== 1 ? 's' : ''}.`,
    )
  }

  if (staleCount > 0) {
    narrativeParts.push(
      `${staleCount} imóvel${staleCount !== 1 ? 'is' : ''} estagnado${staleCount !== 1 ? 's' : ''} (>180 dias) a deteriorar a saúde do portfólio.`,
    )
  }

  if (top_agent !== null) {
    narrativeParts.push(
      `Agente ${top_agent.agent_id} lidera com ${fmt(topAgentCommission)} em comissões${top_agent.performance_label === 'elite' ? ' — performance de elite' : ''}.`,
    )
  }

  narrativeParts.push(
    `Receita mensal prevista: ${fmt(monthly)} | Receita trimestral prevista: ${fmt(quarterly)} (confiança: ${Math.round(confidence * 100)}%).`,
  )

  const narrative = narrativeParts.join(' ')

  // Top 3 opportunities
  const top_opportunities: string[] = []

  if (leakage_items.length > 0) {
    const topLeak = leakage_items[0]
    top_opportunities.push(
      `Resolver ${topLeak.leakage_type === 'overpriced' ? 'sobrepreço' : topLeak.leakage_type === 'stale' ? 'estagnação' : topLeak.leakage_type === 'low_demand' ? 'baixa procura' : 'ausência de fotos'} no imóvel ${topLeak.property_id} pode recuperar ${fmt(topLeak.estimated_leakage_eur)}/mês.`,
    )
  }

  const lowDemandHighValue = listings
    .filter((l) => l.demand_score < 40 && l.listing_price_eur > 500_000)
    .sort((a, b) => b.listing_price_eur - a.listing_price_eur)[0]

  if (lowDemandHighValue) {
    top_opportunities.push(
      `Imóvel ${lowDemandHighValue.property_id} (${fmt(lowDemandHighValue.listing_price_eur)}) tem procura baixa (${lowDemandHighValue.demand_score}/100) — campanha digital pode acelerar o fecho.`,
    )
  }

  const needsSupportAgent = agent_rankings.find(
    (a) => a.performance_label === 'needs_support',
  )
  if (needsSupportAgent) {
    top_opportunities.push(
      `Agente ${needsSupportAgent.agent_id} necessita de suporte (score ${needsSupportAgent.revenue_score}/100) — acompanhamento de gestão recomendado.`,
    )
  }

  // Ensure we have at most 3 and pad if needed
  if (top_opportunities.length === 0) {
    top_opportunities.push('Portfólio sem sinais de fuga de receita significativa. Manter estratégia actual.')
  }

  return {
    generated_at: new Date(),
    total_leakage_eur_monthly: Math.round(total_leakage_eur_monthly),
    leakage_items,
    agent_rankings,
    top_agent_id: top_agent?.agent_id ?? null,
    predicted_monthly_revenue_eur: monthly,
    predicted_quarterly_revenue_eur: quarterly,
    revenue_confidence: confidence,
    narrative,
    top_opportunities: top_opportunities.slice(0, 3),
  }
}

export const executiveRevenueV2 = {
  detectRevenueLeakage,
  rankAgents,
  predictRevenue,
  buildExecutiveSnapshot,
}
