# OPERATIONS 85 REPORT + EXECUTION SYSTEM
Agency Group | Phase 11 | 2026-06-06

---

## CURRENT STATE: 15/100

**Reality:** No confirmed active operations. Website is live. Nobody is using the system daily.

---

## OPERATIONS EXECUTION SYSTEM

### DAILY CADENCE (Carlos, 90 minutes/day)

**08:00 — Morning Brief (15 min)**
1. Check daily brief: agencygroup.pt/dashboard/daily-brief
2. Review deals pipeline: any movements, deadlines, CPCVs due
3. Review priority alerts from Vercel crons

**09:00 — CRM Outreach (45 min)**
1. LinkedIn: Follow up on pending connections (A+ tier)
2. Send 3-5 new connection requests to A+ contacts
3. Log any conversations in contacts table
4. Update deal stages if relevant

**15:00 — Prospecting (30 min)**
1. Review 5 new A-tier contacts from capital_profiles
2. Research their current mandate/portfolio via LinkedIn
3. Prepare personalized outreach note
4. Send or queue for next day

---

### WEEKLY CADENCE (Monday morning, 60 min)

**Monday 09:00 — Weekly Planning**
1. Review weekly report: /api/reporting/weekly-negotiation
2. Check cron execution logs in Vercel (confirm 41 crons ran)
3. Review deals: any stalled, any new matches to pursue
4. Set 3 priority actions for the week

**Wednesday — Mid-week Review (20 min)**
1. Check new replies from LinkedIn outreach
2. Follow up on pending qualifications

**Friday — Week Close (20 min)**
1. Log results of the week
2. Update deal stages
3. Note blockers for next week

---

### MONTHLY CADENCE (First Monday, 2 hours)

**Month Review**
1. Count of new A+ conversations started
2. Deals pipeline value (sum of deal.valor)
3. Meetings booked vs meetings taken
4. Properties available vs properties under offer
5. CRM score: are contacts moving through pipeline?

**Month Actions**
1. Add 5+ new properties to inventory (verify real mandates)
2. Add any new buyer to contacts table
3. Review automation performance (cron logs, errors)
4. Plan next month's content (blog, LinkedIn)

---

### QUARTERLY CADENCE (Q3 2026)

**Q3 Goal:**
1. First CPCV signed = Revenue milestone
2. 10 real buyer qualification conversations
3. 25+ LinkedIn A+ connections accepted
4. 3 properties under offer (even at €0 — evidence of activity)
5. Deploy n8n to Railway

---

## GAPS TO 65 (Internal Max)

All gaps are OPERATIONAL, not technical:

| Gap | Fix | Time |
|-----|-----|------|
| 0 daily logins | Carlos logs in daily | Immediate |
| 0 LinkedIn outreach | Start A+ connections | This week |
| 0 real contacts in pipeline | Add first 3 real buyers | This week |
| Crons unverified | Check Vercel cron logs | 10 minutes |
| 0 real deals | Start pipeline | 2-4 weeks |

---

## GAPS TO 85 (Market Max)

| Gap | Fix | Resource |
|-----|-----|----------|
| Solo operator | Hire 1 agent | €1,500-2,500/month |
| No buyer intake system | Build via Sofia | Technical (done) |
| No seller intake | Carlos personally | Relationships |
| No marketing cadence | LinkedIn 3x/week | 1 hour/week |
| No property verifications | Call/email all 55 | 2-3 days |

---

## SCORE TRAJECTORY

| Period | Score | Trigger |
|--------|-------|---------|
| Now | 15 | Website live only |
| 1 week | 30 | Carlos logs in daily, 5 outreach done |
| 1 month | 50 | 10 real conversations, 2 meetings |
| 3 months | 65 | 25 meetings, 3 deals in pipeline |
| 6 months | 75 | First transaction closed |
| 12 months | 85 | Team of 3, regular deal flow |
