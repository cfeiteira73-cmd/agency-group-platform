// =============================================================================
// Agency Group — Behavioral Investor API
// app/api/investors/behavioral/route.ts
//
// GET  /api/investors/behavioral?investor_id=xxx
//      → returns behavioral profile (builds if not cached)
//
// GET  /api/investors/behavioral?investor_id=xxx&property_id=xxx
//      → conversion prediction (use query param `mode=conversion`)
//
// GET  /api/investors/behavioral?investor_id=xxx&mode=deployment&months=3
//      → deployment history
//
// POST /api/investors/behavioral?investor_id=xxx
//      → rebuild profile (service auth: x-service-auth = INTERNAL_API_SECRET)
//
// Auth: isPortalAuth (reads) | x-service-auth (POST rebuild)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import log from '@/lib/logger'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildBehavioralProfile,
  computeConversionPrediction,
} from '@/lib/investors/behavioralModel'
import { getDeploymentHistory } from '@/lib/investors/capitalDeploymentTracker'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Service auth helper ──────────────────────────────────────────────────────

function isServiceAuth(req: NextRequest): boolean {
  const secret   = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming = req.headers.get('x-service-auth') ?? ''
  if (!incoming) return false
  try {
    const a = Buffer.from(incoming)
    const b = Buffer.from(secret)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── GET /api/investors/behavioral ───────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const investorId  = searchParams.get('investor_id')
    const propertyId  = searchParams.get('property_id')
    const mode        = searchParams.get('mode') ?? 'profile'
    const monthsRaw   = searchParams.get('months')
    const months      = monthsRaw ? Math.min(24, Math.max(1, parseInt(monthsRaw, 10))) : 6

    if (!investorId) {
      return NextResponse.json(
        { error: 'Missing required param: investor_id' },
        { status: 400 },
      )
    }

    // ── Mode: conversion prediction ──────────────────────────────────────────
    if (mode === 'conversion' || propertyId) {
      if (!propertyId) {
        return NextResponse.json(
          { error: 'Missing required param: property_id for conversion mode' },
          { status: 400 },
        )
      }

      const prediction = await computeConversionPrediction(tenantId, investorId, propertyId)

      log.info('[API /investors/behavioral] conversion prediction', {
        investor_id:  investorId,
        property_id:  propertyId,
        tenant_id:    tenantId,
        probability:  prediction.conversion_probability,
      } as any)

      return NextResponse.json({ success: true, data: prediction })
    }

    // ── Mode: deployment history ─────────────────────────────────────────────
    if (mode === 'deployment') {
      const history = await getDeploymentHistory(tenantId, investorId, months)

      log.info('[API /investors/behavioral] deployment history', {
        investor_id: investorId,
        tenant_id:   tenantId,
        months,
        count:       history.length,
      } as any)

      return NextResponse.json({ success: true, data: history })
    }

    // ── Mode: profile (default) ──────────────────────────────────────────────

    // Try cache first
    const db = supabaseAdmin as any

    const { data: cachedRaw } = await db
      .from('investor_behavioral_profiles')
      .select('*')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .single()

    if (cachedRaw) {
      log.info('[API /investors/behavioral] profile — served from cache', {
        investor_id: investorId,
        tenant_id:   tenantId,
      } as any)
      return NextResponse.json({ success: true, data: cachedRaw, source: 'cache' })
    }

    // Build fresh
    const profile = await buildBehavioralProfile(tenantId, investorId)

    log.info('[API /investors/behavioral] profile — built fresh', {
      investor_id: investorId,
      tenant_id:   tenantId,
    } as any)

    return NextResponse.json({ success: true, data: profile, source: 'computed' })
  } catch (err) {
    log.warn('[API /investors/behavioral GET] error', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/investors/behavioral?investor_id=xxx ──────────────────────────
// Service auth only — force-rebuild the behavioral profile

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isServiceAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const investorId = searchParams.get('investor_id')

    if (!investorId) {
      return NextResponse.json(
        { error: 'Missing required param: investor_id' },
        { status: 400 },
      )
    }

    // Force-rebuild (bypasses cache)
    const profile = await buildBehavioralProfile(tenantId, investorId)

    log.info('[API /investors/behavioral POST] profile rebuilt', {
      investor_id: investorId,
      tenant_id:   tenantId,
    } as any)

    return NextResponse.json({ success: true, data: profile })
  } catch (err) {
    log.warn('[API /investors/behavioral POST] error', {
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

