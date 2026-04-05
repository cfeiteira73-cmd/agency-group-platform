import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const DraftOfferSchema = z.object({
  offerPrice: z.number().positive('Valor da proposta deve ser positivo'),
  deal:       z.object({
    imovel: z.string().optional(),
    valor:  z.string().optional(),
    ref:    z.string().optional(),
    comprador: z.string().optional(),
  }).optional(),
  contact: z.object({
    name:        z.string().optional(),
    nationality: z.string().optional(),
    email:       z.string().email().optional().or(z.literal('')),
  }).optional(),
  property: z.object({
    nome:    z.string().optional(),
    zona:    z.string().optional(),
    bairro:  z.string().optional(),
    tipo:    z.string().optional(),
    area:    z.union([z.string(), z.number()]).optional(),
    quartos: z.union([z.string(), z.number()]).optional(),
    preco:   z.union([z.string(), z.number()]).optional(),
  }).optional(),
  conditions: z.string().optional(),
  offerType:  z.string().optional(),
  agentName:  z.string().optional(),
})

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = DraftOfferSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { deal, contact, property, offerPrice, conditions, offerType, agentName } = parsed.data

    const today = new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
    const agent = agentName || 'Carlos Feiteira'

    const prompt = `És ${agent}, agente sénior da Agency Group (AMI 22506), com suporte jurídico especializado em transacções imobiliárias em Portugal.

Redige uma proposta formal de compra de imóvel em português europeu jurídico correcto e profissional.

DADOS DA TRANSACÇÃO:
- Imóvel: ${property?.nome || deal?.imovel || '—'}
- Localização: ${property?.zona || '—'}${property?.bairro ? `, ${property.bairro}` : ''}
- Tipologia: ${property?.tipo || '—'}
- Área: ${property?.area || '—'}m²
- Quartos: T${property?.quartos || '—'}
- Preço de Pedido: ${deal?.valor || (property?.preco ? `€${Number(property.preco).toLocaleString('pt-PT')}` : '—')}
- Referência Agency Group: ${deal?.ref || 'AG-2026-XXX'}

PROPONENTE:
- Nome: ${contact?.name || deal?.comprador || '—'}
- Nacionalidade: ${contact?.nationality || '—'}
- NIF: [A preencher pelo proponente]
- Email: ${contact?.email || '—'}

PROPOSTA:
- Valor oferecido: €${Number(offerPrice || 0).toLocaleString('pt-PT')}
- Tipo: ${offerType || 'Compra definitiva'}
- Condições especiais: ${conditions || 'Nenhuma condição especial'}
- Data da proposta: ${today}
- Validade: 5 dias úteis

Gera em JSON com carta formal completa:
{
  "subject": "Assunto formal da carta (ex: Proposta de Aquisição — [imóvel])",
  "letterhead": "Cabeçalho formal (cidade, data, referência)",
  "salutation": "Exmo(a). Senhor(a)...",
  "body": "Corpo completo da carta em português jurídico formal (mínimo 350 palavras). Estrutura obrigatória:\\n\\n1. IDENTIFICAÇÃO DAS PARTES (proponente e vendedor/intermediário)\\n2. OBJECTO DA PROPOSTA (descrição completa do imóvel, localização, artigo matricial se conhecido)\\n3. VALOR E FORMA DE PAGAMENTO (preço total, sinal CPCV recomendado ~10%, data prevista escritura, método de pagamento)\\n4. CONDIÇÕES SUSPENSIVAS (aprovação bancária se aplicável, resultado da due diligence)\\n5. CLÁUSULAS ESPECIAIS (condições negociadas)\\n6. VALIDADE DA PROPOSTA (5 dias úteis a contar da recepção)\\n7. DECLARAÇÃO DE INTENÇÃO (compromisso formal)\\n\\nUsar linguagem jurídica correcta em português europeu formal.",
  "closing": "Fecho formal com cumprimentos",
  "signature": "${agent}\\nAgency Group — AMI 22506\\ngeral@agencygroup.pt",
  "keyTerms": [
    { "term": "termo jurídico 1", "explanation": "o que significa em linguagem simples" }
  ],
  "financialSummary": {
    "offerPrice": ${offerPrice || 0},
    "suggestedCPCV": ${Math.round((offerPrice || 0) * 0.1)},
    "suggestedBalance": ${Math.round((offerPrice || 0) * 0.9)},
    "estimatedIMT": "a calcular",
    "estimatedIS": "a calcular",
    "suggestedEscrituraDate": "a acordar entre as partes"
  },
  "warnings": ["aviso legal 1 se relevante"],
  "nextSteps": [
    "1. Enviar proposta ao vendedor/representante",
    "2. Aguardar resposta (max 5 dias úteis)",
    "3. Se aceite: marcar reunião para assinar CPCV",
    "4. Verificar financiamento bancário (se aplicável)",
    "5. Solicitar certidão predial e caderneta urbana"
  ],
  "dueDiligenceChecklist": [
    "Certidão permanente do registo predial",
    "Caderneta predial urbana (valor patrimonial)",
    "Licença de habitação",
    "Certificado energético",
    "Ausência de ónus ou encargos",
    "Declaração de não execução fiscal"
  ]
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let result
    try {
      result = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Erro ao processar resposta da IA' }, { status: 500 })
    }

    return NextResponse.json({ success: true, offer: result })
  } catch (error) {
    console.error('[Draft Offer] Error:', error)
    return NextResponse.json({ error: 'Erro ao redigir proposta' }, { status: 500 })
  }
}
