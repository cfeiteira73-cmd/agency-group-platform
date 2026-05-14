// AGENCY GROUP — SH-ROS Compliance: policyEngine | AMI: 22506

export interface PolicyContext {
  action: string
  entity_type: string
  entity_id?: string
  org_id: string
  actor: string
  metadata: Record<string, unknown>
}

export interface PolicyDecision {
  allowed: boolean
  policy_id?: string
  reason: string
  conditions?: string[]
}

export interface CompliancePolicy {
  policy_id: string
  name: string
  rule: (ctx: PolicyContext) => boolean
  action_required?: string
  severity: 'info' | 'warning' | 'blocking'
}

export interface ComplianceReport {
  org_id: string
  compliant: boolean
  issues: Array<{ policy: string; severity: string; description: string }>
  computed_at: string
}

export class PolicyEngine {
  private _policies: CompliancePolicy[] = []

  constructor() {
    this._registerBuiltInPolicies()
  }

  evaluate(context: PolicyContext): PolicyDecision {
    for (const policy of this._policies) {
      try {
        const allowed = policy.rule(context)
        if (!allowed) {
          return {
            allowed:   false,
            policy_id: policy.policy_id,
            reason:    `Policy '${policy.name}' blocked this action`,
            conditions: policy.action_required ? [policy.action_required] : [],
          }
        }
      } catch (err) {
        console.warn(`[PolicyEngine] policy ${policy.policy_id} evaluation error:`, err)
      }
    }
    return { allowed: true, reason: 'All policies passed' }
  }

  registerPolicy(policy: CompliancePolicy): void {
    this._policies.push(policy)
  }

  getPolicies(): CompliancePolicy[] {
    return [...this._policies]
  }

  checkCompliance(org_id: string): ComplianceReport {
    const testContexts: PolicyContext[] = [
      { action: 'data_access', entity_type: 'contacts', org_id, actor: 'system', metadata: {} },
      { action: 'delete', entity_type: 'contacts', org_id, actor: 'system', metadata: {} },
    ]

    const issues: ComplianceReport['issues'] = []

    for (const ctx of testContexts) {
      for (const policy of this._policies) {
        try {
          const allowed = policy.rule(ctx)
          if (!allowed && policy.severity !== 'info') {
            issues.push({
              policy:      policy.name,
              severity:    policy.severity,
              description: `${ctx.action} on ${ctx.entity_type} violates policy '${policy.name}'`,
            })
          }
        } catch { /* skip */ }
      }
    }

    return { org_id, compliant: issues.filter(i => i.severity === 'blocking').length === 0, issues, computed_at: new Date().toISOString() }
  }

  private _registerBuiltInPolicies(): void {
    this._policies = [
      {
        policy_id: 'pii_access_logged',
        name: 'PII Access Logging',
        severity: 'warning',
        rule: (ctx) => {
          if (['contacts', 'deals'].includes(ctx.entity_type) && ctx.action === 'data_access') {
            return true // Always allow but should be logged — enforced externally
          }
          return true
        },
        action_required: 'Ensure PII access is logged in immutable_audit',
      },
      {
        policy_id: 'legal_hold_check',
        name: 'Legal Hold Check Before Delete',
        severity: 'blocking',
        rule: (ctx) => {
          if (ctx.action === 'delete' && ctx.metadata.legal_hold_checked !== true) {
            return false // Block delete if legal hold not checked
          }
          return true
        },
        action_required: 'Check legalHoldManager.isHeld() before deletion',
      },
      {
        policy_id: 'gdpr_erasure_allowed',
        name: 'GDPR Erasure Requires Consent Withdrawal',
        severity: 'blocking',
        rule: (ctx) => {
          if (ctx.action === 'gdpr_erasure') {
            return ctx.metadata.consent_withdrawn === true
          }
          return true
        },
        action_required: 'Record consent withdrawal before erasure',
      },
    ]
  }
}

export const policyEngine = new PolicyEngine()
