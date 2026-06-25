# 14 — INVENTORY / MANDATES FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Verdict

**The inventory system has sophisticated code and 0 verified real mandates.**

55 seeded demo properties. 0 signed mandate agreements. 0 properties to actually sell.

---

## Inventory Numbers

| Metric | Value |
|--------|-------|
| Properties in DB | **~55** |
| Verified real mandates | **0** |
| Off-market leads (developers) | **14** (offmarket_leads table) |
| Demo/seed properties | **55** (~100%) |
| Property pages live | ✅ (`/imoveis`, `/imoveis/[id]`) |

---

## Inventory System Architecture

### Tables
| Table | Purpose | Rows |
|-------|---------|------|
| `properties` | Main property listings | ~55 (seeded) |
| `offmarket_leads` | Developer/vendor contacts | 14 |
| `property_collections` | Saved property sets | Unknown |
| `price_history` | Price change tracking | Exists |
| `property_embeddings` | pgvector semantic search | Exists |

### API Routes
| Route | Purpose | Status |
|-------|---------|--------|
| `GET /api/properties/public` | Public listing | ✅ Fixed 1760efe |
| `GET/POST /api/properties` | Portal CRUD | ✅ Fixed 1760efe |
| `GET /api/properties/[id]` | Property detail | ✅ |
| `POST /api/properties/new` | Add property | ✅ |
| `GET /api/offmarket-leads` | Off-market pipeline | ✅ |
| `POST /api/offmarket-leads/score` | Lead scoring | ✅ |
| `POST /api/cron/avm-compute` | AVM batch | ✅ |

### Frontend Pages
| Route | Purpose | Status |
|-------|---------|--------|
| `/imoveis` | Property listings | ✅ Shows 55 demo properties |
| `/imoveis/[id]` | Property detail | ✅ |
| `/imoveis/premium/[id]` | Premium listing | ✅ |
| `/off-market` | Off-market section | ✅ |
| `/dashboard/properties` | Management dashboard | ✅ |
| `/dashboard/properties/new` | Add new property | ✅ |

---

## The Properties API Fix (Critical History)

**Before commit 1760efe (2026-06-11)**: The properties API used wrong column names:
- `title` instead of `nome`
- `zone` instead of `zona`
- `price` instead of `preco`

**Result**: All property queries returned empty or errored. The `/imoveis` page showed 0 properties despite 55 existing in DB.

**After fix**: Properties page shows all 55 demo properties correctly.

---

## Demo Properties Data

The 55 seeded properties include:
- Properties across Lisboa, Cascais, Algarve, Porto, Sintra
- Prices from €350K to €5M (demo ranges)
- Types: T0-T5, Moradia, Quinta, Comercial
- All with demo descriptions, AI-generated photos, coordinates
- NONE are real mandates

---

## Off-Market Pipeline (14 Leads)

The `offmarket_leads` table contains 14 developer/vendor contacts. These are candidates for co-agency agreements, not signed mandates.

| Field | Value |
|-------|-------|
| Total | 14 |
| Average score | Unknown |
| With email | Unknown |
| Contacted | 0 |
| Mandate signed | 0 |

---

## Mandate Intake System

Agency Group has built a mandate intake flow:

1. Developer/vendor contacts via website (`/vender`, `/vender-imovel-portugal`)
2. Form submits to CRM
3. Agent follows up
4. Mandate document generated
5. Property added to `properties` table

**Status**: The flow exists as code. 0 mandates have ever been signed.

---

## Connector Lists

The revenue-activation folder shows that connector lists exist:
- `revenue-activation/inventory/` — developer contacts for co-agency
- 14 off-market developer leads in DB

These 14 developers represent potential co-agency partners for the first real property.

---

## Path to First Real Property

```
1. Call 3 developers from offmarket_leads (3 hours, €0)
2. Pitch: "I have 7,342 international institutional buyers"
3. Sign co-agency agreement (1 week)
4. Get property details and photos
5. Add to properties table via /dashboard/properties/new
6. Sofia can present it to buyers
7. First showing → first offer → first commission
```

---

*Evidence: reverse-engineering/09_INVENTORY_ENGINE_DNA.md | properties API fix commit 1760efe | offmarket_leads table | 2026-06-25*
