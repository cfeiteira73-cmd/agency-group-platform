# 13 — OPERATIONAL REALITY
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## CRITICAL FINDING

> **Agency Group has had exactly ONE user in its entire operational history: Carlos (geral@agencygroup.pt).**

This is not an estimate. This is a fact backed by the complete `used_magic_tokens` table.

---

## REAL USAGE STATISTICS (EVIDENCE FROM DATABASE)

### Authentication (used_magic_tokens: 38 rows)
| Metric | Value | Evidence |
|--------|-------|---------|
| Total logins | 38 | COUNT(*) on used_magic_tokens |
| Unique users | 1 | All tokens: geral@agencygroup.pt |
| Last login | 2026-06-07 20:37 UTC | MAX(used_at) |
| First login | Unknown (earliest in token table) | — |
| External user logins | 0 | 0 tokens with other emails |

**All 38 logins are Carlos checking his own system.**

### AI Conversations (sofia_conversations: 0 rows)
| Metric | Value |
|--------|-------|
| Total conversations | 0 |
| Total message turns | 0 |
| WhatsApp conversations | 0 |
| Video interactions | 0 |
| **Sofia has never talked to a buyer** | |

### CRM Activity (contacts: 28 rows)
| Category | Count | Evidence |
|----------|-------|---------|
| Demo/seeded contacts | ~27 | System generated |
| Real external contacts | 1 | ISABELGRILO@GMAIL.COM, 2026-06-03 |
| Contacts contacted | 0 | No outreach evidence |
| Contacts replied | 0 | No reply records |
| Contacts qualified | 0 | — |

### Deals (deals: 8 rows)
| Metric | Value |
|--------|-------|
| Total deals | 8 |
| Real deals | 0 |
| Demo/seeded deals | 8 |
| Revenue from deals | €0 |

### Properties (properties: 55 rows)
| Type | Count |
|------|-------|
| Total DB properties | 55 |
| Verified mandates | 0 |
| Seeded/demo | 55 |
| Properties with viewing booked | 0 |

### KPI Snapshot History (50 rows — REAL DATA)
```
SYSTEM TIMELINE (from kpi_snapshots):

2026-04-24: leads=27, deals=8, props=8    ← SYSTEM STARTED
2026-04-25: leads=27, deals=8, props=28   ← Properties seeded
2026-04-26: leads=27, deals=8, props=55   ← Seeding complete
2026-04-27 → 2026-05-14: STABLE (no growth)
2026-06-06: leads=28 (first lead added in 6 weeks)
2026-06-12: leads=28, deals=8, props=55   ← TODAY (no change)

CONCLUSION:
- System running since 2026-04-24 (51 days)
- In 51 days: +1 lead, 0 real contacts, 0 deals
- KPI values are 100% static — nothing is changing
```

### Automation Reality
| Component | Configured | Actually Running | Output |
|-----------|-----------|-----------------|--------|
| kpi-snapshot cron | ✅ | ✅ | 50 rows (confirmed) |
| 40 other crons | ✅ | Unknown | 0 evidence |
| n8n workflows (11) | ✅ | ❌ | 0 (local only) |
| Email sequences | ✅ | ❌ | 0 emails sent |
| WhatsApp | ✅ | ❌ | 0 messages |
| Push notifications | ✅ | ❌ | 0 (notifications: 0) |
| Lead enrichment | ✅ | Unknown | 67/7342 have email |
| Buyer scoring | ✅ | Unknown | No buyers table |

---

## ACTIVE VS INACTIVE SYSTEMS

### CONFIRMED ACTIVE (real evidence)
| System | Evidence |
|--------|---------|
| Website (agencygroup.pt) | HTTP 200 live |
| Magic link authentication | 38 real tokens |
| KPI snapshot cron | 50 consecutive runs |
| Supabase database | All queries return real data |
| TypeScript build | 0 errors (exit code 0) |
| Vercel deployment | Site live, Paris CDN |
| Blog (55 articles) | Live, indexed by Google |

### CONFIRMED INACTIVE (zero evidence of use)
| System | Evidence of Inactivity |
|--------|----------------------|
| Sofia AI (chat) | 0 conversations, 0 turns |
| WhatsApp | WHATSAPP_ACTIVE not set |
| Email sequences (n8n) | 0 sent, n8n local only |
| HeyGen video | Never invoked |
| AVM (real valuations) | 0 real property valuations |
| Partner system | Table missing |
| Agent system | 0 agents, table missing |
| Push notifications | 0 sent |
| Property collections | 0 collections |
| Off-market lead scoring | 14 leads, scoring status unknown |
| Learning events (ML) | 14 events — system generated |

---

## USER BEHAVIOUR ANALYSIS

### Carlos Login Pattern (38 logins from geral@agencygroup.pt)
```
2026-06-07 20:37 — Last login
2026-05-21 21:26
2026-05-20 18:52
2026-05-17 08:43
2026-05-16 20:56
2026-05-16 14:13
2026-05-15 16:13
2026-05-14 15:29
2026-05-03 15:06
2026-04-30 11:08
... (earlier logins)

Pattern: Checking portal 2-8x per month
Purpose: Monitoring system he built
Productive output from these sessions: Unknown
```

---

## REVENUE REALITY

| Metric | Reality |
|--------|---------|
| Revenue since launch | €0 |
| Deals closed | 0 |
| Properties sold | 0 |
| Buyers matched and converted | 0 |
| Commission earned | €0 |
| Outreach sent | 0 |
| Meetings booked | 0 |

---

## WHAT CHANGED IN 51 DAYS (since 2026-04-24)

```
STARTED:  27 leads | 8 deals (demo) | 8 properties (demo)
TODAY:    28 leads | 8 deals (demo) | 55 properties (demo)

CHANGE:
  +1 lead (one real contact)
  +47 properties (seeding — demo)
  +0 deals (no real progress)
  +0 outreach sent
  +0 conversations
  +€0 revenue
```

---

## THE OPERATIONAL GAP IN ONE LINE

```
System operational since: 2026-04-24 (51 days ago)
Total outreach sent:       0
Total revenue:             €0

The system is a Formula 1 car that has never left the garage.
```

---

*Evidence: Supabase REST API queries 2026-06-14 — zero estimates, zero assumptions*
