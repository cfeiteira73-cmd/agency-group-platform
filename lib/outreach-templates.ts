// =============================================================================
// Agency Group — Outreach Templates & Scripts Library
// Wave 10+11: All commercial scripts for sellers, partners, buyers, negotiation
// Used in PortalDealDesk and PortalOffmarketLeads
// =============================================================================

export type TemplateCategory =
  | 'seller_first' | 'seller_second' | 'seller_post_interest'
  | 'seller_email' | 'seller_call'
  | 'partner_whatsapp' | 'partner_email' | 'partner_call'
  | 'reactivation' | 'post_meeting'
  | 'buyer_match' | 'pre_close'
  | 'buyer_first_contact' | 'buyer_qualify_fast' | 'buyer_pressure' | 'buyer_followup'
  | 'negotiation_buyer' | 'negotiation_seller' | 'negotiation_blocked'
  | 'objection_public' | 'objection_price' | 'objection_evaluating'
  | 'objection_agencies' | 'objection_no_urgency' | 'objection_message_only'
  | 'close_objection_think' | 'close_objection_sinal' | 'close_objection_deadline'
  | 'close_objection_other_option'

export interface OutreachTemplate {
  id: TemplateCategory
  label: string
  channel: 'whatsapp' | 'email' | 'call' | 'universal'
  subject?: string              // email only
  body: string
  tags: string[]
}

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  // ── SELLER SCRIPTS ─────────────────────────────────────────────────────────

  {
    id: 'seller_first',
    label: 'WhatsApp — Primeiro Contacto (Seller)',
    channel: 'whatsapp',
    body: `Bom dia, falo da Agency Group.
Temos atualmente procura ativa para ativos com este perfil na sua zona.
Trabalhamos de forma confidencial e muito focada em execução.
Faz sentido fazermos uma avaliação sem compromisso?`,
    tags: ['seller', 'primeiro-contacto', 'off-market', 'outreach'],
  },

  {
    id: 'seller_second',
    label: 'WhatsApp — Segundo Toque (Seller)',
    channel: 'whatsapp',
    body: `Bom dia. Retomo o meu contacto anterior.
Continuamos com procura ativa para este tipo de ativo e posso enquadrar rapidamente o mercado e o potencial de saída, com total discrição.
Faz sentido falarmos 5 minutos?`,
    tags: ['seller', 'follow-up', 'reactivacao'],
  },

  {
    id: 'seller_post_interest',
    label: 'WhatsApp — Pós-Interesse (Seller)',
    channel: 'whatsapp',
    body: `Perfeito. Para enquadrarmos corretamente, preciso apenas de perceber três pontos: localização exata, tipologia/área e expectativa de valor.
A partir daí consigo dizer-lhe se faz mais sentido um circuito reservado ou exposição mais ampla.`,
    tags: ['seller', 'qualificacao'],
  },

  {
    id: 'seller_email',
    label: 'Email — Seller Off-Market',
    channel: 'email',
    subject: 'Procura ativa para ativo na sua zona',
    body: `Estamos neste momento a acompanhar clientes qualificados com procura ativa na sua zona para ativos com este perfil.

A Agency Group trabalha em contexto confidencial, com forte foco em qualificação de compradores e rapidez de execução.

Se fizer sentido, teremos gosto em enquadrar o ativo sem compromisso.

Com os melhores cumprimentos,
Agency Group · AMI 22506`,
    tags: ['seller', 'email', 'off-market'],
  },

  {
    id: 'seller_call',
    label: 'Call Script — Seller',
    channel: 'call',
    body: `Bom dia, fala [nome] da Agency Group.
Estou a contactá-lo porque temos procura ativa para ativos com este perfil na sua zona.
Trabalhamos muito em contexto reservado e com seleção de compradores.
Faz sentido percebermos rapidamente se existe abertura para avaliação ou venda?`,
    tags: ['seller', 'call', 'off-market'],
  },

  // ── PARTNER / INSTITUTIONAL SCRIPTS ────────────────────────────────────────

  {
    id: 'partner_whatsapp',
    label: 'WhatsApp — Parceiro (Advogado/Contabilista)',
    channel: 'whatsapp',
    body: `Bom dia. Trabalho com operações imobiliárias off-market e clientes qualificados.
Se surgir algum ativo em contexto de herança, insolvência, reestruturação ou venda discreta, conseguimos estruturar e executar com rapidez e confidencialidade.
Faz sentido alinharmos?`,
    tags: ['parceiro', 'institucional', 'off-market'],
  },

  {
    id: 'partner_email',
    label: 'Email — Parceiro Institucional',
    channel: 'email',
    subject: 'Colaboração em operações imobiliárias discretas',
    body: `A Agency Group trabalha com clientes qualificados e operações conduzidas com discrição e controlo.

Quando surgem ativos fora do mercado, conseguimos estruturar rapidamente o processo, filtrar compradores e acelerar execução.

Caso faça sentido, terei gosto em alinhar consigo um modelo simples de colaboração.

Com os melhores cumprimentos,
Agency Group · AMI 22506`,
    tags: ['parceiro', 'email', 'institucional'],
  },

  {
    id: 'partner_call',
    label: 'Call Script — Parceiro',
    channel: 'call',
    body: `Bom dia, fala [nome] da Agency Group.
[Contexto breve — como conheceu ou de onde vem o contacto]
Trabalho em operações imobiliárias discretas e com clientes qualificados.
Quando surgem ativos fora do mercado — herança, reestruturação, venda discreta — conseguimos estruturar e executar com rapidez e confidencialidade.
Faz sentido agendarmos 10 minutos para alinharmos?`,
    tags: ['parceiro', 'call'],
  },

  // ── REACTIVATION ───────────────────────────────────────────────────────────

  {
    id: 'reactivation',
    label: 'WhatsApp — Reativação (Dormentes)',
    channel: 'whatsapp',
    body: `Bom dia, retomo o nosso contacto.
Continuamos com procura activa na sua zona.
Há interesse em avaliarmos a situação?`,
    tags: ['reativacao', 'dormentes'],
  },

  // ── POST MEETING ────────────────────────────────────────────────────────────

  {
    id: 'post_meeting',
    label: 'WhatsApp/Email — Pós-Reunião',
    channel: 'universal',
    body: `Obrigado pela reunião de hoje.
Conforme acordado, o próximo passo é [PRÓXIMO PASSO].
Fico ao dispor para qualquer questão.
Agency Group`,
    tags: ['pos-reuniao', 'follow-up', 'seller'],
  },

  // ── BUYER MATCHING ──────────────────────────────────────────────────────────

  {
    id: 'buyer_match',
    label: 'WhatsApp — Buyer Match (Comprador Potencial)',
    channel: 'whatsapp',
    body: `Bom dia, [nome].
Tenho um ativo off-market que pode encaixar bem no que procura: [tipo] em [zona], [valor estimado], fora de mercado aberto.
Posso partilhar os detalhes com total discrição. Faz sentido?`,
    tags: ['comprador', 'buyer-match', 'off-market'],
  },

  {
    id: 'pre_close',
    label: 'WhatsApp — Pré-Fecho (Seller + Buyer Alinhado)',
    channel: 'whatsapp',
    body: `Bom dia.
Temos neste momento um perfil de comprador qualificado com interesse real para ativos nesta zona e faixa de valor.
Conseguimos estruturar uma abordagem reservada, rápida e sem exposição pública.
Tem disponibilidade para uma chamada esta semana?`,
    tags: ['pre-fecho', 'seller', 'buyer-match'],
  },

  // ── BUYER OUTREACH SCRIPTS (FASE 18) ───────────────────────────────────────

  {
    id: 'buyer_first_contact',
    label: 'WhatsApp — Primeiro Contacto (Comprador)',
    channel: 'whatsapp',
    body: `Bom dia, [nome].
Falo da Agency Group. Tenho neste momento um ativo off-market com perfil que pode encaixar no que procura: [tipo] em [zona], estimativa de valor €[valor], fora de qualquer portal.
Trabalho com total discrição e seleção rigorosa de compradores.
Faz sentido partilhar os detalhes consigo?`,
    tags: ['comprador', 'primeiro-contacto', 'off-market', 'outreach'],
  },

  {
    id: 'buyer_qualify_fast',
    label: 'WhatsApp — Qualificação Rápida (Comprador)',
    channel: 'whatsapp',
    body: `[nome], para validar o enquadramento correto preciso de confirmar três pontos rapidamente:
1. Zona prioritária — ainda é [zona]?
2. Tipologia — foco em [tipo] ou aberto a outras?
3. Timing — procura ativa agora ou horizonte de X meses?
Com isso consigo dizer-lhe já se este ativo faz sentido.`,
    tags: ['comprador', 'qualificacao', 'off-market'],
  },

  {
    id: 'buyer_pressure',
    label: 'WhatsApp — Pressão de Execução (Comprador)',
    channel: 'whatsapp',
    body: `[nome], o ativo que partilhei tem neste momento mais de um perfil de comprador ativo.
Não quero criar pressão artificial, mas a realidade é que ativos com esta relação preço/zona/tipologia fora de mercado são escassos.
Se existe interesse real, o próximo passo é uma visita ou chamada nos próximos dois dias.
Consigo garantir?`,
    tags: ['comprador', 'fecho', 'urgencia', 'off-market'],
  },

  {
    id: 'buyer_followup',
    label: 'WhatsApp — Follow-up Comprador',
    channel: 'whatsapp',
    body: `Bom dia, [nome]. Retomo o nosso contacto sobre o ativo em [zona].
Ainda não consegui dar-lhe seguimento — queria perceber se a procura continua ativa da sua parte.
Se sim, terei gosto em rever o que temos disponível e atualizar o enquadramento de mercado.`,
    tags: ['comprador', 'follow-up', 'reativacao'],
  },

  // ── NEGOTIATION SCRIPTS ─────────────────────────────────────────────────────

  {
    id: 'negotiation_buyer',
    label: 'Negociação — "O preço está alto" (Comprador)',
    channel: 'universal',
    body: `Compreendo. O ponto não é apenas o valor pedido, mas o equilíbrio entre ativo, escassez, timing e margem de negociação. O ideal é percebermos até onde existe flexibilidade real antes de perdermos a oportunidade.`,
    tags: ['negociacao', 'comprador', 'objeccao', 'fecho'],
  },

  {
    id: 'negotiation_seller',
    label: 'Negociação — "Tive propostas mais altas" (Vendedor)',
    channel: 'universal',
    body: `Percebo. O mais importante agora é distinguir interesse informal de proposta realmente executável. O nosso foco é proteger o valor e ao mesmo tempo aproximar-nos de um fecho real.`,
    tags: ['negociacao', 'vendedor', 'objeccao'],
  },

  {
    id: 'negotiation_blocked',
    label: 'Negociação — Bloqueio Entre Partes',
    channel: 'universal',
    body: `O que normalmente destrói negócios não é a diferença inicial, mas a falta de estrutura na aproximação. Vamos reorganizar os pontos críticos, isolar o que é negociável e aproximar as partes com critério.`,
    tags: ['negociacao', 'bloqueio'],
  },

  // ── OBJECTION HANDLING ──────────────────────────────────────────────────────

  {
    id: 'objection_public',
    label: 'Objeção — "Não quero anunciar publicamente"',
    channel: 'universal',
    body: `Perfeitamente. Aliás, uma parte relevante do nosso trabalho é precisamente conduzir processos fora do mercado aberto, com controlo total sobre quem vê o ativo e em que condições.`,
    tags: ['objeccao', 'confidencialidade'],
  },

  {
    id: 'objection_price',
    label: 'Objeção — "Só vendo por um valor muito alto"',
    channel: 'universal',
    body: `Compreendo. O ponto crítico é perceber se esse valor é defensável junto do perfil certo de comprador. Se for, trabalha-se. Se não for, o risco é perder timing. O melhor é enquadrarmos primeiro com precisão.`,
    tags: ['objeccao', 'preco'],
  },

  {
    id: 'objection_evaluating',
    label: 'Objeção — "Ainda estou só a avaliar"',
    channel: 'universal',
    body: `Sem problema. Muitas operações começam exatamente assim. O objetivo inicial é apenas dar-lhe clareza de mercado, opções de posicionamento e nível real de procura.`,
    tags: ['objeccao', 'avaliacao'],
  },

  {
    id: 'objection_agencies',
    label: 'Objeção — "Já tenho outras agências"',
    channel: 'universal',
    body: `Compreendo. A diferença está normalmente menos no número de agências e mais na qualidade do processo, no controlo da exposição e na seleção de compradores. É aí que conseguimos acrescentar valor.`,
    tags: ['objeccao', 'concorrencia'],
  },

  {
    id: 'objection_no_urgency',
    label: 'Objeção — "Não tenho urgência"',
    channel: 'universal',
    body: `Ótimo. Isso dá-nos margem para trabalhar melhor a estratégia. O importante é perceber se faz sentido preparar já o ativo e mapear a procura certa, mesmo sem pressão imediata.`,
    tags: ['objeccao', 'sem-urgencia'],
  },

  {
    id: 'objection_message_only',
    label: 'Objeção — "Envie-me só por mensagem"',
    channel: 'universal',
    body: `Posso fazê-lo, claro. Mas em dois minutos consigo contextualizar melhor o mercado, a procura e o posicionamento ideal. Evita decisões com pouca informação.`,
    tags: ['objeccao', 'mensagem'],
  },

  // ── CLOSING OBJECTIONS ──────────────────────────────────────────────────────

  {
    id: 'close_objection_think',
    label: 'Fecho — "Quero pensar"',
    channel: 'universal',
    body: `Naturalmente. A questão é perceber se precisa de mais tempo ou de mais clareza. Se isolarmos os dois ou três pontos em aberto, conseguimos decidir com muito mais segurança.`,
    tags: ['fecho', 'objeccao', 'pensar'],
  },

  {
    id: 'close_objection_sinal',
    label: 'Fecho — "Não estou confortável com o sinal"',
    channel: 'universal',
    body: `Podemos trabalhar o tema do sinal dentro de uma estrutura equilibrada. O importante é que haja compromisso suficiente para proteger o processo sem criar bloqueio desnecessário.`,
    tags: ['fecho', 'objeccao', 'sinal'],
  },

  {
    id: 'close_objection_deadline',
    label: 'Fecho — "O prazo é curto"',
    channel: 'universal',
    body: `O prazo deve proteger a execução, não criar fricção artificial. O melhor é ajustá-lo à realidade documental e financeira para garantir um fecho sólido.`,
    tags: ['fecho', 'objeccao', 'prazo'],
  },

  {
    id: 'close_objection_other_option',
    label: 'Fecho — "Tenho outra opção"',
    channel: 'universal',
    body: `Compreendo. O ponto crítico é comparar executabilidade, risco e timing, não apenas headline. Muitas vezes a melhor proposta aparente não é a que chega ao fim.`,
    tags: ['fecho', 'objeccao', 'concorrencia'],
  },
]

// ── Pre-CPCV Checklist ────────────────────────────────────────────────────────

export const PRE_CPCV_CHECKLIST: string[] = [
  'Identificação correta das partes (CC/Passaporte)',
  'Legitimidade para vender confirmada',
  'Caderneta predial e certidão de teor disponíveis',
  'Preço e sinal acordados por escrito',
  'Prazo para escritura definido',
  'Condições precedentes identificadas',
  'Ónus / encargos / hipotecas conhecidos',
  'Financiamento: aprovação confirmada (se aplicável)',
  'Advogado / solicitador de ambas as partes alinhado',
  'Risco principal identificado e documentado',
]

// ── Post-CPCV Checklist ───────────────────────────────────────────────────────

export const POST_CPCV_CHECKLIST: string[] = [
  'Data do CPCV registada no CRM',
  'Valor do sinal registado e recibo emitido',
  'Prazo de escritura marcado no calendário',
  'Lista de documentos pendentes criada',
  'Responsável por cada documento identificado',
  'Checkpoints semanais agendados',
  'Financiamento a acompanhar (se aplicável)',
  'Licenças e certidões em progresso',
  'Distrate de hipoteca (se aplicável)',
  'Alertas de prazo configurados',
  'Notário confirmado e agendado',
  'IMT calculado e data de pagamento definida',
]

// ── Meeting Prep Checklist ────────────────────────────────────────────────────

export const MEETING_PREP_CHECKLIST: string[] = [
  'Rever score_reason do lead',
  'Rever buyer matches disponíveis',
  'Rever origem e histórico de notas',
  'Definir hipótese principal: seller / avaliação / pré-fecho / institucional',
  'Preparar análise AVM da zona',
  'Preparar 3 ativos comparáveis recentes',
  'Definir posicionamento de preço a propor',
  'Identificar pontos de sensibilidade (urgência, confidencialidade, multi-agência)',
]

// ── Meeting Capture Fields ────────────────────────────────────────────────────

export const MEETING_CAPTURE_FIELDS: string[] = [
  'Motivação real do vendedor / proprietário',
  'Urgência declarada',
  'Enquadramento jurídico (herança, empresa, individual)',
  'Abertura a processo reservado',
  'Expectativa de valor (pedido vs. realista)',
  'Timing desejado (escritura em X meses)',
  'Qualidade documental (o que tem disponível)',
  'Sensibilidade a exclusividade',
  'Buyer fit identificado na reunião',
]

// ── SLA Rules ─────────────────────────────────────────────────────────────────

export interface SLARule {
  label: string
  minScore: number
  maxScore: number
  limitMinutes: number
  limitLabel: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  color: string
}

export const SLA_RULES: SLARule[] = [
  { label: 'P0 — ATAQUE IMEDIATO', minScore: 80, maxScore: 100, limitMinutes: 15,  limitLabel: '15 min',    priority: 'P0', color: '#e74c3c' },
  { label: 'P1 — ALTA PRIORIDADE', minScore: 70, maxScore: 79,  limitMinutes: 60,  limitLabel: '60 min',    priority: 'P1', color: '#f39c12' },
  { label: 'P2 — MESMO DIA',       minScore: 50, maxScore: 69,  limitMinutes: 480, limitLabel: '8 horas',   priority: 'P2', color: '#3a7bd5' },
  { label: 'P3 — SEM SLA',         minScore: 0,  maxScore: 49,  limitMinutes: 0,   limitLabel: '—',         priority: 'P3', color: '#95a5a6' },
]

export function getSLARule(score: number | null): SLARule {
  if (score === null) return SLA_RULES[3]
  return SLA_RULES.find(r => score >= r.minScore && score <= r.maxScore) ?? SLA_RULES[3]
}

export function getSLAMinutesElapsed(createdAt: string): number {
  const t = new Date(createdAt).getTime()
  if (isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 60000))
}

export function getSLAStatus(score: number | null, createdAt: string | null | undefined, contactedAt: string | null): {
  breached: boolean
  minutesElapsed: number
  minutesLimit: number
  label: string
  color: string
} {
  const rule = getSLARule(score)
  if (rule.priority === 'P3') return { breached: false, minutesElapsed: 0, minutesLimit: 0, label: 'Sem SLA', color: '#95a5a6' }
  if (!createdAt) return { breached: false, minutesElapsed: 0, minutesLimit: rule.limitMinutes, label: 'Data indisponível', color: '#95a5a6' }

  const elapsed = getSLAMinutesElapsed(createdAt)

  // effectiveElapsed: if contacted, measure response time (creation → contact)
  // if not contacted, measure time since creation (running clock)
  const effectiveElapsed = contactedAt
    ? Math.max(0, Math.floor((new Date(contactedAt).getTime() - new Date(createdAt).getTime()) / 60000))
    : elapsed

  const breached = effectiveElapsed > rule.limitMinutes

  // Color: use effectiveElapsed (response time) for contacted leads, elapsed for pending
  const colorBasis = contactedAt ? effectiveElapsed : elapsed
  const color = breached
    ? '#e74c3c'
    : colorBasis > rule.limitMinutes * 0.75
    ? '#f39c12'
    : '#27ae60'

  const minutesLeft = Math.max(0, rule.limitMinutes - elapsed)

  return {
    breached,
    minutesElapsed: elapsed,
    minutesLimit: rule.limitMinutes,
    label: contactedAt
      ? (breached
        ? `⚠️ SLA breach — respondido em ${effectiveElapsed}min (limite: ${rule.limitMinutes}min)`
        : `✓ Contactado a tempo (${effectiveElapsed}min)`)
      : (breached
        ? `🔴 SLA violado — ${elapsed}min sem contacto`
        : `🟡 ${minutesLeft}min restantes`),
    color,
  }
}

// ── Risk Flags Labels ─────────────────────────────────────────────────────────

export const RISK_FLAG_LABELS: Record<string, { label: string; color: string; severity: 'high' | 'medium' | 'low' }> = {
  sla_breach:              { label: '🔴 SLA Violado',                   color: '#e74c3c', severity: 'high' },
  high_score_no_action:    { label: '🔴 Score Alto Sem Ação',            color: '#e74c3c', severity: 'high' },
  matched_not_contacted:   { label: '🟠 Match Buyers Sem Contacto',      color: '#f39c12', severity: 'high' },
  no_followup_set:         { label: '🟠 Follow-up Vencido',              color: '#f39c12', severity: 'medium' },
  stale_hot_lead:          { label: '🟠 Lead Quente Parado >14 dias',    color: '#f39c12', severity: 'medium' },
  no_owner_assigned:       { label: '🟡 Sem Advisor Atribuído',          color: '#e6c84a', severity: 'medium' },
  cpcv_deadline_soon:      { label: '🔴 Prazo CPCV em <7 dias',          color: '#e74c3c', severity: 'high' },
  escritura_deadline_soon: { label: '🔴 Escritura em <14 dias',          color: '#e74c3c', severity: 'high' },
  next_step_overdue:       { label: '🟠 Próximo Passo Vencido',          color: '#f39c12', severity: 'medium' },
}
