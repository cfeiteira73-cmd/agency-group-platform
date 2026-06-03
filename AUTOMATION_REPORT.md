# AUTOMATION REPORT
Agency Group | Wave 59

---

## ALREADY AUTOMATED (41 crons)
| Process | Automation | Frequency |
|---------|-----------|-----------|
| Health monitoring | /api/cron/health-check | Hourly |
| Self-healing | /api/cron/self-heal | Every 5 min |
| Lead scoring | /api/offmarket-leads/score | Weekdays 7am |
| Buyer scoring | /api/buyers/score | Weekdays 6:15am |
| Revenue loop | /api/automation/revenue-loop | 3× daily |
| KPI snapshot | /api/cron/kpi-snapshot | Daily 23:55 |
| Listings ingest | /api/cron/ingest-listings | Daily 5am |
| Market data refresh | /api/market-data/refresh | Weekly |
| AVM compute | /api/cron/avm-compute | Daily 7am |
| Follow-ups | /api/cron/followups | Daily 9am |
| Reporting | /api/reporting/daily | Weekdays 8:30am |
| Partner tier update | /api/cron/update-partner-tiers | Daily 3am |
| Data quality score | /api/cron/data-quality-score | Daily 6am |
| GDPR purge | /api/cron/purge-conversations | Daily 3am |

---

## AUTOMATE NOW (manual processes remaining)
| Process | Automation path | Effort |
|---------|----------------|--------|
| WhatsApp follow-up | Activate WHATSAPP_ACCESS_TOKEN | 1 hour |
| Stripe live activation | Update env var | 30 min |
| PagerDuty SOC | Create free account | 1 hour |
| Idealista data ingestion | API key approval | 1 week |
| Bank reconciliation | SaltEdge contract | 2 weeks |

---

## AUTOMATE LATER
| Process | Recommendation |
|---------|---------------|
| Deal pack generation | Already in /api/deal-packs — needs activation |
| Investor onboarding | Currently manual — Sofia can qualify |
| Property valuation requests | AVM is live — needs marketing integration |
| Partner referral tracking | Routes exist, workflow needs testing |

---

## SOFIA AUTOMATION POTENTIAL
Sofia can automate:
- Initial lead qualification (fully built)
- Follow-up sequences (built, WhatsApp blocked)
- Meeting booking (built)
- Deal proposal generation (built)
- Investor matching introductions (built)

---

## HUMAN ONLY (cannot automate)
- Notary / Escritura execution
- KYC identity verification (final decision)
- Contract negotiation above €1M
- Regulatory filing (IRN/ANCERT)
- Final deal approval (CAPITAL_FREEZE human ack)
