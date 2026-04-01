// ─── Lightweight i18n utility ─────────────────────────────────────────────────
// Works without next-intl dependency — reads JSON message files directly
// Usage:
//   import { getTranslations } from '@/lib/i18n'
//   const t = await getTranslations('en')
//   t('nav.home') // → 'Home'

export type Locale = 'pt' | 'en' | 'fr' | 'de' | 'zh' | 'ar'

export const LOCALES: Locale[] = ['pt', 'en', 'fr', 'de', 'zh', 'ar']
export const DEFAULT_LOCALE: Locale = 'pt'

export const LOCALE_NAMES: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ar: 'العربية',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  pt: '🇵🇹',
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  zh: '🇨🇳',
  ar: '🇸🇦',
}

export const RTL_LOCALES: Locale[] = ['ar']
export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

// ─── Type for nested message objects ─────────────────────────────────────────
type Messages = Record<string, unknown>

// ─── Dot-notation accessor ────────────────────────────────────────────────────
function getNestedValue(obj: Messages, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path // fallback to key if not found
    }
  }
  return typeof current === 'string' ? current : path
}

// ─── Load messages for a locale ──────────────────────────────────────────────
const messageCache = new Map<Locale, Messages>()

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!
  }

  try {
    // Dynamic import for server-side
    const messages = await import(`../messages/${locale}.json`)
    const data = messages.default || messages
    messageCache.set(locale, data)
    return data
  } catch {
    // Fallback to Portuguese
    if (locale !== DEFAULT_LOCALE) {
      return loadMessages(DEFAULT_LOCALE)
    }
    return {}
  }
}

// ─── Translation function factory ─────────────────────────────────────────────
export type TFunction = (key: string, vars?: Record<string, string | number>) => string

export async function getTranslations(locale: Locale): Promise<TFunction> {
  const messages = await loadMessages(locale)

  return function t(key: string, vars?: Record<string, string | number>): string {
    let value = getNestedValue(messages, key)

    // Variable interpolation: {name} → vars.name
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v))
      })
    }

    return value
  }
}

// ─── Client-side hook (for 'use client' components) ──────────────────────────
// Since we use static locale pages (app/en/page.tsx etc.), pass locale as prop
export function createT(messages: Messages): TFunction {
  return function t(key: string, vars?: Record<string, string | number>): string {
    let value = getNestedValue(messages, key)
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v))
      })
    }
    return value
  }
}

// ─── Detect locale from Accept-Language header ────────────────────────────────
export function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE

  const preferred = acceptLanguage
    .split(',')
    .map(l => l.split(';')[0].trim().toLowerCase().slice(0, 2))
    .find(l => LOCALES.includes(l as Locale))

  return (preferred as Locale) || DEFAULT_LOCALE
}

// ─── Hreflang data for SEO ────────────────────────────────────────────────────
export function getHreflangAlternates(path: string): Record<string, string> {
  const base = 'https://agencygroup.pt'
  const alternates: Record<string, string> = {
    'x-default': `${base}${path}`,
    'pt': `${base}${path}`,
  }

  LOCALES.filter(l => l !== 'pt').forEach(locale => {
    alternates[locale] = `${base}/${locale}${path}`
  })

  return alternates
}
