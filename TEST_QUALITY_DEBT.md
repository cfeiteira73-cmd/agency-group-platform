# Test Quality Debt

Audit date: 2026-09-04
Phase I introduced Gate A (blocking, retries=0), Gate B (blocking, retries=1), and Gate C (non-blocking).
The items below are known quality issues in the existing test suite that did NOT block Phase I
but must be resolved before the test suite is considered production-grade.

---

## TQD-001 — Gallery assertion is conditional on UI state

**File**: `tests/e2e/homepage.spec.ts` — "gallery prev/next buttons work"
**Issue**: The test wraps `nextBtn.click()` and the counter assertion inside `if (await nextBtn.isVisible())`. If the gallery renders without a next button (e.g., single photo), the test body is never exercised but the test passes. A passing test that exercises zero assertions is a false green.
**Risk**: Photo gallery regressions will not be caught.
**Recommended fix**: Assert that a next button IS visible before clicking it (hard assertion, not a conditional). If the property must have multiple photos, verify data first.

---

## TQD-002 — Portal reset flow has branching that silently skips the route test

**File**: `tests/e2e/portal.spec.ts` — "password reset link is reachable from login"
**Issue**: Test branches on whether a reset link exists in the DOM (`if (await resetLink.count() > 0)`). If the link is absent (regression), the branch falls through to a direct navigation. The test passes either way; the missing link is never flagged.
**Risk**: A missing reset link on the login page will not be caught.
**Recommended fix**: Use a hard assertion (`await expect(resetLink).toBeVisible()`) matching the actual product contract.

---

## TQD-003 — Mortgage body assertion only checks error key existence

**File**: `tests/e2e/api-security.spec.ts` — "Mortgage rejects montante below €10.000 with 400"
**File**: `tests/e2e/gate-b.spec.ts` — same test
**Issue**: `expect(body.error).toMatch(/mínimo/i)` checks that the word "mínimo" appears in the error message. This is weak — any string containing "mínimo" passes, including unrelated error messages.
**Risk**: If the error key changes structure or a different validation triggers, the test still passes as long as "mínimo" appears anywhere.
**Recommended fix**: Assert the exact error code or a more specific message pattern once the canonical error vocabulary is defined.

---

## TQD-004 — Conditional unit-test assertions in Vitest suite

**File**: Various Vitest spec files (commission, pipeline tests)
**Issue**: Some unit tests use `if (condition) { expect(...) }` patterns where a falsy condition causes zero assertions to run. Vitest does not enforce a minimum assertion count by default.
**Risk**: Tests that should catch logic regressions silently pass.
**Recommended fix**: Add `expect.assertions(N)` at the top of tests that must exercise a minimum number of assertions, or replace conditional assertions with hard ones.

---

## TQD-005 — Weak HTTP status assertions (range checks instead of exact codes)

**File**: `tests/e2e/homepage.spec.ts` — "AVM endpoint responds"
**Issue**: `expect([200, 400]).toContain(response.status())` — accepts both 200 and 400 as valid. A 400 means the request was malformed; the test passes even when the endpoint rejects the payload.
**Risk**: Malformed test payloads look like passing product tests.
**Recommended fix**: Fix the test payload so it always produces a 200, then assert `toBe(200)` exactly.

---

## TQD-006 — `networkidle` used as a wait strategy

**File**: `tests/e2e/homepage.spec.ts` — imoveis listing tests
**Issue**: `await page.waitForLoadState('networkidle')` waits until no network requests have been made for 500ms. This is fragile in environments with background polling or analytics beacons (WebSockets, Sentry heartbeats). It also inflates test run time.
**Risk**: Tests may timeout in environments with active WebSocket connections; or conversely, may resolve too early if the 500ms window elapses before the target UI finishes rendering.
**Recommended fix**: Wait on a specific DOM element that is only rendered after the data loads (e.g., `await expect(page.locator('a[href^="/imoveis/AG-"]').first()).toBeVisible()`).

---

## TQD-007 — Homepage API endpoint test uses wrong response shape

**File**: `tests/e2e/homepage.spec.ts` — "AVM endpoint responds"
**Issue**: Asserts `body.min`, `body.max`, `body.central` — but the actual AVM response shape is `{ success, estimativa, rangeMin, rangeMax, ... }`. This test would pass only if the response happens to include those keys, or fail silently if the response is never 200.
**Note**: This test also sends no auth header (AVM requires isPortalAuth), so it now always gets 401 — making the body assertions unreachable. The test is effectively dead.
**Recommended fix**: Remove this test from `homepage.spec.ts` (Gate C). AVM product contract is already covered in `avm.spec.ts` and `gate-b.spec.ts` with correct auth and correct response shape assertions.

---

## Phase J Audit Items (investigated, NOT fixed in Phase I)

These product bugs were confirmed during the audit. Fixes require explicit approval (Phase J).

### J1 — `/imoveis/AG-9999-999` returns 200 instead of 404

`notFound()` is called in `app/imoveis/[id]/page.tsx:154` for unknown IDs.
In Next.js 15 the `notFound()` call should trigger a 404 response.
The E2E test (`notFound for invalid ID`) expects 404 but the page appears to return 200.
Possible cause: `generateStaticParams` / static rendering intercepting the call, or a
custom not-found page returning 200. Root cause requires investigation with a running server.

### J2 — `public/robots.txt` overrides `app/robots.ts`

`public/robots.txt` is a static file that Next.js serves directly, taking precedence over
the dynamic `app/robots.ts` metadata route. The static file has `Allow: /` with no portal
exclusions. The dynamic route correctly disallows `/portal/`, `/api/`, etc. but is never
reached. A crawler can index portal routes today.
**Fix**: Delete `public/robots.txt` after confirming the dynamic route serves correctly.

### J3 — Meta descriptions exceed 160 characters on 3+ pages

Pages identified: homepage, /imoveis, possibly /blog. Descriptions >160 chars are truncated
in SERPs, reducing click-through. Fix: shorten copy. Requires editorial decision.

### J4 — CSP wildcard `o*.ingest.sentry.io` is invalid syntax

Browsers reject `o*.ingest.sentry.io` as an invalid CSP host pattern (wildcards only valid
as a leftmost label: `*.example.com`, not `o*.example.com`). The correct source is
`*.ingest.sentry.io` or the specific Sentry DSN host.
**Impact**: Sentry error reporting is silently blocked in all browsers.

### J5 — Two 404 resources on homepage load

Two asset requests return 404 on homepage load. Exact URLs to be confirmed with a running
server (`read_network_requests` or browser DevTools). Likely missing fonts or images referenced
in CSS/JS but not present in `public/`.

---

## Deliberate Failure Test (Phase I validation — NOT committed)

To verify Gate A blocks on failure, temporarily change one assertion:

```typescript
// In tests/e2e/gate-a.spec.ts
// Change:
expect(response.status()).toBe(401)
// To:
expect(response.status()).toBe(200)  // deliberately wrong
```

Run locally:
```bash
pnpm exec playwright test --project=gate-a
```

Expected: non-zero exit code, test reported as FAILED.
Restore the original assertion before committing.

---

## Before/After Numbers

| Metric | Before (audit 2026-09-04) | After Phase I |
|--------|--------------------------|---------------|
| Total E2E tests | 91 | TBD — run after deployment |
| Passing | 68 | TBD |
| Failing | 23 | TBD |
| Gate A tests | 0 (not yet created) | 8 |
| Gate B tests | 0 (not yet created) | 5 |
| Gate C tests | 91 (all, non-blocking) | TBD |
| Auth contract violations | 3 (AVM/Radar as public) | 0 |
| Strict-mode violations | 6 | 0 |
| Wrong brand regex | 1 | 0 |

_After numbers to be filled in after running against a live server._
