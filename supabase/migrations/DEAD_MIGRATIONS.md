# Dead Migration Registry

This file is the canonical repository record for migrations that must never be
applied (or re-applied) to any environment.

---

## Migration 064 — `064_fix_profile_identity_fk.sql`

| Field | Value |
|---|---|
| Status | **DEAD — DO NOT APPLY** |
| Attempted | 2026-09-05 (production) |
| Outcome | Transaction rolled back. Zero intended mutations persisted. |
| Superseded by | **Migration 065** |

### Why 064 is dead

Migration 064 was written to correct the `profiles.id` foreign key from
`auth.users(id)` to `public.users(id)` (the Option B identity decision).
It was attempted in production but the transaction rolled back. No mutations
from 064 persisted in the production database.

Migration 065 was subsequently written and applied as the correct, canonical
version of this identity correction. **Migration 065 is applied and live.**

### What this means for operators

- `profiles.id → public.users(id)` is already correct in production (via 065).
- Running 064 again would attempt to redo work that is already complete.
- Even though 064 contains idempotency guards, the absolute rule is: **never execute it**.
- The safe state is to leave 064's SQL file in place (as historical record) and
  never pass it to any migration runner.

### Protected invariants

- `public.users` is the canonical application identity table.
- `profiles.id → public.users(id)` (ON DELETE RESTRICT) is the live FK.
- `demand_mandates.owner_id → profiles.id` is the mandate ownership chain.
- Do NOT reconnect `profiles.id` to `auth.users`. Option B is final and irreversible.
- Do NOT populate `auth.users` rows to "fix" any FK. That reverses Option B.

### Migrations that ARE applied in production

| Migration | Status | Notes |
|---|---|---|
| 059 | Applied | Demand mandate schema, 8 tables |
| 060 | Applied and verified | geography_nodes AUTONOMOUS_REGION level |
| 061 | Superseded — DO NOT APPLY | Assumed auth.users canonicality (wrong) |
| 062 | NEVER APPLY | |
| 063 | Applied | create_demand_mandate_v1 RPC |
| **064** | **DEAD — NEVER APPLY** | Failed; superseded by 065 |
| 065 | Applied | Canonical identity correction (profiles.id → public.users) |

---

*Last updated: 2026-09-13. Governed by Foundation Hardening Gate D4.*
