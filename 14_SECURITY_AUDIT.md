# 14 — SECURITY AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## SECURITY OVERVIEW

| Category | Score | Evidence |
|----------|-------|---------|
| Authentication | 88/100 | NextAuth v5 + magic links + 2FA |
| Authorization (RBAC) | 82/100 | Portal auth + Bearer + CRON_SECRET |
| RLS (Supabase) | 80/100 | Configured on all tables |
| Secrets management | 85/100 | .env.local + Vercel env vars |
| Rate limiting | 90/100 | Upstash Redis on auth routes |
| Input validation | 88/100 | Zod on all POST routes |
| SQL injection | 95/100 | Parameterised Supabase queries |
| XSS | 88/100 | RSC + CSP headers |
| SSRF | 85/100 | Allowlist implemented |
| Secret scanning | 90/100 | GitHub push blocked + fixed |
| **Overall** | **87/100** | |

---

## AUTHENTICATION (VERIFIED)

| Method | Routes | Status |
|--------|--------|--------|
| NextAuth v5 | Portal, dashboard, control-tower | ✅ Active |
| Magic links | /api/auth/send + /api/auth/verify | ✅ Active (38 tokens used) |
| 2FA (TOTP) | /api/auth/check-2fa + setup-2fa + verify-2fa | ✅ Code exists |
| CRON_SECRET | All 41 cron routes | ✅ safeCompare (timing-safe) |
| Bearer tokens | Service routes | ✅ Enforced |
| isPortalAuth | Portal API routes | ✅ Enforced |

Evidence of real auth: 38 used_magic_tokens in DB.

---

## SECRETS MANAGEMENT

| Asset | Status | Location |
|-------|--------|---------|
| .env.local | ✅ Local only | C:\Users\Carlos\agency-group\.env.local |
| .env.example | ✅ Template (no values) | Committed to repo |
| Vercel env vars | ✅ Configured | Production |
| Supabase key in code | FIXED | Removed from scripts/import-crm-run.py |
| GitHub secret scanning | ✅ Active | Blocked leaked key push |

---

## RATE LIMITING (UPSTASH REDIS)

| Route | Limit | Window |
|-------|-------|--------|
| /api/auth/send | Configured | Per IP |
| /api/auth/verify | Configured | Per IP |
| /api/juridico | Configured | Per IP |
| /api/properties POST | 3 per IP | 1 hour |
| General auth | Configured | — |

---

## INPUT VALIDATION

All POST routes use Zod schemas. Examples:
- PartnerSubmissionSchema (properties POST)
- Contact creation (validated)
- Auth flows (email validation)

---

## SECURITY FINDINGS

### Resolved
| Finding | Severity | Fix |
|---------|----------|-----|
| Supabase key hardcoded in import script | CRITICAL | Removed 2026-06-06, history squashed |
| GitHub push blocked by secret scanning | CRITICAL | Fixed |
| Magic link one-time-use | HIGH | SHA-256 blocklist in used_magic_tokens |
| Race condition in magic link | MEDIUM | Fixed Wave 6 |

### Remaining Concerns

| Finding | Severity | Notes |
|---------|----------|-------|
| .env.local with 8KB of keys on disk | MEDIUM | Normal for dev; keys also in Vercel |
| 5 missing tables expose 500 errors | LOW | Not a security issue, just broken |
| PITR never tested | LOW | Backup exists, restore unverified |
| n8n not deployed = no automation | LOW | Not a security concern |
| Duplicate self-heal crons | LOW | Double execution risk, not security |

---

## OWASP TOP 10 STATUS

| Category | Status |
|----------|--------|
| A01 Broken Access Control | ✅ Portal auth + RLS |
| A02 Cryptographic Failures | ✅ bcrypt passwords, HTTPS |
| A03 Injection | ✅ Parameterised queries (Supabase) |
| A04 Insecure Design | ✅ Auth-first architecture |
| A05 Security Misconfiguration | ⚠️ Missing tables = 500 errors (low risk) |
| A06 Vulnerable Components | ⚠️ Dependencies need audit |
| A07 Auth Failures | ✅ Rate limiting + timing-safe compare |
| A08 Integrity Failures | ✅ GitHub secret scanning |
| A09 Logging Failures | ⚠️ Sentry configured, audit log coverage incomplete |
| A10 SSRF | ✅ Allowlist implemented |

---

## SECURITY SCORE: 87/100
