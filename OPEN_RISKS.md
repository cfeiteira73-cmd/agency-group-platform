# AGENCY GROUP — OPEN RISKS REGISTER
**Last updated: 2026-09-03**

---

## RISK LEVELS
- 🔴 CRITICAL — Could destroy the business or mission
- 🟠 HIGH — Material impact on commercial trajectory
- 🟡 MEDIUM — Degrades performance or efficiency
- 🟢 LOW — Minor, manageable

---

## ACTIVE RISKS

### R001 🔴 — ZERO REVENUE (100+ days live)
**Risk:** Platform has generated €0 revenue. Solo operator with no confirmed pipeline.
**Impact:** Existential if extended. Cannot fund platform improvements. Team impossible to hire.
**Mitigations in place:** 113 HNWI/institutional emails sent 2026-09-03. CRM active.
**Next action:** Monitor email responses. Follow up within 72h. Target first mandate by 2026 Q4.

### R002 🟠 — n8n NOT DEPLOYED
**Risk:** All 41 automated cron-based workflows are running on Vercel crons, but n8n orchestration not deployed. Follow-up sequences, lead nurturing, and developer alerts not running.
**Impact:** Manual follow-up only. Carlos is the bottleneck for every lead.
**Mitigations:** n8n cloud trial expired. Railway deployment designed but not executed.
**Next action:** Deploy n8n to Railway (4h, €15/mo). This is P1.

### R003 🟠 — WHATSAPP_ACCESS_TOKEN = PREENCHER
**Risk:** Sofia cannot respond on WhatsApp. Largest missed channel for 24/7 buyer engagement.
**Impact:** All WhatsApp inbound unanswered. Modern buyers expect instant response.
**Mitigations:** Infrastructure fully built. Just needs token.
**Next action:** Get permanent WhatsApp Business token from Meta. Set in Vercel. 30-minute task.

### R004 🟠 — SINGLE OPERATOR DEPENDENCY
**Risk:** Carlos Feiteira is the only person. All commercial relationships, tech decisions, and operations depend on one person.
**Impact:** Illness/travel = zero operations. No redundancy.
**Mitigations:** Platform automation designed to reduce dependency. Sofia handles 24/7 responses.
**Next action:** First hire decision (2027 target). Document all processes.

### R005 🟡 — EMAIL ENRICHMENT GAP (99% no email)
**Risk:** 18,042 CRM contacts, but 99% lack verified email. Outreach pool is ~113 contacts.
**Impact:** Cannot scale outreach without Apollo enrichment.
**Mitigations:** Apollo integration built. 113 high-quality contacts already emailed.
**Next action:** Apollo subscription ($49/mo). Enrich top 500 contacts.

### R006 🟡 — SOFIA 0 REAL CONVERSATIONS
**Risk:** AI advisor operational but 0 real buyer conversations. Product-market fit unknown.
**Impact:** Cannot demonstrate AI value. Cannot improve prompts without conversation data.
**Mitigations:** Widget live on site. Traffic needed to generate conversations.
**Next action:** Drive traffic to site. Embed widget in outreach links. Test with real buyers.

### R007 🟡 — RESEND API KEY ROTATION RISK
**Risk:** Resend API key re_MRqLWf4u created 2026-09-03. Previous key expired after ~150 days without warning.
**Impact:** Email delivery silently breaks. Outreach + transactional emails stop.
**Mitigations:** New key created. `.env.local` updated.
**Next action:** Set calendar reminder to check key every 90 days. Monitor Resend dashboard.

### R008 🟡 — NO VERIFIED PROPERTIES IN SYSTEM
**Risk:** Property database may contain no verified, live listings. Cannot demonstrate inventory.
**Impact:** HNWI buyers ask to see properties → nothing to show.
**Mitigations:** Platform supports property upload. 
**Next action:** Upload 3–5 real properties with photos, price, description before next buyer call.

### R009 🟢 — SUPABASE MCP 403 (read-only)
**Risk:** Cannot query Supabase directly from Claude Code sessions (403 errors).
**Impact:** Manual verification needed for all DB claims.
**Mitigations:** Data verified via CSV exports and API calls.
**Next action:** Investigate MCP permissions. Workaround: use direct Supabase dashboard.

### R010 🟢 — VERCEL OIDC TOKEN EXPIRY
**Risk:** VERCEL_OIDC_TOKEN in .env.local has expiry (~24h tokens). Local dev may hit auth issues.
**Impact:** Local development auth flows may fail.
**Mitigations:** Production uses Vercel env vars directly.
**Next action:** Regenerate when needed via `vercel env pull`.

---

## RESOLVED RISKS (for reference)

### RESOLVED: Resend API 401 (2026-09-03)
**Resolution:** Created new "Agency Group Production" key re_MRqLWf4u. Updated .env.local. 113 emails sent successfully.

### RESOLVED: TS 1,083 errors claim (2026-06-23)
**Resolution:** False alarm from incorrect tsc call. `pnpm tsc --noEmit` = 0 errors confirmed.

### RESOLVED: Fake stats/reviews on public pages (2026-06-23)
**Resolution:** Legal audit Wave. Fake statistics removed from all public-facing pages.
