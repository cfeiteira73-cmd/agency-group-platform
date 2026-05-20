// AGENCY GROUP — SH-ROS GTM: Market Expansion Strategy | AMI: 22506
// Geo × segment expansion playbook — where to go next, in what order, with what motion
// Data-driven: market size × penetration × CAC efficiency per market
// =============================================================================

import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketOpportunity {
  market_id:          string
  geography:          string
  segment:            string
  tam:                number    // total addressable market €/year (agency commissions)
  sam:                number    // serviceable addressable market
  som_year_1:         number    // realistically winnable year 1
  avg_deal_value:     number    // avg property transaction value
  avg_commission_pct: number
  agencies_count:     number    // total agencies in market
  target_agencies:    number    // our ICP within that market
  entry_difficulty:   'low' | 'medium' | 'high'
  language_barrier:   boolean
  regulatory_notes:   string
  priority_score:     number    // composite entry priority 0–100
}

export interface ExpansionWave {
  wave:           number
  name:           string
  timeline:       string
  markets:        MarketOpportunity[]
  investment:     number        // estimated spend to enter
  expected_arr:   number        // expected ARR after wave
  key_milestones: string[]
  risks:          string[]
}

export interface GTMMotion {
  market_id:        string
  motion_type:      'product_led' | 'sales_led' | 'partner_led' | 'community_led'
  primary_channel:  string
  secondary_channel: string
  avg_sales_cycle:  number   // days
  conversion_rate:  number   // lead → customer
  cac_estimate:     number
  rationale:        string
}

// ─── Market Opportunities ─────────────────────────────────────────────────────

export const MARKET_OPPORTUNITIES: MarketOpportunity[] = [
  {
    market_id:          'pt-luxury',
    geography:          'Portugal — Luxury',
    segment:            'Luxury boutique agencies (€500K–€10M deals)',
    tam:                4_200_000_000,   // €4.2B in luxury commissions
    sam:                840_000_000,     // agencies in our ICP band
    som_year_1:         2_400_000,       // 0.3% penetration year 1
    avg_deal_value:     1_200_000,
    avg_commission_pct: COMMISSION_RATE,
    agencies_count:     380,
    target_agencies:    80,
    entry_difficulty:   'low',
    language_barrier:   false,
    regulatory_notes:   'GDPR + Portuguese property law. No additional RE license required for SaaS.',
    priority_score:     95,
  },
  {
    market_id:          'pt-mid',
    geography:          'Portugal — Mid Market',
    segment:            'Mid-market agencies (€100K–€500K deals)',
    tam:                8_900_000_000,
    sam:                1_780_000_000,
    som_year_1:         3_600_000,
    avg_deal_value:     320_000,
    avg_commission_pct: COMMISSION_RATE,
    agencies_count:     1_200,
    target_agencies:    300,
    entry_difficulty:   'low',
    language_barrier:   false,
    regulatory_notes:   'Same as pt-luxury. Large addressable base.',
    priority_score:     88,
  },
  {
    market_id:          'es-luxury',
    geography:          'Spain — Luxury (Madrid, Barcelona, Costa del Sol)',
    segment:            'Luxury boutique agencies',
    tam:                12_000_000_000,
    sam:                2_400_000_000,
    som_year_1:         4_800_000,
    avg_deal_value:     1_500_000,
    avg_commission_pct: COMMISSION_RATE,
    agencies_count:     620,
    target_agencies:    120,
    entry_difficulty:   'medium',
    language_barrier:   false,    // Portuguese team speaks Spanish
    regulatory_notes:   'GDPR applies. Spanish property law nuances. Local partner recommended.',
    priority_score:     82,
  },
  {
    market_id:          'madeira-acores',
    geography:          'Madeira + Açores',
    segment:            'All segments — island premium',
    tam:                480_000_000,
    sam:                96_000_000,
    som_year_1:         960_000,
    avg_deal_value:     350_000,
    avg_commission_pct: COMMISSION_RATE,
    agencies_count:     95,
    target_agencies:    30,
    entry_difficulty:   'low',
    language_barrier:   false,
    regulatory_notes:   'Same as mainland Portugal. Island residency programs boost demand.',
    priority_score:     78,
  },
  {
    market_id:          'fr-riviera',
    geography:          'France — Côte d\'Azur',
    segment:            'Ultra-luxury (€2M+ deals)',
    tam:                9_500_000_000,
    sam:                1_900_000_000,
    som_year_1:         2_000_000,
    avg_deal_value:     3_200_000,
    avg_commission_pct: 0.04,
    agencies_count:     280,
    target_agencies:    45,
    entry_difficulty:   'high',
    language_barrier:   true,
    regulatory_notes:   'GDPR applies. French notaire system. Local partner essential.',
    priority_score:     62,
  },
  {
    market_id:          'ae-dubai',
    geography:          'UAE — Dubai',
    segment:            'International investor-facing agencies',
    tam:                15_000_000_000,
    sam:                3_000_000_000,
    som_year_1:         1_500_000,
    avg_deal_value:     2_500_000,
    avg_commission_pct: 0.02,    // 2% is typical in UAE
    agencies_count:     450,
    target_agencies:    60,
    entry_difficulty:   'high',
    language_barrier:   false,   // English dominant in Dubai RE
    regulatory_notes:   'No GDPR. RERA regulation. Dubai-specific property law. High-value market.',
    priority_score:     55,
  },
]

// ─── Expansion Waves ──────────────────────────────────────────────────────────

export const EXPANSION_WAVES: ExpansionWave[] = [
  {
    wave:     1,
    name:     'Iberian Dominance',
    timeline: '2026 — Q1–Q4',
    markets:  MARKET_OPPORTUNITIES.filter(m => ['pt-luxury', 'pt-mid', 'madeira-acores'].includes(m.market_id)),
    investment: 180_000,
    expected_arr: 3_600_000,
    key_milestones: [
      '50 paying agency customers in Portugal',
      'Case study: +35% close rate documented',
      'Partnership with top 3 real estate networks in PT',
      'Featured in Idealista Portugal + Público coverage',
    ],
    risks: [
      'Slower adoption from traditional agencies',
      'Pricing sensitivity in mid-market',
    ],
  },
  {
    wave:     2,
    name:     'Spain Entry + PT Scale',
    timeline: '2027 — Q1–Q3',
    markets:  MARKET_OPPORTUNITIES.filter(m => ['es-luxury', 'pt-mid'].includes(m.market_id)),
    investment: 420_000,
    expected_arr: 9_600_000,
    key_milestones: [
      '20 agency customers in Spain',
      'Madrid office or local sales hire',
      'Integration with idealista.com API',
      '€4M ARR milestone',
    ],
    risks: [
      'Local competition from Spanish PropTech',
      'Sales cycle longer in Spain',
    ],
  },
  {
    wave:     3,
    name:     'Western Europe + MENA',
    timeline: '2028+',
    markets:  MARKET_OPPORTUNITIES.filter(m => ['fr-riviera', 'ae-dubai'].includes(m.market_id)),
    investment: 800_000,
    expected_arr: 18_000_000,
    key_milestones: [
      'French-language product version',
      'Dubai RERA compliance',
      'Series A funding to support expansion',
    ],
    risks: [
      'High CAC in competitive markets',
      'Regulatory complexity',
      'Currency and payment infrastructure',
    ],
  },
]

// ─── GTM Motions ──────────────────────────────────────────────────────────────

export const GTM_MOTIONS: GTMMotion[] = [
  {
    market_id:         'pt-luxury',
    motion_type:       'product_led',
    primary_channel:   'Referral (agency-to-agency)',
    secondary_channel: 'LinkedIn outbound to agency owners',
    avg_sales_cycle:   21,
    conversion_rate:   0.35,
    cac_estimate:      3_200,
    rationale:         'Luxury RE is relationship-driven. Product demos win on results.',
  },
  {
    market_id:         'pt-mid',
    motion_type:       'sales_led',
    primary_channel:   'Direct outbound (email + WhatsApp)',
    secondary_channel: 'Real estate events + APEMIP membership',
    avg_sales_cycle:   35,
    conversion_rate:   0.22,
    cac_estimate:      2_800,
    rationale:         'Mid-market needs ROI proof. Sales-assisted trial converts better.',
  },
  {
    market_id:         'es-luxury',
    motion_type:       'partner_led',
    primary_channel:   'Partnership with Spanish luxury RE networks',
    secondary_channel: 'Referrals from PT customers with ES offices',
    avg_sales_cycle:   45,
    conversion_rate:   0.20,
    cac_estimate:      6_500,
    rationale:         'New market — partner channel reduces CAC and builds trust.',
  },
]

// ─── Market Expansion Strategy ────────────────────────────────────────────────

export class MarketExpansionStrategy {

  /**
   * Get prioritized expansion roadmap.
   */
  getPriorityRoadmap(): MarketOpportunity[] {
    return [...MARKET_OPPORTUNITIES].sort((a, b) => b.priority_score - a.priority_score)
  }

  /**
   * Get current wave (Wave 1 by default).
   */
  getCurrentWave(): ExpansionWave {
    return EXPANSION_WAVES[0]
  }

  /**
   * Get GTM motion for a specific market.
   */
  getGTMMotion(market_id: string): GTMMotion | null {
    return GTM_MOTIONS.find(m => m.market_id === market_id) ?? null
  }

  /**
   * Calculate total addressable market across all target markets.
   */
  getTotalOpportunity(): {
    total_tam: number
    total_sam: number
    year_1_som: number
    top_market: MarketOpportunity
  } {
    const sorted = this.getPriorityRoadmap()
    return {
      total_tam:   MARKET_OPPORTUNITIES.reduce((s, m) => s + m.tam, 0),
      total_sam:   MARKET_OPPORTUNITIES.reduce((s, m) => s + m.sam, 0),
      year_1_som:  MARKET_OPPORTUNITIES.slice(0, 3).reduce((s, m) => s + m.som_year_1, 0),
      top_market:  sorted[0],
    }
  }

  /**
   * Get all expansion waves.
   */
  getAllWaves(): ExpansionWave[] {
    return EXPANSION_WAVES
  }

  /**
   * Estimate ARR at end of each wave.
   */
  getARRMilestones(): { wave: number; year: string; target_arr: number; cumulative: number }[] {
    let cumulative = 0
    return EXPANSION_WAVES.map(wave => {
      cumulative += wave.expected_arr
      return {
        wave:          wave.wave,
        year:          wave.timeline,
        target_arr:    wave.expected_arr,
        cumulative,
      }
    })
  }
}

export const marketExpansionStrategy = new MarketExpansionStrategy()
