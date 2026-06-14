# 10 — SOFIA GENOME
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## WHAT SOFIA IS

Sofia is Agency Group's AI-powered real estate sales agent. Powered by Anthropic Claude (claude-sonnet-4-6), she is designed to qualify buyers, match properties, generate deal packs, and escalate to Carlos.

**Reality: Sofia has never spoken to a single buyer. sofia_conversations: 0 rows.**

---

## SOFIA ARCHITECTURE

```
Model:     claude-sonnet-4-6 (Anthropic)
SDK:       @anthropic-ai/sdk ^0.80.0
Mode:      Multi-turn conversation + 8 agentic tools
Memory:    Supabase sofia_conversations (persistent, 0 rows)
Channels:  Web chat | WhatsApp | Video (HeyGen) | Voice (TTS)
Languages: 6 (PT/EN/FR/DE/ES/IT)
```

---

## SOFIA'S TOOLS (8 in agentic loop)

| Tool | Purpose | DB Action | Status |
|------|---------|----------|--------|
| search_contacts | Find buyer in CRM | SELECT contacts | Built |
| create_contact | Create new buyer | INSERT contacts | Built |
| update_contact | Update buyer info | UPDATE contacts | Built |
| search_properties | Find matching props | SELECT properties | Built |
| create_match | Log a buyer-property match | INSERT matches | Built |
| generate_deal_pack | Generate deal PDF | INSERT deal_packs | Built |
| send_notification | Alert Carlos | Push notification | Built |
| log_activity | Log interaction | INSERT activities | Built |

---

## SOFIA'S SYSTEM PROMPT

```
Sofia is built with a layered prompt architecture:

Layer 1: Identity
  "You are Sofia, Agency Group's AI real estate advisor.
   You represent Carlos Feiteira AMI 22506..."

Layer 2: Persona
  - Speaks in Portuguese, English, French (auto-detect)
  - Warm but professional tone
  - Knows all listed properties
  - Can access buyer database

Layer 3: Goals
  - Qualify buyer (budget, timeline, location, type)
  - Match to available properties
  - Book viewing if match score ≥70
  - Escalate to Carlos for closing

Layer 4: Constraints
  - Never make false promises on price
  - Never share other buyers' names
  - Always confirm listing availability
  - Escalate if buyer asks for terms

Layer 5: Tools
  - Can search and create CRM records
  - Can generate deal packs
  - Can notify Carlos immediately
```

---

## 16 SPECIALIZED AI AGENTS

| Agent | Purpose | Status |
|-------|---------|--------|
| leadQualificationAgent | Qualify new leads | Built, 0 uses |
| dealClosingAgent | Close deals | Built, 0 uses |
| followUpAgent | Follow-up sequences | Built, 0 uses |
| forecastingAgent | Revenue forecasting | Built, 0 uses |
| pricingStrategyAgent | Pricing recommendations | Built, 0 uses |
| revenueLeakAgent | Revenue leak detection | Built, 0 uses |
| kpiIntelligenceAgent | KPI analysis | Built, 0 uses |
| conversionOptimizationAgent | Conversion improvements | Built, 0 uses |
| pipelineStallAgent | Stalled deal detection | Built, 0 uses |
| growthStrategyAgent | Growth strategy | Built, 0 uses |
| riskGovernanceAgent | Risk management | Built, 0 uses |
| systemHealthAgent | System health | Built, unknown |
| dataIntegrityAgent | Data validation | Built, unknown |
| decisionArbitrationAgent | Decision support | Built, 0 uses |
| agentSupervisor | Supervisor layer | Built, unknown |
| workflowAutomationAgent | Workflow triggers | Built, 0 uses |

---

## SOFIA CHANNELS

### 1. Web Chat Widget (BUILT, 0 USES)
```
Component:  SofiaAgentWidget.tsx (751 lines)
Route:      /api/sofia-agent/chat
Location:   Floats on ALL pages (excluded: /blog, /faq)
Mode:       Client-side streaming (SSE)
History:    sofia_conversations table (0 rows)
Status:     BUILT AND WORKING — nobody has used it
```

### 2. WhatsApp (BUILT, INACTIVE)
```
Provider:   Twilio WhatsApp Business
Webhook:    /api/whatsapp/webhook (FIXED — timingSafeEqual)
Routes:     5 routes built
Status:     WHATSAPP_ACTIVE env var NOT SET
To activate: 
  1. Set WHATSAPP_ACTIVE=true in Vercel
  2. Configure Meta Business Manager
  3. Set webhook URL to /api/whatsapp/webhook
Time: 2-4 hours
```

### 3. HeyGen Video (CONFIGURED, NEVER USED)
```
API Key:    HEYGEN_API_KEY (configured)
Avatar ID:  HEYGEN_AVATAR_ID (configured)
Voice ID:   HEYGEN_VOICE_ID (configured)
Routes:     /api/heygen/* (built)
Status:     Configured but never invoked
Use case:   Video presentation to qualified buyer
```

### 4. Voice/TTS (BUILT, NEVER USED)
```
Route:      /api/tts
Engine:     Text-to-speech (vendor unknown)
Status:     Built, never called
```

---

## SOFIA CONVERSATION FLOW

```
CONFIGURED FLOW:
  Visitor arrives → Sofia widget appears
       ↓
  Sofia: "Olá! Sou a Sofia da Agency Group. Em que posso ajudar?"
       ↓
  Buyer: "Procuro apartamento em Lisboa €800K"
       ↓
  Sofia: [tool: search_properties zone=Lisboa tipo=apartamento preco_max=800000]
       ↓
  Sofia: "Tenho 3 propriedades que podem interessar..."
       ↓
  Sofia: [tool: create_contact name=... email=...]
       ↓
  Sofia: [tool: create_match property_id=... contact_id=... score=85]
       ↓
  Sofia: "Posso agendar uma visita para..."
       ↓
  Sofia: [tool: send_notification "Carlos — novo lead qualificado!"]

ACTUAL FLOW (today):
  Visitor arrives → Sofia widget appears → Nobody interacts
  → 0 conversations → 0 leads captured → 0 deals
```

---

## PROMPT CACHING

```
System:   Anthropic prompt caching (5-min TTL)
Applied:  /api/juridico (legal AI queries)
Status:   Active on juridico route
Sofia:    Unknown if caching applied
Benefit:  Reduces API cost for repeated system prompts
```

---

## SOFIA QUALITY ASSESSMENT

| Dimension | Status | Score |
|-----------|--------|-------|
| Architecture | Complete | 95/100 |
| Multi-language | 6 languages | 90/100 |
| Tool integration | 8 tools | 90/100 |
| CRM integration | Full CRUD | 90/100 |
| Memory | Persistent | 80/100 |
| Multi-channel | 4 channels built | 75/100 |
| **Production use** | **0 conversations** | **0/100** |
| **Revenue impact** | **€0** | **0/100** |

**Sofia is one of the most sophisticated AI real estate agents in existence. She has zero conversations to her name.**

---

## WHAT SOFIA NEEDS TO WORK

```
1. A visitor to the website who engages with the widget
2. OR WhatsApp activated (2-4 hours work)
3. OR Carlos to send the website URL to buyers he's contacted
4. OR a marketing campaign driving traffic

None of these require any code changes.
Sofia is ready. The buyers need to find her.
```

---

*Evidence: Sofia widget code, /api/sofia-agent/* routes, sofia_conversations=0 (Supabase), forensic-inventory/09_SOFIA_MAP.md*
