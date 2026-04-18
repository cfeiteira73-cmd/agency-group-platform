/**
 * browser.ts — unsupported browser detection
 *
 * Returns TRUE for Internet Explorer (any version) and Edge in IE Mode.
 * Returns FALSE for Chrome, Firefox, Safari, and modern Edge.
 *
 * Two signals used in combination:
 *   1. document.documentMode — an IE-only DOM property (number in IE, undefined elsewhere)
 *   2. UA pattern             — MSIE (IE 5–10) and Trident/ (IE 11 + Edge IE Mode)
 *
 * Safe to call on server (returns false when window is undefined).
 * No side-effects — pure detection only.
 */
export function isUnsupportedBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof (document as Document & { documentMode?: number }).documentMode === 'number' ||
    /Trident\/|MSIE /i.test(navigator.userAgent)
  )
}
