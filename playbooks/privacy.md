# PLAYBOOK — PRIVACY & GDPR
**Agency Group | GDPR compliance is not optional. AMI: 22506.**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## LEGAL BASIS
- Contract: processing necessary for real estate transaction
- Legitimate interest: market intelligence, business development
- Consent: marketing communications, cookie analytics

## DATA MINIMISATION
Only collect what is necessary for the stated purpose.
Do not collect NIF, passport, or financial data without legal necessity.

## RETENTION PERIODS
- Leads (no transaction): 2 years from last contact
- Transaction data: 10 years (legal requirement)
- AML/KYC: 7 years minimum (Portuguese law)
- Sofia conversations: 1 year (unless transaction involved)
- Analytics: 13 months

## DELETION REQUESTS
- Process within 30 days
- Check all systems (Supabase, email lists, CRM)
- Log deletion with date

## AI PROMPTS
- Never include raw personal data (name + email + address) in AI prompts
- Anonymise or pseudonymise where possible
- Log what personal data enters AI systems

## COOKIE MANAGEMENT
- Analytics: require consent (not legitimate interest)
- Strictly necessary: no consent needed
- Marketing pixels: require explicit consent
- Default: decline non-essential

## PROCESSOR AGREEMENTS
Key processors (data shared with):
- Supabase (DB) — EU region ✓
- Vercel (hosting) — EU region ✓
- Resend (email) — check DPA
- Anthropic (AI) — check DPA, data processing terms
- Apollo (enrichment) — check DPA

## BREACH PROTOCOL
If personal data is exposed:
1. Assess scope within 2h
2. Contain immediately
3. Notify CNPD within 72h if >500 records OR sensitive data
4. Notify affected individuals if high risk to their rights
5. Document everything
