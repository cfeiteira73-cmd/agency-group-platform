// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deprovisioned'

export interface TenantConfig {
  org_id: string
  org_name: string
  plan_tier: string
  region: 'eu-west' | 'us-east' | 'ap-south'
  max_agents: number
  max_workflows: number
  features_enabled: string[]
  created_at: Date
  status: TenantStatus
  provisioned_at?: Date
}

export interface ProvisionResult {
  org_id: string
  success: boolean
  config: TenantConfig
  errors: string[]
  provisioned_resources: string[]
  rollback_id: string
}

export const DEFAULT_FEATURES_BY_TIER: Record<string, string[]> = {
  starter: ['crm_basic', 'email_notifications', 'deal_tracking', 'basic_reporting'],
  pro: [
    'crm_basic', 'crm_advanced', 'email_notifications', 'deal_tracking',
    'basic_reporting', 'advanced_reporting', 'workflow_automation',
    'ai_valuation', 'lead_scoring',
  ],
  elite: [
    'crm_basic', 'crm_advanced', 'email_notifications', 'deal_tracking',
    'basic_reporting', 'advanced_reporting', 'workflow_automation',
    'ai_valuation', 'lead_scoring', 'predictive_analytics', 'investor_portal',
    'multi_region', 'custom_integrations', 'priority_support',
  ],
  institutional: [
    'crm_basic', 'crm_advanced', 'email_notifications', 'deal_tracking',
    'basic_reporting', 'advanced_reporting', 'workflow_automation',
    'ai_valuation', 'lead_scoring', 'predictive_analytics', 'investor_portal',
    'multi_region', 'custom_integrations', 'priority_support',
    'white_label', 'dedicated_infrastructure', 'sla_99_9', 'audit_logs',
    'sso', 'api_access', 'data_export',
  ],
}

const MAX_AGENTS_BY_TIER: Record<string, number> = {
  starter: 2,
  pro: 10,
  elite: 50,
  institutional: 500,
}

const MAX_WORKFLOWS_BY_TIER: Record<string, number> = {
  starter: 5,
  pro: 25,
  elite: 150,
  institutional: 2000,
}

class TenantProvisioner {
  private tenants: Map<string, TenantConfig> = new Map()

  provision(
    config: Omit<TenantConfig, 'created_at' | 'status' | 'provisioned_at'>
  ): ProvisionResult {
    const errors = this._validateConfig(config)

    if (errors.length > 0) {
      logger.warn('[TenantProvisioner] provision failed validation', { org_id: config.org_id, errors })
      const failConfig: TenantConfig = {
        ...config,
        created_at: new Date(),
        status: 'deprovisioned',
      }
      return {
        org_id: config.org_id,
        success: false,
        config: failConfig,
        errors,
        provisioned_resources: [],
        rollback_id: this._generateRollbackId(),
      }
    }

    const now = new Date()
    const tenantConfig: TenantConfig = {
      ...config,
      max_agents: config.max_agents || MAX_AGENTS_BY_TIER[config.plan_tier] || 2,
      max_workflows: config.max_workflows || MAX_WORKFLOWS_BY_TIER[config.plan_tier] || 5,
      features_enabled:
        config.features_enabled.length > 0
          ? config.features_enabled
          : (DEFAULT_FEATURES_BY_TIER[config.plan_tier] ?? DEFAULT_FEATURES_BY_TIER['starter']),
      created_at: now,
      status: 'active',
      provisioned_at: now,
    }

    this.tenants.set(config.org_id, tenantConfig)

    const provisioned_resources = [
      `database:${config.org_id}-db`,
      `cache:${config.org_id}-cache`,
      `storage:${config.org_id}-assets`,
      `queue:${config.org_id}-events`,
    ]

    logger.info('[TenantProvisioner] tenant provisioned', {
      org_id: config.org_id,
      tier: config.plan_tier,
      region: config.region,
    })

    return {
      org_id: config.org_id,
      success: true,
      config: tenantConfig,
      errors: [],
      provisioned_resources,
      rollback_id: this._generateRollbackId(),
    }
  }

  deprovision(orgId: string): boolean {
    const tenant = this.tenants.get(orgId)
    if (!tenant) {
      logger.warn('[TenantProvisioner] deprovision: tenant not found', { orgId })
      return false
    }
    tenant.status = 'deprovisioned'
    this.tenants.set(orgId, tenant)
    logger.info('[TenantProvisioner] tenant deprovisioned', { orgId })
    return true
  }

  suspend(orgId: string, reason: string): boolean {
    const tenant = this.tenants.get(orgId)
    if (!tenant || tenant.status !== 'active') {
      logger.warn('[TenantProvisioner] suspend: tenant not found or not active', { orgId })
      return false
    }
    tenant.status = 'suspended'
    this.tenants.set(orgId, tenant)
    logger.info('[TenantProvisioner] tenant suspended', { orgId, reason })
    return true
  }

  reactivate(orgId: string): boolean {
    const tenant = this.tenants.get(orgId)
    if (!tenant || tenant.status !== 'suspended') {
      logger.warn('[TenantProvisioner] reactivate: tenant not found or not suspended', { orgId })
      return false
    }
    tenant.status = 'active'
    this.tenants.set(orgId, tenant)
    logger.info('[TenantProvisioner] tenant reactivated', { orgId })
    return true
  }

  getTenant(orgId: string): TenantConfig | null {
    return this.tenants.get(orgId) ?? null
  }

  updateTier(orgId: string, newTier: string): TenantConfig {
    const tenant = this.tenants.get(orgId)
    if (!tenant) {
      throw new Error(`[TenantProvisioner] updateTier: tenant not found: ${orgId}`)
    }
    tenant.plan_tier = newTier
    tenant.max_agents = MAX_AGENTS_BY_TIER[newTier] ?? tenant.max_agents
    tenant.max_workflows = MAX_WORKFLOWS_BY_TIER[newTier] ?? tenant.max_workflows
    tenant.features_enabled = DEFAULT_FEATURES_BY_TIER[newTier] ?? tenant.features_enabled
    this.tenants.set(orgId, tenant)
    logger.info('[TenantProvisioner] tenant tier updated', { orgId, newTier })
    return tenant
  }

  private _validateConfig(config: Partial<TenantConfig>): string[] {
    const errors: string[] = []
    if (!config.org_id || config.org_id.trim() === '') errors.push('org_id is required')
    if (!config.org_name || config.org_name.trim() === '') errors.push('org_name is required')
    if (!config.plan_tier || !Object.keys(DEFAULT_FEATURES_BY_TIER).includes(config.plan_tier)) {
      errors.push(`plan_tier must be one of: ${Object.keys(DEFAULT_FEATURES_BY_TIER).join(', ')}`)
    }
    if (!config.region || !['eu-west', 'us-east', 'ap-south'].includes(config.region)) {
      errors.push('region must be eu-west, us-east, or ap-south')
    }
    if (config.max_agents !== undefined && config.max_agents < 1) errors.push('max_agents must be >= 1')
    if (config.max_workflows !== undefined && config.max_workflows < 1) errors.push('max_workflows must be >= 1')
    return errors
  }

  private _generateRollbackId(): string {
    return `rbk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  }
}

export const tenantProvisioner = new TenantProvisioner()
export default tenantProvisioner
