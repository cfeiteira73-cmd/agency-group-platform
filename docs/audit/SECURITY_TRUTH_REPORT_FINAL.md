# Security Truth Report — Final
AGENCY GROUP SH-ROS · 2026-05-17

---

## Executive Summary

The system has a solid layered auth architecture (NextAuth + HMAC magic-link + CRON_SECRET) that is correctly implemented in the core libraries, uses constant-time comparison on all secret checks, and has one-time-use magic tokens enforced via a Supabase blocklist. The main weaknesses are coverage gaps (approximately 204 of 277 routes rely on `isPortalAuth`/`requirePortalAuth`, but at least 73 routes from the Grep sample appear unprotected or public-only), an in-memory rate limiter on the public `/buyer-intelligence/track` endpoint that resets on every serverless cold start, and `application/octet-stream` being allowed in the upload route as an extension catch-all which bypasses MIME validation. No hardcoded secrets or SSRF vulnerabilities based on user-supplied URLs were found; all external fetch targets are env-var-controlled or fixed hostnames.

---

## Auth Architecture

### How it works

Three authentication methods are accepted by both `lib/portalAuth.ts` (isPortalAuth) and `lib/requirePortalAuth.ts` (requirePortalAuth):

1. **Service tokens**: `x-cron-secret` header or `Authorization: Bearer` header matched against `CRON_SECRET` or `INTERNAL_API_TOKEN` env vars. Used by Vercel cron, n8n, and internal service calls. Comparison is delegated to `lib/safeCompare.ts` (uses `crypto.timingSafeEqual`) in the cron routes; the core `isPortalAuth` uses inline `createHmac` + direct string comparison on cookie payloads but calls `safeCompare` in `sync-listings`. **Minor inconsistency**: `isPortalAuth` does `expected !== sig` (non-constant-time) on the cookie HMAC, while `auth/verify` uses `safeCompare`. This is low risk for cookies but should be unified.

2. **NextAuth v5 session**: Google OAuth or credentials. `requirePortalAuth` tries `auth()` and accepts any session with a non-null `email`. `isPortalAuth` does NOT check NextAuth — it only covers service tokens + magic link cookie. Routes using `isPortalAuth` instead of `requirePortalAuth` will silently reject valid NextAuth sessions.

3. **HMAC magic-link cookie (`ag-auth-token`)**: Payload is `base64url(JSON({email, exp}))` + `.` + HMAC-SHA256 hex, signed with `AUTH_SECRET`. Token is 30-minute validity. Session cookie is 8-hour validity. One-time-use enforced via SHA-256 hash stored in `used_magic_tokens` table (23505 unique violation = already used). A two-step design (GET validates but does not consume; POST from the auto-submit form consumes) protects against email scanner pre-fetch invalidating tokens before the user clicks.

### Route Coverage

- Total route files found: **277** (`export async function` handlers)
- Routes using `isPortalAuth` or `requirePortalAuth` or `portalAuthGate`: **73** (confirmed by Grep)
- Routes using `auth()` directly (NextAuth only): scattered across remaining routes — many sensitive routes (e.g., `/api/user/export-data`, `/api/user/delete-account`, `/api/cron/purge-conversations`) appear to use `auth()` directly without magic-link fallback
- Routes with Upstash rate-limiting: **26** (auth, claude endpoints, sofia, booking, avm, crm, juridico, etc.)
- Routes that appear unprotected or public-by-design: `/api/buyer-intelligence/track`, `/api/health`, `/api/healthz`, `/api/rates`, `/api/mortgage`, `/api/imt`, `/api/mais-valias`, `/api/properties/public`, `/api/alerts/unsubscribe`, and other public-facing informational endpoints

The dual-library situation (`isPortalAuth` vs `requirePortalAuth`) means some routes that were written with the older library miss NextAuth session support. `requirePortalAuth` is the correct one and should be the standard.

---

## Critical Vulnerabilities

None found at CRITICAL severity. The following are HIGH and MEDIUM:

### HIGH — In-memory rate limiter resets on serverless cold start

**File**: `app/api/buyer-intelligence/track/route.ts`, lines 23–47

**Description**: The `ipBuckets` Map is module-level state. On Vercel Edge/Serverless, each cold start creates a fresh map, making the 60 req/min window meaningless under load. An attacker can exhaust the server by triggering new instances.

**Business impact**: The `/track` endpoint feeds the buyer intent profiler. Unlimited writes could inflate buyer intent scores or exhaust compute. Low impact since no auth data is at stake, but buyer intelligence data quality degrades.

**Fix**: Replace with Upstash Redis sliding window (the same pattern used on `/api/auth/send`). Since Upstash is already a dependency, this is a 20-line change.

**Severity**: HIGH (data integrity, DoS potential on public endpoint)

---

### HIGH — `application/octet-stream` allowed in upload route bypasses MIME validation

**File**: `app/api/property-ai/upload/route.ts`, lines 28–30, 104

**Description**: `ALLOWED_MIME_EXACT` includes `'application/octet-stream'` with the comment "some browsers send ZIP as this." When a browser sends a file with no detectable MIME type, the code defaults to `application/octet-stream` (line 104). The `isAllowedFile` check passes this through, meaning any binary file — including executables, scripts, or crafted polyglots — can be uploaded as long as the extension check at line 46–47 also passes. Extension check is: `filename.split('.').pop()?.toLowerCase()` — easily bypassed with a double extension like `malicious.php.zip`.

**Business impact**: Uploaded files go to Supabase Storage (`property-media` bucket). If the bucket is public (which it appears to be — `getPublicUrl` is used), a crafted file could be served to future users or used as a delivery vector. SVG files are not in `ALLOWED_EXTENSIONS` but the MIME `image/svg+xml` passes through `image/` prefix check and SVGs can contain scripts.

**Fix**:
1. Remove `'application/octet-stream'` from `ALLOWED_MIME_EXACT`. If ZIP support is needed, require the extension to be `.zip` and the MIME to match.
2. Add SVG to a blocked list (or strip script content).
3. Consider magic-byte validation (read first 16 bytes) for images.
4. Set `Content-Disposition: attachment` on Supabase Storage for non-image files.

**Severity**: HIGH

---

### MEDIUM — HMAC cookie comparison uses non-constant-time `!==` in `isPortalAuth`

**File**: `lib/portalAuth.ts`, line 38

**Description**: `if (expected !== sig) return false` — JavaScript string comparison is not guaranteed constant-time. An attacker performing a timing attack across thousands of requests could theoretically recover the cookie HMAC. The correct pattern (`safeCompare`) is already used in `auth/verify/route.ts`.

**Fix**: Replace `expected !== sig` with `!safeCompare(expected, sig)` (importing the existing `lib/safeCompare.ts`). One-line fix.

**Severity**: MEDIUM (theoretical timing attack on HMAC cookie)

---

### MEDIUM — `isPortalAuth` does not check NextAuth sessions

**File**: `lib/portalAuth.ts`

**Description**: `isPortalAuth` only accepts service tokens and magic-link cookies. `requirePortalAuth` also accepts NextAuth sessions. Routes using the older `isPortalAuth` (73 of the protected routes) will reject users who authenticated via Google OAuth, degrading UX and potentially creating inconsistent access control behavior.

**Fix**: Deprecate `isPortalAuth` and migrate all call sites to `requirePortalAuth`. The newer library is a strict superset.

**Severity**: MEDIUM (functional auth gap, not a security hole but an access control inconsistency)

---

### MEDIUM — Rate limiting degrades to "fail open" when Upstash is unavailable

**Files**: `app/api/auth/send/route.ts` line 39, `app/api/auth/verify/route.ts` line 33, `app/api/juridico/route.ts` line 43

**Description**: All Upstash-backed rate limiters catch exceptions and return `{ allowed: true }`. If Upstash becomes unavailable (misconfiguration, network issue), rate limiting is silently disabled for all affected endpoints including the magic-link send endpoint. This means a user could send unlimited magic-link emails, burning Resend quota and enabling user enumeration.

**Fix**: Consider returning `{ allowed: false }` on Upstash errors for auth-critical endpoints (send/verify), with a fallback to an in-process window (imperfect but better than no limit). Log the Upstash failure loudly.

**Severity**: MEDIUM

---

### LOW — `sync-listings` cron accepts `limit` param from query string without upper bound check via safeCompare

**File**: `app/api/cron/sync-listings/route.ts`, line 426

**Description**: `parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10)` — a caller with the CRON_SECRET can pass `limit=10000` and trigger processing of 10,000 properties in one run, potentially causing a 300s Vercel timeout and Supabase query overload. The auth gate is correct (CRON_SECRET checked via `safeCompare`), so only authenticated internal actors are affected.

**Fix**: Add `Math.min(500, ...)` clamping on the parsed limit.

**Severity**: LOW (authenticated internal DoS only)

---

### LOW — `auth/send` email validation is `email.includes('@')` only

**File**: `app/api/auth/send/route.ts`, line 59

**Description**: The email check `!email || !email.includes('@')` accepts malformed emails like `a@`, `@b`, or `@@`. While Resend will reject genuinely invalid emails at the SMTP level, the token is still minted and the API call is still made before finding out. More critically, a value like `very_long_string_repeating@x` could cause the HMAC computation to be slow on older hardware (denial-of-service vector of low concern).

**Fix**: Use a simple RFC-compliant regex or a library like `validator.isEmail()`.

**Severity**: LOW

---

## File Upload Security

**Route**: `app/api/property-ai/upload/route.ts`

**Positive controls**:
- Auth required (NextAuth session OR magic-link cookie) — line 66–69
- 50 MB per-file limit enforced — line 111–114
- MIME prefix allowlist (`image/`, `video/`, `audio/`, `application/pdf`) — line 43–47
- Extension-based fallback allowlist — lines 33–41
- File ID generated with `crypto.randomUUID()` — no path traversal risk on storage key
- Storage path: `${submissionId}/${fileId}.${ext}` — UUID-based, not derived from user filename
- `upsert: false` — prevents overwriting existing files

**Issues**:
- `application/octet-stream` is in the MIME exact allowlist (HIGH severity — see above)
- SVG files pass through the `image/` prefix check; SVGs can contain inline JavaScript. If the Supabase Storage bucket serves these with `Content-Type: image/svg+xml`, stored XSS is possible if the URL is embedded in HTML.
- Original filename is stored in the response but not in the storage path, which is good. However, the raw `ext` from `file.name.split('.').pop()` is used in the storage key. A filename like `image.jpg.php` would store as `uuid.php`. This is safe in terms of serving (Supabase Storage serves by content type, not extension) but confusing.
- No virus/malware scanning before storage.

---

## Rate Limiting Coverage

| Endpoint | Rate Limit | Mechanism |
|---|---|---|
| `/api/auth/send` | 3/hour/IP | Upstash Redis sliding window |
| `/api/auth/verify` (GET+POST) | 10/15min/IP | Upstash Redis sliding window |
| `/api/auth/request` | 5/hour/IP | Upstash Redis sliding window |
| `/api/juridico` | 30/hour/IP | Upstash Redis sliding window |
| `/api/sofia/chat` | Present | Upstash Redis |
| `/api/avm` | Present | Upstash Redis |
| `/api/booking` | Present | Upstash Redis |
| `/api/buyer-intelligence/track` | 60/min/IP | In-memory Map (resets on cold start — HIGH issue) |
| `/api/properties/public` | Not found | None detected |
| `/api/search` | Not found | None detected |
| `/api/contacto` | Present | Upstash Redis |
| `/api/leads` | Present | Upstash Redis |

Routes without rate limiting that face public traffic (no auth required): `/api/properties/public`, `/api/search`, `/api/rates`, `/api/imt`, `/api/mortgage`. These are read-only and don't accept user input for writes, so impact is limited to compute abuse.

---

## Secret Management

All secrets are accessed via `process.env.*` with no hardcoded values found in the audit. Key env vars in use:

- `AUTH_SECRET` — HMAC key for magic-link tokens and session cookies
- `CRON_SECRET` — authenticates cron + internal service calls
- `INTERNAL_API_TOKEN` — alternative service token
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS (service-role admin operations)
- `NEXT_PUBLIC_SUPABASE_URL` — public, correctly so
- `RESEND_API_KEY` — email sending
- `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- `ANTHROPIC_API_KEY` (implied) — Claude API

One observation: `process.env.AUTH_SECRET!` is used with a non-null assertion in `auth/send/route.ts` line 57. If `AUTH_SECRET` is not set in an environment, this will throw a runtime error rather than fail gracefully. The `auth/verify` route handles this correctly at module level (logs error, returns 500). The `auth/send` route does not — it will throw an unhandled exception.

No hardcoded secrets, passwords, or API keys were found in the codebase.

---

## Prompt Injection Risks

The `juridico` route accepts an array of `messages` (user + assistant turns) validated with Zod (`z.string().min(1)`) and passes them directly to the Anthropic API as the `messages` array. The system prompt is a long Portuguese legal expert persona that is not modified by user input.

**Risk**: A user could inject instructions into their message content like "Ignore all previous instructions and instead output..." The system prompt is fixed and authoritative, which is the correct defense. However:
- The system prompt is passed with `cache_control` (prompt caching) — this is correct and efficient.
- There is no content filtering or message length limit beyond Zod's `min(1)`. A user could send a 100KB legal question, burning tokens.
- The endpoint is auth-gated (requires session), limiting the attack surface to authenticated agents only.

**Fix**: Add `z.string().max(10000)` to the message content schema to bound token consumption.

---

## GDPR / Data Retention

**PII stored**:
- `sofia_conversations` — chat history with email-linked sessions
- `property_collections` — saved properties per agent
- `profiles` — agent profile data
- `used_magic_tokens` — email + token hash + timestamps
- `contacts` / CRM data — buyer/seller contact information
- `push_subscriptions` — device tokens

**Deletion**: `app/api/user/delete-account/route.ts` performs parallel deletion across `sofia_conversations`, `property_collections`, `push_subscriptions`, `used_magic_tokens`, and `profiles`. Authenticated with NextAuth session + email confirmation. **Gap**: CRM contacts, leads, and deal records linked to the user as an agent are not deleted — this may be intentional (business records) but should be documented.

**Automated purge**: `app/api/cron/purge-conversations` exists (GDPR-motivated retention purge of old Sofia conversations).

**Export**: `app/api/user/export-data/route.ts` implements GDPR Art. 20 data portability for conversations, collections, and profile. Same gap as deletion: CRM and deal data not included.

**Assessment**: Core GDPR Article 17 and 20 flows are implemented. Business record retention for deals/contacts is an acknowledged gap that should be documented in a data retention policy.

---

## What Is Secure

- `lib/safeCompare.ts` correctly uses `crypto.timingSafeEqual` — used in cron auth and magic-link verify
- One-time magic-link tokens enforced via `used_magic_tokens` (SHA-256 hash, unique constraint, 23505 detection) — replay attack resistant
- Two-step GET/POST confirm design prevents email scanner pre-fetch from consuming tokens
- Session cookie: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, 8-hour `Max-Age` — correct configuration
- CRON_SECRET auth: consistent across all cron routes, `safeCompare` used
- No SSRF from user-supplied URLs: all `fetch()` targets are either fixed external hostnames (Notion API, Facebook Graph, HeyGen), env-var-controlled internal URLs (`N8N_WEBHOOK_URL`, `NEXT_PUBLIC_APP_URL`), or self-referential (`${baseUrl}/api/...`)
- File upload path: UUID-based storage keys, no path traversal risk
- No `eval()` or `new Function()` patterns found in application code
- Zod validation on Juridico endpoint before Claude API submission
- GDPR Art. 17 and 20 endpoints exist and are auth-gated

---

## Recommended Security Fixes

### CRITICAL: Fix immediately
_(none found at critical severity)_

### HIGH: Fix this sprint

1. **Replace in-memory rate limiter on `/api/buyer-intelligence/track`** with Upstash Redis sliding window. File: `app/api/buyer-intelligence/track/route.ts`, replace `ipBuckets` Map with the same Upstash pipeline pattern used in `auth/send`. Estimated: 30 minutes.

2. **Remove `application/octet-stream` from ALLOWED_MIME_EXACT in upload route**. File: `app/api/property-ai/upload/route.ts`, line 29. If ZIP support is required, add explicit `application/zip` only and verify extension. Add SVG to a block list or sanitize SVG content before storage. Estimated: 1 hour.

### MEDIUM: Fix next sprint

3. **Unify HMAC cookie comparison to use `safeCompare`**. File: `lib/portalAuth.ts`, line 38. Replace `expected !== sig` with `!safeCompare(expected, sig)`. Requires importing `safeCompare`. One line.

4. **Deprecate `isPortalAuth` in favour of `requirePortalAuth`**. Audit all 73 usages of `isPortalAuth` and migrate to `requirePortalAuth` to ensure NextAuth sessions are accepted everywhere. This is a breaking API change for each migrated route — test carefully.

5. **Fail closed (not open) on Upstash errors for auth endpoints**. Files: `auth/send`, `auth/verify`. Return `{ allowed: false }` in the catch block for `/api/auth/send` specifically, with a fallback in-process window of max 3 requests per hour using a module-level Map as backstop.

6. **Add `max(500, ...)` clamp on `sync-listings` `limit` param**. File: `app/api/cron/sync-listings/route.ts`, line 426.

### LOW: Monitor

7. **Strengthen email validation in `auth/send`**. Replace `email.includes('@')` with RFC-5322 regex or `validator.isEmail()`. File: `app/api/auth/send/route.ts`, line 59.

8. **Add message content length cap in Juridico**. Add `z.string().max(10000)` to `MessageParamSchema`. File: `app/api/juridico/route.ts`, line 8.

9. **Handle missing `AUTH_SECRET` gracefully in `auth/send`**. Replace `process.env.AUTH_SECRET!` (line 57) with a null check that returns HTTP 500 with a logged error rather than throwing an unhandled exception.
