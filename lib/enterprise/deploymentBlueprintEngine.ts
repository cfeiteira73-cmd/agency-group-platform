// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export type DeploymentEnvironment = 'production' | 'staging' | 'sandbox'

export interface RegionalConfig {
  region: 'eu-west' | 'us-east' | 'ap-south'
  primary: boolean
  kafka_cluster?: string
  db_cluster: string
  cache_cluster: string
  cdn_endpoint: string
}

export interface DeploymentBlueprint {
  blueprint_id: string
  org_id: string
  environment: DeploymentEnvironment
  regions: RegionalConfig[]
  tier: string
  infrastructure: {
    compute: string
    database: string
    cache: string
    events: string
    monitoring: string
  }
  estimated_monthly_infra_cost_eur: number
  deployment_steps: Array<{
    order: number
    step: string
    estimated_minutes: number
    rollback_step: string
  }>
  created_at: Date
}

export const INFRA_COST_BY_TIER: Record<string, number> = {
  starter: 50,
  pro: 150,
  elite: 400,
  institutional: 1200,
}

const INFRA_SPECS_BY_TIER: Record<
  string,
  DeploymentBlueprint['infrastructure']
> = {
  starter: {
    compute: 'shared-1vcpu-512mb',
    database: 'pg-shared-5gb',
    cache: 'redis-shared-50mb',
    events: 'queue-shared',
    monitoring: 'basic-metrics',
  },
  pro: {
    compute: 'dedicated-2vcpu-2gb',
    database: 'pg-dedicated-20gb',
    cache: 'redis-dedicated-256mb',
    events: 'queue-dedicated',
    monitoring: 'standard-apm',
  },
  elite: {
    compute: 'dedicated-4vcpu-8gb',
    database: 'pg-dedicated-100gb-ha',
    cache: 'redis-dedicated-1gb',
    events: 'kafka-managed',
    monitoring: 'full-observability',
  },
  institutional: {
    compute: 'bare-metal-16vcpu-32gb',
    database: 'pg-dedicated-1tb-ha-replica',
    cache: 'redis-cluster-10gb',
    events: 'kafka-cluster-ha',
    monitoring: 'enterprise-siem',
  },
}

const REGIONAL_CONFIGS: Record<'eu-west' | 'us-east' | 'ap-south', Omit<RegionalConfig, 'primary'>> = {
  'eu-west': {
    region: 'eu-west',
    db_cluster: 'pg-eu-west-1',
    cache_cluster: 'redis-eu-west-1',
    cdn_endpoint: 'cdn-eu.agencygroup.pt',
    kafka_cluster: 'kafka-eu-west-1',
  },
  'us-east': {
    region: 'us-east',
    db_cluster: 'pg-us-east-1',
    cache_cluster: 'redis-us-east-1',
    cdn_endpoint: 'cdn-us.agencygroup.pt',
    kafka_cluster: 'kafka-us-east-1',
  },
  'ap-south': {
    region: 'ap-south',
    db_cluster: 'pg-ap-south-1',
    cache_cluster: 'redis-ap-south-1',
    cdn_endpoint: 'cdn-ap.agencygroup.pt',
    kafka_cluster: 'kafka-ap-south-1',
  },
}

const BASE_DEPLOYMENT_STEPS: DeploymentBlueprint['deployment_steps'] = [
  {
    order: 1,
    step: 'Provision database cluster and run migrations',
    estimated_minutes: 15,
    rollback_step: 'Drop provisioned database cluster',
  },
  {
    order: 2,
    step: 'Provision cache cluster and configure eviction policy',
    estimated_minutes: 5,
    rollback_step: 'Flush and destroy cache cluster',
  },
  {
    order: 3,
    step: 'Deploy application containers to compute layer',
    estimated_minutes: 10,
    rollback_step: 'Rollback to previous image tag',
  },
  {
    order: 4,
    step: 'Configure CDN distribution and SSL certificates',
    estimated_minutes: 10,
    rollback_step: 'Disable CDN distribution',
  },
  {
    order: 5,
    step: 'Set up event bus and subscribe workflows',
    estimated_minutes: 8,
    rollback_step: 'Unsubscribe workflows and destroy event queues',
  },
  {
    order: 6,
    step: 'Deploy monitoring agents and configure alerting rules',
    estimated_minutes: 5,
    rollback_step: 'Remove monitoring agents',
  },
  {
    order: 7,
    step: 'Run smoke tests and validate health checks',
    estimated_minutes: 10,
    rollback_step: 'Initiate full environment rollback',
  },
]

class DeploymentBlueprintEngine {
  createBlueprint(
    orgId: string,
    tier: string,
    environment: DeploymentEnvironment,
    regions: string[] = ['eu-west']
  ): DeploymentBlueprint {
    const blueprintId = `bp_${orgId}_${environment}_${Date.now()}`
    const validRegions = (['eu-west', 'us-east', 'ap-south'] as const).filter((r) =>
      regions.includes(r)
    )
    const primaryRegion = validRegions[0] ?? 'eu-west'

    const regionalConfigs: RegionalConfig[] = validRegions.map((r) => ({
      ...REGIONAL_CONFIGS[r],
      primary: r === primaryRegion,
    }))

    const infra = INFRA_SPECS_BY_TIER[tier] ?? INFRA_SPECS_BY_TIER['starter']
    const estimatedCost = this.estimateCost(tier, validRegions.length)

    const blueprint: DeploymentBlueprint = {
      blueprint_id: blueprintId,
      org_id: orgId,
      environment,
      regions: regionalConfigs,
      tier,
      infrastructure: infra,
      estimated_monthly_infra_cost_eur: estimatedCost,
      deployment_steps: BASE_DEPLOYMENT_STEPS,
      created_at: new Date(),
    }

    logger.info('[DeploymentBlueprintEngine] blueprint created', {
      blueprintId,
      orgId,
      tier,
      environment,
      regions: validRegions,
    })

    return blueprint
  }

  estimateCost(tier: string, regionCount: number): number {
    const base = INFRA_COST_BY_TIER[tier] ?? INFRA_COST_BY_TIER['starter']
    // Each additional region adds 60% of base cost
    const total = base + (regionCount - 1) * Math.round(base * 0.6)
    return total
  }

  validateBlueprint(blueprint: DeploymentBlueprint): string[] {
    const errors: string[] = []
    if (!blueprint.blueprint_id) errors.push('blueprint_id is required')
    if (!blueprint.org_id) errors.push('org_id is required')
    if (!blueprint.tier || !Object.keys(INFRA_COST_BY_TIER).includes(blueprint.tier)) {
      errors.push(`tier must be one of: ${Object.keys(INFRA_COST_BY_TIER).join(', ')}`)
    }
    if (!blueprint.regions || blueprint.regions.length === 0) {
      errors.push('at least one region is required')
    }
    const primaryCount = blueprint.regions.filter((r) => r.primary).length
    if (primaryCount !== 1) errors.push('exactly one region must be marked as primary')
    if (!blueprint.infrastructure?.compute) errors.push('infrastructure.compute is required')
    if (!blueprint.infrastructure?.database) errors.push('infrastructure.database is required')
    return errors
  }

  getRegionalConfig(region: string, tier: string): RegionalConfig {
    const validRegion = (['eu-west', 'us-east', 'ap-south'] as const).find((r) => r === region)
    if (!validRegion) {
      throw new Error(`[DeploymentBlueprintEngine] invalid region: ${region}`)
    }
    return { ...REGIONAL_CONFIGS[validRegion], primary: true }
  }

  exportBlueprint(blueprint: DeploymentBlueprint): string {
    return JSON.stringify(blueprint, null, 2)
  }
}

export const deploymentBlueprintEngine = new DeploymentBlueprintEngine()
export default deploymentBlueprintEngine
