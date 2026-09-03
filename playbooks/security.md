# PLAYBOOK — SECURITY
**Agency Group | OWASP 87/100 baseline — NEVER degrade**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## ABSOLUTE RULES
- Never set `strict: false` in tsconfig
- Never add `@ts-ignore` without documented reason
- Never remove `auth()` guards from protected routes
- Never expose API keys in client code or git
- Never log personal data (email, phone, NIF) to console

## OWASP FLOOR = 87/100
Any change that degrades security score = BLOCKED.

## AUTH MODEL
- NextAuth sessions for web users
- Bearer tokens for API-to-API
- CRON_SECRET for cron routes
- `auth()` guard on every private route — no exceptions

## RATE LIMITING (Upstash Redis)
Active on: auth/send, auth/verify, juridico
Pattern: check before adding new auth routes

## PRIVATE MARKET RULES
- Confidential property MUST NOT appear in sitemap, schema.org, public APIs, search index
- Watermarking on sensitive documents
- Audit trail for access

## INPUT VALIDATION
- Zod on all API inputs
- Never trust client-provided IDs for ownership
- File uploads: type + size validation

## SECRETS ROTATION
- Resend key: rotate if exposed (done 2026-09-03)
- NEXTAUTH_SECRET: rotate if exposed
- SUPABASE keys: rotate if exposed, check RLS immediately after
- Never commit .env to git

## BEFORE ADDING A NEW ROUTE
1. Does it need auth? → add `auth()` guard
2. Does it accept user input? → add Zod validation
3. Does it access DB? → check RLS policy exists
4. Is it a cron? → add CRON_SECRET check
