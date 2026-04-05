import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { property } = await request.json()

    if (!property) {
      return NextResponse.json({ error: 'property is required' }, { status: 400 })
    }

    // Find matching investors from Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: investors } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, name, email, phone, whatsapp, budget_min, budget_max, zonas, tipos, status')
      .in('status', ['prospect', 'cliente', 'vip'])
      .lte('budget_min', property.preco || property.price || 9999999)
      .gte('budget_max', (property.preco || property.price || 0) * 0.85)
      .limit(20)

    const matchCount = investors?.length || 0

    // Generate AI alert message
    const prompt = `You are a luxury real estate agent at Agency Group Portugal (AMI 22506).
A new property just became available: ${property.nome || property.name}, ${property.zona || property.zone}, €${(property.preco || property.price || 0).toLocaleString()}.
Write a 2-sentence urgent WhatsApp message to alert VIP investors. Be concise and compelling. In Portuguese.`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    })

    const alertMessage = msg.content[0].type === 'text' ? msg.content[0].text : ''

    return NextResponse.json({
      ok: true,
      matched_investors: matchCount,
      investors: investors?.slice(0, 5) || [],
      alert_message: alertMessage,
      property,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
