# 04 — BACKEND DNA
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## API ARCHITECTURE

```
Runtime:      Node.js via Next.js App Router (Edge + Node runtime)
Auth layer:   Bearer tokens + next-auth session + CRON_SECRET
Rate limiting: Upstash Redis (auth routes + juridico)
Validation:   Zod schemas on all inputs
Error format: Structured JSON { error, code, status }
Monitoring:   Sentry + OpenTelemetry traces
```

---

## ALL 542 API ROUTES (BY GROUP)

### Authentication (8 routes)
| Route | Method | Purpose | Auth | Status |
|-------|--------|---------|------|--------|
| /api/auth/send | POST | Send magic link | None | ✅ Active |
| /api/auth/verify | POST | Verify token | None | ✅ Active |
| /api/auth/[...nextauth] | * | NextAuth handler | — | ✅ Active |
| /api/auth/logout | POST | Kill session | Session | ✅ Active |
| /api/auth/2fa/setup | POST | TOTP setup | Session | ✅ Built |
| /api/auth/2fa/verify | POST | TOTP verify | Session | ✅ Built |
| /api/auth/session | GET | Session info | Session | ✅ Active |
| /api/auth/refresh | POST | Refresh token | Session | ✅ Built |

### Properties (12 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/properties | GET | List (portal) — [FIXED] | ✅ Active |
| /api/properties/public | GET | Public listing — [FIXED] | ✅ Active |
| /api/properties/[id] | GET | Single property | ✅ Active |
| /api/properties/[id] | PATCH | Update property | ✅ Built |
| /api/properties/search | GET | Semantic search | ✅ Built |
| /api/properties/avm | POST | Get valuation | ✅ Built |
| /api/properties/embed | POST | Generate embedding | ✅ Built |
| /api/properties/score | POST | Score property | ✅ Built |
| /api/properties/images | POST | Photo scoring | ✅ Built |
| /api/properties/match | POST | Find buyers | ✅ Built |
| /api/properties/import | POST | Bulk import | ✅ Built |
| /api/properties/offmarket | GET | Off-market leads | ✅ Built |

### Contacts / CRM (8 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/contacts | GET | List contacts | ✅ Active |
| /api/contacts | POST | Create contact | ✅ Active |
| /api/contacts/[id] | GET | Single contact | ✅ Active |
| /api/contacts/[id] | PATCH | Update contact | ✅ Active |
| /api/contacts/[id] | DELETE | Delete contact | ✅ Built |
| /api/contacts/search | GET | Search contacts | ✅ Built |
| /api/contacts/score | POST | Score contact | ✅ Built |
| /api/contacts/dedup | POST | Deduplicate | ✅ Built |

### Deals (10 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/deals | GET | List deals | ✅ Active |
| /api/deals | POST | Create deal | ✅ Active |
| /api/deals/[id] | GET | Single deal | ✅ Active |
| /api/deals/[id] | PATCH | Update deal | ✅ Active |
| /api/deals/[id]/stage | POST | Advance stage | ✅ Built |
| /api/deals/[id]/commission | GET | Commission P&L | ✅ Built |
| /api/deals/[id]/timeline | GET | Deal timeline | ✅ Built |
| /api/deals/pipeline | GET | Full pipeline | ✅ Built |
| /api/deals/forecast | GET | Revenue forecast | ✅ Built |
| /api/deals/summary | GET | Deal summary KPIs | ✅ Built |

### Sofia AI Agent (6 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/sofia-agent/chat | POST | Main chat handler | ✅ Built, 0 uses |
| /api/sofia-agent/history | GET | Conversation history | ✅ Built (0 rows) |
| /api/sofia-agent/clear | POST | Clear history | ✅ Built |
| /api/sofia-agent/handoff | POST | Human handoff | ✅ Built |
| /api/sofia-agent/qualify | POST | Lead qualification | ✅ Built |
| /api/sofia-agent/brief | GET | Daily brief | ✅ Built |

### Capital Profiles (6 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/capital-profiles | GET | List profiles | ✅ Active, 7,342 rows |
| /api/capital-profiles/[id] | GET | Single profile | ✅ Active |
| /api/capital-profiles/search | GET | Search/filter | ✅ Active |
| /api/capital-profiles/score | POST | Re-score profile | ✅ Built |
| /api/capital-profiles/enrich | POST | Enrich contact | ✅ Built |
| /api/capital-profiles/export | GET | Export CSV | ✅ Built |

### Matches (8 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/matches | GET | List matches | ✅ Active (17 demo) |
| /api/matches | POST | Create match | ✅ Active |
| /api/matches/[id] | GET | Single match | ✅ Active |
| /api/matches/[id] | PATCH | Update match | ✅ Active |
| /api/matches/auto | POST | Auto-match | ✅ Built |
| /api/matches/priority | GET | High-score matches | ✅ Built |
| /api/matches/score | POST | Re-score match | ✅ Built |
| /api/matches/notify | POST | Notify on match | ✅ Built |

### Analytics (24 routes)
| Route Group | Count | Status |
|------------|-------|--------|
| /api/analytics/overview | 1 | ✅ |
| /api/analytics/pipeline | 1 | ✅ |
| /api/analytics/contacts | 1 | ✅ |
| /api/analytics/deals | 1 | ✅ |
| /api/analytics/properties | 1 | ✅ |
| /api/analytics/revenue | 1 | ✅ |
| /api/analytics/capital | 1 | ✅ |
| /api/analytics/automation | 1 | ✅ |
| /api/analytics/sre | 1 | ✅ |
| /api/analytics/funnel | 1 | ✅ |
| /api/analytics/cohort | 1 | ✅ |
| /api/analytics/attribution | 1 | ✅ |
| Other analytics/* | 12 | ✅ |

### Automation (17 routes)
| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/automation/lead-score | POST | Score all leads | ✅ Cron 06:15 |
| /api/automation/match-buyer | POST | Run matching | ✅ Cron 06:30 |
| /api/automation/revenue-loop | POST | Revenue engine | ✅ Cron 3x/day |
| /api/automation/email-sequence | POST | Email automation | ✅ n8n dependent |
| /api/automation/follow-up | POST | Follow-up triggers | ✅ Built |
| /api/automation/dedup | POST | CRM dedup | ✅ Built |
| Other automation/* | 11 | Various | ✅ Built |

### Cron Jobs (41 routes)
| Route | Schedule | Purpose | Confirmed Running? |
|-------|----------|---------|-------------------|
| /api/cron/kpi-snapshot | Daily 23:55 UTC | KPI capture | ✅ YES (50 runs) |
| /api/cron/avm-daily | Daily 07:00 | Property valuations | ❓ Unknown |
| /api/cron/lead-score | Mon-Fri 06:15 | Score leads | ❓ Unknown |
| /api/cron/match-buyer | Mon-Fri 06:30 | Match properties | ❓ Unknown |
| /api/cron/gdpr-purge | Daily 03:00 | GDPR compliance | ❓ Unknown |
| /api/cron/revenue-loop | 3x daily | Revenue engine | ❓ Unknown |
| /api/cron/daily-brief | Daily 07:30 | Sofia brief | ❓ Unknown |
| /api/cron/weekly-report | Mon 08:00 | Reports | ❓ Unknown |
| Other crons | ~33 | Various | ❓ Unknown |

### Security (6 routes)
| Route | Purpose | Status |
|-------|---------|--------|
| /api/security/audit | Security audit | ✅ Active |
| /api/security/events | SIEM events | ✅ Active |
| /api/security/health | Security health | ✅ Active |
| /api/security/zero-trust | ZT checks | ✅ Active |
| /api/security/rate-limit | Rate limit status | ✅ Active |
| /api/security/secrets | Secrets rotation | ✅ Built |

### WhatsApp (5 routes)
| Route | Purpose | Status |
|-------|---------|--------|
| /api/whatsapp/webhook | Incoming messages | ✅ Fixed (timingSafeEqual) |
| /api/whatsapp/send | Send message | ✅ Built |
| /api/whatsapp/status | Message status | ✅ Built |
| /api/whatsapp/template | Template messages | ✅ Built |
| /api/whatsapp/media | Media messages | ✅ Built |

**WHATSAPP_ACTIVE env var: NOT SET — all WhatsApp routes inactive**

### Partner System (4 routes — BROKEN)
| Route | Purpose | Status |
|-------|---------|--------|
| /api/partners/performance | Performance stats | ❌ 404 (table missing) |
| /api/partners/invite | Invite partner | ❌ 404 |
| /api/partners/tiers | Partner tiers | ❌ 404 |
| /api/partners/commissions | Commission calc | ❌ 404 |

---

## KEY SERVICE LAYER FILES

### lib/ai/ — AI Gateway
| File | Purpose |
|------|---------|
| lib/ai/sofia/sofiaOS.ts | Sofia main orchestrator |
| lib/ai/sofia/sofiaPrompts.ts | System prompts |
| lib/ai/sofia/sofiaTools.ts | 8 agentic tools |
| lib/ai/gateway/aiGateway.ts | Claude API client |
| lib/ai/agents/ | 16 specialized agents |

### lib/security/ (46 files)
| Key File | Purpose |
|----------|---------|
| lib/security/rateLimiter.ts | Upstash rate limiting |
| lib/security/zeroTrustEngine.ts | Zero-trust auth |
| lib/security/siemPipeline.ts | SIEM event pipeline |
| lib/security/secretsManager.ts | Env var management |
| lib/security/timingSafeCompare.ts | Fixed (length guard) |

### lib/scoring/ — ML Scoring
| File | Purpose |
|------|---------|
| lib/scoring/leadScorer.ts | Lead score (0-100) |
| lib/scoring/capitalProfileScorer.ts | Buyer score (0-100) |
| lib/scoring/propertyScorer.ts | Property score |
| lib/scoring/matchScorer.ts | Match compatibility |

---

## MIDDLEWARE

```typescript
// middleware.ts — protects ALL /portal and /dashboard routes
// Redirects unauthenticated to /auth/login
// Allows public: /, /blog, /imoveis, /api/auth/*, /api/properties/public

Active protections:
- /portal/* → requires Session
- /dashboard/* → requires Session
- /control-tower/* → requires Session
- /api/* → requires Bearer (service routes)
- /api/auth/* → public (no auth)
- /api/cron/* → requires CRON_SECRET header
```

---

## CRON SYSTEM (vercel.json)

```json
41 total cron jobs configured
Format: { "path": "/api/cron/...", "schedule": "cron expression" }

CONFIRMED RUNNING:
  kpi-snapshot: "55 23 * * *" → 50 runs ✅

UNCONFIRMED (no evidence in DB):
  40 other crons → evidence unknown
```

---

## INTEGRATION LAYER

| Service | Purpose | Integration Method | Active? |
|---------|---------|-------------------|---------|
| Supabase | Database | @supabase/supabase-js | ✅ Active |
| Anthropic | AI (Sofia) | @anthropic-ai/sdk | ✅ Active (API calls) |
| Resend | Email | resend npm | ✅ Configured, 0 real emails |
| Upstash Redis | Rate limits | ioredis | ✅ Active |
| Sentry | Error tracking | @sentry/nextjs | ✅ Configured |
| Stripe | Payments | stripe npm | ✅ Configured, 0 transactions |
| Notion | Database sync | Notion API | ✅ Configured |
| HeyGen | Video AI | REST API | ✅ Configured, 0 uses |
| Twilio/WhatsApp | WhatsApp | Twilio SDK | ✅ Configured, INACTIVE |
| Apify | Web scraping | Apify API | ✅ Used for leads |
| KafkaJS | Event streaming | kafkajs npm | ✅ Configured, not streaming |

---

*Evidence: app/api/ directory scan, forensic-inventory/03_BACKEND_MAP.md, vercel.json, package.json*
