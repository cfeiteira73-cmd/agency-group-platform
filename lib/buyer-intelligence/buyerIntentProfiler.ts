// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// lib/buyer-intelligence/buyerIntentProfiler.ts

import { intentClassifier } from './intentClassifier'
import type { BuyerBehaviorEvent, BuyerIntentProfile } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS_PER_SESSION = 50
const SESSION_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

// ---------------------------------------------------------------------------
// Session store entry
// ---------------------------------------------------------------------------

interface SessionEntry {
  events: BuyerBehaviorEvent[]
  profile: BuyerIntentProfile
  last_active: number // Unix ms
}

// ---------------------------------------------------------------------------
// BuyerIntentProfiler — in-memory singleton
// ---------------------------------------------------------------------------

class BuyerIntentProfiler {
  private readonly sessions = new Map<string, SessionEntry>()

  // ── Evict stale sessions ──────────────────────────────────────────────────

  private evictExpired(): void {
    const cutoff = Date.now() - SESSION_TTL_MS
    for (const [id, entry] of this.sessions) {
      if (entry.last_active < cutoff) {
        this.sessions.delete(id)
      }
    }
  }

  // ── Add event + reclassify ────────────────────────────────────────────────

  addEvent(sessionId: string, event: BuyerBehaviorEvent): BuyerIntentProfile {
    this.evictExpired()

    const now = Date.now()
    const existing = this.sessions.get(sessionId)

    let events: BuyerBehaviorEvent[]

    if (existing) {
      // Append new event; enforce max-events cap (drop oldest if needed)
      events = [...existing.events, event]
      if (events.length > MAX_EVENTS_PER_SESSION) {
        events = events.slice(events.length - MAX_EVENTS_PER_SESSION)
      }
    } else {
      events = [event]
    }

    const profile = intentClassifier.classify(events)

    this.sessions.set(sessionId, {
      events,
      profile,
      last_active: now,
    })

    return profile
  }

  // ── Retrieve current profile ──────────────────────────────────────────────

  getProfile(sessionId: string): BuyerIntentProfile | null {
    this.evictExpired()

    const entry = this.sessions.get(sessionId)
    if (!entry) return null

    // Refresh last_active on read (keeps hot sessions alive)
    entry.last_active = Date.now()
    return entry.profile
  }

  // ── Diagnostics (not exposed via API) ────────────────────────────────────

  get sessionCount(): number {
    return this.sessions.size
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const buyerIntentProfiler = new BuyerIntentProfiler()
