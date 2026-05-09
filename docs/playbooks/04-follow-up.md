# SOP 04 — Follow-Up Cadence
**Owner:** Agent | **Platform:** CRM + WhatsApp + Email | **Automation:** n8n sequences

## Cadence by Status

### New Lead (status: lead)
| Day | Action | Channel | Template |
|---|---|---|---|
| 0 | Initial acknowledgment | WhatsApp | `novoContacto` |
| 1 | Value add: market insight for their zone | Email | `market-intel-{zone}` |
| 3 | Check-in: did they review? | WhatsApp | Manual |
| 7 | Final: different approach or different property | Email | `7-day-followup` |
| 14 | Dormant: monthly digest only | Email | `monthly-digest` |

### Qualified Lead (status: qualified)
| Frequency | Action | Channel |
|---|---|---|
| Same day | Present 3 matched properties | Portal link + WhatsApp |
| 48h | Visit proposal | Phone call |
| Weekly | Pipeline update | Email/WhatsApp |
| If no reply 5 days | Escalate to Carlos | Internal alert |

### Active Buyer (status: active)
| Trigger | Action | SLA |
|---|---|---|
| New match ≥80 score | Send deal pack | <1h |
| After every visit | Summary + next steps | <24h |
| No contact 5 days | Urgency check | Phone call |
| No activity 14 days | Escalation alert | Flag for Carlos |

### Post-Proposal
| Timing | Action | Channel |
|---|---|---|
| 24h after proposal | Follow-up: questions? | Phone call |
| 72h | Check competition | WhatsApp |
| 7 days no response | Offer expiry notice | Email + WhatsApp |

## SLA Breach Alerts
System automatically alerts Carlos if:
- Lead with score ≥60: no contact in 48h
- Active buyer: no contact in 7 days
- Proposal sent: no follow-up in 48h

## Do Not Contact Rules
- Opt-out: `opt_out_whatsapp = true` → WhatsApp only with explicit consent
- Opt-out: `opt_out_marketing = true` → No promotional emails
- After 22h or before 9h: no outbound calls or WhatsApp

## Message Templates Reference

### WhatsApp — `novoContacto`
*"Olá [Nome], obrigado pelo seu contacto com a Agency Group! Sou [Agente] e vou ser o seu consultor pessoal. Quando tem disponibilidade para uma conversa rápida de 10 minutos?"*

### WhatsApp — Check-in (Day 3)
*"Olá [Nome], queria assegurar-me que recebeu as propriedades que partilhei. Tem alguma questão ou gostaria de ver alguma em particular?"*

### Email — 7-Day Follow-Up Subject
`[AG] Ainda à procura de [zona]? Novas opções esta semana`

## Dormant Lead Reactivation (>30 days silent)
1. Remove from active cadence
2. Add to monthly digest list
3. Flag in CRM: `status = 'dormant'`
4. Set 90-day reminder for reactivation attempt
5. On reactivation: treat as new lead, restart intake

## GDPR Compliance Note
All follow-up communications require active GDPR consent recorded in CRM.
If `gdpr_consent = false` or null: email marketing is prohibited. Phone + WhatsApp only with prior relationship.
