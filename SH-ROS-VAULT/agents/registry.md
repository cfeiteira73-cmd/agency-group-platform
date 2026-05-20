# SH-ROS Agent Registry
## Version: 1.0.0 | Created: 2026-05-19

> Source of truth for all AI agents in the SH-ROS system.
> Changes to agent configs must be reflected here AND in lib/ai/agentRegistry.ts.

---

## Agent Definitions

### sofia-chat
- **ID**: `sofia-chat`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Customer-facing conversational AI. Handles buyer inquiries via WhatsApp and web chat.
  Recommends properties, answers questions about the Portuguese real estate market, qualifies leads.
- **Risk Level**: MEDIUM (public-facing, handles PII)
- **Monthly Token Budget**: 5,000,000 tokens (~€25/month)
- **Triggers**: WhatsApp inbound, web chat widget, `/api/sofia-agent/chat`
- **Languages**: Portuguese, English, French, Spanish, Chinese (basic)
- **Context window**: Last 20 messages from `sofia_conversations` table
- **Fallback**: Static FAQ response if circuit open

---

### crm-orchestrator
- **ID**: `crm-orchestrator`
- **Model**: `claude-opus-4-6`
- **Purpose**: Agentic CRM loop. Runs 8-tool loop to analyze deals, enrich contacts,
  generate outreach, schedule follow-ups, and update pipeline.
- **Risk Level**: HIGH (writes to database, sends communications)
- **Monthly Token Budget**: 2,000,000 tokens (~€60/month)
- **Triggers**: Manual agent trigger, `match_created` HIGH score event, `deal_lost` event
- **Tools available**: searchContacts, getPropertyDetails, computeMatchScore, sendEmail,
  scheduleFollowUp, updateDealStage, generateDealPack, queryAVM
- **Max loop iterations**: 8 (hardcoded limit to prevent runaway cost)
- **Fallback**: Queue for human agent review

---

### avm-engine
- **ID**: `avm-engine`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Automated Valuation Model. Generates property price estimates with 6-month forecast
  and ±confidence interval. Uses comparable sales from Supabase + market trend data.
- **Risk Level**: MEDIUM (output used in financial documents)
- **Monthly Token Budget**: 1,000,000 tokens (~€5/month)
- **Triggers**: `/api/avm/estimate`, deal pack generation, property listing creation
- **Output format**: `{ estimatedValue, confidenceInterval, forecast6m, comparables[], marketTrend }`
- **Fallback**: Market median per m² × property area

---

### lead-scorer
- **ID**: `lead-scorer`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Qualifies inbound leads. Scores buyer intent (0–100) based on budget clarity,
  timeline urgency, property type specificity, and engagement signals.
- **Risk Level**: LOW (no writes, advisory only)
- **Monthly Token Budget**: 2,000,000 tokens (~€10/month)
- **Triggers**: New contact creation, WhatsApp conversation analysis, form submission
- **Score bands**: Hot (≥ 80), Warm (60–79), Cold (< 60)
- **Fallback**: Score 50 (medium, manual review)

---

### followup-generator
- **ID**: `followup-generator`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Generates personalized follow-up messages for deals. Adapts tone and content
  to buyer nationality, deal stage, and time since last contact.
- **Risk Level**: LOW (advisory only — agent approves before send)
- **Monthly Token Budget**: 3,000,000 tokens (~€15/month)
- **Triggers**: 3-day, 7-day, 14-day, 30-day follow-up crons
- **Output**: Draft message in buyer's preferred language + suggested send time
- **Fallback**: Template-based follow-up from `lib/templates/followup/`

---

### deal-risk
- **ID**: `deal-risk`
- **Model**: `claude-opus-4-6`
- **Purpose**: Assesses deal-specific risks. Identifies red flags (title issues, permit problems,
  buyer financing risk, legal encumbrances) before CPCV signing.
- **Risk Level**: HIGH (output affects legal+financial decisions)
- **Monthly Token Budget**: 500,000 tokens (~€15/month)
- **Triggers**: Deal stage PROPOSAL → CPCV transition
- **Output**: `{ riskLevel, redFlags[], mitigations[], recommendation }`
- **Fallback**: Generic risk checklist from `/SH-ROS-VAULT/prompts/`

---

### legal-advisor
- **ID**: `legal-advisor`
- **Model**: `claude-opus-4-6`
- **Purpose**: Portuguese real estate law advisor. Covers 10 legal areas: CPCV, IMT/IMI,
  NHR tax regime, Golden Visa (post-2023 rules), co-ownership, mortgage release,
  urban rehabilitation, rural land, timeshare, and commercial property.
- **Risk Level**: CRITICAL (legal advice — must include disclaimer)
- **Monthly Token Budget**: 1,000,000 tokens (~€30/month)
- **Triggers**: `/api/legal/query`, deal risk assessment
- **Mandatory disclaimer**: "This is general information only. Consult a licensed Portuguese lawyer."
- **Prompt caching**: System prompt cached (>2048 tokens) — ~60% cost reduction
- **Fallback**: ESCALATE to human (no legal fallback permitted)

---

### daily-brief
- **ID**: `daily-brief`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Generates morning briefing for agents at 07:00 UTC. Includes: new leads overnight,
  deals needing attention, market news summary, priority actions for the day.
- **Risk Level**: LOW (informational only)
- **Monthly Token Budget**: 500,000 tokens (~€2.50/month)
- **Triggers**: Cron `0 7 * * *` via `/api/cron/daily-brief`
- **Output**: Push notification + Notion page update + optional email
- **Fallback**: Static "No brief available today" message

---

### photo-scorer
- **ID**: `photo-scorer`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Rates listing photo quality (0–100) and identifies issues (poor lighting,
  clutter, bad angles). Triggers virtual staging suggestion via Stability AI if score < 60.
- **Risk Level**: LOW (advisory)
- **Monthly Token Budget**: 1,000,000 tokens (~€5/month)
- **Triggers**: Property listing creation/update, portal upload
- **Output**: `{ score, issues[], virtualStagingRecommended, improvedOrderSuggestion }`
- **Fallback**: Score 70 (no action triggered)

---

### heygen-script
- **ID**: `heygen-script`
- **Model**: `claude-haiku-4-5`
- **Purpose**: Generates scripts for HeyGen avatar videos. Used for personalized property
  presentation videos featuring Sophia avatar in buyer's language.
- **Risk Level**: LOW (script review before video generation)
- **Monthly Token Budget**: 500,000 tokens (~€2.50/month)
- **Triggers**: Manual request from agent, deal pack generation for HNWI buyers
- **Output**: Video script (max 90 seconds) + voice direction notes
- **Fallback**: Template script from `/SH-ROS-VAULT/prompts/heygen-templates/`
