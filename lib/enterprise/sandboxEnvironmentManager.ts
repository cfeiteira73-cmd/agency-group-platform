// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface SandboxEnvironment {
  sandbox_id: string
  org_id: string
  name: string
  type: 'demo' | 'testing' | 'staging'
  data_source: 'synthetic' | 'anonymized_prod'
  created_at: Date
  expires_at: Date
  status: 'active' | 'expired' | 'destroyed'
  config: Record<string, unknown>
}

export const SANDBOX_TTL_DAYS: Record<SandboxEnvironment['type'], number> = {
  demo: 7,
  testing: 30,
  staging: 90,
}

class SandboxEnvironmentManager {
  private sandboxes: Map<string, SandboxEnvironment> = new Map()

  create(
    orgId: string,
    name: string,
    type: SandboxEnvironment['type']
  ): SandboxEnvironment {
    const sandboxId = `sbx_${orgId}_${type}_${Date.now()}`
    const now = new Date()
    const ttlDays = SANDBOX_TTL_DAYS[type]

    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + ttlDays)

    const sandbox: SandboxEnvironment = {
      sandbox_id: sandboxId,
      org_id: orgId,
      name,
      type,
      data_source: type === 'staging' ? 'anonymized_prod' : 'synthetic',
      created_at: now,
      expires_at: expiresAt,
      status: 'active',
      config: {
        isolated_network: true,
        reset_on_expire: type !== 'staging',
        max_agents: type === 'staging' ? 10 : 3,
        rate_limit_multiplier: 0.1,
      },
    }

    this.sandboxes.set(sandboxId, sandbox)
    logger.info('[SandboxEnvironmentManager] sandbox created', {
      sandboxId,
      orgId,
      type,
      ttlDays,
    })

    return sandbox
  }

  destroy(sandboxId: string): boolean {
    const sandbox = this.sandboxes.get(sandboxId)
    if (!sandbox) {
      logger.warn('[SandboxEnvironmentManager] destroy: sandbox not found', { sandboxId })
      return false
    }
    sandbox.status = 'destroyed'
    this.sandboxes.set(sandboxId, sandbox)
    logger.info('[SandboxEnvironmentManager] sandbox destroyed', { sandboxId })
    return true
  }

  refresh(sandboxId: string): SandboxEnvironment {
    const sandbox = this.sandboxes.get(sandboxId)
    if (!sandbox) {
      throw new Error(`[SandboxEnvironmentManager] sandbox not found: ${sandboxId}`)
    }
    if (sandbox.status === 'destroyed') {
      throw new Error(`[SandboxEnvironmentManager] cannot refresh destroyed sandbox: ${sandboxId}`)
    }

    const ttlDays = SANDBOX_TTL_DAYS[sandbox.type]
    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + ttlDays)

    sandbox.expires_at = newExpiry
    sandbox.status = 'active'
    this.sandboxes.set(sandboxId, sandbox)

    logger.info('[SandboxEnvironmentManager] sandbox refreshed', { sandboxId, newExpiry })
    return sandbox
  }

  listForOrg(orgId: string): SandboxEnvironment[] {
    return Array.from(this.sandboxes.values()).filter((s) => s.org_id === orgId)
  }

  getActive(orgId: string): SandboxEnvironment[] {
    const now = new Date()
    return this.listForOrg(orgId).filter(
      (s) => s.status === 'active' && s.expires_at > now
    )
  }

  cleanup(): number {
    let count = 0
    for (const [id, sandbox] of this.sandboxes.entries()) {
      if (sandbox.status === 'active' && this.isExpired(sandbox)) {
        sandbox.status = 'expired'
        this.sandboxes.set(id, sandbox)
        count++
        logger.info('[SandboxEnvironmentManager] sandbox expired during cleanup', {
          sandboxId: id,
          org_id: sandbox.org_id,
        })
      }
    }
    return count
  }

  isExpired(sandbox: SandboxEnvironment): boolean {
    return new Date() > sandbox.expires_at
  }
}

export const sandboxEnvironmentManager = new SandboxEnvironmentManager()
export default sandboxEnvironmentManager
