# SOP 12 — Incident Handling & Operational Recovery
**Owner:** Carlos Feiteira | **P0 Response:** <1 hour

## Incident Severity Matrix

| Level | Definition | Examples | Response Time | Escalation |
|---|---|---|---|---|
| **P0 — Critical** | Revenue at risk or client harm | CPCV payment failed, client complaint to APEMIP, platform down | <1h | Carlos immediate |
| **P1 — High** | Significant disruption | Sofia AI down, data breach, legal threat | <4h | Carlos + advogado |
| **P2 — Medium** | Operational degradation | Key feature broken, missed SLA, agent conflict | <24h | Carlos |
| **P3 — Low** | Minor issue | UI bug, typo, minor delay | <72h | Agent self-resolve |

## P0 Response Protocol

### First 15 Minutes
1. Carlos alerted via WhatsApp (automatic system alert or manual)
2. Assess: financial impact? Client impact? Legal exposure?
3. Immediate containment action defined
4. Communication drafted (client-facing if needed)

### First Hour
5. Root cause identified
6. Containment action executed
7. Client/counterparty communicated if impacted
8. Incident logged in system (incident_log table)
9. Legal/notário alerted if contract at risk

### Resolution (varies by type)
- Financial failure: bank contact, escrow verification, bridge payment
- Platform failure: Vercel/Supabase status checked, rollback if needed
- Legal threat: advogado on call, no communication without legal review
- Client complaint: personal call from Carlos within 1h

### Post-Incident (24h)
- Written incident report
- Root cause documented
- Prevention measures implemented
- update_incident logged in system

## Common Incident Playbooks

### CPCV Payment Not Received
1. Confirm bank details were correct
2. Contact buyer's bank directly (with authorization)
3. Give 24h grace period
4. If still not received: formal notice via advogado
5. If intentional default: execute penalty clause (CPCV terms)

### Platform Down During Critical Deal
1. Switch to manual process (WhatsApp + email)
2. Document everything in WhatsApp for CRM input later
3. Carlos personally manages communication
4. Check Vercel/Supabase status pages
5. Activate backup communication channels

### Client Threatening Complaint (APEMIP/IMPIC)
1. STOP all communication — refer to Carlos immediately
2. Carlos reviews situation with advogado
3. No admission of fault in writing
4. Resolve within 48h with counter-narrative or concession
5. Document all communications

### Data Breach or Security Incident
1. Immediately alert Carlos (P0)
2. Identify scope: what data, how many clients
3. Contain: revoke access, rotate keys if needed
4. GDPR breach notification obligation: if personal data affected, CNPD must be notified within 72h
5. Legal review of notification obligations
6. Client notification if required by law

### Agent Error (Wrong Information Given to Client)
1. Agent reports to Carlos immediately
2. Assess: financial impact, legal exposure
3. Carlos contacts client personally to correct
4. Document correction in writing
5. Process review to prevent recurrence

## Incident Log Fields (CRM)
When logging an incident:
- `incident_type`: financial / platform / legal / client / agent_error / security
- `severity`: P0 / P1 / P2 / P3
- `deal_ref`: if deal-specific
- `impact_eur`: estimated financial impact
- `status`: open / contained / resolved / post-mortem
- `resolution_notes`: what was done
- `prevention_action`: what changes to prevent recurrence
