// =============================================================================
// Agency Group — Properties API
// GET  /api/properties  — portal-authenticated listing query
// POST /api/properties  — public partner submission (parceiros form)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'

const PartnerSubmissionSchema = z.object({
  // Agency details
  agencyName:  z.string().min(1).max(200),
  agencyAMI:   z.string().min(1).max(20),
  agencyEmail: z.string().email(),
  agencyPhone: z.string().min(6).max(30),
  // Property details
  nome:        z.string().min(1).max(300),
  zona:        z.string().min(1).max(80),
  bairro:      z.string().max(80).optional().default(''),
  tipo:        z.string().max(80).optional().default('Apartamento'),
  preco:       z.coerce.number().min(1),
  area:        z.coerce.number().min(1),
  quartos:     z.coerce.number().optional().default(2),
  casasBanho:  z.coerce.number().optional().default(1),
  vista:       z.string().max(80).optional().default(''),
  piscina:     z.boolean().optional().default(false),
  garagem:     z.boolean().optional().default(false),
  jardim:      z.boolean().optional().default(false),
  terraco:     z.boolean().optional().default(false),
  desc:        z.string().max(3000).optional().default(''),
  tourUrl:     z.string().max(500).optional().default(''),
  features:    z.array(z.string()).optional().default([]),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 3 submissions per IP per hour
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? request.headers.get('x-real-ip')
          ?? '127.0.0.1'
  const rl = await rateLimit(ip, { maxAttempts: 3, windowMs: 3_600_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas submissões. Tente novamente mais tarde.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = PartnerSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data

    // 1. Save agency contact to contacts table
    if (supabaseAdmin) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
          .from('contacts')
          .upsert({
            email:      d.agencyEmail,
            phone:      d.agencyPhone,
            name:       d.agencyName,
            full_name:  d.agencyName,
            source:     'parceiros_form',
            status:     'lead',
            notes:      `AMI: ${d.agencyAMI} | Imóvel: ${d.nome} em ${d.zona} a €${d.preco.toLocaleString('pt-PT')}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email', ignoreDuplicates: false })
      } catch (e) {
        console.error('[properties POST] contacts upsert error:', e)
      }

      // 2. Save property as pending_review in properties table
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
          .from('properties')
          .insert({
            nome:         d.nome,
            zona:         d.zona,
            bairro:       d.bairro,
            tipo:         d.tipo,
            preco:        d.preco,
            area:         d.area,
            quartos:      d.quartos,
            casas_banho:  d.casasBanho,
            status:       'pending_review',
            descricao:    d.desc,
            features:     d.features,
            notes:        `Parceiro: ${d.agencyName} (AMI ${d.agencyAMI}) — ${d.agencyEmail} — ${d.agencyPhone}${d.tourUrl ? ` | Tour: ${d.tourUrl}` : ''}`,
            created_at:   new Date().toISOString(),
            updated_at:   new Date().toISOString(),
          })
      } catch (e) {
        // properties table may have schema differences — non-critical
        console.warn('[properties POST] property insert error (non-critical):', e)
      }
    }

    // 3. Send email alert to agent
    const alertEmail = process.env.AGENT_ALERT_EMAIL
    if (alertEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const features = d.features.length > 0 ? d.features.join(', ') : '—'
        const extras = [d.piscina&&'Piscina',d.garagem&&'Garagem',d.jardim&&'Jardim',d.terraco&&'Terraço',d.vista&&`Vista: ${d.vista}`].filter(Boolean).join(' · ')
        await resend.emails.send({
          from: 'Agency Group <noreply@agencygroup.pt>',
          to:   alertEmail,
          subject: `🤝 Nova parceria: ${d.nome} em ${d.zona} — €${d.preco.toLocaleString('pt-PT')}`,
          html: `
            <h2>Nova Submissão de Parceiro</h2>
            <h3>Agência</h3>
            <ul>
              <li><strong>Nome:</strong> ${d.agencyName}</li>
              <li><strong>AMI:</strong> ${d.agencyAMI}</li>
              <li><strong>Email:</strong> ${d.agencyEmail}</li>
              <li><strong>Telefone:</strong> ${d.agencyPhone}</li>
            </ul>
            <h3>Imóvel</h3>
            <ul>
              <li><strong>Nome:</strong> ${d.nome}</li>
              <li><strong>Zona:</strong> ${d.zona}${d.bairro ? ` — ${d.bairro}` : ''}</li>
              <li><strong>Tipo:</strong> ${d.tipo}</li>
              <li><strong>Preço:</strong> €${d.preco.toLocaleString('pt-PT')}</li>
              <li><strong>Área:</strong> ${d.area} m²</li>
              <li><strong>Quartos:</strong> T${d.quartos} | ${d.casasBanho} WC</li>
              ${extras ? `<li><strong>Extras:</strong> ${extras}</li>` : ''}
              ${d.tourUrl ? `<li><strong>Tour Virtual:</strong> <a href="${d.tourUrl}">${d.tourUrl}</a></li>` : ''}
              ${d.features.length ? `<li><strong>Features:</strong> ${features}</li>` : ''}
            </ul>
            ${d.desc ? `<h3>Descrição</h3><p>${d.desc}</p>` : ''}
            <hr/>
            <p><small>Submetido via parceiros form — Agency Group</small></p>
          `,
        })
      } catch (e) {
        console.error('[properties POST] Resend alert error:', e)
      }
    }

    return NextResponse.json({ success: true, message: 'Proposta recebida com sucesso.' })
  } catch (err) {
    console.error('[properties POST] error:', err)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const zona     = searchParams.get('zona')
    const tipo     = searchParams.get('tipo')
    const maxPreco = searchParams.get('max_preco') ? parseInt(searchParams.get('max_preco')!) : null
    const status   = searchParams.get('status') ?? 'active'
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    if (!supabaseAdmin) {
      return NextResponse.json({ data: [], source: 'error', error: 'Supabase not configured' })
    }

    // Try with portal-compat columns (migration 003)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabaseAdmin as any)
        .from('properties')
        .select('id, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, energia, status, descricao, features, gradient')
        .not('nome', 'is', null)  // Only portal-populated rows
        .limit(limit)

      if (status && status !== 'all') query = query.eq('status', status)
      if (zona)     query = query.eq('zona', zona)
      if (tipo)     query = query.eq('tipo', tipo)
      if (maxPreco) query = query.lte('preco', maxPreco)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row) => ({
          id:         row.id,
          nome:       row.nome       || '',
          zona:       row.zona       || '',
          bairro:     row.bairro     || '',
          tipo:       row.tipo       || '',
          preco:      row.preco      || 0,
          area:       row.area       || 0,
          quartos:    row.quartos    || 0,
          casasBanho: row.casas_banho || 0,
          energia:    row.energia    || '',
          status:     row.status     || 'active',
          descricao:  row.descricao  || '',
          features:   Array.isArray(row.features) ? row.features : [],
          gradient:   row.gradient   || 'from-slate-800 to-gray-900',
        }))

        return NextResponse.json({ data: mapped, total: mapped.length, source: 'supabase' })
      }
    } catch {
      // Portal-compat columns might not exist yet (pre-migration 003)
      // Fall through to complex schema attempt
    }

    // Try with complex Supabase schema (migration 001)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabaseAdmin as any)
        .from('properties')
        .select('id, title, zone, city, type, price, area_m2, bedrooms, bathrooms, energy_certificate, status, description, features')
        .limit(limit)

      if (status && status !== 'all') query = query.eq('status', status)
      if (zona)     query = query.eq('zone', zona)
      if (tipo)     query = query.eq('type', tipo)
      if (maxPreco) query = query.lte('price', maxPreco)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row) => ({
          id:         row.id,
          nome:       row.title      || '',
          zona:       row.zone       || row.city || '',
          bairro:     '',
          tipo:       row.type       || '',
          preco:      row.price      || 0,
          area:       row.area_m2    || 0,
          quartos:    row.bedrooms   || 0,
          casasBanho: row.bathrooms  || 0,
          energia:    row.energy_certificate || '',
          status:     row.status     || 'active',
          descricao:  row.description || '',
          features:   Array.isArray(row.features) ? row.features : [],
          gradient:   'from-slate-800 to-gray-900',
        }))
        .filter((p: { nome: string }) => p.nome)

        return NextResponse.json({ data: mapped, total: mapped.length, source: 'supabase' })
      }
    } catch {
      // Supabase unavailable or schema mismatch
    }

    // Return empty — component will use PORTAL_PROPERTIES fallback
    return NextResponse.json({ data: [], total: 0, source: 'empty' })
  } catch (error) {
    console.error('[properties GET]', error)
    return NextResponse.json({ data: [], source: 'error' }, { status: 500 })
  }
}
