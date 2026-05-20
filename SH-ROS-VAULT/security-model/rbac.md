# SH-ROS Security Model — RBAC
## Version: 1.0.0 | Created: 2026-05-19

> Full spec in system-bible/SH-ROS_MASTER_BIBLE.md Section 9.
> Implementation: lib/auth/rbac.ts

---

## 7 Roles

| Role | Code | Description | Typical User |
|------|------|-------------|-------------|
| Super Admin | `super_admin` | All permissions, cross-tenant access, secrets management | CTO / System owner |
| Admin | `admin` | Full control within tenant, no cross-tenant, no secrets | Business owner / manager |
| Agent | `agent` | Deal management, contact management, automations | Real estate agent |
| Partner | `partner` | View deals/contacts + limited contact creation | Referral partner |
| Read Only | `readonly` | View-only, no mutations | Investors / observers / auditors |
| API Service | `api_service` | Programmatic access — no UI routes | n8n, webhooks, cron jobs |
| System | `system` | Internal service-to-service only | Background workers, DLQ processor |

---

## 16 Permissions Matrix

| Permission | super_admin | admin | agent | partner | readonly | api_service | system |
|-----------|:-----------:|:-----:|:-----:|:-------:|:--------:|:-----------:|:------:|
| view_deals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| create_deals | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| delete_deals | ✓ | ✓ | — | — | — | — | — |
| view_contacts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| create_contacts | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| manage_agents | ✓ | ✓ | — | — | — | — | ✓ |
| view_analytics | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| manage_integrations | ✓ | ✓ | — | — | — | — | — |
| view_billing | ✓ | ✓ | — | — | — | — | — |
| manage_billing | ✓ | ✓ | — | — | — | — | — |
| manage_security | ✓ | — | — | — | — | — | — |
| view_audit | ✓ | ✓ | — | — | — | ✓ | ✓ |
| trigger_automation | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| manage_vault | ✓ | ✓ | — | — | — | — | ✓ |
| replay_events | ✓ | — | — | — | — | — | ✓ |
| manage_secrets | ✓ | — | — | — | — | — | — |

---

## Route Guard Usage

```typescript
// lib/auth/rbac.ts
export function requiresRole(...roles: Role[]) {
  return async function(userId: string, tenantId: string): Promise<{ allowed: boolean; role?: Role }> {
    const userRole = await getUserRole(userId, tenantId); // Supabase lookup
    const allowed = roles.includes(userRole);
    return { allowed, role: userRole };
  };
}

// In API route handler:
const { allowed, role } = await requiresRole('admin', 'agent')(userId, tenantId);
if (!allowed) {
  return NextResponse.json(
    { error: 'Forbidden', requiredRoles: ['admin', 'agent'], actualRole: role },
    { status: 403 }
  );
}
```

**Permission-based check**:
```typescript
const canDeleteDeal = hasPermission(userRole, 'delete_deals');
```

---

## SIEM Integration

**File**: `lib/security/siem.ts`

Every security event is broadcast to 4 sinks simultaneously (all non-blocking):

```
SecurityEvent → siemLogger.log(event)
                    ├── console.log (JSON structured, always enabled)
                    ├── Sentry.captureEvent (if SENTRY_DSN set)
                    ├── Datadog HTTP ingest (if DATADOG_API_KEY set)
                    └── supabase.from('security_events').insert (fire-and-forget)
```

**SecurityEvent structure**:
```typescript
interface SecurityEvent {
  event_type: string;           // e.g. 'unauthorized_access', 'replay_storm'
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tenant_id: string;
  user_id?: string;
  ip_address?: string;
  route?: string;
  details: Record<string, unknown>;
  timestamp: string;
}
```

---

## Intrusion Detection Rules

**File**: `lib/security/intrusionDetection.ts`

| Pattern | Detection Logic | Threshold | Response |
|---------|----------------|-----------|----------|
| **Replay Storm** | Count `/api/events/replay` calls per IP per 5min window | > 50 | Block IP (Redis TTL 24h) + SIEM CRITICAL |
| **Webhook Flood** | Count `/api/whatsapp/webhook` + `/api/automation/*` per tenant per minute | > 200 | Return 429, SIEM HIGH |
| **Prompt Injection** | Regex on request body: `ignore previous`, `system:`, `<script`, `DROP TABLE` | Any match | Sanitize input + SIEM MEDIUM |
| **Unusual AI Spend** | Compare hourly token count vs. 30-day hourly average | > 3× average | ESCALATE policy + SIEM HIGH |

---

## Magic Link Security

- Tokens are single-use (stored as SHA-256 hash in `used_magic_tokens`)
- Expiry: 15 minutes from generation
- After use: `used_at` timestamp recorded, token cannot be reused
- GDPR purge: `used_magic_tokens` rows older than 30 days deleted daily at 03:00 UTC
- Rate limit: max 5 magic link requests per email per hour

---

## Secrets Rotation Policy

**File**: `lib/security/secretsRotation.ts`

| Secret | Rotation Schedule | Owner | Alert Lead Time |
|--------|------------------|-------|-----------------|
| ANTHROPIC_API_KEY | Quarterly | CTO | 30 days before expiry |
| SUPABASE_SERVICE_ROLE_KEY | Annual | CTO | 60 days before expiry |
| RESEND_API_KEY | On compromise only | CTO | Immediate |
| WHATSAPP_TOKEN | Per Meta policy | CTO | 7 days before expiry |
| AUTH_SECRET | Annual | CTO | 60 days before expiry |
| VAPID_PRIVATE_KEY | Annual | CTO | 30 days before expiry |

All rotations logged to `secret_rotation_log` table.
