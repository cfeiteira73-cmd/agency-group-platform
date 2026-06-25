# 21 — FALSE CLAIMS AND AUDIT RECONCILIATION
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

This report reconciles every major claim from previous audit sessions that was contradicted by evidence in a later session. Older sessions are listed as SUPERSEDED with their correction.

---

## False Claim Ledger

### FC-001: "TypeScript: 1,083 errors in 158 files"
| Field | Value |
|-------|-------|
| Source | master-audit session 2026-06-23 (agency_group_master_audit_2026-06-23.md) |
| Claimed | TS had 1,083 errors in 158 files |
| Actual | **0 errors** (confirmed: `tsc.CMD --noEmit` in PowerShell, 2026-06-24 and 2026-06-25) |
| Root cause | The 2026-06-23 audit ran `node node_modules/.bin/tsc` — on Windows this is a bash shell script, not a CMD/PowerShell executable. The call failed with a shell error, which was misread as TS errors. |
| Status | CORRECTED — 0 errors is the truth |

---

### FC-002: "11 n8n workflows"
| Field | Value |
|-------|-------|
| Source | reverse-engineering/11_AUTOMATION_GENOME.md (2026-06-14) and all prior audits |
| Claimed | 11 n8n workflow JSON files |
| Actual | **21 JSON workflow files** (workflows a through r, plus post-close, property-ai, wf_g_current, duplicates) |
| Root cause | Previous count enumerated only alphabetically-named workflows a-k (11 letters), and missed l-r plus the non-letter-named files |
| Status | CORRECTED — 21 workflows |

---

### FC-003: "kpi_snapshots = 0 rows"
| Field | Value |
|-------|-------|
| Source | First live audit sessions (2026-04 through 2026-05) |
| Claimed | kpi_snapshots table was empty |
| Actual | **47+ rows confirmed** (revenue-activation/02_DATABASE_REALITY_CHECK.md, 2026-06-24) |
| Root cause | Table was empty at early audit time; the cron runs daily at 23:55 UTC and has been accumulating data since launch (2026-04-24) |
| Status | CORRECTED — 62+ rows expected by 2026-06-25 |

---

### FC-004: "properties API returning real data"
| Field | Value |
|-------|-------|
| Source | Implied in all audits before 2026-06-11 |
| Claimed | `/api/properties/public` was working |
| Actual | **API was broken from launch until 2026-06-11** — used wrong column names (`title/zone/price` instead of `nome/zona/preco`) |
| Root cause | Schema migration renamed columns; API was not updated |
| Fix | commit 1760efe (2026-06-11) |
| Revenue impact | Users visiting /imoveis saw 0 properties for 48 days (2026-04-24 to 2026-06-11) |
| Status | CORRECTED and FIXED |

---

### FC-005: "WhatsApp webhook causing crashes"
| Field | Value |
|-------|-------|
| Source | reverse-engineering reports (2026-06-14) |
| Claimed | WhatsApp webhook was crashing with `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` |
| Actual | **Fixed in commit 1760efe** (2026-06-11) |
| Root cause | `timingSafeEqual` was called with buffers of different lengths |
| Status | CORRECTED and FIXED |

---

### FC-006: "Sofia has 0 rows in both conversations tables"
| Field | Value |
|-------|-------|
| Source | All audits |
| Claimed | sofia_conversations = 0, sofia_conversation_turns = 0 |
| Actual | **Confirmed true as of 2026-06-24** — 0 real buyer conversations |
| Status | CONFIRMED TRUE — not a false claim |

---

### FC-007: "CRM contacts ≈ 7,000-18,000"
| Field | Value |
|-------|-------|
| Source | Some high-level summaries confused `leads` and `contacts` tables |
| Claimed (implied) | CRM had thousands of real contacts |
| Actual | `contacts` table = **28 rows** (27 seeded + 1 real external) |
| Root cause | `leads` table (18,042 rows) is a SEPARATE table — Lead Engine data, NOT CRM contacts |
| Status | CORRECTED — two completely different tables |

---

### FC-008: "RPC function uses lead_ids (plural)"
| Field | Value |
|-------|-------|
| Source | alerts/push route before commit 472a95e |
| Claimed | The RPC function parameter was `lead_ids` |
| Actual | **Corrected to `lead_id` (singular)** in commit 472a95e |
| Status | CORRECTED and FIXED |

---

### FC-009: "Stage probability for CPCV = 90%"
| Field | Value |
|-------|-------|
| Source | lib/constants/pipeline.ts before commit 8aa4f63 |
| Claimed | CPCV stage probability was 90% |
| Actual | **Corrected to 70%** in commit 8aa4f63 (CPCV is signed but not completed) |
| Status | CORRECTED and FIXED |

---

### FC-010: "Lazy Proxy in gateway.ts was broken"
| Field | Value |
|-------|-------|
| Source | Identified in reverse-engineering audit 2026-06-14 |
| Claimed | Anthropic client instantiated at module load in test environment |
| Actual | **Fixed in commit 8aa4f63** — lazy Proxy pattern prevents jsdom browser-env error |
| Status | CORRECTED and FIXED |

---

## Contradictory Audits Summary

| Previous Audit | Major Error | Source |
|---------------|-------------|--------|
| 2026-06-23 master-audit (Score 57/100) | TS 1,083 errors (false) | Windows shell bug |
| 2026-06-14 reverse-engineering (Score 94/100 tech) | 11 n8n workflows (false) | Incomplete file count |
| 2026-04-06 final-reality (Score 46/100) | kpi_snapshots=0 (stale) | Early audit date |
| Multiple | CRM = 7K+ contacts (false) | leads/contacts table confusion |

---

## Reconciled True State (2026-06-25)

| Metric | True Value |
|--------|-----------|
| TypeScript errors | 0 |
| n8n workflow files | 21 |
| kpi_snapshots rows | 62+ |
| CRM contacts (real) | 1 (ISABELGRILO@GMAIL.COM) |
| CRM contacts (demo/seeded) | 27 |
| Properties API | Working (since 2026-06-11) |
| Properties (real mandates) | 0 |
| Sofia conversations (real buyers) | 0 |
| Revenue | €0 |

---

*Evidence: PowerShell tsc.CMD output 2026-06-25 | n8n-workflows/ file scan | revenue-activation/02_DATABASE_REALITY_CHECK.md | git log commits 1760efe, 8aa4f63, 472a95e*
