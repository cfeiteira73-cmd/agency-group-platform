# SOP 03 — Lead Routing & Assignment
**Owner:** Admin (Carlos) | **SLA:** 30 min from lead creation | **Platform:** `/portal/crm`

## Routing Principles
1. Route by zone expertise first, then by language, then by workload.
2. No agent should hold >20 active leads simultaneously without Carlos approval.
3. Any lead >€2M defaults to Carlos as lead agent.
4. Unassigned leads after 30 min trigger an alert to Carlos.

## Routing Decision Tree

```
New Lead Created
    │
    ├─ Deal value >€2M?
    │       YES → Assign: Carlos (lead), supporting agent if needed
    │
    ├─ Buyer language identified?
    │       YES → Match to agent with matching language
    │       NO  → Assign to next available agent
    │
    ├─ Zone preference identified?
    │       YES → Match to zone expert
    │            Lisboa → Agent: [Lisboa specialist]
    │            Cascais/Estoril → Agent: [Cascais specialist]
    │            Algarve → Agent: [Algarve specialist]
    │            Porto → Agent: [Porto specialist]
    │            Madeira → Agent: [Madeira specialist]
    │            Açores → Agent: [Açores specialist]
    │
    ├─ Referral from specific partner?
    │       YES → Assign agent that manages that partner relationship
    │
    └─ No specific match → Round-robin to lowest-loaded agent
```

## Assignment Rules by Lead Tier

| Tier | Assignment Rule | Response SLA |
|---|---|---|
| A (>€500K, <3mo) | Best-fit agent + Carlos notified | 15 min |
| B (€200K–€500K) | Best-fit agent | 30 min |
| C (nurture) | Any available agent | 2h |
| Referral | Partner's primary contact agent | 1h |

## Workload Caps

| Agent Status | Max Active Leads |
|---|---|
| Full capacity | 20 |
| Warning threshold | 16 |
| Auto-alert to Carlos | 18+ |

When an agent hits the cap, new leads route to next best-fit agent regardless of zone.

## Re-Assignment Protocol
Re-assignment requires:
1. Documented reason in CRM note
2. Notification to original agent
3. Notification to client (if relationship established)
4. Carlos approval if deal >€500K

Valid re-assignment reasons:
- Agent capacity exceeded
- Agent unavailable (illness, vacation)
- Language mismatch identified
- Client requests different agent
- Performance issue

## KPIs Tracked
- Time to assignment (target: <30 min)
- Assignment accuracy rate (right agent first time)
- Agent workload balance index
- Unassigned leads >30 min (target: 0)
