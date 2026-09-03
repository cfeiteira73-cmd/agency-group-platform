# PLAYBOOK — AI & SOFIA
**Agency Group | Sofia: 7 roles, 8 tools, 0 real conversations**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## SOFIA ARCHITECTURE
7 roles: Lead Qualifier, Property Advisor, Investment Analyst, Market Intelligence, Content Research, CRM Follow-Up, Legal Guide
8 tools: property search, lead capture, AVM, market data, document analysis, calendar, CRM write, escalation

## MODEL SELECTION (Claude API)
- Haiku 4.5: high-volume, low-complexity (lead qualification, FAQ)
- Sonnet 5: complex analysis, property matching, investment
- Opus 5: strategic decisions, complex negotiations (use sparingly)

## ABSOLUTE RULES
- Sofia CANNOT: make legal conclusions, binding financial decisions, grant confidential access, publish market claims
- Sofia MUST: escalate high-risk decisions to Carlos
- Sofia MUST: cite source for market statistics
- Sofia MUST NOT: hallucinate property details or prices

## AI KILL SWITCH
All AI features are feature-flagged. If behaviour is unsafe → disable immediately without rebuild.

## EVALUATION
Before deploying AI changes, test:
- Groundedness (does it cite real data?)
- Hallucination (does it invent facts?)
- Calculation accuracy (investment returns)
- Privacy leakage (does it expose other clients?)

## WHATSAPP ACTIVATION (P1)
WHATSAPP_ACCESS_TOKEN must be set in Vercel → activates Sofia on WhatsApp
This is the highest-leverage 30-min action available today.

## COST CONTROL
- Log AI cost per conversation
- Alert if monthly AI cost > €500
- Use Haiku for >80% of interactions
