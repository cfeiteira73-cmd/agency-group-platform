# 15 — DISASTER RECOVERY & BACKUP
Agency Group | Final Operating System Audit | 2026-06-11

---

## BACKUP STATUS

| Component | Backup | Status |
|-----------|--------|--------|
| Supabase PITR | Configured | Never tested |
| GitHub repo | ✅ Pushed | Latest commit: 2026-06-06+ |
| .env.local | LOCAL ONLY | No cloud backup of secrets |
| n8n workflows | Git tracked | Local Docker only |
| capital_profiles | Supabase PITR | 7,342 rows |
| Migrations (278) | Git tracked | ✅ |

---

## RESTORE PROCEDURE (untested)

### Full Database Restore
1. Go to Supabase dashboard → isbfiofwpxqqpgxoftph
2. Settings → Backups → Restore to point in time
3. Select restore point (PITR available)
4. Wait ~15-30 minutes
5. Verify record counts

### Code Restore
1. `git clone github.com/[repo]/agency-group`
2. `npm install`
3. Copy .env.local from secure backup
4. Deploy to Vercel

---

## ENVIRONMENT VARIABLES MANIFEST (no values — structure only)

Required for production:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
AUTH_SECRET
CRON_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
SENTRY_DSN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
HEYGEN_API_KEY
DEFAULT_TENANT_ID
SYSTEM_ORG_ID
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

---

## CRITICAL DATA INVENTORY

| Asset | Count | Backup |
|-------|-------|--------|
| capital_profiles | 7,342 | ✅ Supabase PITR |
| contacts | 28 | ✅ Supabase PITR |
| deals | 8 | ✅ Supabase PITR |
| properties | 55 | ✅ Supabase PITR |
| kpi_snapshots | 47 | ✅ Supabase PITR |
| used_magic_tokens | 38 | ✅ Supabase PITR |

---

## RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| DB corruption | Low | HIGH | PITR configured |
| Key leak | Low (happened once, fixed) | HIGH | Vercel env vars separate |
| Vercel outage | Very low | HIGH | CDN redundancy |
| Supabase outage | Very low | HIGH | Read-only static fallbacks |
| n8n data loss | Low | MEDIUM | Git tracked (local) |
| .env.local loss | Medium | HIGH | **No cloud backup** |

---

## DR SCORE: 65/100

| Category | Score | Reason |
|----------|-------|--------|
| Database backup | 85/100 | PITR configured |
| Code backup | 90/100 | Git + GitHub |
| Secret backup | 40/100 | Only in Vercel + local file |
| Restore test | 0/100 | Never tested |
| n8n backup | 50/100 | Git tracked, local only |
| Documentation | 60/100 | This report |
