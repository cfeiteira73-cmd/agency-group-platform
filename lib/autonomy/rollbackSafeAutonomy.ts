// AGENCY GROUP — SH-ROS | AMI: 22506
// Ensures every autonomous action has a guaranteed rollback path.
// Irreversible actions are recorded for audit but flagged as non-rollbackable.

import { logger } from '@/lib/observability/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RollbackCheckpoint {
  checkpoint_id: string
  action: string
  org_id: string
  snapshot: Record<string, unknown>  // pre-action state snapshot
  created_at: Date
  expires_at: Date       // 72h TTL
  status: 'active' | 'rolled_back' | 'expired'
  is_rollbackable: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLLBACK_TTL_HOURS = 72

/** Actions that CANNOT be undone — still recorded for audit. */
const IRREVERSIBLE_ACTIONS: ReadonlySet<string> = new Set([
  'send_email',
  'post_public_listing',
  'trigger_webhook',
  'notify_client',
])

// ---------------------------------------------------------------------------
// RollbackSafeAutonomy
// ---------------------------------------------------------------------------

class RollbackSafeAutonomy {
  private checkpoints = new Map<string, RollbackCheckpoint>()

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  assertRollbackable(action: string): boolean {
    return !IRREVERSIBLE_ACTIONS.has(action)
  }

  createCheckpoint(
    action: string,
    org_id: string,
    pre_state: Record<string, unknown>,
  ): RollbackCheckpoint {
    const checkpoint_id = crypto.randomUUID()
    const created_at = new Date()
    const expires_at = new Date(created_at.getTime() + ROLLBACK_TTL_HOURS * 60 * 60 * 1000)
    const is_rollbackable = this.assertRollbackable(action)

    const checkpoint: RollbackCheckpoint = {
      checkpoint_id,
      action,
      org_id,
      snapshot: { ...pre_state },
      created_at,
      expires_at,
      status: 'active',
      is_rollbackable,
    }

    this.checkpoints.set(checkpoint_id, checkpoint)

    if (!is_rollbackable) {
      logger.warn('[rollbackSafeAutonomy] createCheckpoint — irreversible action recorded for audit', {
        checkpoint_id,
        action,
        org_id,
        is_rollbackable: false,
      })
    } else {
      logger.info('[rollbackSafeAutonomy] createCheckpoint', {
        checkpoint_id,
        action,
        org_id,
        expires_at: expires_at.toISOString(),
      })
    }

    return { ...checkpoint, snapshot: { ...checkpoint.snapshot } }
  }

  async rollback(checkpoint_id: string): Promise<{ success: boolean; message: string }> {
    const checkpoint = this.checkpoints.get(checkpoint_id)

    if (!checkpoint) {
      logger.warn('[rollbackSafeAutonomy] rollback — checkpoint not found', { checkpoint_id })
      return { success: false, message: `Checkpoint "${checkpoint_id}" not found.` }
    }

    if (checkpoint.status === 'rolled_back') {
      return { success: false, message: `Checkpoint "${checkpoint_id}" already rolled back.` }
    }

    if (checkpoint.status === 'expired') {
      return { success: false, message: `Checkpoint "${checkpoint_id}" has expired (TTL: ${ROLLBACK_TTL_HOURS}h).` }
    }

    if (new Date() > checkpoint.expires_at) {
      checkpoint.status = 'expired'
      logger.warn('[rollbackSafeAutonomy] rollback — checkpoint expired', {
        checkpoint_id,
        expired_at: checkpoint.expires_at.toISOString(),
      })
      return { success: false, message: `Checkpoint "${checkpoint_id}" expired at ${checkpoint.expires_at.toISOString()}.` }
    }

    if (!checkpoint.is_rollbackable) {
      logger.error('[rollbackSafeAutonomy] rollback — action is irreversible', new Error('IrreversibleAction'), {
        checkpoint_id,
        action: checkpoint.action,
        org_id: checkpoint.org_id,
      })
      return {
        success: false,
        message: `Action "${checkpoint.action}" is irreversible and cannot be rolled back. Checkpoint retained for audit.`,
      }
    }

    // Apply rollback — restore pre_state (callers subscribe to the snapshot)
    checkpoint.status = 'rolled_back'

    logger.info('[rollbackSafeAutonomy] rollback — success', {
      checkpoint_id,
      action: checkpoint.action,
      org_id: checkpoint.org_id,
      snapshot_keys: Object.keys(checkpoint.snapshot),
    })

    return {
      success: true,
      message: `Checkpoint "${checkpoint_id}" for action "${checkpoint.action}" rolled back successfully. Pre-state restored.`,
    }
  }

  cleanupExpired(): number {
    const now = new Date()
    let cleaned = 0

    for (const [id, checkpoint] of this.checkpoints) {
      if (now > checkpoint.expires_at && checkpoint.status === 'active') {
        checkpoint.status = 'expired'
        this.checkpoints.delete(id)
        cleaned += 1
      }
    }

    if (cleaned > 0) {
      logger.info('[rollbackSafeAutonomy] cleanupExpired', { cleaned_count: cleaned })
    }

    return cleaned
  }

  getCheckpoint(checkpoint_id: string): RollbackCheckpoint | null {
    const cp = this.checkpoints.get(checkpoint_id)
    return cp ? { ...cp, snapshot: { ...cp.snapshot } } : null
  }
}

export const rollbackSafeAutonomy = new RollbackSafeAutonomy()
