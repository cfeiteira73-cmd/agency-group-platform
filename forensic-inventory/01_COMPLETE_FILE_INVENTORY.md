# 01 — COMPLETE FILE INVENTORY
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## STATISTICS SUMMARY

| Metric | Value |
|--------|-------|
| Total files (all) | 90,695 |
| Source files (excl. node_modules/.next/.git) | 2,837 |
| TypeScript (.ts) | 1,613 |
| TypeScript React (.tsx) | 390 |
| SQL migrations | 293 |
| Markdown (.md) | 301 |
| JSON configs | 104 |
| Python scripts | 22 |
| HTML files | 20 |
| Image assets | 19 |
| SVG files | 8 |
| Config files (.mjs/.yaml/.yml/.toml) | 20 |
| **Total lines of code (TS/TSX/JS)** | **461,190** |

---

## TOP-LEVEL DIRECTORY STRUCTURE

```
agency-group/
├── app/                    Next.js app router (pages + API routes)
│   ├── api/               542 API routes
│   ├── blog/              55 blog articles
│   ├── control-tower/     29 operations pages
│   ├── dashboard/         10 dashboard pages
│   ├── portal/            10 portal pages
│   └── [50+ other sections]
├── components/             React components
│   ├── portal/            Portal-specific components
│   └── ui/                UI primitives
├── lib/                    ~400 service files
│   ├── ai/               AI gateway + agents
│   ├── compliance/        GDPR + SOC2 + KYC
│   ├── events/            Event bus (Kafka-like)
│   ├── ml/               ML pipeline
│   ├── security/          Security layer
│   ├── sre/              SRE + chaos engineering
│   └── [60+ more modules]
├── supabase/
│   └── migrations/        278 SQL migration files
├── n8n-workflows/          11 automation workflow files
├── __tests__/              91 test files (2,222 tests)
├── public/                 Static assets
├── forensic-inventory/     THIS AUDIT
└── [config files]          package.json, vercel.json, etc.
```

---

## FILE BREAKDOWN BY FOLDER

### app/ (pages + API)
| Subfolder | .ts files | .tsx files | Purpose |
|-----------|----------|-----------|---------|
| api/ | ~542 | 0 | API routes |
| blog/ | ~5 | ~55 | Blog articles |
| control-tower/ | ~5 | ~29 | Ops dashboards |
| dashboard/ | ~5 | ~10 | Main dashboards |
| portal/ | ~5 | ~10 | Portal pages |
| auth/ | ~5 | ~4 | Authentication |
| imoveis/ | ~3 | ~5 | Property pages |
| Other | ~50 | ~25 | Various pages |

### lib/ (services — ~400 files)
| Module | Approx Files | Complexity |
|--------|-------------|-----------|
| security/ | ~40 | Enterprise |
| compliance/ | ~35 | Regulatory-grade |
| events/ | ~28 | Infrastructure |
| sre/ | ~22 | Infrastructure |
| ml/ | ~22 | Data science |
| observability/ | ~22 | Infrastructure |
| runtime/ | ~35 | Infrastructure |
| capital/ | ~15 | Business |
| ai/ | ~15 | AI |
| investors/ | ~18 | Business |
| growth/ | ~15 | Analytics |
| market/ | ~15 | Business |
| economics/ | ~15 | Financial |
| Other modules | ~100+ | Various |

---

## CRITICALITY CLASSIFICATION

### CRITICAL (platform cannot function without)
| File | Purpose |
|------|---------|
| lib/supabase.ts | Database connection |
| lib/db.ts | DB query layer |
| lib/session.ts | Session management |
| lib/auth/serviceAuth.ts | Service authentication |
| lib/security/rateLimiter.ts | Rate limiting |
| middleware.ts | Route middleware |
| app/layout.tsx | Root layout |
| app/api/auth/send/route.ts | Magic link auth |
| app/api/auth/verify/route.ts | Auth verification |

### HIGH IMPORTANCE (core features)
| File Category | Count |
|--------------|-------|
| app/api/properties/* | 12 routes |
| app/api/contacts/* | 5 routes |
| app/api/deals/* | 8 routes |
| app/api/sofia-agent/* | 4 routes |
| lib/ai/sofia/sofiaOS.ts | Sofia brain |
| lib/valuation/avm.ts | AVM engine |
| lib/scoring/* | Scoring system |

### MEDIUM IMPORTANCE (operational)
| File Category | Count |
|--------------|-------|
| app/api/cron/* | 30+ routes |
| app/api/analytics/* | 24 routes |
| app/api/automation/* | 17 routes |
| lib/observability/* | 22 files |
| lib/compliance/* | 35 files |

### LOW / CONFIGURED BUT INACTIVE
| File Category | Status |
|--------------|--------|
| lib/events/kafkaClient.ts | Configured, never used |
| lib/financial-rails/* | Configured, never used |
| lib/legal-execution/* | Configured, never used |
| lib/expansion/* | Configured, never used |
| n8n-workflows/* | Local only, not deployed |

### ORPHANED / POTENTIALLY UNUSED
| Concern | Files |
|---------|-------|
| Most of lib/ | Never called in production (no revenue) |
| Control Tower pages | Never accessed by real users |
| ML training files | No training data exists |
| Multi-tenant files | Single tenant only |

---

## CONFIG FILES

| File | Purpose |
|------|---------|
| package.json | Dependencies (27 prod, 13 dev) |
| vercel.json | Deployment + 41 cron jobs |
| tsconfig.json | TypeScript config (strict mode) |
| tailwind.config.ts | Design system |
| next.config.ts | Next.js config |
| vitest.config.ts | Test config |
| playwright.config.ts | E2E test config |
| .env.local | 76 environment variables |
| .env.example | Template (confirmed exists) |
| supabase/config.toml | Supabase local config |
| middleware.ts | Route middleware |

---

## ENVIRONMENT VARIABLES (76 total)

### Database & Auth (5)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH_SECRET
GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
```

### AI APIs (2)
```
ANTHROPIC_API_KEY
OPENAI_API_KEY
```

### Communication (10)
```
RESEND_API_KEY
TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM
WHATSAPP_PHONE_NUMBER + WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN + WHATSAPP_VERIFY_TOKEN
WHATSAPP_ACTIVE (NOT SET — WhatsApp inactive)
HEYGEN_API_KEY + HEYGEN_AVATAR_ID + HEYGEN_VOICE_ID
```

### Infrastructure (6)
```
UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT
SENTRY_DSN + SENTRY_AUTH_TOKEN
```

### Business (8)
```
APIFY_TOKEN
IDEALISTA_API_KEY + IDEALISTA_SECRET
NOTION_TOKEN + 8 NOTION_*_DB IDs
STRIPE_* keys
STABILITY_API_KEY
```

### Security (8)
```
CRON_SECRET
INTERNAL_API_TOKEN
ADMIN_SECRET
PORTAL_API_SECRET
INTERNAL_API_SECRET
HEALTH_CHECK_SECRET
WHATSAPP_APP_SECRET
ADMIN_EMAIL + ALLOWED_AGENTS
```

### Features (5)
```
AI_AUDIT_ENABLED
CAUSAL_TRACE_ENABLED
EVENT_HISTORY_ENABLED
TENANT_ISOLATION_ENABLED
N8N_BASE_URL + N8N_WEBHOOK_URL
```

---

## THIRD-PARTY DEPENDENCIES

### Production (27)
| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.1 | Framework |
| react | 19.2.4 | UI |
| @anthropic-ai/sdk | ^0.80.0 | AI |
| @supabase/supabase-js | ^2.49.4 | Database |
| next-auth | ^5.0.0-beta.25 | Authentication |
| zustand | ^5.0.12 | State management |
| zod | ^3.24.0 | Validation |
| resend | ^6.9.4 | Email |
| stripe | ^22.0.2 | Payments |
| ioredis | ^5.10.1 | Redis client |
| kafkajs | ^2.2.4 | Event streaming |
| leaflet | ^1.9.4 | Maps |
| gsap | ^3.14.2 | Animations |
| web-push | ^3.6.7 | Push notifications |
| bcryptjs | ^2.4.3 | Password hashing |
| next-intl | ^3.25.0 | i18n |
| @sentry/nextjs | ^8.0.0 | Monitoring |
| @opentelemetry/api | ^1.9.0 | Tracing |

### Dev (13)
| Package | Version | Purpose |
|---------|---------|---------|
| vitest | ^2.0.0 | Unit tests |
| @playwright/test | ^1.59.1 | E2E tests |
| @temporalio/* | ^1.11.0 | Workflow engine (dev) |
| typescript | ^5 | Type checking |
| tailwindcss | ^4 | CSS |

---

*Evidence: PowerShell file system scan 2026-06-11, package.json, .env.example*
