// =============================================================================
// Agency Group — Properties API
// GET  /api/properties  — portal-authenticated listing query (internal staff)
// POST /api/properties  — public partner submission (parceiros form)
// =============================================================================
// SCHEMA NOTE: production.properties uses Portuguese column names.
// (nome, zona, tipo, preco, area, quartos, casas_banho, energia, images, …)
// English-named columns (title, zone, type, price, area_m2, …) do NOT exist.
// B1 columns (is_verified, verification_date, verified_by, submission_source,
// is_off_market) are added by migration 067 — must be applied before deploy.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { recordRequest as sloRecordRequest } from '@/lib/sre/sloTracker'

const PartnerSubmissionSchema = z.object({
  // Agency details
  agencyName:  z.string().min(1).max(200),
  agencyAMI:   z.string().min(1).max(20),
  agencyEmail: z.string().email(),
  agencyPhone: z.string().min(6).max(30),
  // Property details — Portuguese field names matching production schema
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

// Canonical Portuguese tipo values stored in production.properties.tipo (TEXT).
// Maps partner-submitted tipo names to canonical production storage value.
// UNKNOWN TYPE ≠ APARTMENT — unmapped tipos return null and must be rejected.
// Quinta/Herdade are not accepted via the partner submission channel.
const TIPO_CANONICAL: Record<string, string> = {
  'Apartamento':        'Apartamento',
  'Moradia':            'Moradia',
  'Moradia em Banda':   'Moradia em Banda',
  'Townhouse':          'Moradia em Banda',  // alias → canonical
  'Penthouse':          'Penthouse',
  'Villa':              'Villa',
  'Terreno':            'Terreno',
  'Lote':               'Terreno',           // alias → canonical
  'Comercial':          'Comercial',
  'Escritório':         'Escritório',
  'Armazém':            'Armazém',
  'Hotel':              'Hotel',
  'Loteamento':         'Loteamento',
}

function mapPropertyTipo(tipo: string): string | null {
  const normalized = tipo.trim()
  return TIPO_CANONICAL[normalized] ?? null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(request)
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

    const canonicalTipo = mapPropertyTipo(d.tipo)
    if (canonicalTipo === null) {
      return NextResponse.json({ error: 'Tipo de imóvel não reconhecido.' }, { status: 400 })
    }

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
        console.error('[properties POST] contacts upsert error:', e, { corrId })
      }

      // 2. Persist property as pending_review — CRITICAL: must succeed before success response.
      // Uses canonical Portuguese column names matching production schema.
      // B1 columns (is_verified, is_off_market, submission_source) require migration 067.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast for B1 columns pre-type-gen
      const { error: propertyError } = await (supabaseAdmin as any)
        .from('properties')
        .insert({
          nome:              d.nome,
          zona:              d.zona,
          bairro:            d.bairro || null,
          tipo:              canonicalTipo,
          preco:             d.preco,
          area:              d.area,
          quartos:           d.quartos,
          casas_banho:       d.casasBanho,
          descricao:         d.desc || null,
          features:          d.features,
          status:            'pending_review',
          is_off_market:     true,
          is_verified:       false,
          submission_source: 'partner',
          created_at:        new Date().toISOString(),
          updated_at:        new Date().toISOString(),
        })

      if (propertyError) {
        console.error('[properties POST] property insert failed:', {
          corrId,
          code:    propertyError.code,
          message: propertyError.message,
        })
        return NextResponse.json(
          { error: 'Falha ao registar imóvel. Tente novamente.' },
          { status: 500 }
        )
      }
    }

    // 3. Send email alert to agent — only after successful property persistence
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
              <li><strong>Email:</strong> ${d.agencyPhone}</li>
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
        console.error('[properties POST] Resend alert error:', e, { corrId })
      }
    }

    return NextResponse.json({ success: true, message: 'Proposta recebida com sucesso.' })
  } catch (err) {
    console.error('[properties POST] error:', err, { corrId })
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(request)
  const _sloStart = Date.now()
  const _sloTenant = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
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

    try {
      // Query using canonical Portuguese production column names.
      // B1 fields (is_verified, submission_source) available after migration 067.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabaseAdmin as any)
        .from('properties')
        .select('id, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, energia, status, descricao, features, images, matterport_url, is_verified, submission_source, created_at')
        .not('nome', 'is', null)
        .limit(limit)

      if (status && status !== 'all') query = query.eq('status', status as string)
      if (zona)     query = query.eq('zona', zona)
      if (tipo)     query = query.eq('tipo', tipo)
      if (maxPreco) query = query.lte('preco', maxPreco)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        // Map Portuguese DB column names to portal DTO.
        // Transformations: snake_case → camelCase, images → imagens (DTO contract).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row) => ({
          id:               row.id,
          nome:             row.nome              || '',
          zona:             row.zona              || '',
          bairro:           row.bairro            || '',
          tipo:             row.tipo              || '',
          preco:            row.preco             || 0,
          area:             row.area              || 0,
          quartos:          row.quartos           || 0,
          casasBanho:       row.casas_banho       || 0,
          energia:          row.energia           || '',
          status:           row.status            || 'active',
          descricao:        row.descricao         || '',
          features:         Array.isArray(row.features)  ? row.features  : [],
          gradient:         'from-slate-800 to-gray-900',
          badge:            undefined,
          lifestyleTags:    [],
          imagens:          Array.isArray(row.images)    ? row.images    : [],
          matterportUrl:    row.matterport_url    || undefined,
          youtubeUrl:       undefined,
          isVerified:       row.is_verified       ?? false,
          submissionSource: row.submission_source || null,
          listingDate:      row.created_at        || null,
        }))

        void sloRecordRequest(_sloTenant, 'api', true, Date.now() - _sloStart).catch(() => {})
        return NextResponse.json({ data: mapped, total: mapped.length, source: 'supabase' })
      }
    } catch {
      // Supabase unavailable — return empty, component uses PORTAL_PROPERTIES fallback
    }

    // Return empty — component will use PORTAL_PROPERTIES fallback
    return NextResponse.json({ data: [], total: 0, source: 'empty' })
  } catch (error) {
    console.error('[properties GET]', error, { corrId })
    void sloRecordRequest(_sloTenant, 'api', false, Date.now() - _sloStart).catch(() => {})
    return NextResponse.json({ error: 'Internal server error', data: [], source: 'error' }, { status: 500 })
  }
}
