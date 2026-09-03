# PLAYBOOK — ANALYTICS & ATTRIBUTION
**Agency Group | Measure what matters. Ignore vanity metrics.**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## METRICS THAT MATTER (revenue-connected)
1. Qualified leads generated
2. Leads by source (email, organic, referral, social)
3. Lead → viewing conversion rate
4. Viewing → offer conversion rate
5. Average days to close
6. GCI by source
7. CAC by channel
8. Sofia conversation → lead conversion

## METRICS THAT DON'T MATTER
- Page views without source/conversion context
- Social media followers
- Email open rates without click/conversion
- AI feature usage without outcome tracking

## EVENTS TO TRACK (minimum)
- `property_viewed` — property_id, org
- `property_enquiry` — source, property_id
- `viewing_requested` — lead_id, property_id
- `lead_captured` — source, type (buyer/seller/investor)
- `sofia_conversation_started` — channel (web/whatsapp)
- `cpcv_signed` — deal_id, value

## FUNNEL TO MAINTAIN
```
LEAD → QUALIFIED → VIEWING → OFFER → CPCV → DEED
```
Measure drop-off at each stage. Fix the biggest leak first.

## ATTRIBUTION MODEL
- First touch: where did they first find us?
- Last touch: what triggered the final action?
- Preferred: both, linked by lead_id in Supabase

## NEVER
- Optimise for low-quality lead volume
- Report metrics without time context
- Present estimated data as measured data
