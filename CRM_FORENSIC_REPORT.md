# CRM FORENSIC REPORT
Agency Group | Phase 05 | Ultimate Institutional Master Audit | 2026-06-06
Fresh query from live database. No assumptions.

---

## CAPITAL_PROFILES FULL AUDIT

### Volume (confirmed)
| Metric | Value | Evidence |
|--------|-------|----------|
| Total contacts | 7,342 | REST API HEAD |
| Has email | 67 (0.9%) | Full scan |
| Has LinkedIn (valid, ≥35 chars) | 7,096 (96.7%) | Fresh scan |
| Has LinkedIn (invalid/cleared) | 246 (3.3%) | Fixed today |
| Has no LinkedIn at all | 0 | |
| total_score > 0 | 7,342 (100%) | Fixed previously |

### Tier Distribution
| Tier | Count | % |
|------|-------|---|
| A+ | 73 | 1.0% |
| A | 1,571 | 21.4% |
| B | 2,090 | 28.5% |
| C | 3,089 | 42.1% |
| D | 519 | 7.1% |

### Contact Status Distribution
| Status | Count | Notes |
|--------|-------|-------|
| NEW | 5,698 | No action taken |
| OUTREACH_QUEUED | 1,571 | A-tier (fixed today) |
| PENDING_CONTACT | 73 | A+ tier (fixed today) |

### Owner Distribution
| Owner | Count | Notes |
|-------|-------|-------|
| SOFIA | 5,179 | Automated |
| CARLOS | 1,644 | Personal (case bug fixed) |
| MARKETING | 519 | Newsletter only |

### Pipeline Distribution
| Pipeline | Count |
|---------|-------|
| ULTRA_CAPITAL | 4,414 |
| CONNECTORS | 1,292 |
| BUYERS | 1,184 |
| PARTNERS | 452 |

### Persona Distribution
| Persona | Count |
|---------|-------|
| FAMILY_OFFICE | 1,701 |
| WEALTH_MANAGER | 1,470 |
| REAL_ESTATE_FUND | 1,025 |
| INVESTOR | 997 |
| CONNECTOR | 816 |
| BROKER | 452 |
| ARCHITECT | 295 |
| PRIVATE_CLIENT_ADVISOR | 218 |

### Geographic Distribution
| Country | Count | % |
|---------|-------|---|
| US | 3,010 | 41% |
| GB | 881 | 12% |
| FR | 748 | 10% |
| AE | 504 | 7% |
| HK | 265 | 4% |
| CH | 261 | 4% |
| BE | 218 | 3% |
| IL | 215 | 3% |
| ES | 201 | 3% |
| SG | 147 | 2% |

---

## DATA QUALITY ISSUES FOUND

### Issue 1: 246 truncated LinkedIn URLs (FIXED)
Contacts with special characters (é, ê, ç, ô, etc.) in names had LinkedIn URLs truncated to 1-4 characters. These were cleared today.
- Examples: "Søren Bay" → "https://www.linkedin.com/in/s"
- Now: LinkedIn = '' (empty, needs enrichment)

### Issue 2: 5,698 contacts with status='NEW' (never contacted)
The entire A tier (1,571) + C+D tiers have never had any outreach action.

### Issue 3: Buying power field not fully populated
Sample buying power values: '€10M–€100M+', '€500K–€2M', '<€500K', '€2M–€10M'
This is a text field with range values — not queryable for precise filtering.

### Issue 4: next_action mostly empty
73 A+ contacts now have next_action set (fixed).
Remaining 7,269 have no next_action.

---

## DUPLICATE ANALYSIS

| Check | Result |
|-------|--------|
| lead_id UNIQUE index | Active — prevents exact duplicate import |
| LinkedIn URL duplicates | 24 (after clearing 246 truncated = now 0 true duplicates) |
| Name duplicates | Unknown |
| Email duplicates | Not a concern (only 67 emails) |

---

## CONTACTS TABLE (OPERATIONAL CRM)

| Metric | Value |
|--------|-------|
| Total records | 28 |
| Test records (t1-{ts}@test.com) | ~16 |
| Real-looking records | ~12 |
| Confirmed as real buyers | 0 |

**All "real-looking" contacts match the demo deals — seeded for UI demonstration.**

---

## FOUNDER LISTS (from Desktop Excel files)

| File | Count | Notes |
|------|-------|-------|
| FOUNDER_25.xlsx | 25 | Highest priority personal |
| FOUNDER_50.xlsx | 50 | |
| FOUNDER_100.xlsx | 100 | |
| ULTRA_CAPITAL_CONTACTABLE.xlsx | 65 | Contactable segment |
| TOP_20_REQUIRED_ASSETS.xlsx | 20 | Asset targeting |

These exist on Desktop only — NOT loaded into Supabase contacts.

---

## GAPS

| Gap | Impact | Fix |
|-----|--------|-----|
| Email: 0.9% coverage | CRITICAL | Apollo.io enrichment |
| 246 invalid LinkedIn cleared | MEDIUM | Manual enrichment from name+company |
| 5,698 contacts = 'NEW' | HIGH | Start outreach |
| No founder lists in Supabase | MEDIUM | Import from Desktop Excel |
| No real buyers in contacts table | CRITICAL | Log conversations |
