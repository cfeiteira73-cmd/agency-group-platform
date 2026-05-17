# Global Positioning Truth Report
AGENCY GROUP SH-ROS · 2026-05-17

---

## Core Identity Assessment

**Claim:** "AI-native Revenue Operating System for Real Estate"

**Is it defensible?**

The claim holds for the parts that exist. The codebase confirms:
- AI-native ingestion pipeline (vision, OCR, voice, URL scraping) — real and functional
- Revenue attribution (commission calculations at signal level, funnel predictions) — real, though some models are heuristic
- Operating system posture (daily brief + action queue + execution layer) — real structure exists

What makes it partially defensible and partially aspirational:
- "Closed-loop" is the centerpiece of the positioning. A genuine closed loop requires: action → outcome → model recalibration. The recalibration engine exists (`lib/intelligence/recalibrationEngine.ts`) but it has no real closed deal data feeding it at this stage. The loop is architecturally complete but informationally empty — it cannot yet self-improve from real outcomes.
- "Self-Healing Revenue Operating System" (SH-ROS) implies autonomous correction. The `lib/ops/selfHealing.ts` module exists, but at current scale it cannot heal what it has not learned. The "self-healing" narrative is a future-state claim presented as present-state capability.
- "Every agent decision is made with full revenue context" — true for signals and daily brief. Not yet true for the conversion command page, which runs in demo mode with hardcoded baseline probabilities.

**Verdict:** The identity is defensible as a directional category claim and architectural reality. It becomes fully defensible when the first 90 days of real deal outcomes are fed back into the models.

---

## Competitive Differentiation (Evidence-Based)

### vs Zillow / Idealista (Portals)

**What SH-ROS has that portals don't:**
- Multimodal ingestion: `lib/property-ai/ingestion/` — visionAnalyzer, ocrDocumentIntelligence, voiceIntelligence, urlScraper. Portals accept photos and a form.
- Agent-side action intelligence: `lib/scoring/signalDetector.ts` produces actionable signals (price reduction, stale listing, below AVM) that fire to the agent. Portals surface these passively or not at all.
- Buyer behavioral profiling: `lib/buyer-intelligence/buyerIntentProfiler.ts` classifies intent within a session. Portals report anonymous page views.
- Commission attribution per action: `signalDetector.ts` attaches `revenue_impact` (€) to every signal. Portals have no concept of commission attribution.

**The portal comparison is easy to win on paper.** SH-ROS is an agent tool, not a consumer portal. The comparison is valid for investor decks but not for agent onboarding (agents already know portals are not operational tools).

### vs Salesforce / HubSpot (CRMs)

**What SH-ROS has that CRMs don't:**
- Property-specific AI pipeline: no CRM has vision analysis, energy certificate OCR, or URL scraping for property ingestion.
- Zone-calibrated market data: `lib/market/zones.ts` — 80+ Portuguese zones with absorption rates, demand scores, and international buyer percentages. CRMs have no real estate market awareness.
- Economic attribution layer: `lib/commercial/revenueAttribution.ts`, `lib/commercial/revenueLeakage.ts` — per-listing monthly revenue leakage detection. HubSpot has deal revenue tracking but no property-specific leakage detection.
- Morning brief with € impact: `app/dashboard/daily-brief/` — the brief surfaces expected daily opportunity in €, not just "tasks due today."

**The CRM comparison is the strongest competitive argument.** CRMs are genuinely blind to real estate economics. A €2M deal closing is just a "deal stage update" in Salesforce. In SH-ROS, it recalibrates zone pricing models and buyer profiles.

### vs Compass (Agent-focused proptech)

Compass built a strong UI and acquired CoStar data. It has an agent-facing CRM with some AI features (AI-generated listing descriptions, basic market reports). What it lacks:
- Pre-execution simulation layer: Compass has no equivalent to SH-ROS's simulation → approve → execute pattern. Agents at Compass make pricing decisions without a modeled € impact preview.
- Multimodal ingestion at the property level: Compass relies on manual photo upload + form fill.
- Session-level buyer intent: Compass does not profile buyer intent from behavioral signals within a browsing session.
- Portuguese/Iberian market calibration: Compass is US-centric. Applying it to Portuguese luxury real estate (200+ day DOM in Algarve, 78% international buyer share in Quinta do Lago) requires market data it does not have.

### vs AI-native startups (Sierra, Conversica, etc.)

Sierra and Conversica are AI conversation platforms — they handle buyer communication via AI chat but do not touch property valuation, signal detection, or portfolio intelligence. They compete with the Sofia agent widget, not with SH-ROS's core intelligence layer.

The more relevant AI-native comparison is **Ylopo** (US buyer behavior AI for real estate) and **Homebot** (portfolio intelligence). Neither operates in Portugal, neither has the closed-loop economic attribution, and neither has multimodal property ingestion.

**The unique claim:** The combination of property-level AI ingestion + zone-calibrated market intelligence + session-level buyer profiling + economic attribution per action is not replicated by any identified competitor. This is a genuine white space, not marketing copy.

---

## The 5 Moats — Evidence Score

### Economic Moat: 3/5

**Evidence:** Signal detector attaches € revenue impact to every signal. Daily brief surfaces estimated daily opportunity in €. Commission calculation (5% × price × p_close) is wired into the conversion command page. AVM module exists (`lib/valuation/avm.ts`).

**Why not 5/5:** The economic models are heuristic, not empirically calibrated. The conversion probabilities (p_close = 0.08 baseline) are hardcoded, not learned from historical deal data. Revenue attribution deepens to a genuine moat only after 200–500 closed deals feed back into the models. Currently the moat is architectural promise, not data-proven advantage.

### Behavioral Moat: 2/5

**Evidence:** Daily brief is habit-forming by design. Session-level buyer intent profiler exists architecturally. The morning brief → action queue → execution loop is structurally present.

**Why not higher:** The buyer intent profiler is non-functional in distributed serverless deployment (in-memory singleton, state lost between function invocations). The behavioral moat requires persistent session data accumulating over time — which cannot happen until the profiler is backed by Redis. No actual behavioral patterns have been collected yet. The moat is designed but not yet built.

### Operational Moat: 4/5

**Evidence:** 15-minute onboarding claim is plausible given the auth system (HMAC cookie, no complex SSO) and the structured dashboard. The agent connects, sets AMI number, and starts receiving briefs. `lib/ops/selfHealing.ts`, `lib/ops/featureFlags.ts`, `lib/ops/governance.ts` suggest mature operational infrastructure.

**Why not 5/5:** The properties page mixes English and Portuguese. No active nav state. The conversion command runs in demo mode. These are onboarding friction points that undercut the "15-minute time to value" claim for non-technical agents.

### Distribution Moat: 2/5

**Evidence:** Referral system and partner tiering exist (`lib/commercial/partnerTiering.ts`). Network effects from shared zone data are real — any agent's closed deal recalibrates zone models for all agents.

**Why not higher:** With a single agency (Agency Group, AMI 22506), there is no multi-agent network effect yet. The distribution moat is predicated on having a network. At current scale it is a hypothesis, not a realized advantage. The viral referral loop, deal-sharing, and collaborative intelligence require a minimum viable network of ~50 agents to produce meaningful signal.

### AI Moat: 4/5

**Evidence:** 10 Claude Opus calls confirmed across the ingestion pipeline. Purpose-built prompts for Portuguese real estate (energy certificates, habitation licenses, Portuguese zone names). 80+ zone dataset calibrated for PT market. Signal thresholds tuned for Portuguese DOM medians (35 days in Chiado vs. 300 days in Quinta do Lago). The AI is real estate-specific, not generic.

**Why not 5/5:** All models use heuristic weights, not learned parameters. The closed-loop training data that would compound the AI moat does not yet exist. Voice intelligence is analyzing filenames, not audio content. Prompt caching is not implemented, which is a cost inefficiency but not a moat gap. The AI moat becomes significantly stronger after 6–12 months of production operation with real closed deals.

---

## Market Readiness Assessment

### Portugal

**What's ready today:**
- Full ingestion pipeline (vision, OCR, URL scraping) for Portuguese properties
- 80+ zone market data with Q1 2026 benchmarks from Portuguese sources
- Signal detection calibrated for Portuguese DOM medians and zone demand scores
- Dashboard with Portuguese language (partial)
- Agency Group brand identity and AMI 22506 positioned

**What's missing:**
- Voice intelligence (Whisper integration)
- Real deal data feeding the recalibration engine
- Fully Portuguese UI (nav, status labels, button text)
- Active nav state, responsive design for tablet
- Multi-agent deployment (today it is single-agency)

**Readiness: 6/10** — Functional for a single agency managing its own portfolio. Not ready for a SaaS launch to 100 agents.

### Iberia (Spain)

**What would need to change:**
- Idealista regex already handles `.es` domain — scraper is partially ready
- Zone data needs Spanish cities: Madrid (Salamanca, Chamberí), Barcelona (Eixample, Gràcia), Marbella, Valencia
- Regulatory layer: Spain uses different energy certificate format (IDAE), different property register (Registro de la Propiedad), different taxes (ITP, IVA rules differ by CCAA)
- Currency is EUR — no conversion needed
- Spanish language localization throughout the app

**Readiness: 3/10** — Architecture is transferable. Data and localization are missing. Would require ~3 months of market data work plus regulatory compliance.

### Europe

**What's needed:**
- Zone datasets for France (notaires.fr data), Germany (Gutachterausschüsse), UK (Land Registry, Rightmove scraper exists)
- Currency handling: GBP for UK
- Regulatory compliance: GDPR Article 22 for automated decision-making affecting property values; each country's professional licensing requirements
- Multilingual UI: `lib/property-ai/listing-generator/multilingualAdapter.ts` already handles multiple languages, but the dashboard is PT/EN only
- Energy certificate formats differ by country (UK EPC, French DPE, German Energieausweis)
- Legal document types differ (UK: Land Registry title deeds; France: acte de vente; Germany: Grundbuchauszug)

**Readiness: 2/10** — Strong architectural foundation, but meaningful localization and regulatory work required per country. Not a 3-month project.

### Global

**What's needed:**
- Currency conversion layer throughout the entire pricing stack
- Non-European property registration and legal document types (US: title insurance, deeds; UAE: NOC; Brazil: ITBI)
- Property type definitions differ (US: SFR, MFR; UAE: off-plan; Brazil: loteamento)
- Agent licensing: AMI 22506 is specific to Portugal. Global deployment requires either licensing partnerships or white-labeling to local brokerages
- Localization: Arabic (RTL layout), Chinese, Japanese

**Readiness: 1/10** — The intelligence architecture is portable, but every market-specific assumption (zone data, signal thresholds, document types, commission structure) is baked in for Portugal. Global is a 2–3 year roadmap item.

---

## Valuation Drivers

**What increases valuation:**
- First real closed deal data feeding the recalibration engine — proves the closed loop works in practice
- Multi-agent deployment: 5+ agencies using the platform simultaneously, generating cross-agent zone intelligence
- Voice intelligence integration (Whisper) — completes the multimodal ingestion story
- Revenue from SaaS subscriptions or commission splits — any monetization event establishes a revenue multiple basis for valuation
- Spain market entry data package — demonstrates geographic expansion capability
- Proprietary zone dataset that outperforms public INE data (requires accumulating private transaction data)

**What decreases valuation:**
- In-memory buyer profiler non-functional in production — if discovered in due diligence, it reveals a gap between claimed behavioral intelligence and actual capability
- Voice intelligence analyzing filenames, not audio — same issue: marketed capability that doesn't work
- No prompt caching on Claude calls — suggests operational immaturity and higher unit economics than necessary
- Single-agency operation — the network effects and data moat arguments are theoretical until the second agency joins
- Mixed English/Portuguese UI — suggests prototype-quality, not production-quality software

---

## Current Estimated Valuation Range

**Stage:** Late prototype / early pilot. One agency (Agency Group itself), no external paying customers, full AI architecture built, no closed-loop training data yet.

**Comparable companies:**
- Homebot (US, portfolio intelligence for agents): raised Series A at ~$40M valuation with ~500 paying agents
- Ylopo (US, AI buyer behavior): $50M+ estimated valuation with significant revenue
- Casafari (Lisbon-based, property intelligence): raised €10M Series A in 2022

**Conservative / Base / Optimistic:**

**Conservative: €500K–€1M** — Prototype with sophisticated architecture, zero external revenue, single-agency. Valued primarily as IP and team capability. At this range, acquirers are likely portals (Idealista, SAPO Imóveis) wanting to add AI ingestion to their platform.

**Base: €2M–€4M** — After: (1) Whisper integration completes multimodal claim, (2) first 90 days of real deal data in the recalibration engine, (3) 2–3 external paying agencies using the platform. Positioned as a Series A fundraise candidate in Iberian proptech.

**Optimistic: €8M–€15M** — After: Spain market entry with zone data, 10+ paying agencies, demonstrated closed-loop improvement in deal close rates (e.g., agents using SH-ROS close X% faster than baseline). Comparable to early Homebot or Casafari rounds.

**The jump from Conservative to Base** requires real deal data and one external paying customer — achievable in 6 months. The jump from Base to Optimistic requires Spain market entry and proven ROI metrics — achievable in 18–24 months.

---

## What Should Be Built Next for Commercial Impact

**1. Real deal outcome capture and recalibration (3 weeks)**
Wire `lib/intelligence/outcomeCapture.ts` and `lib/intelligence/recalibrationEngine.ts` into the agent workflow. When a deal closes, the agent marks it closed in the dashboard. This event recalibrates AVM for that zone, updates buyer preference models, and generates the first real "closed loop" event. Without this, the positioning claim is theoretical. This is the single highest-leverage engineering action.

**2. Whisper voice transcription integration (1 week)**
Add OpenAI Whisper API call before the existing `analyzeTranscriptionText()` function in `voiceIntelligence.ts`. This completes the multimodal ingestion story and makes voice notes genuinely useful. Cost: ~$0.006/minute of audio. For a 2-minute voice note, this is negligible.

**3. Multi-agency onboarding flow (2 weeks)**
Create a self-serve signup flow where a second agency can connect their Supabase instance (or be onboarded to the Agency Group tenant), set their AMI number, and start receiving briefs. Even one external paid agency transforms the narrative from "internal tool" to "SaaS product." This is the commercial breakthrough event.

---

## What Blocks Scale to 100 Agents

**1. Buyer intent profiler must be backed by Redis**
The core behavioral intelligence claim collapses in production at scale. Replace `new Map<>()` with Upstash Redis calls. This is a 1-day fix. Without it, every demo to a potential agency customer that includes the behavioral intelligence feature is demonstrating fiction.

**2. Conversion command must use real deal data, not demo mode**
An agent seeing "Modo demo · sem sessão activa" loses confidence in the product immediately. The conversion command needs to load the agent's actual active pipeline from the database and display real probabilities from their real deal history. This requires the outcome capture pipeline to be operational first.

**3. Full Portuguese localization of the dashboard UI**
At 100 agents, the product will be reviewed by brokerage owners and their IT staff. A dashboard with English status labels ("Ingesting," "Analyzing") and mixed-language nav will not pass commercial review in the Portuguese market. Complete localization is a 2-day effort and is a commercial prerequisite, not a nice-to-have.

---

*SH-ROS · Agency Group · AMI 22506 · 2026-05-17*
