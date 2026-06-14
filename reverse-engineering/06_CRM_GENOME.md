# 06 — CRM GENOME
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## THE TWO CRM SYSTEMS

Agency Group has two distinct CRM systems that serve different purposes:

```
┌─────────────────────────────────────┐  ┌──────────────────────────────────┐
│      CAPITAL NETWORK CRM            │  │       PORTAL CRM                 │
│      (capital_profiles)             │  │       (contacts, deals)           │
│                                     │  │                                  │
│  7,342 institutional buyers         │  │  28 contacts (mostly demo)       │
│  Family Offices, WMs, Funds         │  │  8 deals (ALL demo)              │
│  Scored 0-100                       │  │  1 real contact                  │
│  60+ countries                      │  │  0 real deals                    │
│  PURPOSE: Outbound matching         │  │  PURPOSE: Inbound qualification  │
└─────────────────────────────────────┘  └──────────────────────────────────┘
```

---

## CAPITAL PROFILES CRM

### Statistics
| Metric | Value |
|--------|-------|
| Total contacts | 7,342 |
| With email | 67 (0.9%) |
| Without email | 7,275 (99.1%) |
| A+ tier (score ≥80) | 116 |
| A tier (score 70-79) | ~340 |
| B tier (score 60-69) | ~620 |
| C tier (score <60) | ~6,266 |

### Geographic Distribution
| Country | Count | % |
|---------|-------|---|
| United States | 3,010 | 41% |
| United Kingdom | 882 | 12% |
| France | 748 | 10% |
| United Arab Emirates | 504 | 7% |
| Germany | 380 | 5% |
| Switzerland | 280 | 4% |
| Other (55+ countries) | 1,538 | 21% |

### Profile Types
| Type | Approx Count | Ticket Size |
|------|-------------|------------|
| Family Office | ~1,701 | €2M–€50M+ |
| Wealth Manager | ~1,470 | €500K–€10M |
| Fund / PE | ~1,550 | €10M–€500M |
| Introducer | ~800 | Referral |
| VC | ~400 | €1M–€50M |
| Private Banker | ~600 | €1M–€20M |
| Other | ~821 | Various |

### Scoring Model
```
Score 0-100 (ML-calculated):
  Name quality:       10 pts
  Organization data:  15 pts
  Role seniority:     20 pts
  Contact info:       25 pts (email=high, phone=medium)
  Country premium:    15 pts (UAE/CH/US = high)
  Profile type:       15 pts (Family Office = highest)

Threshold levels:
  A+: ≥80 → 116 contacts (auto-trigger deal pack)
  A:  70-79 → ~340 contacts (priority outreach)
  B:  60-69 → ~620 contacts (secondary outreach)
  C:  <60   → ~6,266 (bulk email only)
```

### What's Usable TODAY
```
67 contacts have email → Contact immediately via Resend
Email cost: ~€0 (Resend free tier: 3,000/month)
Time required: 60 minutes to draft, 10 minutes to send
Expected reply rate: 2-5% = 1-3 replies
Expected meeting rate: 0.5-1% = 0-1 meeting
```

---

## PORTAL CRM

### Contacts Table (28 rows)
| Category | Count | Details |
|----------|-------|---------|
| Demo/seeded | ~27 | System generated, fake data |
| Real contacts | 1 | ISABELGRILO@GMAIL.COM (2026-06-03) |
| Contacted | 0 | No outreach evidence |
| In pipeline | 0 | No active pipeline |

### Deals Table (8 rows)
| Category | Count |
|----------|-------|
| Real deals | 0 |
| Demo deals | 8 |
| Active pipeline | 0 |
| Revenue | €0 |

### Activities Table (8 rows — ALL DEMO)
```
8 demo activities (call/email/meeting/note)
0 real activities
0 real logged interactions
```

### Matches Table (17 rows — ALL DEMO)
```
17 demo property-buyer matches
Match scores: all artificial
0 real matches from actual buyers
```

---

## CRM PIPELINE STAGES

```
CONFIGURED PIPELINE:
  prospecting → qualified → proposal → negotiation → closed_won → closed_lost
  
ACTUAL PIPELINE:
  prospecting: 8 demo contacts
  qualified:   0
  proposal:    0
  negotiation: 0
  closed_won:  0 (€0 revenue)
  closed_lost: 0
```

---

## LEAD SCORING SYSTEM

### For capital_profiles
```
Automated:  lib/scoring/capitalProfileScorer.ts
Cron:       /api/cron/lead-score (Mon-Fri 06:15)
Last run:   Unknown (no evidence)
Scores:     All 7,342 already scored (from import)
```

### For portal contacts
```
Manual:     Score field in contacts table
Auto-score: /api/contacts/score (POST)
Current:    All 28 have scores (demo values)
```

---

## CRM DEDUPLICATION

```
System: lib/crm/dedup.ts
Method: Email match + LinkedIn URL match
Status: Configured
Last run: Unknown
Real dedup needed: 0 (contacts table has ~1 real contact)
```

---

## WHAT'S USED VS UNUSED

### USED (evidence-based)
| Feature | Evidence |
|---------|---------|
| capital_profiles read | API queries return data |
| Scoring display | Portal shows scores |
| Country filtering | capital_profiles.country_iso used |
| Contact CRUD | 28 rows exist |

### UNUSED (zero evidence)
| Feature | Status |
|---------|--------|
| Outreach queue | 3,120 items, 0 sent |
| Email sequences | 0 emails sent |
| Follow-up automation | n8n local only |
| Pipeline progression | 0 stage changes |
| Activity logging | 8 demo activities |
| Deal creation | 0 real deals |
| Lead enrichment | 99.1% no email |
| CRM analytics | 0 real pipeline data |

---

## THE CRM GAP

```
HAVE:   7,342 institutional buyers, scored and ready
NEED:   1 property to match them to
HAVE:   68 contacts with email
NEED:   1 email campaign to launch
HAVE:   Sofia AI to qualify interested buyers
NEED:   Someone to actually open the portal and press send

Gap is NOT technology. Gap is execution.
```

---

*Evidence: Supabase REST API (2026-06-14), forensic-inventory/05_CRM_MAP.md*
