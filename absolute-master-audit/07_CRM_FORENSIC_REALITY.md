# 07 — CRM FORENSIC REALITY
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Verdict

**The CRM is a production-grade UI waiting for data.**

Technically complete. Commercially near-empty. 28 contacts (mostly demo), 8 deals (demo), 0 real commercial relationships.

---

## CRM Architecture

The Agency Group platform has TWO parallel contact databases:

| Database | Table | Rows | Purpose |
|----------|-------|------|---------|
| **Lead Engine** | `leads` | 18,042 | B2B outreach targets (Apify-sourced) |
| **Capital Network** | `capital_profiles` | 7,342 | Institutional buyer network |
| **CRM** | `contacts` | 28 | Operational CRM contacts |

The CRM (`contacts` table) is the smallest of the three. It's designed to be the operational system for active deal management, but 18,042 leads have never been imported into it.

---

## Table-by-Table Reality

### contacts (28 rows)

| Field | Status |
|-------|--------|
| id | ✅ |
| name | ✅ |
| email | ✅ (1 confirmed real external: ISABELGRILO@GMAIL.COM) |
| phone | ✅ |
| buyer_score | ✅ (scoring logic exists) |
| stage | ✅ (pipeline stages exist) |
| owner | ✅ |
| country | ✅ |
| created_at | ✅ |

Reality: 27 demo contacts + 1 real external contact.

### deals (8 rows)

All demo/seed data. Fields include:
- deal reference
- property link
- buyer/seller
- stage (Angariação through Escritura)
- expected_fee
- commission %
- status

No real deal ever processed.

### activities (8 rows)

Demo activity log entries. Types: call, email, visit, note.

### matches (17 rows)

Demo buyer-property matches. The matching algorithm runs but has no real buyer profiles to work with.

### profiles (0 rows)

Agent/user profiles table. **Empty.** No agent has ever created a profile.

---

## CRM Capabilities (What Works Today)

| Capability | Code Exists | Works | Used |
|-----------|-------------|-------|------|
| Create contact | ✅ | ✅ | ⚠️ Only demo |
| Create deal | ✅ | ✅ | ⚠️ Only demo |
| Pipeline stages | ✅ | ✅ | ⚠️ Only demo |
| Buyer scoring | ✅ | ✅ | ⚠️ No real buyers |
| Activity logging | ✅ | ✅ | ⚠️ Only demo |
| Commission calculator | ✅ | ✅ | ⚠️ Only demo |
| Expected fee calc | ✅ | ✅ | ⚠️ Only demo |
| CRM search | ✅ | ✅ | ⚠️ Only demo |
| CSV export | ✅ | ✅ | ⚠️ Only demo |
| Deal packs | ✅ | ✅ | ⚠️ Only demo |
| Priority items | ✅ | ✅ | ⚠️ Only demo |
| AI-powered matching | ✅ | ✅ | ⚠️ No real data |
| Task management | ✅ | ✅ | ⚠️ Only demo |

---

## How Contacts Are Created

**Manual**: Carlos can create contacts through the portal dashboard UI (`/dashboard`, `/portal`).

**Import**: Bulk import SQL scripts exist (`RUN_CRM_IMPORT.sql`, untracked). They are NOT committed and have NOT been run.

**Automated**: Lead Engine → CRM import was built but NOT run. 18,042 leads remain in `leads` table, not in `contacts`.

**From website**: Contact form at `/contacto` can create contacts.

---

## Pipeline Stages

```
Angariação → Lead → Qualificação → Visita Agendada → Visita Realizada
→ Proposta Enviada → Proposta Aceite → Negociação → Due Diligence
→ Financiamento → CPCV → CPCV Assinado → Escritura Marcada
→ Escritura → Escritura Concluída → Fechado → Pós-Venda
```

Probabilities: corrected in commit 8aa4f63 (angariacao=10%, cpcvassinado=70%, escritura=100%).

---

## What Carlos Can Do in CRM TODAY

1. Log in at agencygroup.pt
2. See 28 contacts in the CRM dashboard
3. Create new contacts manually
4. Create deals and move them through pipeline stages
5. Calculate expected commissions
6. See which leads are matched to which properties
7. View deal packs
8. Create priority action items

**What Carlos CANNOT do today:**
- See 18,042 leads in the CRM (they're in `leads` table, not `contacts`)
- Get automated follow-up sequences (n8n not deployed)
- See real buyers' activity (Sofia has 0 conversations)

---

## The Import Gap (Critical)

The largest commercial unlock is importing leads → contacts:

```
18,042 leads in DB
→ 0 imported to CRM contacts table
→ RUN_CRM_IMPORT.sql exists but not executed
→ Would require: Select top 500 A+ leads, run import SQL, assign stages
```

Estimated time to fix: **30 minutes**

---

*Evidence: revenue-activation/02_DATABASE_REALITY_CHECK.md | reverse-engineering/06_CRM_GENOME.md | contacts=28, deals=8 verified 2026-06-24*
