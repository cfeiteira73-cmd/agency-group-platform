// AGENCY GROUP — SH-ROS | AMI: 22506
// GET  /api/distribution/onboard?agent_id=xxx — fetch current onboarding progress
// POST /api/distribution/onboard { agent_id, email, completed_step, invited_by? } — advance step
// Auth: isPortalAuth required on GET; POST is authenticated too (agent-owned data)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'
import {
  createOnboardingProgress,
  advanceStep,
  generateInviteCode,
  type OnboardingProgress,
  type OnboardingStep,
} from '@/lib/distribution-engine'

export const runtime = 'nodejs'
export const maxDuration = 15

// ---------------------------------------------------------------------------
// Supabase type escape
// ---------------------------------------------------------------------------

type DB = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>
      }
    }
    upsert: (
      row: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => Promise<{ error: unknown }>
  }
}

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface OnboardingRow {
  agent_id: string
  email: string
  steps_completed: string[]
  current_step: string
  completion_pct: number
  is_activated: boolean
  invite_code: string
  invited_by?: string | null
  started_at: string
  activated_at?: string | null
  time_to_activate_minutes?: number | null
}

function rowToProgress(row: OnboardingRow): OnboardingProgress {
  return {
    agent_id: row.agent_id,
    email: row.email,
    steps_completed: (row.steps_completed ?? []) as OnboardingStep[],
    current_step: (row.current_step ?? 'account') as OnboardingStep,
    completion_pct: row.completion_pct ?? 0,
    is_activated: row.is_activated ?? false,
    invite_code: row.invite_code ?? generateInviteCode(row.agent_id),
    invited_by: row.invited_by ?? undefined,
    started_at: new Date(row.started_at),
    activated_at: row.activated_at ? new Date(row.activated_at) : undefined,
    time_to_activate_minutes: row.time_to_activate_minutes ?? undefined,
  }
}

function progressToRow(p: OnboardingProgress): Record<string, unknown> {
  return {
    agent_id: p.agent_id,
    email: p.email,
    steps_completed: p.steps_completed,
    current_step: p.current_step,
    completion_pct: p.completion_pct,
    is_activated: p.is_activated,
    invite_code: p.invite_code,
    invited_by: p.invited_by ?? null,
    started_at: p.started_at.toISOString(),
    activated_at: p.activated_at?.toISOString() ?? null,
    time_to_activate_minutes: p.time_to_activate_minutes ?? null,
    updated_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent_id = req.nextUrl.searchParams.get('agent_id')
  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
  }

  const db = supabaseAdmin as unknown as DB

  try {
    const { data, error } = await db
      .from('agent_onboarding')
      .select('*')
      .eq('agent_id', agent_id)
      .limit(1)

    if (error || !data || data.length === 0) {
      // Return a fresh default progress — agent hasn't started yet
      const fresh = createOnboardingProgress(agent_id, '')
      return NextResponse.json({ progress: fresh, is_new: true })
    }

    const progress = rowToProgress(data[0] as OnboardingRow)
    return NextResponse.json({ progress, is_new: false })
  } catch (err) {
    logger.warn('[distribution/onboard] GET failed', { agent_id, err })
    const fresh = createOnboardingProgress(agent_id, '')
    return NextResponse.json({ progress: fresh, is_new: true })
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { agent_id?: string; email?: string; completed_step?: string; invited_by?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { agent_id, email, completed_step, invited_by } = body

  if (!agent_id || !completed_step) {
    return NextResponse.json({ error: 'agent_id and completed_step required' }, { status: 400 })
  }

  const db = supabaseAdmin as unknown as DB

  // Load existing progress or create fresh
  let progress: OnboardingProgress
  try {
    const { data } = await db
      .from('agent_onboarding')
      .select('*')
      .eq('agent_id', agent_id)
      .limit(1)

    if (data && data.length > 0) {
      progress = rowToProgress(data[0] as OnboardingRow)
    } else {
      progress = createOnboardingProgress(agent_id, email ?? '', invited_by)
    }
  } catch {
    progress = createOnboardingProgress(agent_id, email ?? '', invited_by)
  }

  // Advance step
  const updated = advanceStep(progress, completed_step as OnboardingStep)

  // Persist
  try {
    const { error } = await db
      .from('agent_onboarding')
      .upsert(progressToRow(updated), { onConflict: 'agent_id' })

    if (error) {
      logger.warn('[distribution/onboard] upsert failed', { agent_id, error })
    }
  } catch (err) {
    logger.warn('[distribution/onboard] upsert exception', { agent_id, err })
  }

  logger.info('[distribution/onboard] step advanced', {
    agent_id,
    completed_step,
    completion_pct: updated.completion_pct,
    is_activated: updated.is_activated,
  })

  return NextResponse.json({ progress: updated, success: true })
}
