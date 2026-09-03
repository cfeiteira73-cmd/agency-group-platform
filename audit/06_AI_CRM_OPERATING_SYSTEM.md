# 06 — AI & CRM OPERATING SYSTEM
**Agency Group | 2026-09-03**

---

## VERDICT: EXCEPTIONAL AI ARCHITECTURE. COMMERCIALLY DORMANT.

Sofia is the most differentiated asset in the platform. 7 roles, 8 tools, multilingual, 24/7 operation capability. 0 real conversations. The CRM has 18,042 contacts and 25,384 capital profiles — completely unactivated commercially.

**Score: 55/100** — Architecture: 9/10 · Commercial activation: 1/10

---

## SOFIA AI (VERIFIED STATE)

| Component | Status |
|-----------|--------|
| Model | claude-sonnet-4-6 |
| Roles | 7 (residential, commercial, investment, developer, AVM, juridico, multilingual) |
| Tools | 8 (property search, AVM, market data, CRM update, sofia_conversations, etc.) |
| Widget | Live on agencygroup.pt |
| Languages | EN, PT, FR, DE, ZH, IT |
| Real conversations | 0 (sofia_conversations table empty) |
| WhatsApp integration | BUILT but INACTIVE (token missing) |
| History persistence | ✅ Implemented (Wave 2) |
| Response time target | < 3s (untested) |

**Sofia roles and use cases:**
- Residential: Buyer qualification, property matching, viewing scheduling
- Commercial: Commercial RE inquiries, yield analysis
- Investment: Investor mandate intake, deal briefing
- Developer: Developer sell-out inquiries
- AVM: Instant property valuations for leads
- Juridico: Legal guidance (CANNOT replace lawyer — always adds disclaimer)
- Multilingual: Auto-detects language, responds in buyer's language

---

## CRM STATE (VERIFIED)

| Table | Rows | Quality |
|-------|------|---------|
| leads | 18,042 | 4/10 (99% no email) |
| capital_profiles | 25,384 | 3/10 (uncontacted, unenriched) |
| contacts (Notion) | DEPRECATED | Use Supabase |
| sofia_conversations | 0 | Empty |
| properties | UNKNOWN | Not audited this session |
| deals | UNKNOWN | Not audited this session |

---

## AUTOMATION ARCHITECTURE

| Layer | Status |
|-------|--------|
| 41 Vercel cron jobs | Code exists, passive (trigger-based) |
| n8n orchestration | DESIGNED, NOT DEPLOYED |
| WhatsApp Sofia | BUILT, NOT ACTIVE |
| Email sequences (Resend) | Built, 113 manually sent |
| Lead scoring | Built (A+/A/B tiers) |
| Developer alerts | Built, not triggered |
| Follow-up sequences | Built in n8n, not running |

**Critical gap:** n8n not deployed = zero automated follow-up. Every lead requires manual action from Carlos.

---

## AI OPERATING SYSTEM — 7 ENGINES SUPPORTED

| Engine | AI Asset | Status |
|--------|----------|--------|
| E1 Private RE | Sofia buyer qualification | Live, 0 uses |
| E2 Developments | Sofia developer intake | Live, 0 uses |
| E3 Investment | Sofia investor matching | Live, 0 uses |
| E4 Network | AI co-agency matching | PLANNED |
| E5 Intelligence | Semantic search + AVM | Built, unverified |
| E6 AI | Sofia + all AI features | Core product |
| E7 Data | Conversation intelligence | 0 data (0 conversations) |

---

## IMMEDIATE ACTIONS

1. **Set WHATSAPP_ACCESS_TOKEN** (30 min) — Activates Sofia on WhatsApp immediately
2. **Deploy n8n to Railway** (4h) — Activates all automated workflows
3. **Generate 50 real Sofia conversations** — Share link with real buyers in calls
4. **Test Sofia in all 6 languages** — Verify quality before wide distribution
5. **Map CRM pipeline stages to reality** — Current stages may not reflect actual process
