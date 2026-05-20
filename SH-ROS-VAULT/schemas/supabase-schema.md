# SH-ROS Supabase Schema Reference
## Version: 1.0.0 | Created: 2026-05-19
## Project: isbfiofwpxqqpgxoftph | Region: eu-west

> All 28 tables documented. RLS = Row Level Security status.
> "System" tables = accessed only via service_role key (no RLS needed).

---

## Core Business Tables (6)

### contacts
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id     TEXT NOT NULL DEFAULT 'agency-group'
email         TEXT UNIQUE
phone         TEXT
full_name     TEXT NOT NULL
nationality   TEXT
language      TEXT DEFAULT 'pt'
budget_min    NUMERIC(12,2)
budget_max    NUMERIC(12,2)
property_type TEXT[]          -- ['apartment','villa','commercial']
locations     TEXT[]          -- preferred zones
urgency_score INTEGER         -- 0–100, computed by lead-scorer
lead_source   TEXT            -- 'whatsapp','web','referral','portal','cold'
lead_status   TEXT DEFAULT 'new'  -- new|qualified|active|inactive
assigned_to   TEXT            -- agent user_id
gdpr_consent  BOOLEAN DEFAULT FALSE
gdpr_date     TIMESTAMPTZ
notes         TEXT
metadata      JSONB DEFAULT '{}'
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```
**RLS**: Yes — agents see own contacts + shared contacts; admin sees all
**Indexes**: `(email)`, `(tenant_id, lead_status)`, `(tenant_id, nationality)`, `(tenant_id, budget_min, budget_max)`

---

### deals
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id         TEXT NOT NULL DEFAULT 'agency-group'
contact_id        UUID REFERENCES contacts(id)
property_id       UUID REFERENCES properties(id)
stage             TEXT NOT NULL DEFAULT 'MATCH'
  -- MATCH|DECISION|DEAL_PACK|SEND|FOLLOWUP|VIEWING|PROPOSAL|NEGOTIATION|CPCV|ESCRITURA|CLOSED|LOST
assigned_agent    TEXT            -- user_id
deal_value        NUMERIC(12,2)   -- transaction price
commission_rate   NUMERIC(5,4) DEFAULT 0.05
commission_split  JSONB           -- { agent: 0.5, company: 0.5 }
cpcv_date         DATE
escritura_date    DATE
lost_reason       TEXT
correlation_id    TEXT            -- links to event_history + causal_trace
notes             TEXT
metadata          JSONB DEFAULT '{}'
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```
**RLS**: Yes — assigned_agent sees own; admin sees all
**Indexes**: `(tenant_id, stage)`, `(tenant_id, assigned_agent)`, `(correlation_id)`, `(cpcv_date)`, `(escritura_date)`

---

### properties
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       TEXT NOT NULL DEFAULT 'agency-group'
reference       TEXT UNIQUE     -- internal ref e.g. AG-2026-001
title           TEXT NOT NULL
description     TEXT
property_type   TEXT NOT NULL   -- apartment|villa|commercial|land|office
status          TEXT DEFAULT 'active'  -- active|reserved|sold|off-market
price           NUMERIC(12,2) NOT NULL
area_m2         NUMERIC(8,2)
bedrooms        INTEGER
bathrooms       INTEGER
zone            TEXT            -- Lisboa|Porto|Algarve|Madeira|Açores|Cascais|...
address         TEXT
latitude        NUMERIC(10,8)
longitude       NUMERIC(11,8)
features        TEXT[]          -- ['pool','garage','sea_view','concierge',...]
photos          TEXT[]          -- S3/CloudFront URLs
floor_plan_url  TEXT
matterport_url  TEXT
embedding       vector(1536)    -- pgvector for semantic search
avm_estimate    NUMERIC(12,2)
avm_updated_at  TIMESTAMPTZ
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```
**RLS**: Yes — active properties readable by all authenticated; mutations by admin/agent only
**Indexes**: `(tenant_id, status, zone)`, `(price)`, `embedding ivfflat(lists=100) ops=vector_cosine_ops`

---

### matches
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id   TEXT NOT NULL DEFAULT 'agency-group'
contact_id  UUID REFERENCES contacts(id)
property_id UUID REFERENCES properties(id)
score       INTEGER NOT NULL        -- 0–100
tier        TEXT NOT NULL           -- HIGH|MEDIUM|LOW
score_breakdown JSONB               -- { budget:30, location:25, type:20, features:15, urgency:10 }
auto_triggered  BOOLEAN DEFAULT FALSE  -- true if deal pack auto-generated
deal_pack_id    UUID REFERENCES deal_packs(id)
correlation_id  TEXT
computed_at     TIMESTAMPTZ DEFAULT NOW()
UNIQUE(contact_id, property_id)
```
**RLS**: Yes
**Indexes**: `(tenant_id, score DESC)`, `(contact_id)`, `(property_id)`, `(tier, auto_triggered)`

---

### deal_packs
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       TEXT NOT NULL DEFAULT 'agency-group'
deal_id         UUID REFERENCES deals(id)
contact_id      UUID REFERENCES contacts(id)
property_id     UUID REFERENCES properties(id)
generated_by    TEXT DEFAULT 'auto'  -- 'auto'|'manual'
pdf_url         TEXT                 -- S3 URL
status          TEXT DEFAULT 'draft' -- draft|ready|sent|opened|responded
sent_at         TIMESTAMPTZ
opened_at       TIMESTAMPTZ
responded_at    TIMESTAMPTZ
response_type   TEXT                 -- positive|negative|question|no_response
correlation_id  TEXT
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT NOW()
```
**RLS**: Yes
**Indexes**: `(tenant_id, status)`, `(contact_id, created_at DESC)`, `(deal_id)`

---

### priority_items
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id   TEXT NOT NULL DEFAULT 'agency-group'
agent_id    TEXT NOT NULL
item_type   TEXT NOT NULL    -- follow_up|deal_review|new_match|lead_qualify|document
reference_id UUID            -- deal_id or contact_id or match_id
priority    INTEGER DEFAULT 50  -- 0=urgent, 100=low
due_date    TIMESTAMPTZ
completed   BOOLEAN DEFAULT FALSE
completed_at TIMESTAMPTZ
title       TEXT NOT NULL
description TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```
**RLS**: Yes — agents see own items; admin sees all
**Indexes**: `(agent_id, completed, due_date)`, `(tenant_id, priority ASC)`

---

## AI & Intelligence Tables (6)

### learning_events
- Stores training signals: event_type, input, output, outcome, feedback_score, created_at
- No RLS | Index: (event_type, outcome, created_at)

### ai_audit_log
- Every AI call: agent_id, tenant_id, model, prompt_hash, output_hash, tokens_input, tokens_output, cost_usd, latency_ms, correlation_id, fallback_used, created_at
- No RLS | Index: (tenant_id, agent_id, created_at DESC), (correlation_id)

### causal_trace
- Full schema in architecture/causal-graph.md
- No RLS | Index: (correlation_id, step), (revenue_impact DESC), (agent_id)

### agent_memory
- agent_id, tenant_id, key, value (JSONB), ttl (TIMESTAMPTZ nullable), updated_at
- RLS: Yes | Index: (agent_id, tenant_id, key)

### ai_feedback
- audit_log_id (FK ai_audit_log), rating (1–5), comment, rated_by, created_at
- RLS: Yes | Index: (audit_log_id), (rating)

### policy_tuning_log
- rule_id, old_value (JSONB), new_value (JSONB), changed_by, reason, created_at
- No RLS | Index: (rule_id, created_at DESC)

---

## CRM & Engagement Tables (5)

### investidores
- investor profiles: contact_id (FK), portfolio_value, risk_profile, preferred_yield, property_types[], created_at
- RLS: Yes | Index: (tenant_id, risk_profile)

### campanhas
- campaign definitions: name, type (email|whatsapp|push), status, subject, body, segments (JSONB), scheduled_at, sent_count, open_count, created_at
- RLS: Yes | Index: (tenant_id, status, scheduled_at)

### sofia_conversations
- contact_id (FK), tenant_id, channel (whatsapp|web), messages (JSONB array), last_message_at, created_at
- RLS: Yes | Index: (contact_id, channel), (tenant_id, last_message_at DESC)

### property_collections
- contact_id (FK), tenant_id, name, property_ids (UUID[]), created_at, updated_at
- RLS: Yes | Index: (contact_id)

### used_magic_tokens
- token_hash (TEXT UNIQUE), email, expires_at, used_at, created_at
- No RLS | Index: (token_hash), (expires_at) for GDPR purge cron

---

## Infrastructure Tables (7)

### event_history
- Full schema in architecture/event-system.md
- No RLS | Retention: indefinite

### usage_events
- tenant_id, service (anthropic|openai|resend|...), tokens/calls count, cost_usd, period (YYYY-MM), created_at
- No RLS | Index: (tenant_id, service, period)

### job_queue
- id, tenant_id, job_type, payload (JSONB), status (pending|processing|done|failed|dlq|dead), attempts, max_attempts, scheduled_at, started_at, completed_at, error_message
- No RLS | Index: (status, scheduled_at), (tenant_id, job_type)

### secret_rotation_log
- secret_name, rotated_at, rotated_by, expiry_date, notes
- No RLS | Index: (secret_name, rotated_at DESC)

### security_events
- event_type, severity (INFO|LOW|MEDIUM|HIGH|CRITICAL), tenant_id, user_id, ip_address, details (JSONB), created_at
- No RLS | Index: (severity, created_at DESC), (tenant_id, created_at DESC)

### embeddings
- content_id (UUID), content_type (property|contact|blog|faq), content_text, embedding vector(1536), metadata (JSONB), created_at
- No RLS | Index: embedding ivfflat(lists=100) vector_cosine_ops, (content_type, content_id)

---

## Vault Tables (4)

### vault_events
- vault_path, action (create|update|delete|hash_check), actor, hash_before, hash_after, created_at
- No RLS | Append-only

### vault_file_hashes
- file_path (UNIQUE), sha256_hash, file_size_bytes, last_verified_at
- No RLS

### vault_snapshots
- snapshot_date (DATE UNIQUE), status (pending|complete|failed), file_count, total_size_bytes, s3_path, created_at
- No RLS

### vault_integrity_scores
- score NUMERIC(5,2), checked_at TIMESTAMPTZ, violations (JSONB array), files_checked INTEGER, files_changed INTEGER
- No RLS | Index: (checked_at DESC)
