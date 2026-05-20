// lib/tenant/index.ts
export { resolveTenantContext, buildMinimalContext } from './context'
export type { TenantContext, TenantPlanId, TenantStatus, TenantRole } from './context'
export { getTenant, listTenants, createTenant, updateTenant, suspendTenant, ensureDefaultTenant } from './registry'
export type { Tenant, CreateTenantInput, UpdateTenantInput } from './registry'
export { getPlanFeatures, hasFeature, PLAN_FEATURES } from './planConfig'
export type { PlanFeatures } from './planConfig'
