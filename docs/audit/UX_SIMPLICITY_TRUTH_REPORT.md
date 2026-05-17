# UX Simplicity Truth Report
AGENCY GROUP SH-ROS · 2026-05-17

---

## Dashboard Navigation Audit

**Nav items** (from `app/dashboard/layout.tsx`, in sidebar order):
1. Property AI Engine → `/dashboard/properties`
2. Acções Prioritárias → `/dashboard/actions`
3. Executive Revenue → `/dashboard/executive`
4. Centro de Conversão → `/dashboard/conversion-command`
5. Simulações → `/dashboard/simulations`
6. Brief Diário → `/dashboard/daily-brief`

**Critical ordering problem:** The Brief Diário (Daily Brief) is listed last in the nav, but it is the designed entry point for the agent's morning workflow. An agent opening the dashboard sees "Property AI Engine" first — a tool for property submission, not daily intelligence. The nav order should be inverted: Brief Diário first, then Acções Prioritárias, then everything else.

**Language inconsistency in nav:** "Property AI Engine" and "Executive Revenue" are in English. "Acções Prioritárias," "Centro de Conversão," "Simulações," and "Brief Diário" are in Portuguese. This mixed-language nav is jarring for a Portuguese-market product. Either commit to Portuguese throughout or add a language toggle.

**No active state indication:** The nav renders plain `<a>` tags without any active/current page highlighting. An agent cannot tell which section they are in from the sidebar alone.

---

## Screen-by-Screen Analysis

### /dashboard (Home)

**What the user sees first:** The dashboard homepage (`app/dashboard/page.tsx`) was not read in full during this audit. However, based on the layout.tsx structure and the conversion-command page's reference to "Modo demo · sem sessão activa," the home page likely renders a high-level KPI overview. The homepage uses two AbortControllers (`ctrl` on lines 235 and 246), suggesting at least two concurrent data fetches on load.

**3-action rule:** Unknown without reading the full page — but given the sidebar has 6 items, the home page is at risk of presenting too many options simultaneously.

### /dashboard/daily-brief

**Does it answer "what do I do today"?** Yes — clearly. The page is a single-column layout with:
1. Revenue opportunity card (prominent €amount, 4 quick stats)
2. Morning actions list (numbered, prioritized, with urgency chips and expected € impact)
3. Hot leads alert strip (pulsing red dot, CTA to actions page)
4. Alerts section (warning/info/success)
5. Top 3 opportunities grid
6. Footer with refresh button

**Clarity score: 8/10.** The information hierarchy is excellent. The Cormorant serif font for numbers and Jost for labels creates clear visual hierarchy. Urgency chips (AGORA/HOJE/ESTA SEMANA) are immediately scannable.

**Issues:**
- No navigation link between the Daily Brief and the Actions page other than the "Ver Contactos →" anchor in the hot leads strip. An agent finishing their morning review has no obvious "start executing" button that leads to the action queue.
- The page does not indicate when the brief was last generated vs. when data was last refreshed. The footer shows "gerado às HH:MM" but this reflects the API response timestamp, not necessarily real-time data.
- `fetchBrief()` has no AbortController. If a user navigates away mid-fetch, the request and state update continue. This is a minor memory leak risk.

### /dashboard/properties

**Cognitive load: LOW to MEDIUM.** The page is a clean data table with:
- 4 KPI cards (Total Properties, Live Listings, Processing, Avg Readiness)
- Status filter pills + search bar
- Table with 5 columns (Property, Status, Readiness, Demand, Updated)
- Load more pagination

**Issues:**
- The 4 KPI cards use a `gridTemplateColumns: 'repeat(4, 1fr)'` grid with no responsive breakpoint. On a tablet or narrow window, the 4 cards will overflow or compress into unusable widths. There is no `@media` query in the inline styles.
- The "Upload Property" button label is in English ("Upload Property") while the breadcrumb is in Portuguese ("Properties"). The empty state CTA is also "Upload Property →" in English.
- Status badge labels are in English (Ingesting, Analyzing, Enriching, Generating, Reviewing, Live, Archived). In a Portuguese-first product, these should be localized.
- Client-side search (`filtered = submissions.filter(...)`) only filters the currently loaded page (up to 20 items), not the full dataset. An agent with 200 properties searching by description will miss 180 results. Server-side search is needed.

### /dashboard/properties/[id]

Not read directly in this audit. Based on the positioning docs' reference to "PricingIntelligencePanel adds ~8 sections," this page carries high information density risk. The audit template flags this as potentially overwhelming — that assessment stands pending a full read of the detail page.

### /dashboard/conversion-command

**Is it clear to a non-technical agent?** Partially. The page structure is:
1. Sticky header with breadcrumb and subtitle
2. Demo controls (property value input, buyer profile selector) — labeled "Modo demo · sem sessão activa"
3. Two-column layout: Funnel Visualization | Commission Card
4. Next Best Action card (gold left-border accent)
5. Action Queue list

**The "demo mode" label is a UX problem.** An agent opening this page sees controls labeled "Modo demo" and immediately loses confidence that the data is real. If this page is intended for use with a real active lead, it needs to load the lead's actual data — not a demo with hardcoded `current_p_close: '0.08'`. The demo mode should only appear when no lead is selected, with a clear path to associate a real deal.

**Action queue only shows 1 card.** The `actionCards` state is only populated with `json.top_action` (a single item), not a ranked list. The queue renders up to 5 cards but will almost always show exactly 1. This makes "Fila de Acções" feel empty and suggests the data model behind it is not yet fully connected.

**Intent selector (`Perfil do Comprador`) does not affect the funnel visualization** because `intent` state is set but never sent to the API. The `fetchFunnel()` function only sends `property_value_eur` and `current_p_close` — the intent option is silently ignored. This is a silent feature failure that agents may notice when changing the buyer profile and seeing no change in the funnel bars.

**3-action rule: borderline.** The page exposes: value input, buyer profile selector, funnel view, commission card, next best action, and action queue — 6 distinct interaction zones. For a field agent, this is too much to parse at once.

### /dashboard/simulations

Not read in full, but from AbortController scan: uses `useRef<AbortController | null>` pattern (line 401) — correctly prevents stale requests on re-render. Better memory management than daily-brief.

### /dashboard/executive

Not read in full during this audit. From nav label "Executive Revenue," this is likely the P&L / portfolio performance view. Risk: executive dashboards tend toward information density over clarity.

### /dashboard/actions

Not read in full. This is the action queue page linked from the daily brief's hot leads strip. It is the primary execution surface and should be the second item in the nav (after Daily Brief).

---

## UX Issues Found

1. **Nav order is inverted** — Daily Brief should be item #1, not item #6. (`app/dashboard/layout.tsx` line 32–38)
2. **No active nav state** — current page is not highlighted in the sidebar. (`app/dashboard/layout.tsx`)
3. **Mixed English/Portuguese** — nav labels, status badges, KPI labels, and button text mix languages. (`app/dashboard/layout.tsx`, `app/dashboard/properties/page.tsx`)
4. **4-column KPI grid is not responsive** — fixed `repeat(4, 1fr)` without media queries. (`app/dashboard/properties/page.tsx` line 283)
5. **Client-side search on paginated data** — search only covers loaded items, not the full dataset. (`app/dashboard/properties/page.tsx` line 199–203)
6. **Conversion command "demo mode"** — real agents opening this page see it labeled as a demo with no path to real data. (`app/dashboard/conversion-command/page.tsx` line 473)
7. **Intent selector has no effect** — buyer profile dropdown does not change API parameters. (`app/dashboard/conversion-command/page.tsx` lines 286–291)
8. **Daily brief fetchBrief has no AbortController** — minor memory leak if user navigates away during fetch. (`app/dashboard/daily-brief/page.tsx`)
9. **Scroll container structure** — `app/dashboard/layout.tsx` wraps everything in `position: fixed; inset: 0; overflowY: auto`. This means the outer container scrolls, not the page content. Sticky headers inside pages (like conversion-command's `position: sticky; top: 0`) may not work correctly because `top: 0` is relative to the nearest scrolling ancestor — which is the outer fixed wrapper, not the viewport. Verify sticky header behavior in the browser.

---

## Loading State Quality

**Daily Brief:** Full skeleton with animated gradient pulse. Correctly shows skeleton at every section before data arrives. Clean implementation.

**Conversion Command:** Shimmer skeletons for funnel rows (4 bars), commission card, next best action area, and action queue (5 rows). Consistent and complete.

**Properties page:** Shows a spinning circle loader when the initial fetch is loading and no submissions exist. Shows the full table header immediately, then populates rows. Simple but functional.

**Overall loading state quality: GOOD.** All three pages read implement non-jarring loading patterns. The brand pulse animation (`ag-pulse`) and shimmer effects are consistent with the dark green/gold design system.

---

## Error State Quality

**Daily Brief:** Shows a centered layout with a cloud emoji, error text, and a retry button. Clean, actionable, Portuguese language.

**Properties page:** Shows an inline error banner in the table area with the error message text. No retry button — the agent must use browser refresh or change the status filter to trigger a re-fetch.

**Conversion Command:** Shows an inline error string in the funnel card area (`color: C.err` red text). No retry button, no call-to-action.

**Overall error state quality: MEDIUM.** Daily brief handles errors correctly. Properties and conversion command lack retry affordances.

---

## Mobile Responsiveness

**Dashboard layout:** The sidebar is `position: fixed; width: 220px` with `marginLeft: 220` on the main content. There is no responsive breakpoint. On screens narrower than ~900px, the sidebar and content will compress into unusable layout. This dashboard is desktop-only by design (agent use case), but no mobile fallback or hamburger menu exists.

**Daily Brief:** Uses `flexWrap: 'wrap'` on the stats row and the footer row — these will reflow on narrow screens. Max-width of 900px with auto margins. This page is the most responsive of the three.

**Properties page:** The 4-column KPI grid (`repeat(4, 1fr)`) and the 5-column table grid (`1fr 140px 160px 160px 110px`) have no responsive breakpoints. On a 768px tablet, the table columns will be approximately 80px each — too narrow for content.

**Conversion Command:** Two-column grid (`gridTemplateColumns: '1fr 1fr'`) with no responsive breakpoint. On narrow screens, both the funnel and commission card will compress.

**Assessment:** The dashboard is designed for desktop screens ≥1200px. This is acceptable for an internal agent tool but should be documented. The listed properties table specifically needs responsive column hiding for mobile/tablet access.

---

## Language Consistency

**Mixed language issues found:**
- Nav item "Property AI Engine" — should be "Motor de IA Imobiliária" or similar
- Nav item "Executive Revenue" — should be "Receita Executiva"
- Status badge labels: "Ingesting," "Analyzing," "Enriching," "Generating," "Reviewing," "Live," "Archived" — all English
- KPI labels: "Total Properties," "Live Listings," "Processing," "Avg Readiness" — all English
- Table column headers: "Property," "Status," "Readiness," "Demand," "Updated" — all English
- Button text: "Upload Property" — English
- Search placeholder: "Search properties…" — English

The actual page content (daily brief body text, action labels, urgency chips, alerts) is correctly in Portuguese. The inconsistency is concentrated in the navigation shell and the properties page, which appears to have been built in English and not localized.

---

## 3-Action Rule Compliance

**Daily Brief:** COMPLIANT. The primary action is "read and decide." Secondary action is the "Ver Contactos →" CTA. Tertiary action is "Actualizar." Three or fewer clear actions.

**Properties page:** COMPLIANT. Primary: browse/filter properties. Secondary: search. Tertiary: upload new property.

**Conversion Command:** NON-COMPLIANT. The page presents: (1) property value input, (2) buyer profile selector, (3) funnel visualization (observe), (4) commission calculation (observe), (5) "Executar Acção" button, (6) action queue. Six distinct cognitive zones. An agent does not know where to focus.

**Actions page / Executive page / Simulations page:** Not fully audited.

---

## Recommended UX Fixes

**Ordered by impact:**

1. **Reorder sidebar nav** — Move "Brief Diário" to position 1, "Acções Prioritárias" to position 2. The morning workflow is: brief → actions → execute. Current order buries these two critical screens. Effort: 5 minutes.

2. **Add active nav state** — Use `usePathname()` to detect the current route and apply an active style (gold background tint + gold text) to the matching nav item. Without this, agents are navigationally disoriented. Effort: 30 minutes.

3. **Localize the properties page** — Translate all English labels to Portuguese: status badge labels, KPI labels, table column headers, button text, search placeholder. This is the most visibly inconsistent page. Effort: 1 hour.

4. **Make the 4-column KPI grid responsive** — Add `@media (max-width: 900px)` to collapse to 2×2 and `@media (max-width: 600px)` to 1×4. Effort: 30 minutes.

5. **Fix conversion command intent selector** — Either send `intent` as an API parameter or remove the selector until it does something. A visible control that has no effect erodes trust. Effort: 1 hour.

6. **Add retry button to properties and conversion command error states** — Match the daily brief's pattern: error message + "↻ Tentar de novo" button. Effort: 30 minutes per page.

7. **Replace "demo mode" label in conversion command** — Either populate the page with a real active deal from context, or label it "Simulação Manual" and make the path to real deal data visible. Effort: depends on data model.

8. **Server-side search for properties** — Pass `search` query param to `/api/property-ai/submissions` API. Client-side filtering is misleading on paginated data. Effort: 2 hours (API + UI).
