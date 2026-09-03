# PLAYBOOK — PROPERTY DATA & EXPERIENCE
**Agency Group | Truth first. Never publish unverified listings.**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## PROPERTY DATA RULES
Every property published must have:
- [ ] Price: verified with owner/mandate (not estimated)
- [ ] Status: current (checked within 30 days)
- [ ] Photos: real, current, this property
- [ ] Area (m²): verified source noted
- [ ] Description: factually accurate, no invented features
- [ ] Publication rights: mandate or owner permission confirmed

## PROPERTY LIFECYCLE
DRAFT → VERIFICATION → ACTIVE → PRIVATE → RESERVED → UNDER_OFFER → SOLD → ARCHIVED

## SYSTEM OF RECORD
Supabase `properties` table = single truth.
Website reflects Supabase. Never the reverse.

## PRICE DISPLAY
- Always show asking price (not estimated)
- Show €/m² where area is verified
- Never show investment returns unless verified and sourced

## CONFIDENTIAL PROPERTIES
- Set to PRIVATE in Supabase
- MUST NOT appear in sitemap, schema.org, public search, search engines
- Access only after qualification

## STALE LISTING PROTOCOL
- Properties not verified in 30 days → flag for review
- Properties not verified in 60 days → PRIVATE until re-verified
- Never show stale listings silently

## NEVER
- Publish a property without a real mandate or explicit owner permission
- Show estimated prices as asking prices
- Show a property as available if status is unknown
