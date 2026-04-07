import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockAlertMessage(property: Record<string, unknown>): string {
  const nome = String(property.nome || property.name || 'Novo imóvel')
  const zona = String(property.zona || property.zone || 'Portugal')
  const preco = Number(property.preco || property.price || 0)
  const precoLabel = preco > 0 ? `€${(preco / 1000).toFixed(0)}K` : 'preço a confirmar'
  return `Oportunidade exclusiva Agency Group: ${nome} em ${zona} a ${precoLabel}. Imóvel fora do mercado, acesso prioritário para a nossa carteira de investidores. Contacte-nos para mais detalhes.`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { property } = await request.json()

    if (!property) {
      return NextResponse.json({ error: 'property é obrigatório' }, { status: 400 })
    }

    const propertyPrice = property.preco || property.price || 0
    const propertyPriceFloor = propertyPrice * 0.85

    // Find matching investors from Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: investors } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, name, email, phone, whatsapp, budget_min, budget_max, zonas, tipos, status')
      .in('status', ['prospect', 'cliente', 'vip'])
      .lte('budget_min', propertyPrice)
      .gte('budget_max', propertyPriceFloor)
      .limit(20)

    const matchCount = investors?.length || 0

    // Graceful mock when API key is missing
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[investor-alert] ANTHROPIC_API_KEY não definida — mock alert message')
      return NextResponse.json({
        ok: true,
        matched_investors: matchCount,
        investors: investors?.slice(0, 5) || [],
        alert_message: mockAlertMessage(property),
        property,
        generated_at: new Date().toISOString(),
      })
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic()

    const nome = property.nome || property.name || 'Novo imóvel'
    const zona = property.zona || property.zone || 'Portugal'
    const preco = Number(propertyPrice).toLocaleString('pt-PT')
    const tipo = property.tipo || property.type || ''
    const area = property.area || property.area_m2 || ''
    const quartos = property.quartos || property.bedrooms || ''

    const prompt = `És Carlos Feiteira, agente sénior da Agency Group (AMI 22506), especialista em imobiliário de luxo em Portugal.
Mercado actual: Lisboa €5.000/m², Cascais €4.713/m², Algarve €3.941/m². Segmento premium em alta.

Escreve uma mensagem de WhatsApp urgente e personalizada para alertar investidores VIP sobre esta nova oportunidade.
Máx 2 frases. Concisa, persuasiva e exclusiva — transmite urgência real sem alarmismo. Em português europeu formal.

IMÓVEL:
- Nome/Referência: ${nome}
- Zona: ${zona}
- Tipo: ${tipo}
- Área: ${area}m²${quartos ? ` · T${quartos}` : ''}
- Preço: €${preco}

A mensagem deve: mencionar zona e preço, transmitir que é oportunidade exclusiva, criar urgência real, convidar a contacto imediato.`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 200,
      system: 'És um agente imobiliário de luxo em Portugal. Respondes APENAS com a mensagem de WhatsApp, sem aspas, sem JSON, sem explicações.',
      messages: [{ role: 'user', content: prompt }]
    })

    const alertMessage = msg.content[0].type === 'text' ? msg.content[0].text.trim() : mockAlertMessage(property)

    return NextResponse.json({
      ok: true,
      matched_investors: matchCount,
      investors: investors?.slice(0, 5) || [],
      alert_message: alertMessage,
      property,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[investor-alert] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
