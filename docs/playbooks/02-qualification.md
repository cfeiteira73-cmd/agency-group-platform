# SOP 02 — Lead Qualification
**Owner:** Agent | **SLA:** Complete within 24h of intake | **Platform:** `/portal/crm`

## Qualification Framework (BANT-RE)

| Dimension | Questions | Weight |
|---|---|---|
| **B**udget | Total envelope confirmed? Cash or mortgage? Pre-approved? | 30% |
| **A**uthority | Decision maker? Spouse/partner involved? Power of attorney? | 20% |
| **N**eed | Urgency? Current situation? Pain point driving search? | 25% |
| **T**imeline | <3 months, 3–6 months, 6–12 months, 1 year+? | 15% |
| **Zone/Type** | Specific requirements? Flexibility on zone? | 10% |

## Qualification Decision Tree

```
Lead Received
    │
    ├─ Budget >€500K AND Timeline <6 months AND Authority confirmed?
    │       YES → Status: QUALIFIED (A-tier)
    │       NO  →
    │           ├─ Budget >€200K AND Timeline <12 months?
    │           │       YES → Status: QUALIFIED (B-tier)
    │           │       NO  →
    │           │           ├─ Any budget + clear intent?
    │           │           │       YES → Status: PROSPECT (nurture)
    │           │           │       NO  → Status: LEAD (cold)
```

## Tier Definitions

| Tier | Budget | Timeline | Action |
|---|---|---|---|
| A — Priority | >€500K | <3 months | Personal call within 2h, premium service |
| B — Active | €200K–€500K | 3–6 months | Standard qualification call |
| C — Nurture | <€200K or >6 months | >6 months | Automated sequence |

## Required CRM Fields After Qualification
All fields required before advancing to 'active':
- `budget_min` + `budget_max` ✓
- `preferred_locations` (min 1 zone) ✓
- `typologies_wanted` (min 1 type) ✓
- `timeline` ✓
- `financing_type` ✓
- `gdpr_consent` ✓ (MANDATORY — no further marketing without this)
- `qualification_notes` (min 50 chars) ✓

## Disqualification Criteria
Immediately mark as 'lost' + log reason if:
- Budget <€100K
- Looking outside Portugal/Spain/Madeira/Azores
- Already has signed contract elsewhere
- Refuses to provide contact info or consent

## Escalation
If genuinely uncertain on qualification: consult Carlos within same day.
