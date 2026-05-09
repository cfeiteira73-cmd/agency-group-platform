# SOP 01 — Lead Intake
**Owner:** Receiving Agent | **SLA:** <2h first contact | **Platform:** `/portal/crm`

## Trigger Conditions
- New contact created via: website form, WhatsApp, referral, portal import, manual entry
- Sofia AI flags new inbound message

## Step-by-Step

### Step 1 — Acknowledge (0–15 min)
**Owner:** Assigned Agent
**SLA:** 15 min during business hours, first thing next morning if after 20h

Actions:
1. Open contact in `/portal/crm`
2. Verify: full_name, phone, email, source
3. Send acknowledgment:
   - WhatsApp: use `templates.novoContacto()` template
   - Email: send standard acknowledgment (Resend template: `new-lead-ack`)
4. Log interaction: activity type = `whatsapp_sent` or `email_sent`

**Decision:** Does the lead reply with clear buying intent?
- YES → proceed to Step 2
- NO reply after 2h → trigger follow-up sequence (see SOP 04)

### Step 2 — Initial Profiling (15–60 min)
**Owner:** Assigned Agent

Collect and enter in CRM:
- [ ] Budget range (budget_min / budget_max)
- [ ] Preferred zones (preferred_locations)
- [ ] Property typology (typologies_wanted)
- [ ] Timeline (timeline: 'immediate'|'3_months'|'6_months'|'1_year')
- [ ] Financing type (financing_type: 'cash'|'mortgage'|'mixed')
- [ ] Use case (use_type: 'primary'|'secondary'|'investment'|'rental')
- [ ] Language preference

**Decision:** Is this a qualified lead?
- Score ≥ 40 AND has budget + zone → qualify (status: 'qualified')
- Score < 40 OR unclear intent → nurture (status: 'prospect', assign follow-up sequence)

### Step 3 — System Actions (Automatic)
Platform automatically:
- Runs match engine (score ≥ 60 triggers match suggestions)
- Creates learning event: `contact_created`
- If score ≥ 80 → auto-generates deal pack

### Step 4 — Log & Close
- Update lead_score in CRM
- Set next_followup_at (24h default)
- Add note with initial qualification assessment

## Escalation
- Lead value >€2M → notify Carlos immediately (WhatsApp)
- Lead from referral partner → acknowledge partner within 1h
- Lead without phone AND without email → flag for data quality

## KPIs Tracked
- Time to first contact
- Qualification rate from initial intake
- lead_score at intake vs. 7 days later
