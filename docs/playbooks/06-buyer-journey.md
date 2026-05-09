# SOP 06 — Buyer Journey Management
**Owner:** Agent | **Platform:** `/portal/crm` | **Avg cycle:** 180 days (210-day market avg 2026)

## Journey Overview

```
SEARCH → QUALIFY → MATCH → VISIT → PROPOSE → CPCV → ESCRITURA → POST-SALE
  D0        D1–7     D7–30   D30–90   D90–120   D120–150  D150–210   D210+
```

Each stage has defined entry criteria, agent actions, client touchpoints, and exit criteria. No deal advances without meeting exit criteria.

---

## Stage 1 — SEARCH
**Entry:** Lead created in CRM | **Exit:** Budget + zone confirmed, min 3 property matches sent

### Agent Actions
1. Complete intake (SOP 01)
2. Run match engine in portal
3. Send first property selection (3–5 properties) within 24h of qualification
4. Explain how the portal search works
5. Set up automated match alerts (score ≥ 70)

### Client Touch Points
- WhatsApp: "here are your first 3 matches"
- Portal link: create client-accessible saved search
- Email: market intel for their target zone (1-page PDF)

### Communication Cadence
- Day 1: Initial matches sent
- Day 3: Check reaction to matches
- Day 7: Refine search criteria if no fit found
- Day 14: If no engagement, flag as cold (SOP 04 dormant sequence)

### Golden Rules — Search Stage
- Never send more than 5 properties at once (decision fatigue)
- Always include 1 "safe" match + 1 "stretch" match + 1 "value" match
- Listen more than pitch — identify unstated criteria from reactions
- If they reject 10+ properties, the stated criteria are wrong — have a realignment call

---

## Stage 2 — QUALIFY
**Entry:** Budget verbally confirmed | **Exit:** All BANT-RE fields complete in CRM (SOP 02)

### Agent Actions
1. Complete qualification call (30–45 min)
2. Fill all required CRM fields
3. Obtain GDPR consent
4. Set tier: A/B/C (SOP 02)
5. Confirm financing: cash, mortgage pre-approval, or in process

### Financing Guidance
- Cash buyers: request proof of funds (bank statement or letter) before visits start
- Mortgage buyers: confirm pre-approval or connect with preferred bank partners
- Mixed: clarify split and timeline for mortgage approval

### Foreign Buyer Considerations
**Americans (16% of buyers):**
- Timezone: typically 5–8h behind Portugal → schedule calls 14h-18h PT time
- Currency: USD → EUR conversion risk — clarify budget is in EUR net
- NHR / Non-Habitual Resident regime: brief on tax benefits (10-year flat rate)
- LLC/trust structures common for high-value purchases
- Escrow is US-norm — explain CPCV + notário system early

**French (13% of buyers):**
- Strong preference for in-person visits — often fly to Portugal for a dedicated trip
- SCI (French property company) usage common for investment
- NHR awareness — many already researched it
- Strong preference for legal certainty — get advogado involved early

**British (9% of buyers):**
- Post-Brexit residency: explain D7, Golden Visa, or AIMA routes if relevant
- Often very spreadsheet-driven — prepare detailed cost breakdown
- Expect professional follow-up emails, not just WhatsApp
- Currency risk: GBP → EUR — acknowledge and monitor

**Chinese (8% of buyers):**
- Investment-primary motivation common
- Golden Visa interest: clarify current status of program
- Often represented by intermediary/agent — identify the actual decision-maker
- WeChat preferred over WhatsApp for some
- Legal due diligence scrutiny is very high — prepare full documentation

**Brazilians (6% of buyers):**
- Strong cultural connection to Portugal — leverage this
- D7 visa interest common
- Often extended family involved in decision
- Price sensitivity higher than other international segments
- Portuguese-speaking → same language, different legal/process familiarity

---

## Stage 3 — MATCH
**Entry:** Qualified buyer confirmed | **Exit:** Minimum 1 visit scheduled

### Agent Actions
1. Run full match engine: all available properties vs. buyer criteria
2. Curate shortlist (5–8 properties, ranked by match score)
3. Prepare deal pack for top 3 matches
4. Present shortlist via WhatsApp + portal link
5. Propose visit schedule

### Deal Pack Contents (per property)
- Property summary PDF (photos, specs, zone map)
- Price per m² vs. zone average
- AVM estimate with confidence interval
- Estimated monthly costs (condominium + IMI + insurance)
- Nearby amenities and schools (if applicable)
- Any known negotiation room

### Communication Cadence — Match Stage
- Present shortlist immediately after qualification
- Follow up 48h later: "any of these feel right?"
- Weekly refresh: send 2 new matches if no visit scheduled
- After 3 weeks with no visit: qualification realignment call

---

## Stage 4 — VISIT
**Entry:** Visit confirmed | **Exit:** Verbal interest expressed on ≥1 property

### Pre-Visit Preparation
- [ ] Confirm visit time with seller/listing agent (24h ahead)
- [ ] Prepare property summary for client (printed or digital)
- [ ] Check property status: still available, no accepted offers
- [ ] Confirm access arrangements (key, concierge, remote lock)
- [ ] Drive the route if unfamiliar with area
- [ ] Prepare 3 talking points on why this property fits the client

### During the Visit
- Let the client explore freely for 5–10 min before guided tour
- Point out: zone advantages, nearby services, unique features
- Watch body language: linger time, return to rooms, whispered conversations
- Do NOT oversell — ask questions: "What do you think about the kitchen?"
- Note objections carefully: these are negotiation starting points

### Post-Visit (within 24h)
- Send visit summary: pros/cons list as discussed
- Ask directly: "On a scale of 1–10, where does this sit for you?"
- Log visit: activity type = `visit_completed` in CRM
- If rating ≥7: move to proposal discussion immediately
- If rating 4–6: identify what would need to change
- If rating <4: back to match stage with refined criteria

### Visit Cadence
- Ideal: 3–5 visits per trip (especially for international buyers)
- Maximum per day: 4 (fatigue degrades decision quality)
- Minimum 45 min per property
- Always end with a "favorite" — ask buyer to rank at end of day

---

## Stage 5 — PROPOSE
**Entry:** Buyer rates ≥7/10 on a property | **Exit:** Formal written offer submitted

### Agent Actions
1. Confirm buyer's interest and intended offer price
2. Gather: proof of funds / mortgage approval letter
3. Check current status of property (no other offers pending)
4. Present market data to anchor offer: recent comparable sales
5. Advise on offer strategy (see SOP 08 Negotiation)
6. Draft written offer letter (email + WhatsApp summary)
7. Submit to listing agent or seller

### Offer Letter Contents
- Buyer's full name and contact
- Property reference number
- Offered price (in EUR)
- Proposed CPCV timeline (typically 15–30 days)
- Proposed Escritura timeline (typically 60–90 days after CPCV)
- Key conditions (if any: financing, inspection)
- Validity: 48–72h

### Managing Multi-Property Buyers
If buyer is considering multiple properties simultaneously:
- Be transparent with client about urgency on each
- Internally: track all in CRM as separate deal paths
- Never submit simultaneous offers without explicit buyer knowledge
- Help client rank options before offers go out

---

## Stage 6 — CPCV
**Entry:** Offer accepted verbally | **Exit:** CPCV signed and deposit received

Full details in SOP 09 (Contract & Legal). Agent responsibilities:
- Coordinate document collection from both parties
- Liaise with advogado for CPCV drafting
- Track deposit transfer confirmation
- Update CRM: `fase = 'CPCV'`, trigger learning event `cpcv_signed`

---

## Stage 7 — ESCRITURA
**Entry:** CPCV signed + all conditions met | **Exit:** Deed signed, keys handed over

Full details in SOP 09 (Contract & Legal). Agent responsibilities:
- Pre-escritura document checklist (5 business days prior)
- Coordinate with notário, buyer, seller, advogados
- Attend escritura in person
- Confirm commission payment received
- Update CRM: `status = 'won'`, `fase = 'Escritura'`

---

## Stage 8 — POST-SALE
**Entry:** Escritura complete | **Ongoing:** Client relationship management

### Within 48h of Escritura
- Personal congratulations WhatsApp/call
- Request testimonial / Google review
- Send NPS survey (Resend template: `post-escritura-nps`)

### Within 30 days
- Check-in: any issues settling in? Contractor referrals needed?
- Add to annual touch list

### Annual Touches
- Property anniversary message
- Annual market update for their zone
- Investment portfolio check-in (for investor buyers)
- Referral ask: "Who else do you know that might be looking?"

### Golden Rule — Post-Sale
Every satisfied client is a future referral source. Referrals from past clients convert at 3x the rate of cold leads. Never let the relationship go cold after Escritura.

---

## Buyer Journey KPIs

| KPI | Target | Alert |
|---|---|---|
| Search → Visit rate | >60% | <40% |
| Visit → Proposal rate | >40% | <25% |
| Proposal → CPCV rate | >70% | <50% |
| CPCV → Escritura rate | >95% | <90% |
| Avg days Search → CPCV | <90 | >150 |
| NPS post-sale | >70 | <50 |
