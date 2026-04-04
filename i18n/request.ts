import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export default getRequestConfig(async () => {
  // Detect locale from cookie, then Accept-Language header, then default to 'pt'
  const cookieStore = cookies()
  let locale = (cookieStore as unknown as { get: (key: string) => { value: string } | undefined }).get('locale')?.value

  if (!locale) {
    const acceptLanguage = (headers() as unknown as { get: (key: string) => string | null }).get('accept-language') || ''
    const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase()
    const supported = ['pt', 'en', 'fr', 'de', 'es', 'it']
    locale = supported.includes(preferred) ? preferred : 'pt'
  }

  return {
    locale,
    messages: (await import(`@/i18n/messages/${locale}.json`)).default,
  }
})
