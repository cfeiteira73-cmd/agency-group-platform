// AGENCY GROUP — SH-ROS GTM: Positioning Matrix | AMI: 22506
// Defines competitive positioning vs Compass, Zillow, Palantir in PropTech
// WHO we serve, WHAT we sell, WHY we win — machine-readable for GTM agents
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PositioningAxis {
  dimension:   string
  our_position: string
  score:       number       // 0–10 where we stand
  competitors: Record<string, { position: string; score: number }>
  why_we_win:  string
}

export interface IdealCustomerProfile {
  segment:          string
  geography:        string[]
  revenue_range:    string
  pain_points:      string[]
  buying_triggers:  string[]
  deal_size:        string
  close_rate:       number
  ltv:              number    // lifetime value €
  cac:              number    // customer acquisition cost €
  ltv_cac_ratio:   number
}

export interface ValueProposition {
  headline:         string
  subheadline:      string
  proof_points:     string[]
  anti_positioning: string[]  // what we explicitly are NOT
  category:         string    // category we want to own
}

export interface PositioningStatement {
  icp:              IdealCustomerProfile
  value_prop:       ValueProposition
  axes:             PositioningAxis[]
  moat:             string[]    // sustainable competitive advantages
  land_and_expand:  string      // how we grow within a customer
  generated_at:     string
}

// ─── ICP Definitions ─────────────────────────────────────────────────────────

export const ICP_DEFINITIONS: Record<string, IdealCustomerProfile> = {
  boutique_luxury_agency: {
    segment:         'Boutique luxury real estate agency',
    geography:       ['Portugal', 'Spain', 'Madeira', 'Açores'],
    revenue_range:   '€1M–€20M GCI/year',
    pain_points: [
      'Manual lead qualification wastes 60% of agent time',
      'No visibility into pipeline health or close probability',
      'Deal packs take 2–4 hours to create manually',
      'High-value international buyers go cold after first contact',
      'Revenue forecasting is guesswork',
    ],
    buying_triggers: [
      'Lost a €2M+ deal to a more organized competitor',
      'Agent churn due to poor tooling',
      'Scaling from 5 to 15 agents',
      'Entering luxury segment for first time',
    ],
    deal_size:    '€24K–€180K/year (SaaS + commission share)',
    close_rate:   0.25,
    ltv:          120_000,   // 5-year avg
    cac:          8_000,
    ltv_cac_ratio: 15,
  },

  mid_market_agency: {
    segment:         'Mid-market agency (20–100 agents)',
    geography:       ['Portugal', 'Spain'],
    revenue_range:   '€5M–€50M GCI/year',
    pain_points: [
      'CRM not built for real estate deal flow',
      'No AI-powered match scoring',
      'Manual reporting to management takes 8h/week',
      'International buyer qualification has no systematic process',
    ],
    buying_triggers: [
      'Competitor wins deal with AI tooling',
      'New CTO or CEO driving digital transformation',
      'Acquisition integration requiring unified platform',
    ],
    deal_size:    '€48K–€360K/year',
    close_rate:   0.20,
    ltv:          280_000,
    cac:          18_000,
    ltv_cac_ratio: 15.6,
  },

  independent_agent: {
    segment:         'High-performing independent agent',
    geography:       ['Lisbon', 'Porto', 'Algarve', 'Cascais'],
    revenue_range:   '€150K–€2M GCI/year',
    pain_points: [
      'Competing against larger agencies with better tools',
      'No time to follow up all leads systematically',
      'International clients expect professional digital presentation',
    ],
    buying_triggers: [
      'Lost a deal to a digital-first competitor',
      'Wants to scale without hiring staff',
      'Referral from another agent using Agency Group',
    ],
    deal_size:    '€4.8K–€24K/year',
    close_rate:   0.35,     // higher — self-motivated buyers
    ltv:          32_000,
    cac:          1_200,
    ltv_cac_ratio: 26.7,
  },
}

// ─── Value Propositions ───────────────────────────────────────────────────────

export const VALUE_PROPOSITIONS: Record<string, ValueProposition> = {
  primary: {
    headline:    'The Revenue Operating System for European Luxury Real Estate',
    subheadline: 'Close 35% more deals with AI-powered matching, automated follow-up, and real-time pipeline intelligence',
    proof_points: [
      '+35% close rate vs industry baseline (18% → 24%)',
      '80% reduction in manual deal pack creation time',
      'Average deal value 23% higher with AI-scored leads',
      'First AI-native platform built for Iberian luxury market',
      'Covers Portugal, Spain, Madeira, Açores — one platform',
    ],
    anti_positioning: [
      'Not a generic CRM (we are revenue-first, not contact-first)',
      'Not a property portal (we serve agents, not buyers)',
      'Not a US product adapted for Europe (built for Iberian market)',
      'Not a workflow tool (we optimize outcomes, not processes)',
    ],
    category: 'Revenue Operating System (ROS) for Real Estate',
  },

  vs_compass: {
    headline:    'Compass-level intelligence, built for European luxury — without US pricing',
    subheadline: 'Get the AI deal intelligence Compass agents have, tuned for Portugal/Spain market dynamics',
    proof_points: [
      'Portugal market data: €3.076/m² median, 210-day close, 18% close rate — built in',
      'Multi-language: PT, EN, FR, ES, AR — for international buyer flow',
      'GDPR-native: EU data residency by default',
      'Commission structure aligned with Iberian market (5% vs 6% US)',
    ],
    anti_positioning: [
      'Not trying to build a US-style agent platform in Europe',
      'Not ignoring GDPR and EU regulations',
    ],
    category: 'European-first Luxury PropTech',
  },

  vs_palantir: {
    headline:    'Enterprise-grade AI for real estate — without €5M consulting contracts',
    subheadline: 'Self-healing, autonomous revenue intelligence that runs on your existing data',
    proof_points: [
      'Deploys in days, not years',
      'No 6-month implementation — connects to Supabase/Notion in hours',
      'Revenue outcomes visible in 30 days',
      'Starts at €400/month — not €5M/year',
    ],
    anti_positioning: [
      'Not requiring armies of consultants to operate',
      'Not a black-box — agents understand every recommendation',
    ],
    category: 'Accessible AI Infrastructure for Real Estate',
  },
}

// ─── Positioning Axes ─────────────────────────────────────────────────────────

export const POSITIONING_AXES: PositioningAxis[] = [
  {
    dimension:    'European market knowledge',
    our_position: 'Deep Iberian/EU luxury market data, GDPR-native, multi-language',
    score:        9.5,
    competitors: {
      Compass:  { position: 'US-focused, limited EU',    score: 2.0 },
      Zillow:   { position: 'US only',                   score: 1.0 },
      Palantir: { position: 'Generic, no RE domain',     score: 4.0 },
      idealista: { position: 'Good EU, no AI ROS layer', score: 6.0 },
    },
    why_we_win: 'We are the only platform with real Portugal/Spain market intelligence built-in',
  },
  {
    dimension:    'AI-driven revenue outcomes',
    our_position: 'Self-healing ROS: match → decision → deal → close, fully automated',
    score:        9.0,
    competitors: {
      Compass:  { position: 'Good AI tools, agent-centric',     score: 7.5 },
      Zillow:   { position: 'Consumer AI, not agent revenue',   score: 5.0 },
      Palantir: { position: 'Enterprise AI, not RE-specific',   score: 7.0 },
      idealista: { position: 'Portal listings, no revenue OS',  score: 3.0 },
    },
    why_we_win: 'Revenue loop is closed: every decision feeds back into model improvement',
  },
  {
    dimension:    'Speed to value',
    our_position: 'Live in 24h, revenue impact in 30 days',
    score:        9.0,
    competitors: {
      Compass:  { position: 'US-only, 3-6 month onboarding',    score: 4.0 },
      Zillow:   { position: 'Not an enterprise product',         score: 5.0 },
      Palantir: { position: '6-18 month implementation',         score: 2.0 },
      idealista: { position: 'Portal — no implementation',       score: 8.0 },
    },
    why_we_win: 'SaaS model: connect Supabase + Notion, get live dashboard in 24h',
  },
  {
    dimension:    'Pricing accessibility',
    our_position: 'Starts at €400/month for independent agents',
    score:        9.5,
    competitors: {
      Compass:  { position: 'Agents pay fees — not SaaS model', score: 5.0 },
      Zillow:   { position: '$200–$5K/month lead gen',          score: 6.0 },
      Palantir: { position: '$5M+ enterprise contracts',        score: 1.0 },
      idealista: { position: 'Listing fees, not SaaS',          score: 7.0 },
    },
    why_we_win: 'Only enterprise-grade AI at boutique-accessible price point',
  },
]

// ─── Positioning Matrix ────────────────────────────────────────────────────────

export class PositioningMatrix {

  /**
   * Get full positioning statement for a target ICP.
   */
  getPositioning(icp_key: keyof typeof ICP_DEFINITIONS): PositioningStatement {
    const icp       = ICP_DEFINITIONS[icp_key]
    const value_prop = icp_key === 'boutique_luxury_agency'
      ? VALUE_PROPOSITIONS.primary
      : VALUE_PROPOSITIONS.primary

    return {
      icp,
      value_prop,
      axes:   POSITIONING_AXES,
      moat: [
        'Iberian market data flywheel — every deal improves predictions',
        'Self-healing architecture — zero downtime as competitors need constant IT',
        'GDPR-native — EU agencies can\'t easily switch to US platforms',
        'Economic closed loop — only platform where AI learns from actual deal outcomes',
        'Multi-region infrastructure — EU/US/AP data residency for global agencies',
      ],
      land_and_expand: 'Start with 1 agent → whole team → referrals to partner agencies',
      generated_at: new Date().toISOString(),
    }
  }

  /**
   * Get win/loss analysis vs a specific competitor.
   */
  getCompetitorComparison(competitor: string): {
    competitor: string
    our_advantages: string[]
    their_advantages: string[]
    win_rate_estimate: number
    battle_card: string
  } {
    const battle_cards: Record<string, ReturnType<PositioningMatrix['getCompetitorComparison']>> = {
      Compass: {
        competitor: 'Compass',
        our_advantages: [
          'EU market knowledge vs US-only',
          'GDPR compliance vs legal uncertainty',
          '10x lower price point',
          'Self-healing AI vs agent-managed tools',
        ],
        their_advantages: [
          'Stronger brand recognition globally',
          'US market share',
          'Larger feature set for US workflow',
        ],
        win_rate_estimate: 0.75,
        battle_card: 'Lead with: "Built for Portugal/Spain market — Compass doesn\'t serve EU"',
      },
      Palantir: {
        competitor: 'Palantir',
        our_advantages: [
          '100x faster deployment',
          '10x lower cost',
          'Domain-specific — RE is all we do',
          'No implementation consultants needed',
        ],
        their_advantages: [
          'Enterprise brand recognition',
          'Deep government/defense relationships',
          'More general-purpose',
        ],
        win_rate_estimate: 0.85,
        battle_card: 'Lead with: "Enterprise AI for real estate — without the Palantir price tag"',
      },
    }

    return battle_cards[competitor] ?? {
      competitor,
      our_advantages:    ['Domain focus', 'Price', 'EU compliance'],
      their_advantages:  ['Brand', 'Market share'],
      win_rate_estimate: 0.65,
      battle_card:       'Lead with product demo — show revenue outcomes in 10 minutes',
    }
  }

  /**
   * Get all ICP profiles.
   */
  getAllICPs(): IdealCustomerProfile[] {
    return Object.values(ICP_DEFINITIONS)
  }

  /**
   * Get composite competitive score.
   */
  getCompetitiveScore(): { dimension: string; agency_group: number; best_competitor: string; gap: number }[] {
    return POSITIONING_AXES.map(axis => {
      const competitor_scores = Object.entries(axis.competitors)
      const best = competitor_scores.reduce((best, [name, c]) =>
        c.score > best[1].score ? [name, c] : best
      , competitor_scores[0])

      return {
        dimension:       axis.dimension,
        agency_group:    axis.score,
        best_competitor: best[0],
        gap:             axis.score - best[1].score,
      }
    })
  }
}

export const positioningMatrix = new PositioningMatrix()
