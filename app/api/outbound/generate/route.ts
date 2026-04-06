import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ─── RATE LIMIT ───────────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const HOUR = 3600_000
  const LIMIT = 30

  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + HOUR })
    return true
  }
  if (entry.count >= LIMIT) return false
  entry.count++
  return true
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type SignalType =
  | 'heranca' | 'divorcio' | 'insolvencia' | 'tempo_mercado'
  | 'multiplos_imoveis' | 'emigrante' | 'obra_parada'
  | 'renda_antiga' | 'preco_reduzido' | 'manual'

type MessageType = 'carta' | 'email' | 'whatsapp'
type Tone = 'profissional' | 'caloroso' | 'directo'
type Language = 'PT' | 'EN' | 'FR'

interface GenerateRequest {
  signalType: SignalType
  messageType: MessageType
  ownerName?: string
  address: string
  avmEstimate?: number
  tone: Tone
  language: Language
}

// ─── LABELS ───────────────────────────────────────────────────────────────────

const SIGNAL_CONTEXT: Record<SignalType, { pt: string; en: string; fr: string }> = {
  heranca: {
    pt: 'imóvel recebido por herança, proprietários são herdeiros que podem querer liquidar o activo',
    en: 'property inherited, owners are heirs who may want to liquidate the asset',
    fr: 'bien immobilier hérité, les propriétaires sont des héritiers qui pourraient vouloir vendre'
  },
  divorcio: {
    pt: 'imóvel partilhado num processo de divórcio ou separação, ambas as partes querem resolver rapidamente',
    en: 'property shared in divorce proceedings, both parties want to resolve quickly',
    fr: 'bien dans un processus de divorce, les deux parties veulent résoudre rapidement'
  },
  insolvencia: {
    pt: 'imóvel de empresa ou particular em processo de insolvência, administrador precisa liquidar activos',
    en: 'property of company or individual in insolvency proceedings, administrator needs to liquidate assets',
    fr: 'bien d\'une entreprise ou d\'un particulier en procédure d\'insolvabilité'
  },
  tempo_mercado: {
    pt: 'imóvel no mercado há mais de 180 dias sem vender, proprietário provavelmente frustrado',
    en: 'property on the market for over 180 days without selling, owner likely frustrated',
    fr: 'bien sur le marché depuis plus de 180 jours sans se vendre, propriétaire probablement frustré'
  },
  multiplos_imoveis: {
    pt: 'proprietário com múltiplos imóveis, pode querer consolidar ou gerir o portfólio',
    en: 'owner with multiple properties, may want to consolidate or manage portfolio',
    fr: 'propriétaire avec plusieurs biens, peut vouloir consolider ou gérer son portefeuille'
  },
  emigrante: {
    pt: 'proprietário emigrou e tem imóvel parado em Portugal, pode querer vender à distância',
    en: 'owner emigrated and has property sitting empty in Portugal, may want to sell remotely',
    fr: 'propriétaire émigré avec un bien vacant au Portugal, peut vouloir vendre à distance'
  },
  obra_parada: {
    pt: 'imóvel com obra parada ou licença caducada, proprietário enfrenta dificuldades para avançar',
    en: 'property with stalled construction or expired permit, owner facing difficulties proceeding',
    fr: 'bien avec construction arrêtée ou permis expiré, propriétaire face à des difficultés'
  },
  renda_antiga: {
    pt: 'imóvel arrendado com contrato antigo a preços muito abaixo de mercado, proprietário pode querer vender',
    en: 'property rented under old contract at well below market rates, owner may want to sell',
    fr: 'bien loué avec un contrat ancien à des prix très inférieurs au marché'
  },
  preco_reduzido: {
    pt: 'imóvel com preço reduzido 3 ou mais vezes, sinal de urgência de venda',
    en: 'property with price reduced 3 or more times, signal of urgency to sell',
    fr: 'bien avec prix réduit 3 fois ou plus, signal d\'urgence de vente'
  },
  manual: {
    pt: 'sinal identificado manualmente pelo consultor, contexto variável',
    en: 'signal identified manually by the agent, variable context',
    fr: 'signal identifié manuellement par le conseiller, contexte variable'
  }
}

const TONE_INSTRUCTION: Record<Tone, string> = {
  profissional: 'Use a formal, professional tone — authoritative but respectful. Corporate language.',
  caloroso: 'Use a warm, empathetic and human tone — as if speaking with a friend or family member. Show understanding.',
  directo: 'Be concise and direct. No fluff. Clear value proposition upfront. Bullet points if needed.'
}

const FORMAT_INSTRUCTION: Record<MessageType, string> = {
  carta: 'Format as a formal physical letter (A4). Include: city and date line, formal salutation, 3-4 paragraphs, formal closing, Agency Group signature with AMI number. Professional and polished.',
  email: 'Format as a professional email. Include: subject line (prefix with "ASSUNTO:" or "SUBJECT:" or "OBJET:"), formal salutation, 2-3 concise paragraphs, clear call to action, professional signature.',
  whatsapp: 'Format as a WhatsApp message. Short, conversational but professional. Maximum 3-4 short paragraphs. Use line breaks for readability. No formal letter format. Include a clear call to action at the end.'
}

// ─── FALLBACK TEMPLATES ───────────────────────────────────────────────────────

function getFallbackTemplate(req: GenerateRequest): { subject?: string; message: string; messageType: string } {
  const { messageType, ownerName, address, avmEstimate, language, signalType } = req

  const fmtAvm = avmEstimate
    ? new Intl.NumberFormat(language === 'PT' ? 'pt-PT' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(avmEstimate)
    : null

  const owner = ownerName || (language === 'EN' ? 'Property Owner' : language === 'FR' ? 'Propriétaire' : 'Proprietário(a)')

  const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })

  if (language === 'PT') {
    if (messageType === 'carta') {
      return {
        messageType,
        message: `Lisboa, ${today}

Exmo(a). Sr(a). ${owner},

Permitam-nos apresentar a Agency Group, mediadora imobiliária de referência em Portugal (AMI 22506), especializada na intermediação de activos de valor e no acompanhamento personalizado de proprietários exigentes.

Chegou ao nosso conhecimento que poderá estar a ponderar uma decisão relativamente ao imóvel localizado em ${address}. ${fmtAvm ? `A nossa análise de mercado mais recente aponta para um valor estimado na ordem dos ${fmtAvm}, reflectindo a dinâmica actual e a forte procura registada na zona.` : 'A nossa análise de mercado indica uma janela de oportunidade favorável para a sua zona.'}

Temos actualmente uma carteira qualificada de compradores nacionais e internacionais que procuram activamente imóveis com as características do seu. Oferecemos um serviço de mediação exclusivo, com estratégia de marketing personalizada, total discrição e acompanhamento jurídico e financeiro do início ao fim.

Gostaríamos de agendar uma reunião informal, sem qualquer compromisso, para lhe apresentar a nossa avaliação gratuita e uma proposta adaptada à sua situação.

Ficamos ao seu inteiro dispor.

Com os melhores cumprimentos,

Agency Group
AMI 22506 | Lisboa · Porto · Algarve · Madeira
Comissão 5% | 50% CPCV + 50% Escritura`
      }
    }

    if (messageType === 'email') {
      const signalSubjects: Partial<Record<SignalType, string>> = {
        heranca: 'Avaliação Gratuita — Imóvel por Herança',
        divorcio: 'Solução Discreta para Partilha de Imóvel',
        tempo_mercado: 'A Razão pela Qual o Seu Imóvel Ainda Não Vendeu',
        preco_reduzido: 'Nova Estratégia para Vender o Seu Imóvel',
        insolvencia: 'Proposta de Mediação Exclusiva — Agency Group'
      }
      return {
        subject: signalSubjects[signalType] || 'Avaliação Gratuita — Agency Group',
        messageType,
        message: `Exmo(a). Sr(a). ${owner},

Sou consultor da Agency Group (AMI 22506) e contacto-o(a) a propósito do imóvel em ${address}.

${fmtAvm ? `Com base na nossa análise de mercado actualizada, o imóvel apresenta um valor estimado de ${fmtAvm}. Neste momento, temos compradores activamente à procura de imóveis com este perfil.` : 'A nossa análise indica que o seu imóvel tem um posicionamento interessante no mercado actual.'}

Gostaria de agendar uma conversa de 15 minutos para lhe apresentar a nossa abordagem, sem qualquer compromisso da sua parte.

Fico ao dispor.

[Nome do Consultor]
Agency Group | AMI 22506
+351 _ _ _ _ _ _ _ _ _`
      }
    }

    // WhatsApp
    return {
      messageType,
      message: `Bom dia, ${owner}.

Sou consultor da Agency Group (AMI 22506) e gostaria de falar consigo sobre o imóvel em ${address}.${fmtAvm ? `\n\nTemos uma análise de mercado que aponta para um valor de ${fmtAvm} — e compradores à procura de imóveis como o seu.` : ''}

Estaria disponível para uma conversa rápida esta semana?

Obrigado 🙏`
    }
  }

  // English fallback
  return {
    subject: 'Free Property Valuation — Agency Group',
    messageType,
    message: `Dear ${owner},

I am reaching out from Agency Group (License AMI 22506), a leading real estate agency in Portugal, regarding the property at ${address}.

${fmtAvm ? `Our current market analysis estimates a value of ${fmtAvm} for your property, reflecting strong demand in the area.` : 'We have qualified buyers actively looking for properties in your area.'}

We would be delighted to offer you a free, no-obligation valuation and present our personalised selling strategy.

Looking forward to hearing from you.

Kind regards,
Agency Group | AMI 22506`
  }
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 30 requests per hour.' },
      { status: 429 }
    )
  }

  let body: GenerateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { signalType, messageType, ownerName, address, avmEstimate, tone, language } = body

  if (!address || !signalType || !messageType || !tone || !language) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Build prompt
  const signalCtx = SIGNAL_CONTEXT[signalType]?.[language.toLowerCase() as 'pt' | 'en' | 'fr']
    || SIGNAL_CONTEXT[signalType]?.pt
    || 'property owner being approached about selling'

  const fmtAvm = avmEstimate
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(avmEstimate)
    : null

  const langInstruction = {
    PT: 'Write entirely in European Portuguese (Portugal). Formal register, not Brazilian Portuguese.',
    EN: 'Write entirely in British English.',
    FR: 'Write entirely in formal French.'
  }[language]

  const systemPrompt = `You are an expert real estate outreach copywriter for Agency Group, a premium real estate agency in Portugal (AMI License 22506).
You write persuasive, personalised outreach messages that convert property owners into clients.

Agency Group facts:
- Premium agency: €500K–€3M core segment, up to €100M+
- Commission: 5% (50% on promissory contract CPCV + 50% on final deed)
- Areas: Lisbon, Cascais, Porto, Algarve, Madeira, Azores
- Buyers: American, French, British, Chinese, Brazilian, German, Middle Eastern
- Market 2026: +17.6% growth, luxury Lisbon top 5 worldwide

Style rules:
- Never sound desperate or cold-call aggressive
- Position as trusted advisors, not salespeople
- Highlight unique value: qualified buyers, discretion, full legal + financial support
- Include specific market data when AVM is provided
- Always end with a clear, low-friction call to action
- Never mention competitors
- Never use hollow superlatives without substance`

  const userPrompt = `Create an outreach ${messageType} for the following situation:

Signal context: ${signalCtx}
Property address: ${address}
Owner name: ${ownerName || 'Unknown (use generic salutation)'}
Estimated market value: ${fmtAvm || 'Not specified (do not mention a specific value)'}

${TONE_INSTRUCTION[tone]}
${FORMAT_INSTRUCTION[messageType]}
${langInstruction}

${messageType === 'email' ? 'IMPORTANT: Start your response with "SUBJECT:" on the first line, then a blank line, then the email body.' : ''}
${messageType === 'carta' ? 'IMPORTANT: Include date, formal address, full letter body, and professional closing with Agency Group details.' : ''}

Generate only the message content. No explanations or meta-commentary.`

  // Try Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[outbound/generate] No ANTHROPIC_API_KEY — using fallback template')
    return NextResponse.json(getFallbackTemplate(body))
  }

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-haiku-3-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse subject from email output
    let subject: string | undefined
    let message = raw.trim()

    if (messageType === 'email') {
      const lines = message.split('\n')
      const subjectLine = lines.find(l => l.toUpperCase().startsWith('SUBJECT:') || l.toUpperCase().startsWith('ASSUNTO:') || l.toUpperCase().startsWith('OBJET:'))
      if (subjectLine) {
        subject = subjectLine.replace(/^(subject|assunto|objet)\s*:\s*/i, '').trim()
        const subjectIdx = lines.indexOf(subjectLine)
        message = lines.slice(subjectIdx + 1).join('\n').trim()
      }
    }

    return NextResponse.json({ subject, message, messageType })
  } catch (err) {
    console.error('[outbound/generate] Anthropic API error:', err)
    // Graceful fallback — return a quality template
    return NextResponse.json(getFallbackTemplate(body))
  }
}
