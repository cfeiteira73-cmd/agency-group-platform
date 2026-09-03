# 04 — TECH, SECURITY & PERFORMANCE
**Agency Group | 2026-09-03**

---

## VERDICT: EXCEPTIONAL FOUNDATION

The technical platform is the strongest asset Agency Group has. OWASP 87/100 is enterprise-grade. TypeScript 0 errors is rare. 2,222 tests is serious infrastructure. This is genuinely world-class for a solo-built startup.

**Score: 87/100**

---

## VERIFIED TECHNICAL METRICS

| Metric | Value | How verified |
|--------|-------|-------------|
| TypeScript errors | 0 | `pnpm tsc --noEmit` |
| Test suite | 2,222/2,222 passing | vitest |
| OWASP security score | 87/100 | Wave 7 audit |
| Next.js version | 16 (App Router) | package.json |
| API routes | 542 | Build output |
| Pages | 155 | Build output |
| Package manager | pnpm 9.15.4 | — |
| Node.js | v22.22.0 | — |
| Deployment | Vercel Paris cdg1 | Vercel dashboard |
| Database | Supabase Frankfurt | Supabase dashboard |

---

## SECURITY ARCHITECTURE (7 WAVES COMPLETED)

| Wave | What was hardened |
|------|------------------|
| Wave 1 | Base security, auth, CORS, headers |
| Wave 2 | Rate limiting (Upstash Redis), CSRF |
| Wave 3 | FAQ RSC, exit intent, dedup |
| Wave 4 | auth() on 7 routes, ownership checks, magic link one-time-use (SHA-256 blocklist), GDPR purge |
| Wave 5 | timingSafeEqual on 22 routes, auth() in 6 more areas, CRON_SECRET fix, Upstash on 3 auth routes |
| Wave 6 | Race conditions, GSAP lazy-load, Suspense, Sofia persistence, semantic search pgvector |
| Wave 7 | Final OWASP verification → 87/100 |

**OWASP categories covered:**
- A01 Broken Access Control: auth() on critical routes, ownership checks, RLS
- A02 Cryptographic Failures: timingSafeEqual, SHA-256 blocklist, HTTPS only
- A03 Injection: Zod validation, parameterized queries, no raw SQL
- A04 Insecure Design: Rate limiting, CSRF, magic link TTL 15min
- A05 Security Misconfiguration: Headers hardened, CORS configured
- A07 Auth Failures: Magic link one-time-use, GDPR purge, Google OAuth

**Target: 95/100.** Path: A06 (vulnerable components), A08 (integrity failures), A09 (logging).

---

## ARCHITECTURE

```
Browser → Vercel Edge (cdg1 Paris) → Next.js App Router
                                    ↓
                              542 API Routes
                                    ↓
                         Supabase (Frankfurt)
                         ├── PostgreSQL (primary)
                         ├── pgvector (embeddings)
                         ├── Row Level Security
                         └── Real-time subscriptions
                                    ↓
                         External Services:
                         ├── Anthropic (Sofia AI)
                         ├── Resend (email)
                         ├── Upstash (rate limiting)
                         ├── Sentry (error tracking)
                         └── n8n (NOT DEPLOYED)
```

---

## PERFORMANCE STATUS

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| LCP (mobile) | < 2.5s | UNKNOWN | Not measured |
| CLS | < 0.1 | UNKNOWN | Not measured |
| FID/INP | < 200ms | UNKNOWN | Not measured |
| API P95 | < 500ms | UNKNOWN | Not measured |
| Sofia response | < 3s | UNKNOWN | Not tested live |
| Bundle size first load | < 500KB | UNKNOWN | Not measured |

**Action required:** Run PageSpeed Insights on homepage and key property pages.

---

## WHAT MUST NEVER BE TOUCHED

1. **TS strict mode** — Never set `"strict": false` or add `// @ts-ignore` to bypass
2. **vitest suite** — Never commit code that breaks tests. Fix tests before merging.
3. **OWASP 87 baseline** — Never remove: auth() guards, timingSafeEqual, rate limiting, magic link one-time-use
4. **Supabase RLS** — Never bypass Row Level Security for convenience
5. **pnpm** — Never run `npm install`. npm is corrupted on this machine.

---

## TECHNICAL DEBT (MANAGEABLE)

| Item | Risk | Priority |
|------|------|----------|
| n8n not deployed | Commercial (not technical) | P1 |
| pgvector accuracy unverified | AI quality unknown | P3 |
| AVM accuracy unverified | Pricing trust | P3 |
| Performance metrics unmeasured | Unknown baseline | P3 |
| Kafka/Redpanda not configured | Event system incomplete | P5 |

---

## SAFE IMPROVEMENT AREAS (WILL NOT DEGRADE EXCELLENCE)

- Add performance monitoring (Vercel Analytics)
- Add error boundaries to remaining client components
- Add structured logging with correlation IDs
- Improve test coverage for new features (maintain 2,222+)
- Configure A06 dependency scanning in CI
