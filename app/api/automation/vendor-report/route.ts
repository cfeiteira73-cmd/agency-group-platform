import { NextRequest, NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

type PriceRecommendation = 'maintain' | 'reduce_3' | 'reduce_5' | 'reduce_10' | 'increase'
type Language = 'pt' | 'en' | 'fr'

interface VendorReportRequest {
  property_id: string
  property_address: string
  asking_price: number
  listing_start_date: string
  zone: string
  typology: string
  area_m2: number
  visits_this_week: number
  views_this_week: number
  inquiries_this_week: number
  avg_feedback_score: number
  comparable_active: number
  comparable_sold_price: number
  owner_name: string
  owner_language: string
}

interface MetricsSummary {
  days_on_market: number
  price_per_m2: number
  comparable_price_per_m2: number
  price_vs_comparable_pct: number
  weekly_views: number
  weekly_visits: number
  weekly_inquiries: number
  avg_feedback: number
}

interface VendorReportResponse {
  report_text: string
  recommendation: PriceRecommendation
  suggested_price?: number
  headline: string
  metrics_summary: MetricsSummary
  whatsapp_summary: string
}

// ─── Utility: Days on Market ──────────────────────────────────────────────────

function calcDaysOnMarket(listingStartDate: string): number {
  const start = new Date(listingStartDate)
  const today = new Date()
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Business Logic: Price Recommendation ────────────────────────────────────

function determineRecommendation(
  dom: number,
  viewsThisWeek: number,
  avgFeedback: number,
  inquiriesThisWeek: number,
  askingPrice: number,
  comparableSoldPrice: number
): { recommendation: PriceRecommendation; suggested_price?: number } {
  // High demand signal → maintain or increase
  if (inquiriesThisWeek >= 3 && avgFeedback >= 4.0) {
    if (askingPrice < comparableSoldPrice * 0.98) {
      return {
        recommendation: 'increase',
        suggested_price: Math.round(comparableSoldPrice * 1.02),
      }
    }
    return { recommendation: 'maintain' }
  }

  // Severe stagnation → reduce 10%
  if (dom > 90 && viewsThisWeek < 30 && avgFeedback < 3.5) {
    return {
      recommendation: 'reduce_10',
      suggested_price: Math.round(askingPrice * 0.9),
    }
  }

  // Moderate stagnation → reduce 5%
  if (dom > 60 && viewsThisWeek < 50) {
    return {
      recommendation: 'reduce_5',
      suggested_price: Math.round(askingPrice * 0.95),
    }
  }

  // Early stagnation, no offers → reduce 3%
  if (dom > 30 && inquiriesThisWeek === 0) {
    return {
      recommendation: 'reduce_3',
      suggested_price: Math.round(askingPrice * 0.97),
    }
  }

  // Priced above comparables with low feedback → reduce 3%
  if (askingPrice > comparableSoldPrice * 1.1 && avgFeedback < 3.8) {
    return {
      recommendation: 'reduce_3',
      suggested_price: Math.round(comparableSoldPrice * 1.02),
    }
  }

  return { recommendation: 'maintain' }
}

// ─── Report Generator: Portuguese ────────────────────────────────────────────

function generateReportPT(
  req: VendorReportRequest,
  dom: number,
  metrics: MetricsSummary,
  rec: PriceRecommendation,
  suggested_price?: number
): { report_text: string; headline: string; whatsapp_summary: string } {
  const firstName = req.owner_name.split(' ')[0]
  const domText = dom === 1 ? '1 dia' : `${dom} dias`
  const priceK = (req.asking_price / 1000).toFixed(0)
  const suggestedK = suggested_price ? (suggested_price / 1000).toFixed(0) : null

  const recMessages: Record<PriceRecommendation, string> = {
    maintain: 'O preço está bem posicionado face ao mercado actual. Mantemos a estratégia.',
    reduce_3: `Recomendamos uma ligeira revisão de preço para €${suggestedK}K (-3%) para aumentar a competitividade e atrair mais propostas.`,
    reduce_5: `Recomendamos uma revisão de preço para €${suggestedK}K (-5%). Esta correcção deve aumentar significativamente o tráfego e as visitas.`,
    reduce_10: `O mercado está a indicar que o preço precisa de uma revisão mais significativa. Recomendamos €${suggestedK}K (-10%) para garantir venda nos próximos 30-45 dias.`,
    increase: `O imóvel está a receber forte procura. Temos margem para ajustar o preço para €${suggestedK}K (+2%) sem perder momentum.`,
  }

  const feedbackText =
    metrics.avg_feedback >= 4.0
      ? 'O feedback dos visitantes tem sido muito positivo'
      : metrics.avg_feedback >= 3.5
      ? 'O feedback dos visitantes tem sido moderado'
      : 'O feedback dos visitantes indica algumas preocupações com o posicionamento'

  const report_text = `Caro/a ${firstName},

Aqui está o relatório semanal do seu imóvel em ${req.property_address}.

RESUMO DE ACTIVIDADE — ESTA SEMANA
O seu imóvel está no mercado há ${domText}. Esta semana registámos ${metrics.weekly_views} visualizações nos portais imobiliários, ${metrics.weekly_visits} visita${metrics.weekly_visits !== 1 ? 's' : ''} presencial${metrics.weekly_visits !== 1 ? 'ais' : ''} e ${metrics.weekly_inquiries} pedido${metrics.weekly_inquiries !== 1 ? 's' : ''} de informação.

FEEDBACK DE VISITANTES
${feedbackText} (${metrics.avg_feedback.toFixed(1)}/5.0). ${
    metrics.avg_feedback >= 4.0
      ? 'Os compradores elogiam as características do imóvel e a qualidade da habitação.'
      : metrics.avg_feedback >= 3.5
      ? 'Os visitantes apreciam o imóvel mas levantam algumas questões sobre o preço face à concorrência.'
      : 'Os visitantes têm referido que encontram alternativas melhor posicionadas no mesmo segmento de preço.'
  }

ANÁLISE DE MERCADO
O preço de venda actual é de €${priceK}K (€${metrics.price_per_m2.toFixed(0)}/m²). Os imóveis comparáveis vendidos recentemente na zona ${req.zone} fecharam a uma média de €${metrics.comparable_price_per_m2.toFixed(0)}/m². O seu imóvel está ${
    metrics.price_vs_comparable_pct > 5
      ? `${metrics.price_vs_comparable_pct.toFixed(1)}% acima dos comparáveis`
      : metrics.price_vs_comparable_pct < -5
      ? `${Math.abs(metrics.price_vs_comparable_pct).toFixed(1)}% abaixo dos comparáveis`
      : 'bem alinhado com os comparáveis de mercado'
  }. Existem actualmente ${req.comparable_active} imóveis concorrentes activos na mesma zona e tipologia.

RECOMENDAÇÃO
${recMessages[rec]}

${
    rec !== 'maintain'
      ? `Esta recomendação baseia-se na análise dos dados de mercado actuais, no comportamento dos compradores e na velocidade de transacção da zona. O objectivo é maximizar o valor final da venda dentro de um prazo razoável.`
      : `Vamos continuar a trabalhar activamente na divulgação do seu imóvel e a qualificar os potenciais compradores. Qualquer proposta será prontamente comunicada.`
  }

Estamos ao seu dispor para qualquer questão ou para marcar uma reunião de avaliação.

Com os melhores cumprimentos,
Agency Group | AMI 22506
`

  const headline =
    rec === 'maintain'
      ? `${req.typology} ${req.zone}: ${metrics.weekly_visits} visitas esta semana, preço bem posicionado`
      : `${req.typology} ${req.zone}: ${domText} mercado — recomendação de revisão de preço`

  const whatsappLines: Record<PriceRecommendation, string> = {
    maintain: `✅ ${firstName} — ${metrics.weekly_views} views, ${metrics.weekly_visits} visitas esta semana. Preço OK. Relatório enviado.`,
    reduce_3: `${firstName} — relatório semanal enviado. Recomendamos -3% (€${suggestedK}K). ${domText} mercado. Ligue para falar.`,
    reduce_5: `${firstName} — ${domText} mercado, ${metrics.weekly_views} views. Recomendamos €${suggestedK}K (-5%). Relatório no email.`,
    reduce_10: `${firstName} — relatório enviado. Mercado indica revisão para €${suggestedK}K. Importante falar esta semana.`,
    increase: `✅ ${firstName} — forte procura! ${metrics.weekly_inquiries} pedidos esta semana. Podemos subir para €${suggestedK}K. Ligue.`,
  }

  return {
    report_text,
    headline,
    whatsapp_summary: whatsappLines[rec].slice(0, 160),
  }
}

// ─── Report Generator: English ────────────────────────────────────────────────

function generateReportEN(
  req: VendorReportRequest,
  dom: number,
  metrics: MetricsSummary,
  rec: PriceRecommendation,
  suggested_price?: number
): { report_text: string; headline: string; whatsapp_summary: string } {
  const firstName = req.owner_name.split(' ')[0]
  const domText = dom === 1 ? '1 day' : `${dom} days`
  const priceK = (req.asking_price / 1000).toFixed(0)
  const suggestedK = suggested_price ? (suggested_price / 1000).toFixed(0) : null

  const recMessages: Record<PriceRecommendation, string> = {
    maintain: 'The asking price is well-positioned against the current market. We recommend maintaining the current strategy.',
    reduce_3: `We recommend a slight price adjustment to €${suggestedK}K (-3%) to increase competitiveness and attract more offers.`,
    reduce_5: `We recommend a price revision to €${suggestedK}K (-5%). This correction should significantly increase traffic and viewings.`,
    reduce_10: `Market data indicates a more significant price revision is needed. We recommend €${suggestedK}K (-10%) to ensure a sale within the next 30-45 days.`,
    increase: `Your property is receiving strong demand. We have room to adjust the price to €${suggestedK}K (+2%) without losing momentum.`,
  }

  const report_text = `Dear ${firstName},

Please find below your weekly property report for ${req.property_address}.

WEEKLY ACTIVITY SUMMARY
Your property has been on the market for ${domText}. This week we recorded ${metrics.weekly_views} portal views, ${metrics.weekly_visits} in-person viewing${metrics.weekly_visits !== 1 ? 's' : ''}, and ${metrics.weekly_inquiries} enquir${metrics.weekly_inquiries !== 1 ? 'ies' : 'y'}.

VISITOR FEEDBACK
Average visitor feedback score: ${metrics.avg_feedback.toFixed(1)}/5.0. ${
    metrics.avg_feedback >= 4.0
      ? 'Buyers are responding very positively to the property.'
      : metrics.avg_feedback >= 3.5
      ? 'Feedback is moderate — buyers appreciate the property but note price competitiveness concerns.'
      : 'Visitors are flagging competing alternatives at similar price points in the area.'
  }

MARKET ANALYSIS
Current asking price: €${priceK}K (€${metrics.price_per_m2.toFixed(0)}/m²). Recent comparable sales in ${req.zone} averaged €${metrics.comparable_price_per_m2.toFixed(0)}/m². Your property is priced ${
    metrics.price_vs_comparable_pct > 5
      ? `${metrics.price_vs_comparable_pct.toFixed(1)}% above comparables`
      : metrics.price_vs_comparable_pct < -5
      ? `${Math.abs(metrics.price_vs_comparable_pct).toFixed(1)}% below comparables`
      : 'in line with comparable sales'
  }. There are currently ${req.comparable_active} active competing listings in the same zone and typology.

RECOMMENDATION
${recMessages[rec]}

We remain at your full disposal to discuss strategy or schedule a market review meeting.

Kind regards,
Agency Group | AMI 22506
`

  const headline =
    rec === 'maintain'
      ? `${req.typology} ${req.zone}: ${metrics.weekly_visits} viewings this week, price well-positioned`
      : `${req.typology} ${req.zone}: ${domText} on market — price revision recommended`

  const whatsappLines: Record<PriceRecommendation, string> = {
    maintain: `✅ ${firstName} — ${metrics.weekly_views} views, ${metrics.weekly_visits} viewings this week. Price OK. Report sent.`,
    reduce_3: `${firstName} — weekly report sent. Recommend -3% (€${suggestedK}K). ${domText} on market. Call to discuss.`,
    reduce_5: `${firstName} — ${domText} on market. Recommend €${suggestedK}K (-5%). Report in your email.`,
    reduce_10: `${firstName} — report sent. Market signals €${suggestedK}K revision needed. Important to speak this week.`,
    increase: `✅ ${firstName} — strong demand! ${metrics.weekly_inquiries} enquiries this week. Room to go to €${suggestedK}K. Call me.`,
  }

  return {
    report_text,
    headline,
    whatsapp_summary: whatsappLines[rec].slice(0, 160),
  }
}

// ─── Report Generator: French ────────────────────────────────────────────────

function generateReportFR(
  req: VendorReportRequest,
  dom: number,
  metrics: MetricsSummary,
  rec: PriceRecommendation,
  suggested_price?: number
): { report_text: string; headline: string; whatsapp_summary: string } {
  const firstName = req.owner_name.split(' ')[0]
  const domText = dom === 1 ? '1 jour' : `${dom} jours`
  const priceK = (req.asking_price / 1000).toFixed(0)
  const suggestedK = suggested_price ? (suggested_price / 1000).toFixed(0) : null

  const recMessages: Record<PriceRecommendation, string> = {
    maintain: 'Le prix demandé est bien positionné par rapport au marché actuel. Nous recommandons de maintenir la stratégie en place.',
    reduce_3: `Nous recommandons un léger ajustement de prix à €${suggestedK}K (-3%) pour renforcer la compétitivité et attirer davantage d'offres.`,
    reduce_5: `Nous recommandons une révision du prix à €${suggestedK}K (-5%). Cette correction devrait augmenter significativement le trafic et les visites.`,
    reduce_10: `Les données du marché indiquent qu'une révision plus importante est nécessaire. Nous recommandons €${suggestedK}K (-10%) pour assurer une vente dans les 30-45 prochains jours.`,
    increase: `Votre bien reçoit une forte demande. Nous avons la possibilité d'ajuster le prix à €${suggestedK}K (+2%) sans perdre de dynamique.`,
  }

  const report_text = `Cher/Chère ${firstName},

Veuillez trouver ci-dessous votre rapport hebdomadaire pour le bien situé au ${req.property_address}.

RÉSUMÉ D'ACTIVITÉ — CETTE SEMAINE
Votre bien est sur le marché depuis ${domText}. Cette semaine, nous avons enregistré ${metrics.weekly_views} vues sur les portails immobiliers, ${metrics.weekly_visits} visite${metrics.weekly_visits !== 1 ? 's' : ''} en personne et ${metrics.weekly_inquiries} demande${metrics.weekly_inquiries !== 1 ? 's' : ''} d'information.

RETOURS DES VISITEURS
Score moyen de satisfaction des visiteurs : ${metrics.avg_feedback.toFixed(1)}/5.0. ${
    metrics.avg_feedback >= 4.0
      ? "Les acheteurs répondent très positivement au bien."
      : metrics.avg_feedback >= 3.5
      ? 'Les retours sont modérés — les visiteurs apprécient le bien mais soulèvent des préoccupations concernant le prix.'
      : 'Les visiteurs signalent des alternatives concurrentes mieux positionnées dans la même fourchette de prix.'
  }

ANALYSE DE MARCHÉ
Prix demandé actuel : €${priceK}K (€${metrics.price_per_m2.toFixed(0)}/m²). Les ventes comparables récentes à ${req.zone} ont atteint en moyenne €${metrics.comparable_price_per_m2.toFixed(0)}/m². Votre bien est actuellement ${
    metrics.price_vs_comparable_pct > 5
      ? `${metrics.price_vs_comparable_pct.toFixed(1)}% au-dessus des comparables`
      : metrics.price_vs_comparable_pct < -5
      ? `${Math.abs(metrics.price_vs_comparable_pct).toFixed(1)}% en dessous des comparables`
      : 'aligné avec les ventes comparables'
  }. Il y a actuellement ${req.comparable_active} annonces concurrentes actives dans la même zone et typologie.

RECOMMANDATION
${recMessages[rec]}

Nous restons à votre entière disposition pour discuter de la stratégie ou organiser une réunion d'évaluation de marché.

Cordialement,
Agency Group | AMI 22506
`

  const headline =
    rec === 'maintain'
      ? `${req.typology} ${req.zone} : ${metrics.weekly_visits} visites cette semaine, prix bien positionné`
      : `${req.typology} ${req.zone} : ${domText} sur le marché — révision de prix recommandée`

  const whatsappLines: Record<PriceRecommendation, string> = {
    maintain: `✅ ${firstName} — ${metrics.weekly_views} vues, ${metrics.weekly_visits} visites cette semaine. Prix OK. Rapport envoyé.`,
    reduce_3: `${firstName} — rapport envoyé. Recommande -3% (€${suggestedK}K). ${domText} marché. Appelez pour en parler.`,
    reduce_5: `${firstName} — ${domText} marché. Recommande €${suggestedK}K (-5%). Rapport dans votre email.`,
    reduce_10: `${firstName} — rapport envoyé. Marché indique révision €${suggestedK}K. Important de se parler cette semaine.`,
    increase: `✅ ${firstName} — forte demande ! ${metrics.weekly_inquiries} demandes cette semaine. Possible monter à €${suggestedK}K. Appelez.`,
  }

  return {
    report_text,
    headline,
    whatsapp_summary: whatsappLines[rec].slice(0, 160),
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<VendorReportResponse | { error: string }>> {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await request.json()) as VendorReportRequest

    // Validate required fields
    const required: (keyof VendorReportRequest)[] = [
      'property_id',
      'property_address',
      'asking_price',
      'listing_start_date',
      'zone',
      'typology',
      'area_m2',
      'visits_this_week',
      'views_this_week',
      'inquiries_this_week',
      'avg_feedback_score',
      'comparable_active',
      'comparable_sold_price',
      'owner_name',
      'owner_language',
    ]

    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json({ error: `Campo obrigatório em falta: ${field}` }, { status: 400 })
      }
    }

    // Validate asking price
    if (body.asking_price <= 0) {
      return NextResponse.json({ error: 'asking_price deve ser maior que 0' }, { status: 400 })
    }

    // Validate listing date
    const listingDate = new Date(body.listing_start_date)
    if (isNaN(listingDate.getTime())) {
      return NextResponse.json({ error: 'listing_start_date inválido. Formato esperado: YYYY-MM-DD' }, { status: 400 })
    }

    const dom = calcDaysOnMarket(body.listing_start_date)
    const pricePerM2 = body.asking_price / body.area_m2
    const comparablePricePerM2 = body.comparable_sold_price / body.area_m2
    const priceVsComparablePct =
      ((body.asking_price - body.comparable_sold_price) / body.comparable_sold_price) * 100

    const metrics: MetricsSummary = {
      days_on_market: dom,
      price_per_m2: Math.round(pricePerM2),
      comparable_price_per_m2: Math.round(comparablePricePerM2),
      price_vs_comparable_pct: Math.round(priceVsComparablePct * 10) / 10,
      weekly_views: body.views_this_week,
      weekly_visits: body.visits_this_week,
      weekly_inquiries: body.inquiries_this_week,
      avg_feedback: body.avg_feedback_score,
    }

    const { recommendation, suggested_price } = determineRecommendation(
      dom,
      body.views_this_week,
      body.avg_feedback_score,
      body.inquiries_this_week,
      body.asking_price,
      body.comparable_sold_price
    )

    // Determine language
    const langMap: Record<string, Language> = {
      pt: 'pt',
      portuguese: 'pt',
      português: 'pt',
      en: 'en',
      english: 'en',
      fr: 'fr',
      french: 'fr',
      français: 'fr',
    }
    const lang: Language = langMap[body.owner_language.toLowerCase()] ?? 'en'

    let reportContent: { report_text: string; headline: string; whatsapp_summary: string }

    if (lang === 'pt') {
      reportContent = generateReportPT(body, dom, metrics, recommendation, suggested_price)
    } else if (lang === 'fr') {
      reportContent = generateReportFR(body, dom, metrics, recommendation, suggested_price)
    } else {
      reportContent = generateReportEN(body, dom, metrics, recommendation, suggested_price)
    }

    const response: VendorReportResponse = {
      report_text: reportContent.report_text,
      recommendation,
      ...(suggested_price !== undefined ? { suggested_price } : {}),
      headline: reportContent.headline,
      metrics_summary: metrics,
      whatsapp_summary: reportContent.whatsapp_summary,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[vendor-report] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno ao gerar relatório de proprietário' },
      { status: 500 }
    )
  }
}
