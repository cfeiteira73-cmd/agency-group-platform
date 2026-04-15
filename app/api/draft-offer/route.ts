import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

// ─── Schema ───────────────────────────────────────────────────────────────────

const DraftOfferSchema = z.object({
  type: z.enum(['compra', 'contra', 'loi', 'cpcv', 'offmarket']),
  lang: z.enum(['PT', 'EN', 'FR', 'DE', 'AR']),
  property: z.object({
    nome: z.string(),
    preco: z.number(),
    ref: z.string(),
    zona: z.string().optional().default(''),
    area: z.number().optional(),
    quartos: z.number().optional(),
  }),
  contact: z.object({
    name: z.string(),
    nationality: z.string(),
  }).nullable().optional(),
  offerPrice: z.number().positive(),
  listPrice: z.number().positive(),
  discountPct: z.number(),
  conditions: z.object({
    financiamento: z.boolean(),
    inspecao: z.boolean(),
    prazoCondicao: z.string(),
    valorSinal: z.string(),
    dataCPCV: z.string(),
    dataEscritura: z.string(),
    includeMobilia: z.boolean(),
    includeVagaGaragem: z.boolean(),
  }),
  agentName: z.string().optional().default('Carlos'),
  amiNumber: z.string().optional().default('22506'),
})

// ─── Rate limiting ─────────────────────────────────────────────────────────────

const rateMap = new Map<string, { count: number; reset: number }>()
function checkRate(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.reset) { rateMap.set(ip, { count: 1, reset: now + 3_600_000 }); return true }
  if (entry.count >= 20) return false
  entry.count++; return true
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `Você é o melhor especialista em negociação imobiliária de luxo de Portugal, com 20 anos de experiência em transacções acima de €500K. Trabalha para a Agency Group (AMI 22506).

Redigirá cartas formais de proposta, contra-proposta, cartas de intenção (LOI), pré-contratos (CPCV) e abordagens off-market para imóveis de luxo em Portugal.

REGRAS DE REDACÇÃO:
1. Tom: formal, elegante, directo. Nunca suplicante. Nunca fraco.
2. Linguagem adequada ao mercado de luxo — não use "barato", "desconto agressivo" ou linguagem mercantil.
3. Estruture a carta com: abertura (dados do comprador/agente), corpo (termos propostos), condições suspensivas se aplicável, encerramento formal com convite a negociar.
4. Adapte RIGOROSAMENTE ao idioma solicitado (PT, EN, FR, DE, AR). Em árabe use caracteres árabes correctos.
5. Nunca invente dados — use apenas o que lhe é fornecido.
6. Para LOI: inclua cláusula de exclusividade de negociação (período de due diligence).
7. Para CPCV: estruture com artigos numerados, inclua sinal, prazo escritura, penalidades.
8. Para Off-Market: tom mais informal e discreto, foco no interesse genuíno e discrição.

DADOS DA EMPRESA:
- Agency Group · AMI 22506
- Comissão: 5% (50% CPCV + 50% Escritura)
- Mercado 2026: €3.076/m² mediana · +17,6% YoY · Lisboa top 5 luxo mundial

Responda APENAS com JSON válido. Nenhum texto fora do JSON.`

// ─── Offer type labels ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, Record<string, string>> = {
  compra:    { PT:'Proposta Formal de Compra', EN:'Formal Purchase Offer', FR:'Offre d\'Achat Formelle', DE:'Formelles Kaufangebot', AR:'عرض شراء رسمي' },
  contra:    { PT:'Contra-Proposta', EN:'Counter-Offer', FR:'Contre-Proposition', DE:'Gegenangebot', AR:'عرض مضاد' },
  loi:       { PT:'Carta de Intenção (LOI)', EN:'Letter of Intent (LOI)', FR:'Lettre d\'Intention (LOI)', DE:'Absichtserklärung (LOI)', AR:'خطاب نية' },
  cpcv:      { PT:'Proposta CPCV', EN:'CPCV Proposal', FR:'Proposition CPCV', DE:'CPCV-Vorschlag', AR:'مقترح CPCV' },
  offmarket: { PT:'Abordagem Off-Market', EN:'Off-Market Approach', FR:'Approche Off-Market', DE:'Off-Market-Ansatz', AR:'نهج خارج السوق' },
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET ?? process.env.INTERNAL_API_TOKEN
  const incoming = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && incoming === cronSecret) return true

  const secret = process.env.AUTH_SECRET
  if (secret) {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get('ag-auth-token')?.value
    if (cookieValue) {
      const dotIdx = cookieValue.lastIndexOf('.')
      if (dotIdx !== -1) {
        const payload = cookieValue.slice(0, dotIdx)
        const sig = cookieValue.slice(dotIdx + 1)
        const expected = createHmac('sha256', secret).update(payload).digest('hex')
        if (expected === sig) {
          try {
            const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
            if (data.email && Date.now() < data.exp) return true
          } catch { /* invalid */ }
        }
      }
    }
  }
  return false
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Rate limit — máximo 20 propostas/hora por IP' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = DraftOfferSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const fmtEuro = (n: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const sinalEuro = d.offerPrice * (parseFloat(d.conditions.valorSinal) / 100)
  const typeLabel = TYPE_LABELS[d.type]?.[d.lang] ?? d.type

  const conditionsList = [
    d.conditions.financiamento && `Sujeito a aprovação de financiamento (prazo: ${d.conditions.prazoCondicao} dias)`,
    d.conditions.inspecao && 'Sujeito a inspecção técnica favorável do imóvel',
    d.conditions.includeVagaGaragem && 'Inclui vaga de garagem',
    d.conditions.includeMobilia && 'Inclui mobília e equipamento',
  ].filter(Boolean).join('; ') || 'Sem condições suspensivas'

  const prompt = `Redija uma carta formal de "${typeLabel}" no idioma ${d.lang} com os seguintes dados:

IMÓVEL:
- Referência: ${d.property.ref}
- Nome: ${d.property.nome}
- Zona: ${d.property.zona || 'Portugal'}
${d.property.area ? `- Área: ${d.property.area}m²` : ''}
${d.property.quartos ? `- Quartos: ${d.property.quartos}` : ''}
- Preço de listagem: ${fmtEuro(d.listPrice)}

COMPRADOR:
- Nome: ${d.contact?.name ?? 'Comprador Confidencial'}
- Nacionalidade: ${d.contact?.nationality ?? 'Não especificada'}

TERMOS DA PROPOSTA:
- Valor proposto: ${fmtEuro(d.offerPrice)}
- Diferença face à listagem: ${d.discountPct > 0 ? `-${d.discountPct.toFixed(1)}%` : d.discountPct < 0 ? `+${Math.abs(d.discountPct).toFixed(1)}%` : '0% (a mercado)'}
- Sinal: ${d.conditions.valorSinal}% = ${fmtEuro(sinalEuro)}
- Data CPCV: ${d.conditions.dataCPCV || 'A acordar'}
- Data Escritura: ${d.conditions.dataEscritura || 'A acordar'}
- Condições: ${conditionsList}

AGENTE: ${d.agentName} · Agency Group · AMI 22506

Responda EXCLUSIVAMENTE com este JSON (sem markdown, sem texto extra):
{
  "subject": "linha de assunto formal da carta em ${d.lang}",
  "body": "texto completo da carta em ${d.lang}, com parágrafos separados por \\n\\n",
  "keyTerms": [
    {"label": "Preço", "value": "${fmtEuro(d.offerPrice)}"},
    {"label": "Sinal", "value": "${fmtEuro(sinalEuro)} (${d.conditions.valorSinal}%)"},
    {"label": "CPCV", "value": "${d.conditions.dataCPCV || 'A acordar'}"},
    {"label": "Escritura", "value": "${d.conditions.dataEscritura || 'A acordar'}"},
    {"label": "Condições", "value": "string resumida das condições em PT"}
  ],
  "urgencyLevel": "alta|media|baixa",
  "negotiationAdvice": "conselho estratégico de negociação em PT (2-3 frases)",
  "redFlags": ["lista de alertas em PT se desconto >12% ou condições muito suspensivas, senão array vazio"],
  "strengths": ["pontos fortes desta proposta em PT (2-4 items)"],
  "offerSummary": "resumo de 1 linha em PT: ex. '2 bed · Chiado · €2.5M · -5.3%'"
}`

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

    // Strip markdown code fences if model wraps in them
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    let result: unknown
    try {
      result = JSON.parse(jsonStr)
    } catch {
      // If we can't parse, return a fallback with the raw body
      return NextResponse.json({
        subject: typeLabel,
        body: raw,
        keyTerms: [
          { label: 'Preço', value: fmtEuro(d.offerPrice) },
          { label: 'Sinal', value: fmtEuro(sinalEuro) },
          { label: 'CPCV', value: d.conditions.dataCPCV || 'A acordar' },
          { label: 'Escritura', value: d.conditions.dataEscritura || 'A acordar' },
          { label: 'Condições', value: conditionsList },
        ],
        urgencyLevel: 'media',
        negotiationAdvice: '',
        redFlags: [],
        strengths: [],
        offerSummary: `${d.property.nome} · ${fmtEuro(d.offerPrice)}`,
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[draft-offer] Anthropic error:', err)
    return NextResponse.json(
      { error: 'Erro ao gerar proposta. Verifique a chave API.' },
      { status: 502 },
    )
  }
}
