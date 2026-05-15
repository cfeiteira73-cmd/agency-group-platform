// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Smart Defaults Engine
// Org-level preference management with usage-driven adaptation
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface OrgDefaults {
  org_id: string
  followup_cadence_days: number        // default 3
  auto_trigger_score: number           // default 80
  preferred_currency: string           // default 'EUR'
  preferred_format: 'brief' | 'detailed'  // default 'brief'
  risk_tolerance: 'low' | 'medium' | 'high'  // default 'medium'
  digest_time: string                  // default '08:00'
  language: string                     // default 'pt'
  last_updated: Date
}

// ─── Base Defaults ────────────────────────────────────────────────────────────

const DEFAULT_ORG_DEFAULTS: Omit<OrgDefaults, 'org_id'> = {
  followup_cadence_days: 3,
  auto_trigger_score: 80,
  preferred_currency: 'EUR',
  preferred_format: 'brief',
  risk_tolerance: 'medium',
  digest_time: '08:00',
  language: 'pt',
  last_updated: new Date(),
}

// ─── Class ────────────────────────────────────────────────────────────────────

class SmartDefaultsEngine {
  private cache: Map<string, OrgDefaults> = new Map()

  getDefaults(orgId: string): OrgDefaults {
    if (this.cache.has(orgId)) {
      return this.cache.get(orgId)!
    }

    const defaults: OrgDefaults = {
      ...DEFAULT_ORG_DEFAULTS,
      org_id: orgId,
      last_updated: new Date(),
    }

    this.cache.set(orgId, defaults)

    logger.info('[SmartDefaults] getDefaults — created from base', { org_id: orgId })

    return defaults
  }

  setDefault<K extends keyof OrgDefaults>(orgId: string, key: K, value: OrgDefaults[K]): void {
    const current = this.getDefaults(orgId)
    const updated: OrgDefaults = {
      ...current,
      [key]: value,
      last_updated: new Date(),
    }
    this.cache.set(orgId, updated)

    logger.info('[SmartDefaults] setDefault', { org_id: orgId, key: String(key) })
  }

  learnFromUsage(orgId: string, action: string, outcome: 'positive' | 'negative'): void {
    const current = this.getDefaults(orgId)

    // Adapt followup cadence based on re-engagement outcomes
    if (action.includes('followup') || action.includes('re_engage')) {
      const adjustment = outcome === 'positive' ? -1 : 1
      const newCadence = Math.max(1, Math.min(14, current.followup_cadence_days + adjustment))

      if (newCadence !== current.followup_cadence_days) {
        this.setDefault(orgId, 'followup_cadence_days', newCadence)
        logger.info('[SmartDefaults] learnFromUsage — cadence adjusted', {
          org_id: orgId,
          action,
          outcome,
          old_cadence: current.followup_cadence_days,
          new_cadence: newCadence,
        })
        return
      }
    }

    logger.info('[SmartDefaults] learnFromUsage', { org_id: orgId, action, outcome })
  }

  resetToGlobal(orgId: string): void {
    const reset: OrgDefaults = {
      ...DEFAULT_ORG_DEFAULTS,
      org_id: orgId,
      last_updated: new Date(),
    }
    this.cache.set(orgId, reset)

    logger.warn('[SmartDefaults] resetToGlobal', { org_id: orgId })
  }

  exportDefaults(orgId: string): Partial<OrgDefaults> {
    const defaults = this.getDefaults(orgId)
    // Exclude internal tracking fields from export
    const { last_updated, ...exportable } = defaults
    return exportable
  }
}

export const smartDefaultsEngine = new SmartDefaultsEngine()
