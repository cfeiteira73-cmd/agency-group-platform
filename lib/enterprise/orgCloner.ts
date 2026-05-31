// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export type CloneScope =
  | 'workflows'
  | 'templates'
  | 'settings'
  | 'defaults'
  | 'team_structure'
  | 'integrations'

export interface CloneSpec {
  source_org_id: string
  target_org_id: string
  target_org_name: string
  clone_scope: CloneScope[]
  preserve_data: boolean
  anonymize_contacts: boolean
}

export interface CloneResult {
  clone_id: string
  source_org_id: string
  target_org_id: string
  scope: CloneScope[]
  cloned_items: Record<CloneScope, number>
  duration_ms: number
  success: boolean
  errors: string[]
  cloned_at: Date
}

// Default zero counts — real counts populated when clone methods query DB.
// dryRun() returns 0 until real count queries are implemented per scope.
const DEFAULT_ZERO_COUNTS: Record<CloneScope, number> = {
  workflows:      0,
  templates:      0,
  settings:       0,
  defaults:       0,
  team_structure: 0,
  integrations:   0,
}

class OrgCloner {
  clone(spec: CloneSpec): CloneResult {
    const validationErrors = this.validateCloneSpec(spec)
    const cloneId = `clone_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    if (validationErrors.length > 0) {
      logger.warn('[OrgCloner] clone spec validation failed', {
        source: spec.source_org_id,
        target: spec.target_org_id,
        errors: validationErrors,
      })

      const emptyItems = spec.clone_scope.reduce<Record<CloneScope, number>>(
        (acc, s) => ({ ...acc, [s]: 0 }),
        {} as Record<CloneScope, number>
      )

      return {
        clone_id: cloneId,
        source_org_id: spec.source_org_id,
        target_org_id: spec.target_org_id,
        scope: spec.clone_scope,
        cloned_items: emptyItems,
        duration_ms: 0,
        success: false,
        errors: validationErrors,
        cloned_at: new Date(),
      }
    }

    const start = Date.now()
    const clonedItems: Record<CloneScope, number> = {} as Record<CloneScope, number>
    const errors: string[] = []

    for (const scope of spec.clone_scope) {
      try {
        let count = 0
        switch (scope) {
          case 'workflows':
            count = this.cloneWorkflows(spec.source_org_id, spec.target_org_id)
            break
          case 'settings':
            count = this.cloneSettings(spec.source_org_id, spec.target_org_id)
            break
          case 'templates':
            count = this.cloneTemplates(spec.source_org_id, spec.target_org_id)
            break
          default:
            count = DEFAULT_ZERO_COUNTS[scope] ?? 0
        }
        clonedItems[scope] = count
      } catch (err) {
        errors.push(`Failed to clone ${scope}: ${err instanceof Error ? err.message : String(err)}`)
        clonedItems[scope] = 0
      }
    }

    const duration_ms = Date.now() - start
    const success = errors.length === 0

    logger.info('[OrgCloner] clone completed', {
      clone_id: cloneId,
      source: spec.source_org_id,
      target: spec.target_org_id,
      duration_ms,
      success,
    })

    return {
      clone_id: cloneId,
      source_org_id: spec.source_org_id,
      target_org_id: spec.target_org_id,
      scope: spec.clone_scope,
      cloned_items: clonedItems,
      duration_ms,
      success,
      errors,
      cloned_at: new Date(),
    }
  }

  cloneWorkflows(sourceOrgId: string, targetOrgId: string): number {
    logger.info('[OrgCloner] cloning workflows', { sourceOrgId, targetOrgId })
    // Real implementation would read workflows from DB and insert for target org
    return DEFAULT_ZERO_COUNTS['workflows']
  }

  cloneSettings(sourceOrgId: string, targetOrgId: string): number {
    logger.info('[OrgCloner] cloning settings', { sourceOrgId, targetOrgId })
    return DEFAULT_ZERO_COUNTS['settings']
  }

  cloneTemplates(sourceOrgId: string, targetOrgId: string): number {
    logger.info('[OrgCloner] cloning templates', { sourceOrgId, targetOrgId })
    return DEFAULT_ZERO_COUNTS['templates']
  }

  validateCloneSpec(spec: CloneSpec): string[] {
    const errors: string[] = []
    if (!spec.source_org_id?.trim()) errors.push('source_org_id is required')
    if (!spec.target_org_id?.trim()) errors.push('target_org_id is required')
    if (!spec.target_org_name?.trim()) errors.push('target_org_name is required')
    if (spec.source_org_id === spec.target_org_id) {
      errors.push('source_org_id and target_org_id must be different')
    }
    if (!spec.clone_scope || spec.clone_scope.length === 0) {
      errors.push('clone_scope must include at least one scope')
    }
    const validScopes: CloneScope[] = [
      'workflows', 'templates', 'settings', 'defaults', 'team_structure', 'integrations',
    ]
    for (const s of spec.clone_scope ?? []) {
      if (!validScopes.includes(s)) errors.push(`Invalid scope: ${s}`)
    }
    return errors
  }

  dryRun(spec: CloneSpec): Omit<CloneResult, 'cloned_at' | 'duration_ms'> {
    const errors = this.validateCloneSpec(spec)
    const cloneId = `dryrun_${Date.now()}`

    const clonedItems = spec.clone_scope.reduce<Record<CloneScope, number>>(
      (acc, s) => ({ ...acc, [s]: DEFAULT_ZERO_COUNTS[s] ?? 0 }),
      {} as Record<CloneScope, number>
    )

    return {
      clone_id: cloneId,
      source_org_id: spec.source_org_id,
      target_org_id: spec.target_org_id,
      scope: spec.clone_scope,
      cloned_items: clonedItems,
      success: errors.length === 0,
      errors,
    }
  }
}

export const orgCloner = new OrgCloner()
export default orgCloner
