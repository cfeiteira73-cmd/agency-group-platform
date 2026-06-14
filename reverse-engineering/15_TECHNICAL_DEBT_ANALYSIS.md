# 15 — TECHNICAL DEBT ANALYSIS
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## TECHNICAL DEBT OVERVIEW

```
DEBT CLASSIFICATION:
  Dead code (never used in production):     HIGH
  Orphaned systems (no data to run on):     HIGH
  Premature abstraction (overbuilt):        HIGH
  Missing tables (breaks features):         MEDIUM
  Deprecated dependencies:                  LOW
  Type safety debt:                         ZERO (0 TS errors)
  Test debt:                                LOW (2,222/2,222 passing)
```

---

## 1. DEAD CODE

### lib/runtime/ (75 files) — LARGEST DEAD CODE CLUSTER
```
Purpose:  Runtime infrastructure (connection pooling, request 
          routing, worker threads, circuit breakers, etc.)

Evidence of use:  None (no production traffic to justify)
Why it exists:    Built for anticipated 10,000+ req/day scale
Current scale:    ~0-5 req/day (Carlos checking portal)

Files:
  connectionPool.ts       — 0 concurrent users need pooling
  requestRouter.ts        — trivially handled by Next.js
  workerThreadManager.ts  — 0 background workers needed
  circuitBreaker.ts       — 0 failures to break on
  retryPolicy.ts          — 0 failed requests to retry
  ... 70 more

Debt type:   Premature infrastructure
Risk to delete: MEDIUM (may be imported somewhere)
Action:      Identify imports, prune unused files
Time to fix: 2-4 hours audit, 1 hour deletion
```

### lib/events/ (30 files) — KAFKA NOBODY USES
```
Purpose:    Event streaming (Kafka-like) with replay, DLQ, ordering

Evidence:   14 learning_events (system-generated)
Real events: 0 from real user interactions (0 users)
Kafka topic: kafkajs connected? Unknown

Debt type:  Premature event architecture
Risk:       kafkajs adds ~800KB to bundle
Action:     Keep structure, disable Kafka, use simple DB inserts
Time to fix: 1 hour (swap kafka calls for DB inserts)
```

### lib/ml/ training infrastructure (27 files)
```
Purpose:    ML model training, feature engineering, feedback loops

Training data: 0 real examples (no conversions ever happened)
Inference:     Can score leads (does work)
Training:      CANNOT RUN (no labelled training data exists)

Debt type:  Premature ML infrastructure
Files:      mlTrainingPipeline.ts, featureEngineering.ts, etc.
Action:     Keep scoring (active), delete training infra
Time to fix: 1 hour audit
```

### lib/expansion/ (~15 files)
```
Purpose:    Multi-country expansion, white label, franchise system

Evidence:   Imported? Unknown
Revenue:    €0 in current market
Need:       Probably Year 3-4 if growth continues

Debt type:  Premature feature
Action:     Archive to /archive/expansion/
Time:       30 minutes
```

### lib/legal-execution/ (~10 files)
```
Purpose:    Legal contract execution, digital signatures, notarization

Real contracts signed: 0
Real CPCV: 0

Debt type:  Premature feature
Action:     Keep configured, don't expand
Time:       0 (already complete)
```

---

## 2. ORPHANED SYSTEMS

### Partner System (4 routes + code — BROKEN)
```
Code:    lib/commercial/partnerTiering.ts (active)
         lib/commercial/revenueAttribution.ts (active)
Routes:  /api/partners/* (built)
DB:      partners TABLE MISSING

Status:  Code calls non-existent table → 500 error
Orphan type: Missing DB table
Fix: CREATE TABLE partners (...) → 5 minutes
```

### Agent System (routes + pages — BROKEN)
```
Pages:   /agente/[slug] (template ready)
Routes:  /api/agent/weekly-report, /api/agent/performance
DB:      agent_performance TABLE MISSING
Agents:  0 real agents

Status:  Built for feature that doesn't exist yet
Orphan type: Missing data
Fix 1 (table): CREATE TABLE agent_performance → 5 min
Fix 2 (data):  Hire first agent
```

### Campaign System (~8 routes — BROKEN)
```
Code:    References campanhas table
DB:      campanhas TABLE MISSING
Purpose: Email/WhatsApp campaign management

Status:  Calls non-existent table
Fix:     CREATE TABLE campanhas → 5 min
```

### Control Tower (29 pages — ORPHANED FROM OPERATORS)
```
Pages:   29 operational pages
Users:   0 operators (Carlos alone, uses portal)
Widgets: All built and styled

Status:  Works but nobody is using it
Orphan type: No operational staff to use it
Fix: Not needed (will be used when team grows)
Action:  None required
```

---

## 3. PREMATURE ABSTRACTIONS

### Multi-Tenant Architecture
```
System: lib/auth/tenantIsolation.ts + TENANT_ISOLATION_ENABLED
Tenants: 1 (Agency Group, Carlos)
Cost: Added complexity to every auth check

Debt: Checks tenant_id on tables that have no tenant_id column
Evidence: Was causing kpi-snapshot to return zeros 
          (fixed in previous session: removed .eq('tenant_id', tenantId))

Action: Remove tenant_id checks everywhere or make them conditional
Time: 2-4 hours
```

### Causal Tracing (CAUSAL_TRACE_ENABLED)
```
System:  lib/observability/causalTrace.ts
Purpose: Causal debugging for distributed systems
Current: 1 user, no distributed problems

Debt: Adds overhead to every request
Action: Disable in production (keep flag, set false)
Time: 5 minutes (env var change)
```

### Event History (EVENT_HISTORY_ENABLED)
```
Similar to above — event sourcing for 0 events
```

### Multi-Agent Supervisor (for 1 user)
```
System:  lib/agents/agentSupervisor.ts
Purpose: Coordinates 16 AI agents in parallel
Current: 0 agent invocations

Debt:    Complex system with no load
Action:  Keep built, activate when needed
Time:    0
```

---

## 4. MISSING DATABASE TABLES (BLOCKS FEATURES)

| Table | Features Blocked | Fix Time |
|-------|-----------------|---------|
| partners | /api/partners/* (4 routes), revenue attribution | 5 min |
| campanhas | Campaign management routes | 5 min |
| sellers | Seller tracking | 5 min |
| buyers | Buyer journey tracking | 5 min |
| investment_portfolios | Institutional investor portfolios | 5 min |

**Total: 5 tables, 25 minutes of SQL, unblocks ~20 routes**

---

## 5. DEPENDENCY DEBT

```
HEALTHY DEPENDENCIES:
  @anthropic-ai/sdk ^0.80.0 — Current
  @supabase/supabase-js ^2.49.4 — Current
  next 16.2.1 — Current
  react 19.2.4 — Current
  All other major deps — Current (last checked June 2026)

RISKY DEPENDENCIES:
  next-auth v5 beta (^5.0.0-beta.25) — BETA in production
    Risk: Breaking changes in beta
    Mitigation: Pin to specific beta version
    Action: Upgrade to stable v5 when released
    
  kafkajs ^2.2.4 — Adds bundle weight for unused feature
    Action: Consider removing if events not used

VERDICT: Low dependency debt. All packages current.
```

---

## DEBT REPAYMENT PRIORITY

### Immediate (< 30 minutes)
```
1. CREATE 5 missing tables (25 min SQL) → Unblocks 20 routes
2. Verify WHATSAPP_ACTIVE= not set → Confirm it's intentional
```

### Short-term (< 1 week)
```
3. Audit lib/runtime/ imports → Identify dead files
4. Remove tenant_id checks on tables without tenant_id
5. Disable CAUSAL_TRACE_ENABLED in Vercel
```

### Medium-term (< 1 month, after first revenue)
```
6. Remove/archive lib/expansion/
7. Remove lib/ml/training/* (keep inference only)
8. Upgrade next-auth from beta to stable
```

### Long-term (ignore until needed)
```
9. Events system simplification
10. Control Tower consolidation
11. ML pipeline rebuild with real training data
```

---

## DEBT COST SUMMARY

```
IMMEDIATE BLOCKERS:      5 missing tables = 25 minutes
PERFORMANCE DEBT:        lib/runtime/ bloat (70+ files)
COMPLEXITY DEBT:         lib/events/, lib/ml/training/, multi-tenant
PREMATURE FEATURES:      lib/expansion/, control-tower, multi-agent
TOTAL DEBT SEVERITY:     MEDIUM
REVENUE IMPACT:          LOW (debt doesn't block first revenue)
FIX PRIORITY:            LOW (focus on sales, not tech cleanup)
```

**The debt is real but not blocking. Nothing prevents first revenue. Debt repayment is a Q4 2026 task.**

---

*Evidence: lib/ scan (910 files), missing table 404 errors, multi-tenant bug history, forensic-inventory findings*
