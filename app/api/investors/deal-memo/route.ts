import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isPortalAuth } from '@/lib/portalAuth'

// ─── Rate Limiting (in-memory, resets on server restart) ──────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1000000) return `€${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `€${(n / 1000).toFixed(0)}K`
  return `€${n.toLocaleString('pt-PT')}`
}

function calcBaseYield(zona: string): number {
  const yields: Record<string, number> = {
    Lisboa: 4.3, Cascais: 4.0, Porto: 5.1, Algarve: 4.6,
    Comporta: 4.1, Madeira: 4.8, Sintra: 4.2, Alentejo: 3.8,
  }
  return yields[zona] ?? 4.0
}

// ─── Language Prompts ─────────────────────────────────────────────────────────
const LANG_INSTRUCTIONS: Record<string, string> = {
  PT: 'Escreve o memo completamente em Português Europeu (Portugal). Usa terminologia imobiliária portuguesa. Tom: institucional mas acessível.',
  EN: 'Write the memo entirely in English. Use British English. Professional institutional tone. Real estate investment terminology.',
  FR: "Écris le memo entièrement en français. Terminologie immobilière professionnelle. Ton institutionnel et élégant.",
  DE: 'Schreibe das Memo vollständig auf Deutsch. Professionelle Immobilienterminologie. Institutioneller Ton.',
  AR: 'اكتب المذكرة باللغة العربية الفصحى. استخدم مصطلحات الاستثمار العقاري المهنية. نبرة مؤسسية.',
}

// ─── Fallback Mock Memo ────────────────────────────────────────────────────────
function buildFallbackMemo(investor: Record<string, unknown>, property: Record<string, unknown>, dealType: string, additionalData: Record<string, string>) {
  const preco = Number(property.preco ?? 0)
  const zona = String(property.zona ?? '')
  const nome = String(property.nome ?? '')
  const horizonYears = Number(investor.horizonYears ?? 5)
  const yieldBruto = additionalData.yieldEstimado ? parseFloat(additionalData.yieldEstimado) : calcBaseYield(zona)
  const yieldLiquido = parseFloat((yieldBruto * 0.72).toFixed(2))
  const capexEstimado = additionalData.capexEstimado ? parseFloat(additionalData.capexEstimado) : 0
  const appreciation = zona === 'Lisboa' ? 0.07 : zona === 'Cascais' ? 0.065 : 0.055
  const irrEstimado = parseFloat((yieldLiquido + appreciation * 0.8).toFixed(2))
  const exitValue = Math.round(preco * Math.pow(1 + appreciation, horizonYears))
  const roi5anos = Math.round(((yieldLiquido + appreciation) * 5) * 100)

  const investorName = String(investor.name ?? 'Investidor')
  const investorType = String(investor.type ?? 'hnwi')

  return {
    executiveSummary: `${nome} (${fmt(preco)}) apresenta-se como uma oportunidade de investimento ${dealType} de elevada qualidade em ${zona}, Portugal. O ativo alinha-se com o perfil de ${investorName} — ${investorType.replace('_', ' ')} com yield target de ${investor.yieldTarget}% e horizonte de ${horizonYears} anos. O mercado de ${zona} regista crescimento consistente e forte procura internacional, posicionando este imóvel como activo de referência na carteira.`,
    investmentThesis: `Portugal mantém-se como um dos mercados imobiliários mais resilientes da Europa, com Lisboa no top 5 mundial de destinos de luxo. A combinação de benefícios fiscais (NHR/IFICI), qualidade de vida, segurança e valorização consistente cria condições únicas para investidores internacionais. ${nome} beneficia de localização prime em ${zona}, com características diferenciadoras que suportam apreciação de capital a longo prazo. O dealtype ${dealType} maximiza o retorno no horizonte de investimento definido.`,
    financials: {
      precoCompra: preco,
      yieldBruto,
      yieldLiquido,
      irrEstimado,
      exitValue,
      capexEstimado,
      roi5anos,
    },
    risks: [
      `Risco de liquidez em cenário de contração do mercado imobiliário de ${zona}`,
      'Alterações regulatórias em Alojamento Local e tributação de não residentes',
      `Risco cambial para investidores fora da Zona Euro`,
      'Evolução da Euribor e custo de financiamento hipotecário',
      'Risco de obra (se aplicável) — derrapagem de prazo e custo CAPEX',
    ],
    nextSteps: [
      `Agendar visita presencial a ${nome}`,
      'Due diligence jurídica: certidão predial, licença de utilização, ónus e encargos',
      'Vistoria técnica por engenheiro ou arquitecto credenciado',
      `Estruturar proposta formal — preço: ${fmt(preco)}`,
      'CPCV com sinal mínimo de 10% (prazo 90-120 dias)',
      `Escritura notarial e transferência de titularidade`,
    ],
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(language: string): string {
  const langInstruction = LANG_INSTRUCTIONS[language] ?? LANG_INSTRUCTIONS['EN']
  return `You are an elite real estate investment analyst at Agency Group (AMI 22506), Portugal's premier luxury real estate brokerage. You produce institutional-grade deal memos for high-net-worth investors and family offices.

${langInstruction}

Your deal memos are precise, data-driven, and convey deep market knowledge. You always:
- Use specific financial metrics (IRR, yield, cap rate, exit value)
- Reference Portuguese market context (CPCV, IMT, NHR/IFICI, AL regulations)
- Tailor the thesis to the investor's specific profile and objectives
- Identify genuine risks without being alarmist
- Provide actionable next steps in priority order

Output MUST be valid JSON matching this exact schema:
{
  "executiveSummary": "string (2-3 paragraphs)",
  "investmentThesis": "string (2-3 paragraphs)",
  "financials": {
    "precoCompra": number,
    "yieldBruto": number,
    "yieldLiquido": number,
    "irrEstimado": number,
    "exitValue": number,
    "capexEstimado": number,
    "roi5anos": number
  },
  "risks": ["string", "string", "string", "string", "string"],
  "nextSteps": ["string", "string", "string", "string", "string"]
}`
}

// ─── User Prompt ──────────────────────────────────────────────────────────────
function buildUserPrompt(investor: Record<string, unknown>, property: Record<string, unknown>, dealType: string, additionalData: Record<string, string>): string {
  const preco = Number(property.preco ?? 0)
  const zona = String(property.zona ?? '')
  const yieldBase = calcBaseYield(zona)

  return `Generate a deal memo for the following:

INVESTOR PROFILE:
- Name: ${investor.name}
- Type: ${investor.type}
- Nationality: ${investor.nationality}
- Capital Range: €${investor.capitalMin?.toLocaleString()} – €${investor.capitalMax?.toLocaleString()}
- Yield Target: ${investor.yieldTarget}%
- Investment Horizon: ${investor.horizonYears} years
- Risk Profile: ${investor.riskProfile}
- Preferred Zones: ${Array.isArray(investor.zonas) ? investor.zonas.join(', ') : investor.zonas}
- Property Types: ${Array.isArray(investor.tipoImovel) ? investor.tipoImovel.join(', ') : investor.tipoImovel}
- Occupation Intent: ${investor.ocupacao}
- Notes: ${investor.notes}

PROPERTY:
- Reference: ${property.ref}
- Name: ${property.nome}
- Zone: ${property.zona} (${property.bairro})
- Type: ${property.tipo}
- Price: €${preco.toLocaleString()}
- Area: ${property.area}m²
- Bedrooms: ${property.quartos}
- Features: Pool=${property.piscina}, Garage=${property.garagem}, Garden=${property.jardim}, Terrace=${property.terraco}
- Badge: ${property.badge}

DEAL PARAMETERS:
- Deal Type: ${dealType}
- Estimated Yield: ${additionalData.yieldEstimado || yieldBase + '%'}
- CAPEX Estimate: ${additionalData.capexEstimado ? '€' + Number(additionalData.capexEstimado).toLocaleString() : 'Not specified'}
- Timeline: ${additionalData.timeline || investor.horizonYears + ' years'}

MARKET CONTEXT (2026):
- ${zona} avg price/m²: ${zona === 'Lisboa' ? '€5,000' : zona === 'Cascais' ? '€4,713' : zona === 'Algarve' ? '€3,941' : zona === 'Porto' ? '€3,643' : '€3,500'}
- Market trend: +17.6% YoY
- Estimated base yield for ${zona}: ${yieldBase}%
- Portuguese market: 169,812 transactions/year, luxury Lisboa top 5 worldwide

Calculate realistic financials. IRR should account for yield + capital appreciation (${zona === 'Lisboa' ? '7%' : zona === 'Cascais' ? '6.5%' : '5.5%'} annual appreciation estimate). Exit value = purchase price × (1 + appreciation_rate)^years.`
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Rate limit
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 10 memos per hour.' },
      { status: 429 }
    )
  }

  // Parse body
  let body: {
    investor: Record<string, unknown>
    property: Record<string, unknown>
    dealType: string
    language: string
    additionalData: Record<string, string>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { investor, property, dealType, language, additionalData } = body

  if (!investor || !property) {
    return NextResponse.json({ error: 'investor and property are required.' }, { status: 400 })
  }

  // Try Claude API
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Return structured fallback if no API key configured
    const fallback = buildFallbackMemo(investor, property, dealType ?? 'Buy & Hold', additionalData ?? {})
    return NextResponse.json(fallback)
  }

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: buildSystemPrompt(language ?? 'PT'),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(investor, property, dealType ?? 'Buy & Hold', additionalData ?? {}),
        },
      ],
    })

    // Extract text content
    const rawText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    // Parse JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      ...parsed,
      raw: rawText,
    })
  } catch (err) {
    console.error('[deal-memo] AI generation failed:', err)

    // Return structured fallback on any AI error
    const fallback = buildFallbackMemo(investor, property, dealType ?? 'Buy & Hold', additionalData ?? {})
    return NextResponse.json(fallback)
  }
}

// ─── GET: Health Check ────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'POST /api/investors/deal-memo',
    model: 'claude-opus-4-5',
    rateLimit: `${RATE_LIMIT} requests/hour per IP`,
    requiredBody: {
      investor: 'Investor object',
      property: 'Property object',
      dealType: 'Buy & Hold | Value-Add | Flip | Development',
      language: 'PT | EN | FR | DE | AR',
      additionalData: '{ yieldEstimado?, capexEstimado?, timeline? }',
    },
  })
}
