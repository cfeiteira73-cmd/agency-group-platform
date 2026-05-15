// AGENCY GROUP — SH-ROS Product: Explainability Renderer | AMI: 22506
// Renders AI decisions as human-readable explanations for agents and clients
// "Why did the system score this lead 87?" → plain Portuguese/English answer
// =============================================================================

import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExplanationAudience = 'agent' | 'manager' | 'client' | 'developer'
export type ExplanationFormat   = 'short' | 'full' | 'bullet_points' | 'json'

export interface FeatureContribution {
  feature_name:    string         // technical name
  display_name:    string         // human name
  value:           string | number
  contribution:    number         // 0–1 contribution to final score
  direction:       'positive' | 'negative' | 'neutral'
  explanation:     string         // 1 sentence
}

export interface Explanation {
  entity_id:      string
  entity_type:    'match' | 'lead' | 'deal' | 'prediction'
  score:          number
  verdict:        string             // "Strong match", "High risk", etc.
  headline:       string             // 1 sentence
  detail:         string             // 2–3 sentences
  bullet_points:  string[]           // 3–5 bullets
  top_factors:    FeatureContribution[]
  what_would_change: string[]       // "If X changes, score would Y"
  confidence:     'high' | 'medium' | 'low'
  audience:       ExplanationAudience
  language:       'pt' | 'en'
  rendered_at:    string
}

export interface BatchExplanationSummary {
  org_id:           string
  total_explained:  number
  avg_score:        number
  top_positive_features: string[]
  top_risk_features:     string[]
  generated_at:          string
}

// ─── Feature Display Names ────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, { en: string; pt: string }> = {
  match_score:           { en: 'Match score',           pt: 'Pontuação de compatibilidade' },
  budget_alignment:      { en: 'Budget alignment',      pt: 'Alinhamento de orçamento' },
  location_preference:   { en: 'Location preference',   pt: 'Preferência de localização' },
  property_type_match:   { en: 'Property type',         pt: 'Tipo de imóvel' },
  days_in_pipeline:      { en: 'Time in pipeline',      pt: 'Tempo em pipeline' },
  engagement_level:      { en: 'Engagement level',      pt: 'Nível de envolvimento' },
  response_rate:         { en: 'Response rate',         pt: 'Taxa de resposta' },
  viewing_count:         { en: 'Viewings held',         pt: 'Visitas realizadas' },
  price_vs_market:       { en: 'Price vs market',       pt: 'Preço vs mercado' },
  competitor_risk:       { en: 'Competitor risk',       pt: 'Risco de concorrente' },
  financial_readiness:   { en: 'Financial readiness',   pt: 'Prontidão financeira' },
  decision_urgency:      { en: 'Decision urgency',      pt: 'Urgência de decisão' },
}

// ─── Explainability Renderer ──────────────────────────────────────────────────

export class ExplainabilityRenderer {

  /**
   * Render an explanation for a match/lead/deal score.
   * Primary consumer: agents reading explanations before calling a client.
   */
  render(params: {
    entity_id:    string
    entity_type:  Explanation['entity_type']
    score:        number
    features:     Record<string, number>   // feature_name → 0–1 value
    audience?:    ExplanationAudience
    language?:    'pt' | 'en'
  }): Explanation {
    const audience = params.audience ?? 'agent'
    const language = params.language ?? 'en'
    const score    = params.score

    const contributions = this._computeContributions(params.features, language)
    const top_factors   = contributions.slice(0, 3)

    const verdict    = this._getVerdict(score, language)
    const confidence = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'

    const headline = this._buildHeadline(score, verdict, params.entity_type, language)
    const detail   = this._buildDetail(score, contributions, params.entity_type, language, audience)
    const bullets  = this._buildBullets(contributions, language, audience)
    const what_would_change = this._buildCounterfactuals(contributions, language)

    const explanation: Explanation = {
      entity_id:          params.entity_id,
      entity_type:        params.entity_type,
      score,
      verdict,
      headline,
      detail,
      bullet_points:      bullets,
      top_factors,
      what_would_change,
      confidence,
      audience,
      language,
      rendered_at:        new Date().toISOString(),
    }

    logger.info('[Explainability] Rendered', {
      entity_id:  params.entity_id,
      score,
      audience,
      language,
      factors:    top_factors.map(f => f.display_name),
    })

    return explanation
  }

  /**
   * Format explanation for a specific output format.
   */
  format(explanation: Explanation, format: ExplanationFormat): string {
    switch (format) {
      case 'short':
        return `${explanation.headline} (${explanation.score}/100 — ${explanation.verdict})`

      case 'full':
        return [
          `**${explanation.headline}**`,
          '',
          explanation.detail,
          '',
          '**Key factors:**',
          ...explanation.bullet_points.map(b => `• ${b}`),
          '',
          explanation.what_would_change.length > 0
            ? `**What would change the score:**\n${explanation.what_would_change.map(w => `• ${w}`).join('\n')}`
            : '',
        ].filter(Boolean).join('\n')

      case 'bullet_points':
        return explanation.bullet_points.map(b => `• ${b}`).join('\n')

      case 'json':
        return JSON.stringify(explanation, null, 2)

      default:
        return explanation.headline
    }
  }

  /**
   * Generate batch summary across multiple entities.
   */
  summarizeBatch(
    org_id: string,
    explanations: Explanation[]
  ): BatchExplanationSummary {
    if (explanations.length === 0) {
      return {
        org_id,
        total_explained:       0,
        avg_score:             0,
        top_positive_features: [],
        top_risk_features:     [],
        generated_at:          new Date().toISOString(),
      }
    }

    const avg_score = explanations.reduce((s, e) => s + e.score, 0) / explanations.length

    // Aggregate feature importance
    const feature_counts: Record<string, { positive: number; negative: number }> = {}
    for (const explanation of explanations) {
      for (const factor of explanation.top_factors) {
        if (!feature_counts[factor.feature_name]) {
          feature_counts[factor.feature_name] = { positive: 0, negative: 0 }
        }
        if (factor.direction === 'positive') feature_counts[factor.feature_name].positive++
        else if (factor.direction === 'negative') feature_counts[factor.feature_name].negative++
      }
    }

    const sorted_positive = Object.entries(feature_counts)
      .sort(([, a], [, b]) => b.positive - a.positive)
      .slice(0, 3)
      .map(([name]) => FEATURE_LABELS[name]?.en ?? name)

    const sorted_negative = Object.entries(feature_counts)
      .sort(([, a], [, b]) => b.negative - a.negative)
      .slice(0, 3)
      .map(([name]) => FEATURE_LABELS[name]?.en ?? name)

    return {
      org_id,
      total_explained:       explanations.length,
      avg_score,
      top_positive_features: sorted_positive,
      top_risk_features:     sorted_negative,
      generated_at:          new Date().toISOString(),
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _computeContributions(
    features: Record<string, number>,
    language: 'pt' | 'en'
  ): FeatureContribution[] {
    return Object.entries(features)
      .map(([name, value]) => {
        const label       = FEATURE_LABELS[name] ?? { en: name, pt: name }
        const direction   = value >= 0.6 ? 'positive' : value <= 0.4 ? 'negative' : 'neutral'
        const explanation = this._featureExplanation(name, value, language)

        return {
          feature_name:  name,
          display_name:  label[language],
          value,
          contribution:  Math.abs(value - 0.5) * 2,  // distance from neutral
          direction,
          explanation,
        } as FeatureContribution
      })
      .sort((a, b) => b.contribution - a.contribution)
  }

  private _featureExplanation(feature: string, value: number, lang: 'pt' | 'en'): string {
    const high = value >= 0.7
    const low  = value <= 0.3

    const explanations: Record<string, { en: [string, string]; pt: [string, string] }> = {
      budget_alignment: {
        en: ['Budget matches asking price range',    'Budget significantly below asking price'],
        pt: ['Orçamento alinhado com preço pedido',  'Orçamento abaixo do preço pedido'],
      },
      engagement_level: {
        en: ['High engagement — multiple interactions',   'Low engagement — minimal contact'],
        pt: ['Envolvimento elevado — múltiplas interações', 'Envolvimento baixo — contacto mínimo'],
      },
      days_in_pipeline: {
        en: ['Fresh lead — recently entered pipeline',  'Lead has been dormant too long'],
        pt: ['Lead recente — entrou recentemente',      'Lead inativo há demasiado tempo'],
      },
      competitor_risk: {
        en: ['No competing agents detected',          'Competing agents likely involved'],
        pt: ['Sem concorrentes detectados',           'Risco de envolvimento de concorrentes'],
      },
    }

    const text = explanations[feature]
    if (!text) return `${feature} = ${(value * 100).toFixed(0)}%`

    return high ? text[lang][0] : low ? text[lang][1] : text[lang][0]
  }

  private _getVerdict(score: number, language: 'pt' | 'en'): string {
    if (language === 'pt') {
      if (score >= 80) return 'Oportunidade forte'
      if (score >= 65) return 'Boa compatibilidade'
      if (score >= 50) return 'Compatibilidade média'
      if (score >= 35) return 'Compatibilidade fraca'
      return 'Não recomendado'
    } else {
      if (score >= 80) return 'Strong opportunity'
      if (score >= 65) return 'Good match'
      if (score >= 50) return 'Average match'
      if (score >= 35) return 'Weak match'
      return 'Not recommended'
    }
  }

  private _buildHeadline(
    score: number,
    verdict: string,
    entity_type: string,
    language: 'pt' | 'en'
  ): string {
    if (language === 'pt') {
      return `Score ${score}/100 — ${verdict} para este ${entity_type === 'match' ? 'match' : 'negócio'}`
    }
    return `Score ${score}/100 — ${verdict} for this ${entity_type}`
  }

  private _buildDetail(
    score: number,
    contributions: FeatureContribution[],
    entity_type: string,
    language: 'pt' | 'en',
    audience: ExplanationAudience
  ): string {
    const top    = contributions[0]
    const second = contributions[1]

    if (language === 'pt') {
      const base = `A pontuação de ${score}/100 reflete um ${score >= 65 ? 'forte' : 'moderado'} alinhamento.`
      const factors = top
        ? ` O principal fator é ${top.display_name.toLowerCase()}: ${top.explanation}.`
        : ''
      const secondary = second && audience !== 'client'
        ? ` Secundariamente: ${second.explanation}.`
        : ''
      return base + factors + secondary
    } else {
      const base = `The ${score}/100 score reflects ${score >= 65 ? 'strong' : 'moderate'} alignment.`
      const factors = top
        ? ` The primary driver is ${top.display_name.toLowerCase()}: ${top.explanation}.`
        : ''
      const secondary = second && audience !== 'client'
        ? ` Additionally: ${second.explanation}.`
        : ''
      return base + factors + secondary
    }
  }

  private _buildBullets(
    contributions: FeatureContribution[],
    language: 'pt' | 'en',
    audience: ExplanationAudience
  ): string[] {
    const max_bullets = audience === 'developer' ? 5 : 3
    return contributions.slice(0, max_bullets).map(c => {
      const icon = c.direction === 'positive' ? '✅' : c.direction === 'negative' ? '⚠️' : '➡️'
      if (language === 'pt') {
        return `${icon} ${c.display_name}: ${c.explanation}`
      }
      return `${icon} ${c.display_name}: ${c.explanation}`
    })
  }

  private _buildCounterfactuals(contributions: FeatureContribution[], language: 'pt' | 'en'): string[] {
    const risks = contributions.filter(c => c.direction === 'negative').slice(0, 2)

    return risks.map(c => {
      if (language === 'pt') {
        return `Se ${c.display_name.toLowerCase()} melhorar, a pontuação pode subir +10 a +15 pontos`
      }
      return `If ${c.display_name.toLowerCase()} improves, score could increase by +10 to +15 points`
    })
  }
}

export const explainabilityRenderer = new ExplainabilityRenderer()
