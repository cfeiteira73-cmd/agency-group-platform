# DEPENDENCY REPORT
Agency Group | Wave 60 | Evidence: .env.local + code analysis

---

## ALL EXTERNAL PROVIDERS

### 1. STRIPE
| Field | Value |
|-------|-------|
| Status | ⚠️ CONFIGURED — TEST MODE |
| Key | sk_test_51TN1yhHWaY6tISrX... |
| Routes | /api/stripe/checkout, /api/stripe/portal, /api/stripe/webhook |
| Plans | Intelligence €49/mo, Elite €199/mo |
| Webhook | whsec_P0qKbVQOwiMuBvHVKnUBXKnUesG2pSRa (TEST) |
| Risk | HIGH — no real payments possible |
| Fix | Replace STRIPE_SECRET_KEY with sk_live_ + new webhook secret |

### 2. SUPABASE
| Field | Value |
|-------|-------|
| Status | ✅ LIVE |
| Project | isbfiofwpxqqpgxoftph (eu-central-1 Frankfurt) |
| Key | sb_secret_[REDACTED — stored in Vercel env vars] |
| Connection | REST API + Edge Functions |
| PITR | Enabled (Supabase managed) |
| Risk | LOW — fully operational |

### 3. ANTHROPIC (Claude API)
| Field | Value |
|-------|-------|
| Status | ✅ LIVE |
| Key | sk-ant-api03-[REDACTED] (confirmed SET) |
| Usage | Sofia, AVM, Legal AI, Content, Draft Offer |
| Routes | 52+ AI-consuming routes |
| Risk | MEDIUM — AI cost exposure (mitigated by Upstash rate limits) |

### 4. RESEND (Email)
| Field | Value |
|-------|-------|
| Status | ✅ LIVE |
| Key | re_[REDACTED] |
| Usage | Magic links, SOC alerts, follow-ups, escalations |
| From | alerts@agencygroup.pt |
| Risk | LOW — operational |

### 5. UPSTASH REDIS
| Field | Value |
|-------|-------|
| Status | ✅ CONFIGURED (assumed LIVE in Vercel) |
| Purpose | Distributed rate limiting (middleware + routes) |
| Risk | LOW — fallback to in-memory in dev |

### 6. HEYGEN
| Field | Value |
|-------|-------|
| Status | ✅ CONFIGURED |
| Key | sk_V2_[REDACTED — stored in Vercel env vars] |
| Usage | Sofia Speak (video synthesis) |
| Avatar | Sophia_public_20240320 |
| Risk | LOW — non-critical |

### 7. NOTION
| Field | Value |
|-------|-------|
| Status | ✅ CONFIGURED |
| Key | ntn_[REDACTED — stored in Vercel env vars] |
| DBs | Deals, Messages, Reels, Aprendizagens |
| Risk | LOW — supplementary CRM |

### 8. GOOGLE OAUTH
| Field | Value |
|-------|-------|
| Status | ✅ CONFIGURED |
| Client ID | 201831206854-bm2ddt3u0tggpjhrgrvugo75v56ktgft... |
| Usage | Authentication |
| Risk | LOW |

### 9. SENTRY
| Field | Value |
|-------|-------|
| Status | ✅ CONFIGURED |
| DSN | https://b12f3a5deb135114dfffc81a9e6ef1e1@o4511156597096448... |
| Usage | Error tracking |
| Risk | LOW |

### 10. SLACK SOC
| Field | Value |
|-------|-------|
| Status | ✅ CONFIGURED |
| Webhook | https://hooks.slack.com/services/T0ANAP1GUNR/B0B83QXKMJ4/... |
| Channel | Slack Security (Agency Group workspace) |
| Risk | LOW — operational |

### 11. WHATSAPP BUSINESS API
| Field | Value |
|-------|-------|
| Status | ❌ PARTIALLY CONFIGURED |
| Phone | +351919948986 (set) |
| Phone Number ID | 855251598377117 (set) |
| Verify Token | agwh-d21616b3632a63bb1d28635a04ad9b4c (set) |
| Access Token | PREENCHER (MISSING) |
| WHATSAPP_ACTIVE | false |
| Risk | HIGH — Sofia WA channel non-functional |
| Fix | Meta Business Manager → get permanent system user token |

### 12. IDEALISTA
| Field | Value |
|-------|-------|
| Status | ❌ NOT CONFIGURED |
| API Key | PREENCHER |
| API URL | https://api.idealista.com/3.5 (set) |
| Risk | HIGH — market data from static fallback |
| Fix | Apply at developers.idealista.com (5-10 day approval) |

### 13. CASAFARI
| Field | Value |
|-------|-------|
| Status | ❌ NOT CONFIGURED |
| API Key | PREENCHER |
| API URL | https://api.casafari.com/v1 (set) |
| Risk | MEDIUM — Idealista is primary |
| Fix | Contact Casafari sales team |

### 14. PAGERDUTY
| Field | Value |
|-------|-------|
| Status | ❌ NOT CONFIGURED |
| Risk | HIGH — SEV1 incidents not escalated to humans |
| Fix | Create free account at pagerduty.com |

### 15. DATADOG
| Field | Value |
|-------|-------|
| Status | ❌ NOT CONFIGURED |
| Risk | HIGH — no external SIEM |
| Fix | Datadog trial ($31/mo) |

### 16. SALTEDGE
| Field | Value |
|-------|-------|
| Status | ❌ NOT CONFIGURED |
| Risk | HIGH — no external bank reconciliation |
| Fix | SaltEdge commercial contract |

### 17. ADYEN (PSP fallback)
| Field | Value |
|-------|-------|
| Status | ❌ NOT CONFIGURED |
| Risk | MEDIUM — if Stripe fails, no payment fallback |
| Fix | Adyen merchant account |

### 18. VERCEL
| Field | Value |
|-------|-------|
| Status | ✅ LIVE |
| Plan | Pro (carlos-feiteiras-projects) |
| Region | cdg1 (Paris, single region) |
| Risk | MEDIUM — no multi-region |

---

## DEPENDENCY RISK MATRIX

| Provider | Configured | Production | Revenue impact | Risk |
|----------|-----------|------------|---------------|------|
| Supabase | ✅ | ✅ | CRITICAL | LOW |
| Vercel | ✅ | ✅ | CRITICAL | LOW |
| Anthropic | ✅ | ✅ | HIGH | LOW |
| Resend | ✅ | ✅ | MEDIUM | LOW |
| Upstash | ✅ | ✅ | HIGH | LOW |
| Stripe | ✅ TEST | ❌ LIVE | CRITICAL | HIGH |
| WhatsApp | ⚠️ PARTIAL | ❌ | MEDIUM | HIGH |
| Idealista | ❌ | ❌ | HIGH | HIGH |
| PagerDuty | ❌ | ❌ | SOC | HIGH |
| Casafari | ❌ | ❌ | MEDIUM | MEDIUM |
| Datadog | ❌ | ❌ | SOC | MEDIUM |
| SaltEdge | ❌ | ❌ | COMPLIANCE | MEDIUM |
