# SH-ROS Multi-Tenant Isolation Model
## Version: 1.0.0 | Created: 2026-05-19

---

### Overview

SH-ROS uses a **shared-database, row-level isolation** strategy for multi-tenancy. All 28 Supabase tables share a single PostgreSQL instance, but data access is strictly scoped by `tenant_id` at every layer of the stack.

This document defines the isolation model, propagation chain, quota enforcement, and the migration path to dedicated-database sharding for enterprise tenants.

---

### Isolation Strategy: Row-Level Security (RLS)

All 28 Supabase tables enforce:

1. `tenant_id` column: `TEXT NOT NULL DEFAULT 'agency-group'`
2. RLS policy: `USING (tenant_id = auth.jwt()->>'tenant_id')`
3. Service role bypasses RLS for internal cron/admin operations

**Status:** RLS policies are defined but not yet applied to all tables (Phase 1 pending item). All application-layer queries already include `.eq('tenant_id', tenantId)` as a defence-in-depth measure.

---

### Tenant Propagation Chain

```
JWT → x-tenant-id (middleware)
    → TenantContext (API handler)
    → Supabase query filter (.eq('tenant_id', tenantId))
    → Event bus (BaseEvent.tenant_id)
    → Redis keys ({tenant_id}:{resource}:{...})
    → AI policy check (checkAIPolicy(tenantId, agentId))
    → Audit log (audit_log.tenant_id)
    → Vault tables (vault.tenant_id)
```

Every hop in the chain carries `tenant_id`. There is no path through the system that does not propagate tenant context.

---

### Middleware Header Injection

As of 2026-05-19, the middleware injects the following headers on every request:

| Header | Value | Purpose |
|--------|-------|---------|
| `x-tenant-id` | from JWT or `agency-group` | Tenant identification |
| `x-tenant-plan` | `unlimited` \| `starter` | Plan tier for quota routing |
| `x-tenant-status` | `active` \| `suspended` | Account status |
| `x-quota-checked` | `true` (non-agency tenants) | Quota envelope marker |
| `x-correlation-id` | UUID | End-to-end traceability |
| `x-trace-id` | UUID (same as correlation) | SIEM correlation |

---

### Redis Key Namespacing

All Redis keys are prefixed with `{tenant_id}:` to prevent cross-tenant cache pollution.

**Pattern:** `{tenant_id}:{resource_type}:{identifier}`

**Examples:**
```
agent:budget:agency-group:sofia-chat:2026-05
quota:agency-group:ai_tokens:2026-05
quota:agency-group:api_requests:2026-05
agency-group:ev_dedup:sha256hash
agency-group:session:user123
agency-group:rl:api/chat|192.168.1.1
```

No Redis key ever omits the tenant prefix. This is enforced in `lib/cache/redisClient.ts` via a `prefixKey(tenantId, key)` utility.

---

### Tenant Plans and Feature Flags

| Plan | Base Price | AI Tokens/mo | Contacts | Event Replay | Vault Access |
|------|-----------|--------------|----------|--------------|--------------|
| starter | €99 | 500K | 200 | No | No |
| growth | €399 | 2M | 2,000 | Yes | No |
| enterprise | €1,499 | 10M | 10,000 | Yes | Yes |
| unlimited | Custom | ∞ | ∞ | Yes | Yes |

Feature flags are resolved in `lib/tenant/planConfig.ts` via `hasFeature(plan, featureKey)`. Features are never hardcoded inline — always resolved through this utility to ensure plan changes take effect without code deploys.

---

### Data Isolation Guarantees

| Layer | Isolation Mechanism | Status |
|-------|--------------------|----|
| Query-level | `.eq('tenant_id', tenantId)` on all Supabase queries | ✅ Active |
| RLS-level | PostgreSQL RLS policies on all 28 tables | Pending (Phase 1) |
| Event-level | `BaseEvent.tenant_id` on all bus events | ✅ Active |
| Cache-level | Redis keys prefixed with `{tenant_id}:` | ✅ Active |
| AI-level | Policy engine checks tenant token budget before execution | ✅ Active |
| Audit-level | All `audit_log` entries include `tenant_id` | ✅ Active |
| Vault-level | All vault tables include `tenant_id` | ✅ Active |
| Middleware-level | `x-tenant-id` header on all API responses | ✅ Active |

---

### Current Bootstrap

```typescript
// ensureDefaultTenant() — called on first server startup
await createTenant({
  id: 'agency-group',
  name: 'Agency Group',
  plan: 'unlimited',
  status: 'active',
  createdAt: new Date(),
})
```

- Single tenant: `'agency-group'` (plan: `unlimited`)
- `ensureDefaultTenant()` creates the initial record idempotently
- Future: SaaS onboarding flow creates new tenant records via `/api/tenants` POST

---

### Quota Enforcement

Quota enforcement is a **hard stop** — never soft fail. Implemented in `lib/tenant/tenantQuota.ts`:

```typescript
// checkQuota(tenantId, resource) → 'ALLOW' | 'DENY'
// trackUsage(tenantId, resource, amount) → fire-and-forget
```

- `checkQuota()`: reads Redis INCRBY counter, compares to plan limit, returns ALLOW or DENY
- `trackUsage()`: atomically increments monthly usage counter in Redis
- Counters reset on the 1st of each month (key pattern: `quota:{tenantId}:{resource}:{YYYY-MM}`)
- `unlimited` plan: `checkQuota()` always returns ALLOW without Redis lookup

**Current quota domains:**
- `ai_tokens` — Claude API token consumption
- `api_requests` — total API calls
- `contacts` — CRM contact records
- `automation_runs` — workflow execution count
- `whatsapp_messages` — WhatsApp Business sends

---

### Context Resolution Flow

```typescript
// lib/tenant/context.ts
async function resolveTenantContext(req: Request): Promise<TenantContext> {
  const tenantId = req.headers.get('x-tenant-id') ?? 'agency-group'
  const tenant   = await getTenant(tenantId)           // registry lookup
  const features = getPlanFeatures(tenant.plan)        // plan config
  const quotas   = await getQuotaStatus(tenantId)      // Redis snapshot
  return { tenantId, tenant, features, quotas }
}
```

API handlers call `resolveTenantContext(req)` once at the top and pass the context down. No handler ever reads `tenant_id` from the raw request without going through this resolver.

---

### Future: Tenant Sharding (Phase 3)

Phase 3 introduces dedicated Supabase projects for enterprise tenants requiring strict physical isolation.

**Interface:**
```typescript
// lib/tenant/databaseRouter.ts
interface TenantDatabaseRouter {
  getDb(tenantId: string): SupabaseClient
}
// Routes: enterprise tenants → dedicated project
//         standard tenants  → shared project (RLS enforced)
```

**Current state:** Single project, RLS isolation.
**Trigger:** When a tenant requires dedicated DB for compliance (e.g. HIPAA, banking).
**Cost estimate:** +€25/mo per dedicated project (Supabase Pro).

---

### Security Threats Mitigated by Isolation Model

| Threat | Mitigation |
|--------|-----------|
| Tenant A reads Tenant B data | RLS + `.eq('tenant_id', ...)` on all queries |
| Cross-tenant Redis key collision | Mandatory `{tenant_id}:` prefix |
| AI agent exceeds token budget | Quota engine hard-stops before Claude API call |
| Event bus cross-tenant contamination | `BaseEvent.tenant_id` checked on dequeue |
| Audit log tampering | Append-only table, no UPDATE/DELETE allowed |

---

*Document maintained by: SH-ROS Security Team*
*Next review: 2026-06-19*
*Classification: INTERNAL — Architecture Team*
