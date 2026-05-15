// AGENCY GROUP — SH-ROS GTM: Competitor Benchmarking | AMI: 22506
// Real-time competitive intelligence — tracks Compass, Zillow, Palantir + local
// Benchmarks: features, pricing, market share, technology capabilities
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Competitor {
  id:               string
  name:             string
  category:         'global_proptech' | 'ai_platform' | 'iberian_portal' | 'crm' | 'local'
  founded:          number
  hq:               string
  valuation_bn:     number | null   // billion €
  arr_estimate_mn:  number | null   // million €
  target_market:    string[]
  pricing_model:    string
  pricing_range:    string
  key_features:     string[]
  weaknesses:       string[]
  eu_presence:      boolean
  gdpr_compliant:   boolean
  ai_capabilities:  'none' | 'basic' | 'advanced' | 'cutting_edge'
}

export interface FeatureComparison {
  feature:        string
  category:       string
  agency_group:   boolean | 'partial'
  competitors:    Record<string, boolean | 'partial'>
  our_advantage:  string | null
}

export interface CompetitivePosition {
  dimension:       string
  score_0_to_10:   number
  vs_best_in_class: {
    competitor:    string
    gap:           number    // positive = we lead
  }
}

// ─── Competitor Database ──────────────────────────────────────────────────────

export const COMPETITORS: Record<string, Competitor> = {
  compass: {
    id:              'compass',
    name:            'Compass',
    category:        'global_proptech',
    founded:         2012,
    hq:              'New York, USA',
    valuation_bn:    1.8,
    arr_estimate_mn: 1_700,
    target_market:   ['US residential', 'luxury US'],
    pricing_model:   'Commission split + technology fee',
    pricing_range:   '$3K–$15K/year per agent',
    key_features: [
      'AI-powered search',
      'Agent productivity suite',
      'Mortgage integration',
      'Concierge renovation loans',
      'Collections (buyer presentations)',
    ],
    weaknesses: [
      'US-only platform',
      'Not GDPR compliant',
      'No EU market data',
      'High cost structure',
      'Limited multi-language support',
    ],
    eu_presence:     false,
    gdpr_compliant:  false,
    ai_capabilities: 'advanced',
  },

  zillow: {
    id:              'zillow',
    name:            'Zillow',
    category:        'global_proptech',
    founded:         2006,
    hq:              'Seattle, USA',
    valuation_bn:    9.4,
    arr_estimate_mn: 2_100,
    target_market:   ['US residential mass market'],
    pricing_model:   'Lead gen fees + Premier Agent',
    pricing_range:   '$200–$5K/month lead gen',
    key_features: [
      'Zestimate AVM',
      'Consumer search platform',
      'Premier Agent lead gen',
      '3D home tours',
      'Mortgage marketplace',
    ],
    weaknesses: [
      'US-only',
      'Consumer-focused (not agent ROS)',
      'No EU market data',
      'Failed iBuying pivot (-$500M loss)',
      'Not a revenue OS for agents',
    ],
    eu_presence:     false,
    gdpr_compliant:  false,
    ai_capabilities: 'advanced',
  },

  palantir: {
    id:              'palantir',
    name:            'Palantir Technologies',
    category:        'ai_platform',
    founded:         2003,
    hq:              'Denver, USA',
    valuation_bn:    78.0,
    arr_estimate_mn: 2_800,
    target_market:   ['Enterprise', 'Government', 'Defense', 'Healthcare'],
    pricing_model:   'Enterprise contract + AIP licensing',
    pricing_range:   '$5M–$100M/year',
    key_features: [
      'Foundry (data ops platform)',
      'AIP (AI Platform)',
      'Government-grade security',
      'Custom AI model deployment',
      'Real-time operational intelligence',
    ],
    weaknesses: [
      'No real estate domain expertise',
      'Extremely high cost',
      '6–18 month implementation',
      'Requires large technical team to operate',
      'Not accessible to boutique agencies',
    ],
    eu_presence:     true,
    gdpr_compliant:  true,
    ai_capabilities: 'cutting_edge',
  },

  idealista: {
    id:              'idealista',
    name:            'idealista',
    category:        'iberian_portal',
    founded:         2000,
    hq:              'Madrid, Spain',
    valuation_bn:    1.3,
    arr_estimate_mn: 420,
    target_market:   ['Spain', 'Portugal', 'Italy — property listings'],
    pricing_model:   'Listing fees + enhanced profiles',
    pricing_range:   '€100–€2K/month per agency',
    key_features: [
      'Largest Iberian property portal',
      'Strong SEO presence',
      'Basic CRM tools',
      'Mortgage comparison',
      'Analytics dashboard',
    ],
    weaknesses: [
      'Portal, not a revenue OS',
      'No AI match scoring',
      'No deal intelligence',
      'No automated follow-up',
      'Listings-centric (not relationship-centric)',
    ],
    eu_presence:     true,
    gdpr_compliant:  true,
    ai_capabilities: 'basic',
  },

  salesforce_re: {
    id:              'salesforce_re',
    name:            'Salesforce (RE vertical)',
    category:        'crm',
    founded:         1999,
    hq:              'San Francisco, USA',
    valuation_bn:    210.0,
    arr_estimate_mn: 34_000,
    target_market:   ['Enterprise across all industries'],
    pricing_model:   'Per-user SaaS',
    pricing_range:   '€75–€300/user/month',
    key_features: [
      'World\'s largest CRM',
      'Einstein AI',
      'Flow automation',
      'AppExchange ecosystem',
    ],
    weaknesses: [
      'Generic — not built for real estate',
      'Expensive to customize for RE workflows',
      'No Portugal market data',
      'Requires consultants to implement',
      'Not revenue-outcome focused',
    ],
    eu_presence:     true,
    gdpr_compliant:  true,
    ai_capabilities: 'advanced',
  },
}

// ─── Feature Comparison Matrix ────────────────────────────────────────────────

export const FEATURE_COMPARISON: FeatureComparison[] = [
  {
    feature:       'AI-powered lead scoring',
    category:      'Intelligence',
    agency_group:  true,
    competitors:   { compass: true, zillow: 'partial', palantir: true, idealista: false, salesforce_re: 'partial' },
    our_advantage: 'Only platform with Portugal/Spain market-calibrated scores',
  },
  {
    feature:       'Automated deal pack generation',
    category:      'Automation',
    agency_group:  true,
    competitors:   { compass: 'partial', zillow: false, palantir: false, idealista: false, salesforce_re: false },
    our_advantage: 'Auto-generates in <30 seconds vs 2–4 hours manually',
  },
  {
    feature:       'EU market data (PT/ES/FR)',
    category:      'Market Intelligence',
    agency_group:  true,
    competitors:   { compass: false, zillow: false, palantir: false, idealista: true, salesforce_re: false },
    our_advantage: 'Built-in: €3.076/m², 210-day cycle, 18% close rate benchmarks',
  },
  {
    feature:       'GDPR compliance (EU data residency)',
    category:      'Compliance',
    agency_group:  true,
    competitors:   { compass: false, zillow: false, palantir: true, idealista: true, salesforce_re: true },
    our_advantage: 'GDPR Art.17 right to erasure + Art.20 portability built-in',
  },
  {
    feature:       'Self-healing AI (autonomous recovery)',
    category:      'Infrastructure',
    agency_group:  true,
    competitors:   { compass: false, zillow: false, palantir: 'partial', idealista: false, salesforce_re: false },
    our_advantage: 'Only platform with circuit breakers + zero-downtime failover',
  },
  {
    feature:       'Revenue closed loop (outcome → learning)',
    category:      'Intelligence',
    agency_group:  true,
    competitors:   { compass: false, zillow: false, palantir: true, idealista: false, salesforce_re: false },
    our_advantage: 'Every deal outcome improves future predictions automatically',
  },
  {
    feature:       'Multi-language (PT/EN/FR/ES/AR)',
    category:      'Localization',
    agency_group:  true,
    competitors:   { compass: false, zillow: false, palantir: false, idealista: 'partial', salesforce_re: true },
    our_advantage: 'Built for international buyer flow — AR for Middle East segment',
  },
  {
    feature:       'Pricing below €2K/month for boutiques',
    category:      'Accessibility',
    agency_group:  true,
    competitors:   { compass: false, zillow: 'partial', palantir: false, idealista: true, salesforce_re: false },
    our_advantage: 'Enterprise AI at €400/month — uniquely accessible',
  },
]

// ─── Competitor Benchmarking ──────────────────────────────────────────────────

export class CompetitorBenchmarking {

  /**
   * Get all competitors.
   */
  getAll(): Competitor[] {
    return Object.values(COMPETITORS)
  }

  /**
   * Get full feature comparison matrix.
   */
  getFeatureMatrix(): FeatureComparison[] {
    return FEATURE_COMPARISON
  }

  /**
   * Count features where we win vs each competitor.
   */
  getWinRate(): Record<string, { wins: number; ties: number; losses: number; win_rate: number }> {
    const results: Record<string, { wins: number; ties: number; losses: number; win_rate: number }> = {}

    for (const comp_id of Object.keys(COMPETITORS)) {
      let wins = 0, ties = 0, losses = 0

      for (const feature of FEATURE_COMPARISON) {
        const us   = feature.agency_group
        const them = feature.competitors[comp_id]

        if (us === true && them !== true) wins++
        else if (us === them) ties++
        else losses++
      }

      const total = wins + ties + losses
      results[comp_id] = {
        wins, ties, losses,
        win_rate: total > 0 ? Math.round(wins / total * 100) : 0,
      }
    }

    return results
  }

  /**
   * Get battle card for a competitor.
   */
  getBattleCard(competitor_id: string): {
    competitor:    Competitor
    our_advantages: string[]
    handle_objections: Record<string, string>
    one_liner:     string
    demo_flow:     string[]
  } | null {
    const competitor = COMPETITORS[competitor_id]
    if (!competitor) return null

    const advantages = FEATURE_COMPARISON
      .filter(f => f.agency_group === true && f.competitors[competitor_id] !== true && f.our_advantage)
      .map(f => f.our_advantage!)

    const objections: Record<string, string> = {
      'We already use Compass': 'Compass is US-only and not GDPR compliant — you cannot legally use it for EU client data',
      'We use Salesforce': 'Salesforce is generic CRM — we are a revenue OS built specifically for Iberian luxury RE',
      'idealista gives us enough': 'idealista shows you properties — we close deals. Different job entirely.',
      'It\'s too expensive': 'Our ROI is 8–15x in year 1. €400/month that generates €20K+ incremental commission is not a cost.',
    }

    const one_liners: Record<string, string> = {
      compass:       'Compass for Europe — without the US pricing and GDPR nightmares',
      palantir:      'Enterprise AI for real estate — 100x cheaper, 10x faster to deploy',
      idealista:     'idealista shows listings — we close deals. Those are different products.',
      zillow:        'Zillow serves buyers — we serve agents. This is a revenue OS, not a portal.',
      salesforce_re: 'Salesforce needs 6 months and €50K of consultants to work for RE. We\'re live in 24 hours.',
    }

    const demo_flow = [
      '1. Show live pipeline dashboard (30 seconds — immediate wow)',
      '2. Pull up a stale lead — show AI recommending exact next action',
      '3. Generate deal pack in <30 seconds (vs their 2-4 hours)',
      '4. Show revenue forecast with close probability per deal',
      '5. Ask: "How long does this take you today?"',
    ]

    return {
      competitor,
      our_advantages: advantages.slice(0, 5),
      handle_objections: objections,
      one_liner: one_liners[competitor_id] ?? `Better than ${competitor.name} for Iberian luxury RE`,
      demo_flow,
    }
  }

  /**
   * Get our unique features (we have, no one else does).
   */
  getUniqueFeatures(): FeatureComparison[] {
    return FEATURE_COMPARISON.filter(f => {
      if (f.agency_group !== true) return false
      return Object.values(f.competitors).every(v => v !== true)
    })
  }

  /**
   * Compute overall competitive advantage score.
   */
  getCompetitiveAdvantageScore(): number {
    const win_rates = Object.values(this.getWinRate())
    const avg_wins  = win_rates.reduce((s, r) => s + r.win_rate, 0) / win_rates.length
    return Math.round(avg_wins)
  }
}

export const competitorBenchmarking = new CompetitorBenchmarking()
