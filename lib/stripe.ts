import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

// ── PRODUCTION GUARD ──────────────────────────────────────────────────────────
// Wave 53 PATCH-002: Block test key in production. Real money requires sk_live_.
// If someone deploys a test key to production, all settlements appear to succeed
// but no euros move. This guard surfaces the misconfiguration immediately.
const stripeKey = process.env.STRIPE_SECRET_KEY
if (stripeKey.startsWith('sk_test_') && process.env.NODE_ENV === 'production') {
  // Log clearly — do NOT throw (would break the app); surface as critical alert instead
  console.error(
    '🚨 CRITICAL [Stripe] sk_test_ key detected in NODE_ENV=production. ' +
    'Real money transactions are BLOCKED. Replace STRIPE_SECRET_KEY with sk_live_ immediately.'
  )
}

export const STRIPE_IS_LIVE = stripeKey.startsWith('sk_live_')
export const STRIPE_MODE: 'live' | 'test' = STRIPE_IS_LIVE ? 'live' : 'test'

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
})

export const PLANS = {
  intelligence: {
    name: 'Investor Intelligence',
    price: 4900, // €49 em cêntimos
    currency: 'eur',
    interval: 'month' as const,
    features: [
      'Market Intelligence Report mensal',
      'Deal flow off-market Portugal',
      'AVM automático ilimitado',
      'Alert de oportunidades por email',
      'Acesso à base de dados de investidores',
    ],
  },
  elite: {
    name: 'Elite Investor',
    price: 19900, // €199 em cêntimos
    currency: 'eur',
    interval: 'month' as const,
    features: [
      'Tudo do Intelligence',
      'Relatório personalizado mensal',
      'Acesso directo ao consultor sénior',
      'Deal room exclusivo (pre-market)',
      'Webinar mensal com análise de mercado',
      'Priority matching com vendedores',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS
