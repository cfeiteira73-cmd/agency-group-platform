// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface RollbackCheckpoint {
  checkpoint_id: string
  org_id: string
  feature: string
  state_snapshot: Record<string, unknown>
  created_at: Date
  ttl_hours: number
  description: string
}

export interface RollbackResult {
  checkpoint_id: string
  org_id: string
  success: boolean
  restored_state: Record<string, unknown>
  duration_ms: number
  rolled_back_at: Date
}

class EnterpriseRollbackManager {
  private checkpoints: Map<string, RollbackCheckpoint[]> = new Map()

  createCheckpoint(
    orgId: string,
    feature: string,
    state: Record<string, unknown>,
    description = 'Auto checkpoint'
  ): RollbackCheckpoint {
    const checkpointId = `ckpt_${orgId}_${feature}_${Date.now()}`

    const checkpoint: RollbackCheckpoint = {
      checkpoint_id: checkpointId,
      org_id: orgId,
      feature,
      state_snapshot: { ...state },
      created_at: new Date(),
      ttl_hours: 72,
      description,
    }

    const existing = this.checkpoints.get(orgId) ?? []
    existing.push(checkpoint)
    this.checkpoints.set(orgId, existing)

    logger.info('[EnterpriseRollbackManager] checkpoint created', {
      checkpointId,
      orgId,
      feature,
    })

    return checkpoint
  }

  rollback(checkpointId: string): RollbackResult {
    const start = Date.now()
    let targetCheckpoint: RollbackCheckpoint | null = null
    let orgId = ''

    for (const [oid, checkpoints] of this.checkpoints.entries()) {
      const found = checkpoints.find((c) => c.checkpoint_id === checkpointId)
      if (found) {
        targetCheckpoint = found
        orgId = oid
        break
      }
    }

    if (!targetCheckpoint) {
      logger.error('[EnterpriseRollbackManager] rollback: checkpoint not found', { checkpointId })
      return {
        checkpoint_id: checkpointId,
        org_id: '',
        success: false,
        restored_state: {},
        duration_ms: Date.now() - start,
        rolled_back_at: new Date(),
      }
    }

    const expiresAt = new Date(targetCheckpoint.created_at)
    expiresAt.setHours(expiresAt.getHours() + targetCheckpoint.ttl_hours)

    if (new Date() > expiresAt) {
      logger.warn('[EnterpriseRollbackManager] rollback: checkpoint expired', { checkpointId })
      return {
        checkpoint_id: checkpointId,
        org_id: orgId,
        success: false,
        restored_state: {},
        duration_ms: Date.now() - start,
        rolled_back_at: new Date(),
      }
    }

    const restoredState = { ...targetCheckpoint.state_snapshot }
    const duration_ms = Date.now() - start

    logger.info('[EnterpriseRollbackManager] rollback executed', {
      checkpointId,
      orgId,
      feature: targetCheckpoint.feature,
      duration_ms,
    })

    return {
      checkpoint_id: checkpointId,
      org_id: orgId,
      success: true,
      restored_state: restoredState,
      duration_ms,
      rolled_back_at: new Date(),
    }
  }

  listCheckpoints(orgId: string, feature?: string): RollbackCheckpoint[] {
    const checkpoints = this.checkpoints.get(orgId) ?? []
    if (!feature) return checkpoints
    return checkpoints.filter((c) => c.feature === feature)
  }

  purgeExpired(): number {
    let count = 0
    const now = new Date()

    for (const [orgId, checkpoints] of this.checkpoints.entries()) {
      const valid = checkpoints.filter((c) => {
        const expiresAt = new Date(c.created_at)
        expiresAt.setHours(expiresAt.getHours() + c.ttl_hours)
        return now <= expiresAt
      })
      count += checkpoints.length - valid.length
      this.checkpoints.set(orgId, valid)
    }

    if (count > 0) {
      logger.info('[EnterpriseRollbackManager] purged expired checkpoints', { count })
    }
    return count
  }

  getLatest(orgId: string, feature: string): RollbackCheckpoint | null {
    const checkpoints = this.listCheckpoints(orgId, feature)
    if (checkpoints.length === 0) return null
    return checkpoints.reduce((latest, c) =>
      c.created_at > latest.created_at ? c : latest
    )
  }

  canRollback(orgId: string, feature: string): boolean {
    const latest = this.getLatest(orgId, feature)
    if (!latest) return false

    const expiresAt = new Date(latest.created_at)
    expiresAt.setHours(expiresAt.getHours() + latest.ttl_hours)
    return new Date() <= expiresAt
  }
}

export const enterpriseRollbackManager = new EnterpriseRollbackManager()
export default enterpriseRollbackManager
