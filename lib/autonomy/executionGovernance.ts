// AGENCY GROUP — SH-ROS | AMI: 22506
// Risk-tiered governance rules and forbidden autonomy actions.
// Enforces hard limits on autonomous execution frequency and chain depth.

import { logger } from '@/lib/observability/logger'
import type { AutonomyTier } from './confidenceGate'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GovernanceRule {
  rule_id: string
  action_pattern: string // regex or exact match
  risk_tier: AutonomyTier
  requires_audit: boolean
  max_chain_depth: number // max autonomous hops before human required
  daily_limit?: number   // max auto-executions per day per org
}

export interface GovernanceCheck {
  allowed: boolean
  rule_matched: GovernanceRule | null
  violations: string[]
  recommended_tier: AutonomyTier
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHAIN_DEPTH = 5
const DAILY_AUTO_LIMIT = 100

/** Patterns for actions that are NEVER autonomous. Checked as prefix or regex. */
const FORBIDDEN_AUTONOMOUS_PATTERNS: RegExp[] = [
  /^delete_/,
  /^mass_/,
  /^financial_/,
  /^legal_/,
  /^commission_/,
]

/** Predefined governance rules — ordered from most to least specific. */
const GOVERNANCE_RULES: GovernanceRule[] = [
  {
    rule_id: 'GOV-CRIT-DELETE',
    action_pattern: '^delete_',
    risk_tier: 'CRITICAL',
    requires_audit: true,
    max_chain_depth: 0,
    daily_limit: 0,
  },
  {
    rule_id: 'GOV-CRIT-MASS',
    action_pattern: '^mass_',
    risk_tier: 'CRITICAL',
    requires_audit: true,
    max_chain_depth: 0,
    daily_limit: 0,
  },
  {
    rule_id: 'GOV-CRIT-FINANCIAL',
    action_pattern: '^financial_',
    risk_tier: 'CRITICAL',
    requires_audit: true,
    max_chain_depth: 0,
    daily_limit: 0,
  },
  {
    rule_id: 'GOV-CRIT-LEGAL',
    action_pattern: '^legal_',
    risk_tier: 'CRITICAL',
    requires_audit: true,
    max_chain_depth: 0,
    daily_limit: 0,
  },
  {
    rule_id: 'GOV-CRIT-COMMISSION',
    action_pattern: '^commission_',
    risk_tier: 'CRITICAL',
    requires_audit: true,
    max_chain_depth: 0,
    daily_limit: 0,
  },
  {
    rule_id: 'GOV-HIGH-DEAL',
    action_pattern: '^(send_deal_pack|book_appointment|escalate_priority|send_proposal)$',
    risk_tier: 'HIGH',
    requires_audit: true,
    max_chain_depth: 2,
    daily_limit: 20,
  },
  {
    rule_id: 'GOV-MEDIUM-WORKFLOW',
    action_pattern: '^(update_lead_score|trigger_workflow|assign_agent|create_follow_up)$',
    risk_tier: 'MEDIUM',
    requires_audit: true,
    max_chain_depth: 3,
    daily_limit: 50,
  },
  {
    rule_id: 'GOV-LOW-ANALYTICS',
    action_pattern: '^(generate_digest|compute_match|update_analytics|log_event)$',
    risk_tier: 'LOW',
    requires_audit: false,
    max_chain_depth: MAX_CHAIN_DEPTH,
    daily_limit: DAILY_AUTO_LIMIT,
  },
]

// ---------------------------------------------------------------------------
// In-memory daily execution counter
// Structure: Map<org_id, { count: number; reset_at: Date }>
// ---------------------------------------------------------------------------

interface DailyCounter {
  count: number
  reset_at: Date
}

function midnightUTC(): Date {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// ExecutionGovernance
// ---------------------------------------------------------------------------

class ExecutionGovernance {
  private dailyCounters = new Map<string, DailyCounter>()

  private getOrCreateCounter(org_id: string): DailyCounter {
    const now = new Date()
    const existing = this.dailyCounters.get(org_id)
    if (existing && now < existing.reset_at) {
      return existing
    }
    const fresh: DailyCounter = { count: 0, reset_at: midnightUTC() }
    this.dailyCounters.set(org_id, fresh)
    return fresh
  }

  private incrementCounter(org_id: string): void {
    const counter = this.getOrCreateCounter(org_id)
    counter.count += 1
  }

  private isForbidden(action: string): boolean {
    return FORBIDDEN_AUTONOMOUS_PATTERNS.some((pattern) => pattern.test(action))
  }

  private matchRule(action: string): GovernanceRule | null {
    for (const rule of GOVERNANCE_RULES) {
      const re = new RegExp(rule.action_pattern)
      if (re.test(action)) return rule
    }
    return null
  }

  async check(
    action: string,
    org_id: string,
    chain_depth: number,
  ): Promise<GovernanceCheck> {
    const violations: string[] = []
    let recommended_tier: AutonomyTier = 'HIGH'

    // 1. Forbidden pattern check
    if (this.isForbidden(action)) {
      violations.push(`Action "${action}" matches a forbidden autonomous action pattern.`)
    }

    // 2. Chain depth check
    if (chain_depth >= MAX_CHAIN_DEPTH) {
      violations.push(
        `Chain depth ${chain_depth} has reached maximum (${MAX_CHAIN_DEPTH}). Human approval required.`,
      )
    }

    // 3. Rule-based checks
    const rule = this.matchRule(action)
    if (rule) {
      recommended_tier = rule.risk_tier

      if (rule.risk_tier === 'CRITICAL') {
        violations.push(`Rule ${rule.rule_id}: action is CRITICAL tier — always requires human.`)
      }

      if (chain_depth > rule.max_chain_depth) {
        violations.push(
          `Rule ${rule.rule_id}: chain depth ${chain_depth} exceeds rule max (${rule.max_chain_depth}).`,
        )
      }

      if (rule.daily_limit !== undefined) {
        const counter = this.getOrCreateCounter(org_id)
        if (counter.count >= rule.daily_limit) {
          violations.push(
            `Rule ${rule.rule_id}: daily limit (${rule.daily_limit}) reached for org "${org_id}".`,
          )
        }
      }
    }

    // 4. Global daily limit check
    const counter = this.getOrCreateCounter(org_id)
    if (counter.count >= DAILY_AUTO_LIMIT) {
      violations.push(
        `Global daily autonomous limit (${DAILY_AUTO_LIMIT}) reached for org "${org_id}".`,
      )
    }

    const allowed = violations.length === 0

    if (allowed) {
      this.incrementCounter(org_id)
    }

    logger.info('[executionGovernance] check', {
      action,
      org_id,
      chain_depth,
      allowed,
      violations,
      rule_id: rule?.rule_id ?? null,
      recommended_tier,
    })

    return {
      allowed,
      rule_matched: rule,
      violations,
      recommended_tier,
    }
  }
}

export const executionGovernance = new ExecutionGovernance()
