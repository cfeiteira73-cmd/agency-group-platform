# 09 — SOFIA AI MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## SOFIA OVERVIEW

Sofia is the AI-powered sales and qualification agent embedded in Agency Group's platform. She is:
- Powered by **Anthropic Claude** (@anthropic-ai/sdk ^0.80.0)
- Available via web chat widget on agencygroup.pt
- Accessible via portal for authenticated agents
- Configured for WhatsApp (inactive)

---

## USAGE STATISTICS (REAL DATA)

| Metric | Value |
|--------|-------|
| Total conversations | 0 |
| Total message turns | 0 |
| Total sessions | 0 |
| Last conversation | Never |

**Sofia has never been used by a real user.**

---

## TECHNICAL ARCHITECTURE

### Core File: lib/ai/sofia/sofiaOS.ts
The main Sofia orchestration system.

### Routes
| Route | Purpose |
|-------|---------|
| /api/sofia-agent/chat | Main chat endpoint |
| /api/sofia-agent/session | Session management |
| /api/sofia/chat | Alternative chat route |
| /api/sofia/session | Session handler |
| /api/sofia/script | Call script generation |
| /api/sofia/speak | TTS integration |
| /api/sofia/os | Sofia OS status |

### Database Tables
| Table | Count | Status |
|-------|-------|--------|
| sofia_conversations | 0 | Empty |
| sofia_conversation_turns | 0 | Empty |

---

## SOFIA ROLES

| Role | Context | Capability |
|------|---------|-----------|
| Buyer qualification | Web widget | Qualifies budget, timeline, preferences |
| Property matching | Portal | Finds matching properties |
| Objection handling | Web/WhatsApp | Responds to concerns |
| Deal pack generation | Portal | Creates offer documents |
| CRM extraction | Portal | Extracts contact data from text |
| Call script generation | /api/sofia/script | Creates outreach scripts |
| Market briefing | Portal | Market intelligence summaries |
| Meeting prep | /api/crm/meeting-prep | Pre-meeting research |

---

## AI GATEWAY

| Component | File | Purpose |
|-----------|------|---------|
| AI Gateway | lib/ai/gateway.ts | Central API coordinator |
| Budget Enforcer | lib/ai/budgetEnforcer.ts | Cost control |
| Cost Tracker | lib/ai/costTracker.ts | Token tracking |
| Decision Engine | lib/ai/decisionEngine.ts | Routing decisions |
| Policy Engine | lib/ai/policyEngine.ts | Response policy |
| Token Governor | lib/ai/tokenGovernor.ts | Token limits |
| Feedback Engine | lib/ai/feedbackEngine.ts | Learning from outcomes |
| Agent Registry | lib/ai/agentRegistry.ts | Multi-agent registry |
| Memory | lib/ai/memory/index.ts | Conversation memory |

---

## SOFIA PROMPTS (lib/ai/contracts/prompts.ts)

Sofia's system prompt includes:
- Role: "Senior real estate advisor at Agency Group"
- Context: AMI 22506, markets, pricing
- Qualification criteria: budget, timeline, property type, location
- Language: Auto-detect (PT/EN/FR/DE/AR/ZH)
- CRM integration: Extracts and creates contacts
- Escalation: Routes to human agent when needed

---

## AI AGENTS (lib/agents/implementations/)

Beyond Sofia, the system has 15 specialized AI agents:

| Agent | Purpose |
|-------|---------|
| leadQualificationAgent.ts | Score and qualify leads |
| dealClosingAgent.ts | Close deals with AI |
| followUpAgent.ts | Automated follow-ups |
| forecastingAgent.ts | Revenue forecasting |
| pricingStrategyAgent.ts | Dynamic pricing |
| revenueLeakAgent.ts | Revenue leak detection |
| kpiIntelligenceAgent.ts | KPI analysis |
| conversionOptimizationAgent.ts | Conversion optimization |
| pipelineStallAgent.ts | Stall detection |
| growthStrategyAgent.ts | Growth recommendations |
| riskGovernanceAgent.ts | Risk management |
| systemHealthAgent.ts | System monitoring |
| dataIntegrityAgent.ts | Data quality |
| decisionArbitrationAgent.ts | Multi-agent arbitration |
| agentSupervisor.ts | Agent oversight |
| workflowAutomationAgent.ts | Workflow automation |

---

## AGENT SUPERVISOR PATTERN

```
lib/agents/implementations/agentSupervisor.ts
  ↓
  Routes to specialized agents based on context
  ↓
  Each agent:
    1. Reads context from Supabase
    2. Calls Claude API with specific prompt
    3. Executes 8-tool loop (if agentic)
    4. Writes results to Supabase
    5. Fires events via event bus
```

---

## 8-TOOL LOOP (Agentic CRM Mode)

When Sofia is in agentic mode, she has access to:
1. `search_contacts` — Search CRM contacts
2. `create_contact` — Create new contact
3. `update_contact` — Update contact data
4. `search_properties` — Find properties
5. `create_match` — Create buyer-property match
6. `generate_deal_pack` — Generate deal package
7. `send_notification` — Send alerts
8. `log_activity` — Log CRM activity

---

## MEMORY SYSTEM

| Component | File | Type |
|-----------|------|------|
| AI Memory | lib/ai/memory/index.ts | Conversation memory |
| Runtime Memory | lib/runtime/memory.ts | Session state |
| Cold Memory | lib/runtime/coldMemory/ | Long-term analytics |
| Vector Memory | lib/runtime/coldMemory/vectorMemory.ts | Semantic memory |
| AI Memory Vault | lib/vault/aiMemoryVault.ts | Persistent vault |

---

## HEYGEN VIDEO INTEGRATION

| Component | Route | Status |
|-----------|-------|--------|
| Start session | /api/heygen/start | Configured |
| Video generation | /api/heygen/video | Configured |
| Ice breaker | /api/heygen/ice | Configured |
| Avatar config | HEYGEN_AVATAR_ID env var | Set |
| Voice config | HEYGEN_VOICE_ID env var | Set |

Sofia can generate personalized video messages via HeyGen. Status: Configured, never used.

---

## WHATSAPP INTEGRATION

| Component | Status |
|-----------|--------|
| API credentials | Configured in env |
| WHATSAPP_ACTIVE env var | NOT SET (inactive) |
| Webhook route | /api/whatsapp/webhook (FIXED June 2026) |
| Send route | /api/whatsapp/send |
| Status route | /api/whatsapp/status |

**Sofia cannot reach users via WhatsApp until WHATSAPP_ACTIVE=true is set.**

---

## VOICE / TTS

| Component | Route | Status |
|-----------|-------|--------|
| Text-to-speech | /api/tts | Configured |
| Voice search | /api/voice-search | Configured |
| Voice note processing | /api/crm/voice-note | Configured |
| Voz processing | /api/voz/process | Configured |

---

*Evidence: app/api/sofia*, lib/ai/, lib/agents/ directory scan, Supabase REST API — 2026-06-11*
