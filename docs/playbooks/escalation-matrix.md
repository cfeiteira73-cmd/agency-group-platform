# Escalation Matrix — Agency Group
**Version:** 2026 | **Owner:** Carlos Feiteira

## Contact Information (Internal)
| Role | Name | WhatsApp | Availability |
|---|---|---|---|
| Founder / Broker | Carlos Feiteira | +351 919 948 986 | 8h–22h |
| Advogado Parceiro | [TBD] | [TBD] | Business hours |
| Notário Parceiro | [TBD] | [TBD] | Business hours |
| IT Support | Via Vercel/Supabase | support channels | 24/7 (async) |

## Escalation Decision Tree

```
Issue Identified
    │
    ├─ Financial impact >€10K? → P0 → Carlos immediately
    ├─ Client threatening legal action? → P0 → Carlos + Advogado
    ├─ Platform completely down? → P1 → Carlos via WhatsApp
    ├─ Data breach or security incident? → P0 → Carlos + IT
    ├─ Deal stalled >21 days? → L3 → Carlos intervention
    ├─ Agent performance issue? → P2 → Carlos 1:1
    ├─ Legal/contract question? → P1 → Advogado
    └─ Minor operational issue → P3 → Self-resolve + log
```

## Auto-Escalation Rules (System)
The platform automatically alerts Carlos via WhatsApp when:
- Any deal value >€1M goes stalled >5 days
- CPCV payment not confirmed within 24h of due date
- Lead score >80 not contacted within 48h
- Agent data quality score drops below 50
- P0 system alert triggered
- Win/loss: consecutive losses >3 in 7 days for same agent

## Communication Standards
- **P0:** WhatsApp + phone call. Response expected in 15 min.
- **P1:** WhatsApp. Response expected in 2h.
- **P2:** Email + WhatsApp. Response expected in 24h.
- **P3:** CRM note or email. Response expected in 72h.

Always include: [URGENCY LEVEL] [DEAL REF] [IMPACT] [ACTION NEEDED]
Example: *"[P1] AG-2026-047 — Buyer solicitor requesting additional docs. Need your approval to proceed. Respond by 17h."*

## Escalation by Category

| Category | Escalation Path | SLA |
|---|---|---|
| Financial / Commission | Agent → Carlos | P0: <1h |
| Legal / Contract | Agent → Advogado → Carlos | P1: <4h |
| Client complaint | Agent → Carlos immediately | P0: <1h |
| Platform down | Agent → Carlos → Vercel/Supabase | P1: <4h |
| Agent conflict | Agent → Carlos | P2: <24h |
| Data / Privacy breach | Carlos → IT → CNPD (if required) | P0: <1h |
| CPCV default | Agent → Carlos → Advogado | P0: <1h |
| Stalled deal (L3) | Agent → Carlos | L3: <4h |
| Stalled deal (L4, CPCV risk) | Agent → Carlos → Advogado | L4: <1h |

## External Contacts Reference

| Service | Contact | When to Use |
|---|---|---|
| APEMIP | apemip.pt | Regulatory questions, complaints |
| IMPIC | impic.pt | AMI compliance, license queries |
| CNPD | cnpd.pt | Data breach notifications |
| Vercel Status | vercel.com/status | Platform incidents |
| Supabase Status | status.supabase.com | Database incidents |
| Resend | resend.com/docs | Email delivery issues |
