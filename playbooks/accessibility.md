# PLAYBOOK — ACCESSIBILITY
**Agency Group | WCAG 2.2 AA — Accessibility is product quality.**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## TARGET
WCAG 2.2 AA across all public pages.

## AUTOMATED CHECKS (run on every PR)
- Contrast ratios (gold #D4AF37 — verify AA on all backgrounds)
- Alt text on all images
- Label association on all form fields
- aria-* attributes valid

## MANUAL CHECKS (on design changes)
- Keyboard navigation: Tab through all interactive elements
- Focus visible: focus ring present and visible
- Screen reader: test main navigation + property search + contact form
- Zoom 200%: layout still functional
- Reduced motion: animations respect `prefers-reduced-motion`

## COMPONENT RULES
- Every `<button>` has accessible name (text or aria-label)
- Every `<input>` has associated `<label>`
- Every `<img>` has alt (empty `alt=""` for decorative)
- Error messages reference their field by id
- Modal traps focus and returns it on close
- Color is never the ONLY way to convey information

## NEVER
- Degrade accessibility for visual effect
- Remove focus outlines without replacement
- Use `tabindex > 0`
- Use ARIA when native HTML element would work

## TESTING TOOLS
- axe DevTools (browser extension)
- Lighthouse Accessibility audit
- NVDA (Windows) or VoiceOver (Mac) spot checks
