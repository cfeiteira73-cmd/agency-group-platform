# SOFIA TRUTH REPORT
Agency Group | 2026-06-05 | Evidence: lib/ai/sofia/sofiaOS.ts + route files

---

## ROUTES
| Route | Status | Auth | Note |
|-------|--------|------|------|
| /api/sofia/chat | ✅ LIVE | isPortalAuth + rate-limit | Primary chat interface |
| /api/sofia/os | ✅ LIVE | INTERNAL_API_SECRET | 7-role OS |
| /api/sofia/script | ✅ LIVE | isPortalAuth | Script generation |
| /api/sofia/speak | ✅ LIVE | isPortalAuth | HeyGen video |
| /api/sofia/session | ✅ LIVE | isPortalAuth | Session management |
| /api/sofia-agent/chat | ⚠️ LEGACY | Old auth | Duplicate — no monitoring |
| /api/sofia-agent/session | ⚠️ LEGACY | Old auth | Duplicate — should deprecate |

---

## ROLES — CONFIRMED IN CODE
```typescript
// lib/ai/sofia/sofiaOS.ts — verified
export type SofiaRole =
  | 'SDR' | 'ISA' | 'BUYER_QUALIFIER' | 'SELLER_QUALIFIER'
  | 'CAPITAL_INTRODUCER' | 'DEAL_CONCIERGE' | 'INVESTOR_ASSISTANT'
```

All 7 roles: ✅ IMPLEMENTED

---

## ENTITY EXTRACTION (confirmed in code)
- Budget: regex match on €/amount patterns ✅
- Locations: Lisboa, Porto, Cascais, Algarve, Madrid, Barcelona, + 15 more ✅
- Timeline: months/weeks/days pattern ✅
- Intent: BUY/SELL/INVEST detection ✅
- Urgency: urgent/imediato/asap detection ✅

---

## ESCALATION LOGIC (confirmed in code)
- Budget ≥ €3M → immediate escalation to ADMIN_EMAIL ✅
- Score ≥ 85 + URGENT → escalation ✅
- SOC integration → SECURITY_ORCHESTRATOR ✅

---

## CHANNELS
| Channel | Status | Blocker |
|---------|--------|---------|
| Web chat | ✅ OPERATIONAL | None |
| Email follow-ups | ✅ OPERATIONAL | Resend configured |
| WhatsApp | ❌ BLOCKED | WHATSAPP_ACCESS_TOKEN = PREENCHER |
| HeyGen Video | ✅ OPERATIONAL | Key configured |

---

## KNOWN ISSUES
1. **Market data = static**: Sofia gives price estimates from 2026 static medians, not live Idealista
2. **Legacy routes**: /api/sofia-agent/ bypasses monitoring and new rate limiting
3. **No feedback loop**: Sofia learns from interactions but ML model has no real training data
4. **Memory**: Conversation memory requires W54 migration (000151) applied to production

---

## SILENT FAILURE RISKS
1. WhatsApp: Sofia will attempt WA but silently fail (no error visible to user)
2. Market prices: Will quote static data as if real — could mislead serious investors
3. HeyGen: If API limit hit, video generation fails silently

---

## VERDICT
Sofia architecture: ✅ COMPLETE (7 roles, qualification, escalation, memory)
Sofia web channel: ✅ OPERATIONAL
Sofia WhatsApp: ❌ BLOCKED (access token)
Sofia market data: ⚠️ STATIC fallback only
Sofia legacy routes: ⚠️ Should deprecate /api/sofia-agent/
