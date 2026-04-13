// =============================================================================
// Agency Group — Call Engine
// lib/call-engine.ts
//
// Gera scripts de chamada, WhatsApp, follow-up, objeções e CPCV push.
// Output: curto, direto, sempre com CTA de visita.
// Regra: ≤ 20 segundos de fala = ≤ 55 palavras no script de abertura.
// =============================================================================

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CallLeadInput {
  id: string
  nome: string
  cidade: string | null
  tipo_ativo: string | null
  price_ask: number | null
  area_m2: number | null
  score: number | null
  owner_name: string | null
  contact_phone_owner: string | null
  contacto: string | null
  buyer_pressure_class: string | null         // HIGH / MEDIUM / LOW / null
  seller_intent_label: string | null          // hot / warm / neutral / cold / unknown
  deal_readiness_score: number | null         // 0-100
  cpcv_probability: number | null             // 0-100
  matched_buyers_count: number | null
  best_buyer_match_score: number | null
  execution_blocker_reason: string | null
  master_attack_rank: number | null
  revenue_per_lead_estimate: number | null
  contact_attempts_count?: number | null      // migration 019
  last_call_at?: string | null               // migration 019
}

export interface CallScript {
  type: 'first_call' | 'followup' | 'visit_close' | 'cpcv_push' | 'whatsapp_d1' | 'whatsapp_d2' | 'whatsapp_d4'
  script: string
  objective: string
  cta: string
  duration_estimate_sec: number
  notes: string[]
}

export interface ObjectionHandler {
  trigger: string
  objection: string
  response: string
  followup: string
}

export interface CallEngineOutput {
  lead_id: string
  scripts: CallScript[]
  objections: ObjectionHandler[]
  followup_sequence: FollowUpStep[]
  recommended_script: CallScript
  seller_name: string
  zona: string
  ativo: string
  preco_label: string
  buyer_summary: string
  urgency_label: string
  call_window_label: string
}

export interface FollowUpStep {
  day: number
  channel: 'call' | 'whatsapp' | 'email'
  timing: string
  script: string
  objective: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sellerFirstName(lead: CallLeadInput): string {
  if (lead.owner_name) {
    return lead.owner_name.split(' ')[0]
  }
  return '[Nome]'
}

function formatPreco(priceAsk: number | null): string {
  if (!priceAsk) return ''
  if (priceAsk >= 1_000_000) return `€${(priceAsk / 1_000_000).toFixed(1).replace('.0', '')}M`
  return `€${Math.round(priceAsk / 1000)}K`
}

function getZona(lead: CallLeadInput): string {
  return lead.cidade ?? 'zona em análise'
}

function getAtivo(lead: CallLeadInput): string {
  const t = lead.tipo_ativo ?? 'imóvel'
  if (lead.area_m2) return `${t} de ${lead.area_m2}m²`
  return t
}

function getBuyerSummary(lead: CallLeadInput): string {
  const count = lead.matched_buyers_count ?? 0
  const pressure = lead.buyer_pressure_class
  if (count === 0) return 'comprador em análise'
  if (pressure === 'HIGH') return `${count} comprador${count > 1 ? 'es' : ''} altamente motivado${count > 1 ? 's' : ''} com liquidez imediata`
  if (pressure === 'MEDIUM') return `${count} comprador${count > 1 ? 'es' : ''} com orçamento confirmado`
  return `${count} comprador${count > 1 ? 'es' : ''} ativo${count > 1 ? 's' : ''} em carteira`
}

function getUrgencyLabel(lead: CallLeadInput): string {
  const intent = lead.seller_intent_label
  if (intent === 'hot') return 'vendedor motivado'
  if (intent === 'warm') return 'abertura real'
  if (lead.cpcv_probability && lead.cpcv_probability >= 65) return 'deal próximo de fechar'
  return 'oportunidade em avaliação'
}

function getPrecoLabel(lead: CallLeadInput): string {
  const p = formatPreco(lead.price_ask)
  return p ? `pedido ${p}` : 'preço a confirmar'
}

function getCallWindow(): string {
  const h = new Date().getHours()
  if (h >= 9 && h < 12) return 'Boa hora para ligar (manhã)'
  if (h >= 14 && h < 18) return 'Boa hora para ligar (tarde)'
  if (h >= 18 && h < 20) return 'Hora limite (final do dia)'
  return 'Fora da janela ideal — agendar para amanhã 10h'
}

// ── SCRIPT GENERATORS ────────────────────────────────────────────────────────

export function generateFirstCallScript(lead: CallLeadInput): CallScript {
  const nome = sellerFirstName(lead)
  const zona = getZona(lead)
  const ativo = getAtivo(lead)
  const buyers = getBuyerSummary(lead)

  const script = `Olá ${nome}, bom dia. Fala o Carlos da Agency Group.

Ligo-lhe diretamente porque tenho ${buyers} para um ${ativo} na zona de ${zona}.

Antes de avançar com eles, queria perceber se faz sentido conversarmos.

Consegue receber-me esta semana — amanhã ao final do dia ou quinta de manhã?`

  return {
    type: 'first_call',
    script,
    objective: 'Marcar visita dentro de 48 horas',
    cta: 'Amanhã ao final do dia ou quinta de manhã?',
    duration_estimate_sec: 18,
    notes: [
      'Falar devagar, com confiança — nunca urgência',
      'Se hesitar: usar escolha fechada imediatamente',
      'Não explicar quem é o comprador — criar curiosidade',
      'Se pedir mais info: "Prefiro mostrar-lhe pessoalmente"',
    ],
  }
}

export function generateFollowUpScript(lead: CallLeadInput): CallScript {
  const nome = sellerFirstName(lead)
  const zona = getZona(lead)
  const attempts = lead.contact_attempts_count ?? 1

  let opening = `Olá ${nome}, boa tarde. Carlos da Agency Group.`
  let body: string

  if (attempts === 1) {
    body = `Tentei contactar ontem. Tenho um comprador concreto para a sua zona de ${zona} e queria perceber se há abertura.`
  } else if (attempts === 2) {
    body = `Tenho estado a tentar falar consigo. O comprador que tenho para ${zona} tem deadline esta semana.`
  } else {
    body = `Última tentativa da minha parte. Se tiver abertura para conversar, estou disponível. Caso contrário, fico à sua disposição quando for conveniente.`
  }

  const script = `${opening}

${body}

Consegue dois minutos agora?`

  return {
    type: 'followup',
    script,
    objective: attempts <= 2 ? 'Obter resposta — criar urgência de comprador' : 'Última tentativa — abrir porta futura',
    cta: 'Consegue dois minutos agora?',
    duration_estimate_sec: 12,
    notes: [
      attempts === 3 ? 'Se não responde: passar para WhatsApp D4 e fechar ciclo' : 'Mencionar deadline do comprador cria urgência real',
      'Nunca pedir desculpa por ligar',
      'Tom: profissional, direto, sem pressão explícita',
    ],
  }
}

export function generateVisitCloseScript(lead: CallLeadInput): CallScript {
  const zona = getZona(lead)
  const preco = getPrecoLabel(lead)

  const script = `Consigo alinhar a visita ainda esta semana.

Para o ${zona}, ${preco} — tenho o comprador disponível.

Prefere que eu passe amanhã ao final do dia ou na quinta de manhã?`

  return {
    type: 'visit_close',
    script,
    objective: 'Confirmar data e hora da visita — nunca sair sem data',
    cta: 'Amanhã ao final do dia ou quinta de manhã?',
    duration_estimate_sec: 10,
    notes: [
      'Escolha SEMPRE fechada — nunca "quando lhe der jeito"',
      'Se as duas opções forem recusadas: "Então quando é melhor para si?"',
      'Confirmar imediatamente por WhatsApp após chamada',
      'Registar first_meeting_at no portal assim que confirmar',
    ],
  }
}

export function generateCPCVPushScript(lead: CallLeadInput): CallScript {
  const nome = sellerFirstName(lead)
  const preco = formatPreco(lead.price_ask)
  const buyers = lead.matched_buyers_count ?? 1
  const pressure = lead.buyer_pressure_class

  let urgency = ''
  if (pressure === 'HIGH') {
    urgency = 'Está pronto para avançar esta semana — liquidez imediata.'
  } else {
    urgency = 'Tem prazo para tomar decisão ainda este mês.'
  }

  const script = `${nome}, bom dia. Carlos da Agency.

Tenho ${buyers > 1 ? `${buyers} compradores` : 'um comprador'} pronto${buyers > 1 ? 's' : ''} para avançar${preco ? ` a ${preco}` : ''}.

${urgency}

Se alinharmos hoje, consigo formalizar o CPCV ainda esta semana.

Faz sentido avançarmos?`

  return {
    type: 'cpcv_push',
    script,
    objective: 'Fechar acordo verbal — CPCV esta semana',
    cta: 'Faz sentido avançarmos?',
    duration_estimate_sec: 20,
    notes: [
      'Só usar quando: readiness ≥80 + buyer HIGH + cpcv_prob ≥65',
      'Ter advogado/solicitador já contactado antes desta chamada',
      'Se sim: marcar reunião de assinatura nas próximas 48h',
      'Se hesitar: "O que precisaria para avançar esta semana?"',
    ],
  }
}

// ── WHATSAPP SCRIPTS ──────────────────────────────────────────────────────────

export function generateWhatsAppD1(lead: CallLeadInput): CallScript {
  const nome = sellerFirstName(lead)
  const zona = getZona(lead)

  const script = `Olá ${nome} 👋

Carlos da Agency Group. Tentei ligar-lhe hoje.

Tenho um comprador ativo para a zona de ${zona}.

Quando lhe dá mais jeito falar — hoje à tarde ou amanhã de manhã?`

  return {
    type: 'whatsapp_d1',
    script,
    objective: 'Obter resposta — abrir conversa',
    cta: 'Hoje à tarde ou amanhã de manhã?',
    duration_estimate_sec: 0,
    notes: [
      'Enviar entre 10h-12h ou 15h-17h',
      'Máximo 4 linhas',
      'Nunca enviar "Olá" sozinho e esperar resposta',
      'Se não responder em 24h → D2',
    ],
  }
}

export function generateWhatsAppD2(lead: CallLeadInput): CallScript {
  const zona = getZona(lead)
  const buyers = lead.matched_buyers_count ?? 1

  const script = `Boa tarde 👋

O comprador que tenho para ${zona} continua ativo.

${buyers > 1 ? `Tenho ${buyers} interessados` : 'Tem prazo limitado'} — queria perceber se há abertura da sua parte.

Dois minutos por telefone?`

  return {
    type: 'whatsapp_d2',
    script,
    objective: 'Criar urgência — obter chamada',
    cta: 'Dois minutos por telefone?',
    duration_estimate_sec: 0,
    notes: [
      'Mencionar número de compradores cria urgência',
      'Não repetir quem és — já sabe',
      'Se não responder → D4 (última tentativa)',
    ],
  }
}

export function generateWhatsAppD4(lead: CallLeadInput): CallScript {
  const nome = sellerFirstName(lead)

  const script = `${nome}, última mensagem da minha parte.

Se surgir abertura para avaliar uma proposta, pode contactar-me diretamente.

Fico à sua disposição. Carlos — Agency Group 📱`

  return {
    type: 'whatsapp_d4',
    script,
    objective: 'Fechar ciclo — deixar porta aberta',
    cta: '— (sem CTA direto — respeita a decisão)',
    duration_estimate_sec: 0,
    notes: [
      'Após D4 sem resposta: marcar como "not_interested" no portal',
      'Adicionar à watchlist para recontacto em 90 dias',
      'Não enviar mais mensagens após este ponto',
    ],
  }
}

// ── OBJECTION ENGINE ─────────────────────────────────────────────────────────

export function generateObjectionHandlers(): ObjectionHandler[] {
  return [
    {
      trigger: 'Não estou interessado',
      objection: 'Não estou interessado em vender.',
      response: 'Percebo totalmente. Só para não perdermos oportunidade — se tivesse uma proposta concreta acima do valor de mercado, teria abertura para avaliar?',
      followup: 'Se sim → "Então vale a pena conversarmos. Quando posso passar 15 minutos?" | Se não → "Respeito. Posso deixar o meu contacto caso mude de ideias?"',
    },
    {
      trigger: 'Não quero vender',
      objection: 'Não estou a pensar vender agora.',
      response: 'Totalmente válido. A questão não é vender — é perceber se o preço certo existe. Se eu lhe trouxesse uma proposta 15-20% acima do que expectava, consideraria?',
      followup: 'A maioria das vendas off-market nasce desta pergunta. Tom: tranquilo, sem pressão.',
    },
    {
      trigger: 'Não tenho tempo',
      objection: 'Agora não tenho tempo para isto.',
      response: 'Claro. É uma visita de 15 minutos — ajusto-me completamente ao seu horário. Quando é melhor para si esta semana?',
      followup: 'Escolha fechada: "Amanhã ou quinta?" — nunca "qualquer dia".',
    },
    {
      trigger: 'Já tenho agente',
      objection: 'Já tenho agência a tratar disto.',
      response: 'Perfeito. Posso complementar com compradores adicionais da nossa carteira exclusiva sem interferir com o processo que já tem em curso.',
      followup: 'Não competir — complementar. Mencionar carteira exclusiva de HNWI como diferencial.',
    },
    {
      trigger: 'Qual o preço',
      objection: 'Qual é o preço que o comprador oferece?',
      response: 'É uma questão que prefiro alinhar pessoalmente — há nuances que não fazem justiça por telefone. Quando posso passar?',
      followup: 'Nunca dar preço por telefone — destrói margem negocial. A visita é o objetivo.',
    },
    {
      trigger: 'Mande por email',
      objection: 'Pode mandar informação por email?',
      response: 'Posso. Mas para ser honesto, o que tenho para lhe mostrar é muito mais concreto numa conversa de 15 minutos. Quando está disponível esta semana?',
      followup: 'Se insistir em email: enviar 3 linhas máximo + pedir reunião no final.',
    },
    {
      trigger: 'Vou pensar',
      objection: 'Deixe-me pensar e depois ligo-lhe.',
      response: 'Claro. O comprador tem prazo — posso ligar-lhe amanhã às 10h para sabermos se avançamos?',
      followup: 'Nunca deixar o follow-up na mão deles. Agendar chamada concreta.',
    },
    {
      trigger: 'O preço é baixo',
      objection: 'Esse valor está abaixo do que espero.',
      response: 'Entendo. Qual é a sua expectativa de preço? Quero perceber se há margem para trabalhar.',
      followup: 'Ouvir sem julgar. Depois: "Consigo trabalhar para que o comprador se aproxime — posso passar mostrar os números?"',
    },
  ]
}

// ── FOLLOW-UP SEQUENCE ────────────────────────────────────────────────────────

export function generateFollowUpSequence(lead: CallLeadInput): FollowUpStep[] {
  const nome = sellerFirstName(lead)
  const zona = getZona(lead)

  return [
    {
      day: 0,
      channel: 'call',
      timing: 'Hoje 10h-12h ou 15h-17h',
      script: generateFirstCallScript(lead).script,
      objective: 'Marcar visita',
    },
    {
      day: 1,
      channel: 'whatsapp',
      timing: 'Amanhã 10h-11h',
      script: generateWhatsAppD1(lead).script,
      objective: 'Obter resposta — abrir canal WA',
    },
    {
      day: 2,
      channel: 'call',
      timing: 'D+2 15h',
      script: generateFollowUpScript({ ...lead, contact_attempts_count: 2 }).script,
      objective: 'Segunda tentativa — mencionar deadline comprador',
    },
    {
      day: 4,
      channel: 'whatsapp',
      timing: 'D+4 manhã',
      script: `${nome}, última mensagem da minha parte. Comprador para ${zona} ainda ativo. Se houver abertura, estou disponível. Carlos — Agency Group`,
      objective: 'Última tentativa — fechar ciclo ou marcar watchlist 90d',
    },
  ]
}

// ── MAIN GENERATOR ────────────────────────────────────────────────────────────

export function generateCallEngineOutput(lead: CallLeadInput): CallEngineOutput {
  const readiness = lead.deal_readiness_score ?? 0
  const cpcvProb = lead.cpcv_probability ?? 0
  const pressure = lead.buyer_pressure_class
  const attempts = lead.contact_attempts_count ?? 0

  // Choose recommended script based on pipeline state
  let recommended: CallScript

  if (readiness >= 80 && pressure === 'HIGH' && cpcvProb >= 65) {
    recommended = generateCPCVPushScript(lead)
  } else if (attempts === 0) {
    recommended = generateFirstCallScript(lead)
  } else if (attempts >= 1 && attempts <= 2) {
    recommended = generateFollowUpScript(lead)
  } else {
    recommended = generateVisitCloseScript(lead)
  }

  return {
    lead_id: lead.id,
    scripts: [
      generateFirstCallScript(lead),
      generateFollowUpScript(lead),
      generateVisitCloseScript(lead),
      generateCPCVPushScript(lead),
      generateWhatsAppD1(lead),
      generateWhatsAppD2(lead),
      generateWhatsAppD4(lead),
    ],
    objections: generateObjectionHandlers(),
    followup_sequence: generateFollowUpSequence(lead),
    recommended_script: recommended,
    seller_name: sellerFirstName(lead),
    zona: getZona(lead),
    ativo: getAtivo(lead),
    preco_label: getPrecoLabel(lead),
    buyer_summary: getBuyerSummary(lead),
    urgency_label: getUrgencyLabel(lead),
    call_window_label: getCallWindow(),
  }
}
