import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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
