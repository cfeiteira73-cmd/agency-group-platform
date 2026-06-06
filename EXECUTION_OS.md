# EXECUTION OPERATING SYSTEM
Agency Group | Excellence Program Phase 6 | 2026-06-06
The daily/weekly/monthly operating system for Agency Group.

---

## CORE PRINCIPLE

The platform is built. The business starts with execution.  
Execution = showing up every day and doing the work.

---

## DAILY EXECUTION (90 minutes — every weekday)

### 08:00 — MORNING INTEL (15 min)
1. Log in to agencygroup.pt/dashboard
2. Check daily brief → any alerts, deals, cron output
3. Review priority_items table → any high-priority items?
4. Check email inbox for any responses from outreach
5. Check LinkedIn for connection requests + messages

### 09:00 — CAPITAL OUTREACH (30 min)
1. Open TOP_ENRICHMENT_MASTER.xlsx → TOP_200 tab
2. Pick 3-5 contacts where status = PENDING
3. LinkedIn: send connection request OR follow up if already connected
4. Log each action in REVENUE_OPERATING_SYSTEM.xlsx → ACTIVE_PIPELINE tab
5. If any response → move to CONVERSATION stage, book call

### 10:00 — INVENTORY WORK (30 min)
Week 1-2: Verify existing 55 properties (10/day = 5 days done)
- Call/email source of each property
- Confirm: available? price current? mandate possible?
- Update INVENTORY_WAR_ROOM.xlsx → ACTIVE_INVENTORY tab

Week 3+: Source new inventory
- Developer emails: 2 per day
- Co-agency broker contact: 1 per day
- Citius check: 5 minutes on citius.mj.pt

### 10:30 — ADMIN (15 min)
1. Update CRM for any deals that moved
2. Log any conversations that happened yesterday
3. Review next 24 hours

---

## WEEKLY EXECUTION (Monday 09:00, 60 min)

### CAPITAL REVIEW
1. How many LinkedIn connections sent this week?
2. How many accepted?
3. How many conversations active?
4. Any meetings booked?
5. Any deals moved stage?

### PIPELINE REVIEW
1. Open REVENUE_OPERATING_SYSTEM.xlsx
2. Update probability for each deal
3. Calculate total expected revenue
4. Identify stuck deals (>14 days same stage)
5. Set action for each stuck deal

### INVENTORY REVIEW
1. How many properties verified vs unverified?
2. Any new mandates signed?
3. Any buyer matches to pursue?
4. Check off-market pipeline

### CRON HEALTH CHECK (5 min)
1. Vercel dashboard → logs
2. Confirm /api/cron/health-check ran this week
3. Confirm no cron errors in last 7 days

---

## MONTHLY EXECUTION (First Monday, 2 hours)

### MONTH CLOSE
1. Count: conversations started in month
2. Count: meetings taken in month
3. Count: properties added to verified inventory
4. Count: deals in pipeline vs month before
5. Revenue generated (€0 until first deal)

### MONTH ACTIONS
1. Subscribe to 1 enrichment tool if not yet done
2. Add 5+ new properties (verified)
3. Review Sofia sequence performance
4. Deploy n8n to Railway if not done
5. LinkedIn post: 1 market insight article

### MARKET REVIEW
1. INE data: latest transaction volumes
2. Confidencial Imobiliário: price trends
3. Idealista: competition check
4. Update AVM if significant market movement

---

## QUARTERLY EXECUTION (Q3 2026 review)

### Q3 TARGET
- First CPCV signed
- 10+ qualified conversations total
- 25+ LinkedIn A+ connections accepted
- 50+ verified properties in system
- Email enrichment: 300+ emails added
- n8n deployed and running
- Revenue: €0 → €X (any positive number)

### Q4 TARGET (if Q3 achieved)
- 3+ deals closed or in CPCV
- First agent hired
- Email sequences running on 500+ contacts
- Casafari subscription active

---

## DAILY DECISION RULES

**When a contact accepts LinkedIn:**  
→ Send message within 24 hours. Template in CAPITAL_EXCELLENCE_PLAYBOOK.md.

**When a contact responds:**  
→ Book call within 48 hours. Use Sofia script for qualification.

**When a property lead comes in:**  
→ Add to INVENTORY_WAR_ROOM.xlsx. Call within 4 hours. Verify in 24 hours.

**When a buyer shows interest:**  
→ Add to contacts table in Supabase. Create deal record. Generate deal pack via /api/deal-packs.

**When a deal stalls (>14 days same stage):**  
→ Direct personal call. Do not send email.

---

## WHAT NOT TO DO

- Do not build more features until first deal closes
- Do not spend time on reports that aren't read
- Do not add more contacts to CRM — work the 73 A+ contacts you have
- Do not wait for perfect data before reaching out
- Do not automate what should be personal (A+ outreach = Carlos, always)
- Do not spend more than 20% of time on technology

---

## THE ONE METRIC THAT MATTERS

**Conversations started per week.**

Everything else is downstream of this.  
Code quality → irrelevant without conversations.  
CRM completeness → irrelevant without conversations.  
Automation → irrelevant without conversations.

Start conversations. Everything else follows.
