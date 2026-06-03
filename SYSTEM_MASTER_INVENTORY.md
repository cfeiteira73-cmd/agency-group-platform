# SYSTEM_MASTER_INVENTORY
Agency Group — Institutional Real Estate Capital Platform
Generated: 2026-05-31 | Evidence: Live codebase scan

---

## PLATFORM OVERVIEW
- **Domain**: https://www.agencygroup.pt
- **License**: AMI 22506 (Portugal)
- **Stack**: Next.js 15 + TypeScript (strict) + Supabase + Vercel + Upstash Redis
- **Markets**: Portugal + Spain (Madeira, Açores, Algarve, Lisboa, Porto, Madrid, Barcelona)
- **Commit range**: Wave 47 (Apr 2026) → Wave 58 (May 2026) | 715 total commits

---

## 1. REPOSITORIES
| Repo | Branch | Status |
|------|--------|--------|
| cfeiteira73-cmd/agency-group-platform | main | Active production |

---

## 2. API ROUTES — 542 total
### By domain (top-level)
acquisition, activities, admin, agent, ai, alerts, analytics, assets, audit, auth, automation, avm, banking, billing, booking, buyer-intelligence, buyers, campaigns, campanhas, capital, capital-execution, capital-intel, chat, collections, commercial, compliance, contact-enrichment, contacto, contacts, content, control-plane, deals, discovery, distribution, economics, enterprise, events, expansion, financial, forensics, governance, growth, healing, intelligence, investors, leads, legal, liquidity, market, market-data, matching, ml, monitoring, offmarket-leads, operations, opportunity, partners, pipeline, portal, properties, radar, reporting, revenue, security, settlements, sofia, sofia-agent, sre, system, valuation, workers

### Revenue-critical routes: **190**
### AI-consuming routes: **52**
### Security/audit routes: ~40
### Authentication routes: ~15

---

## 3. CRON JOBS — 41 active (0 orphans)
| Schedule | Route |
|----------|-------|
| Every 5 min | /api/cron/detect-incidents, /api/cron/self-heal, /api/cron/anomaly-monitor, /api/sre/self-heal, /api/cron/worker-processor |
| Every 10 min | /api/cron/runtime-recovery |
| Every 15 min | /api/cron/replay-dlq |
| Every 30 min | /api/cron/refresh-graph-views |
| Hourly | /api/cron/health-check, /api/cron/capture-drift-snapshot |
| Daily | 25+ daily crons (market refresh, ingestion, scoring, reporting) |
| Weekly | ml-training-sync, weekly-calibration |

---

## 4. AI SYSTEMS
| System | Route | Purpose |
|--------|-------|---------|
| Sofia Chat | /api/sofia/chat | Conversational SDR/ISA |
| Sofia OS | /api/sofia/os | 7-role autonomous agent |
| Sofia Script | /api/sofia/script | Sales script generation |
| Sofia Speak | /api/sofia/speak | HeyGen video synthesis |
| Sofia Agent (legacy) | /api/sofia-agent/chat | Original Sofia v1 |
| AVM | /api/avm | Automated Valuation Model |
| Radar | /api/radar | Deal radar + opportunity scoring |
| Content | /api/content | AI content generation |
| Draft Offer | /api/draft-offer | Legal offer generation |
| Juridico | /api/juridico | Legal AI assistant |
| Market Intelligence | /api/market-data | Market analysis |

---

## 5. CAPITAL SYSTEMS
| System | Module | Status |
|--------|--------|--------|
| Settlement State Machine | lib/capital/settlementStateMachine.ts | COMPLETE — 8 states immutable |
| Escrow Layer | lib/capital/escrowLayer.ts | COMPLETE — 72h max hold |
| Capital Intake | lib/capital/capitalIntake.ts | COMPLETE |
| Transaction Pipeline | lib/capital/transactionPipeline.ts | COMPLETE |
| Financial Finality Engine | lib/financial/financialFinalityEngine.ts | COMPLETE |
| Capital Execution Hardening | lib/capital/capitalExecutionHardening.ts | COMPLETE |
| Capital Matching Engine | lib/matching/capitalMatchingEngine.ts | COMPLETE |
| Ledger | lib/ledger/ | COMPLETE |
| Financial Rails | lib/financial-rails/ | COMPLETE |

---

## 6. SECURITY SYSTEMS
| System | Module | Status |
|--------|--------|--------|
| ASEL | lib/security/asel.ts | Wave 58 — complete |
| Global Security OS | lib/security/globalSecurityOS.ts | Wave 57 — complete |
| Institutional OS | lib/system/institutionalOS.ts | Wave 56 — complete |
| Live Security Hardening | lib/security/liveSecurityHardening.ts | Wave 51 |
| Absolute Security | lib/security/absoluteSecurityHardening.ts | Wave 52 |
| Secrets Vault | lib/security/secretsVault.ts | Complete |
| KMS Encryption | lib/security/kmsEnvelopeEncryption.ts | Complete |
| Intrusion Detection | lib/security/intrusionDetectionEngine.ts | Complete |
| Incident Response | lib/security/incidentResponseEngine.ts | Complete |

---

## 7. OBSERVABILITY SYSTEMS
| System | Route/Module | Frequency |
|--------|-------------|-----------|
| Reality Monitor | /api/monitoring/reality | On-demand |
| System Health Dashboard | /api/monitoring/dashboard | On-demand |
| Health Check | /api/system/health | Public |
| Self-Heal | /api/cron/self-heal | Every 5 min |
| Anomaly Monitor | /api/cron/anomaly-monitor | Every 5 min |
| Incident Detector | /api/cron/detect-incidents | Every 5 min |
| Drift Capture | /api/cron/capture-drift-snapshot | Hourly |
| Structured Logger | lib/logger.ts | All routes |

---

## 8. DATABASE
| Metric | Count |
|--------|-------|
| Total migrations | 277 |
| Tables defined | 627 |
| Foreign key references | 202 |
| RLS policies (Wave 47-58) | ~300+ |
| Indexes created | ~400+ |

### Key table families
- Capital: settlement_transitions, finality_records, liquidity_locks, escrow_records
- Audit: audit_log, forensic_audit_log, immutable_incident_log
- AI: learning_events, sofia_conversations, sofia_conversation_turns
- Security: soc_incidents, security_incidents, asel_defense_runs
- Market: market_data_cache, property_listings, deal_packs
- Infrastructure: ios_runtime_audits, reality_monitor_snapshots

---

## 9. PROVIDERS
| Provider | Status | Purpose |
|----------|--------|---------|
| Supabase | ✅ LIVE | Database + Auth + Storage |
| Upstash Redis | ✅ LIVE | Rate limiting + cache |
| Anthropic | ✅ LIVE | AI (Sofia, AVM, legal) |
| Resend | ✅ LIVE | Transactional email |
| HeyGen | ✅ LIVE | Sofia video synthesis |
| Notion | ✅ LIVE | CRM database |
| Google OAuth | ✅ LIVE | Authentication |
| Vercel | ✅ LIVE | Hosting + CDN + Edge |
| Sentry | ✅ CONFIGURED | Error tracking |
| Stripe | ⚠️ TEST MODE | Payments (sk_test_) |
| Idealista | ❌ NOT CONFIGURED | Market data |
| Casafari | ❌ NOT CONFIGURED | Market data |
| PagerDuty | ❌ NOT CONFIGURED | SOC alerting |
| Datadog | ❌ NOT CONFIGURED | SIEM |
| SaltEdge | ❌ NOT CONFIGURED | Bank feeds |
| GoCardless | ❌ NOT CONFIGURED | Open banking |
| WhatsApp | ❌ ACCESS TOKEN MISSING | Sofia WA channel |
| Adyen | ❌ NOT CONFIGURED | PSP fallback |

---

## 10. SECRETS (Vercel production)
Configured: 18+ environment variables including all critical non-external secrets
Not configured: Stripe live, Idealista, Casafari, PagerDuty, Datadog, SaltEdge, WhatsApp access token

---

## 11. INFRASTRUCTURE
- **Hosting**: Vercel (hobby plan, single region cdg1 — Paris)
- **DB**: Supabase (isbfiofwpxqqpgxoftph, eu-central-1 Frankfurt)
- **CDN**: Vercel Edge Network (global)
- **Cache**: Upstash Redis (configured)
- **Storage**: Supabase Storage
- **Auth**: Custom magic-link + NextAuth
- **Rate limiting**: Upstash Redis (distributed) with in-memory dev fallback

---

## 12. PAGES — 153 total
Portal pages, public marketing, deal room, investor portal, legal tools, AVM calculator, property search, blog
