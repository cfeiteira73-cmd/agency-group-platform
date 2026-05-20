// =============================================================================
// Agency Group — Per-Tenant Plan Feature Config
// lib/tenant/planConfig.ts
//
// Feature flags and capabilities per plan tier.
// Used by API routes to gate functionality.
//
// TypeScript strict — 0 errors
// =============================================================================

import type { TenantPlanId } from './context'

export interface PlanFeatures {
  planId:             TenantPlanId
  // AI capabilities
  aiAgents:           boolean
  aiStreaming:        boolean
  aiMemory:           boolean
  policyTuning:       boolean
  feedbackLoop:       boolean
  // Data capabilities
  crmContacts:        number   // -1 = unlimited
  propertiesLimit:    number   // -1 = unlimited
  // Platform capabilities
  multiUser:          boolean
  customIntegrations: boolean
  n8nWebhooks:        boolean
  whatsappIntegration:boolean
  // Observability
  causalTrace:        boolean
  auditLog:           boolean
  eventReplay:        boolean
  vaultAccess:        boolean
  // Billing
  billingMeter:       boolean
  usageExport:        boolean
  // Support
  slaMinutes:         number   // SLA response time
}

export const PLAN_FEATURES: Record<TenantPlanId, PlanFeatures> = {
  starter: {
    planId:              'starter',
    aiAgents:            true,
    aiStreaming:         false,
    aiMemory:            false,
    policyTuning:        false,
    feedbackLoop:        false,
    crmContacts:         200,
    propertiesLimit:     50,
    multiUser:           false,
    customIntegrations:  false,
    n8nWebhooks:         false,
    whatsappIntegration: false,
    causalTrace:         false,
    auditLog:            false,
    eventReplay:         false,
    vaultAccess:         false,
    billingMeter:        true,
    usageExport:         false,
    slaMinutes:          4320,  // 72h
  },
  growth: {
    planId:              'growth',
    aiAgents:            true,
    aiStreaming:         true,
    aiMemory:            true,
    policyTuning:        false,
    feedbackLoop:        true,
    crmContacts:         2000,
    propertiesLimit:     500,
    multiUser:           true,
    customIntegrations:  false,
    n8nWebhooks:         true,
    whatsappIntegration: true,
    causalTrace:         true,
    auditLog:            true,
    eventReplay:         false,
    vaultAccess:         false,
    billingMeter:        true,
    usageExport:         true,
    slaMinutes:          480,   // 8h
  },
  enterprise: {
    planId:              'enterprise',
    aiAgents:            true,
    aiStreaming:         true,
    aiMemory:            true,
    policyTuning:        true,
    feedbackLoop:        true,
    crmContacts:         10000,
    propertiesLimit:     5000,
    multiUser:           true,
    customIntegrations:  true,
    n8nWebhooks:         true,
    whatsappIntegration: true,
    causalTrace:         true,
    auditLog:            true,
    eventReplay:         true,
    vaultAccess:         true,
    billingMeter:        true,
    usageExport:         true,
    slaMinutes:          60,    // 1h
  },
  unlimited: {
    planId:              'unlimited',
    aiAgents:            true,
    aiStreaming:         true,
    aiMemory:            true,
    policyTuning:        true,
    feedbackLoop:        true,
    crmContacts:         -1,
    propertiesLimit:     -1,
    multiUser:           true,
    customIntegrations:  true,
    n8nWebhooks:         true,
    whatsappIntegration: true,
    causalTrace:         true,
    auditLog:            true,
    eventReplay:         true,
    vaultAccess:         true,
    billingMeter:        true,
    usageExport:         true,
    slaMinutes:          15,    // 15min
  },
}

export function getPlanFeatures(planId: TenantPlanId): PlanFeatures {
  return PLAN_FEATURES[planId] ?? PLAN_FEATURES.starter
}

export function hasFeature(planId: TenantPlanId, feature: keyof PlanFeatures): boolean {
  const plan = getPlanFeatures(planId)
  const val = plan[feature]
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val > 0 || val === -1
  return false
}
