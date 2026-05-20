// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// POST /api/buyer-intelligence/track
// Public endpoint — called from client-side, no auth required.
// Fire-and-forget: always returns 200 to avoid blocking the UI.

import { NextRequest, NextResponse } from 'next/server'
import { buyerIntentProfiler } from '@/lib/buyer-intelligence/buyerIntentProfiler'
import type { BuyerBehaviorEvent, BuyerEventType, BuyerIntentProfile } from '@/lib/buyer-intelligence/types'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 10

// ---------------------------------------------------------------------------
// Valid event types
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES = new Set<string>([
  'page_view',
  'listing_view',
  'listing_save',
  'filter_apply',
  'inquiry_start',
  'inquiry_submit',
  'price_range_view',
  'map_view',
  'scroll_depth',
  'revisit',
])

// ---------------------------------------------------------------------------
// Sanitize profile — strip raw events to keep response lean
// ---------------------------------------------------------------------------

function sanitizeProfile(profile: BuyerIntentProfile): Omit<BuyerIntentProfile, 'events'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { events: _events, ...safe } = profile
  return safe
}

// ---------------------------------------------------------------------------
// POST /api/buyer-intelligence/track
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const rl = await rateLimit(`buyer-intelligence-track:${ip}`, { maxAttempts: 60, windowMs: 60_000 })
  if (!rl.success) {
    // Still return 200 — fire-and-forget from client, never surface errors
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 200 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 200 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 200 })
  }

  const raw = body as Record<string, unknown>

  // ── Validate fields ────────────────────────────────────────────────────────
  const sessionId = typeof raw.session_id === 'string' && raw.session_id.trim().length > 0
    ? raw.session_id.trim()
    : null

  if (!sessionId) {
    return NextResponse.json({ ok: false, reason: 'missing_session_id' }, { status: 200 })
  }

  const eventType = typeof raw.event_type === 'string' && VALID_EVENT_TYPES.has(raw.event_type)
    ? (raw.event_type as BuyerEventType)
    : null

  if (!eventType) {
    return NextResponse.json({ ok: false, reason: 'invalid_event_type' }, { status: 200 })
  }

  const payload: Record<string, unknown> =
    raw.payload !== null &&
    typeof raw.payload === 'object' &&
    !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : {}

  // ── Build event ────────────────────────────────────────────────────────────
  const event: BuyerBehaviorEvent = {
    session_id: sessionId,
    event_type:  eventType,
    payload,
    timestamp:   new Date(),
  }

  // ── Profile + respond ──────────────────────────────────────────────────────
  try {
    const profile = buyerIntentProfiler.addEvent(sessionId, event)
    return NextResponse.json({ ok: true, profile: sanitizeProfile(profile) }, { status: 200 })
  } catch {
    // Never fail the client — fire-and-forget contract
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 200 })
  }
}
