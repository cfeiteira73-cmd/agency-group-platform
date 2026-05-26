// app/api/financial-rails/status/route.ts
// GET /api/financial-rails/status — returns status of all financial rails

import { NextResponse } from 'next/server'
import { getAvailableProviders } from '@/lib/financial-rails/pspRouter'
import { isConfigured as sepaConfigured } from '@/lib/financial-rails/sepaClient'
import { isConfigured as swiftConfigured } from '@/lib/financial-rails/swiftClient'
import { isConfigured as reconciliationConfigured } from '@/lib/financial-rails/bankReconciliationApi'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(): Promise<NextResponse> {
  const pspProviders = getAvailableProviders()
  const hasPsp = pspProviders.some(p => p.configured)

  const rails = [
    {
      rail: 'PSP (Stripe)',
      configured: pspProviders.find(p => p.provider === 'STRIPE')?.configured ?? false,
      status: pspProviders.find(p => p.provider === 'STRIPE')?.configured ? 'ACTIVE' : 'NOT_CONFIGURED',
      env_vars_required: ['STRIPE_SECRET_KEY'],
      action_required: 'Create Stripe account and complete KYB at https://stripe.com',
    },
    {
      rail: 'PSP (Adyen)',
      configured: pspProviders.find(p => p.provider === 'ADYEN')?.configured ?? false,
      status: pspProviders.find(p => p.provider === 'ADYEN')?.configured ? 'ACTIVE' : 'NOT_CONFIGURED',
      env_vars_required: ['ADYEN_API_KEY', 'ADYEN_MERCHANT_ACCOUNT'],
      action_required: 'Create Adyen account at https://www.adyen.com',
    },
    {
      rail: 'SEPA (GoCardless)',
      configured: sepaConfigured(),
      status: sepaConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
      env_vars_required: ['GOCARDLESS_ACCESS_TOKEN'],
      action_required: 'Register GoCardless at https://manage.gocardless.com',
    },
    {
      rail: 'SWIFT (Currencycloud)',
      configured: swiftConfigured(),
      status: swiftConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
      env_vars_required: ['CURRENCYCLOUD_API_KEY', 'CURRENCYCLOUD_LOGIN_ID'],
      action_required: 'Register Currencycloud at https://www.currencycloud.com',
    },
    {
      rail: 'Bank Reconciliation (Salt Edge)',
      configured: reconciliationConfigured(),
      status: reconciliationConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
      env_vars_required: ['SALTEDGE_APP_ID', 'SALTEDGE_SECRET'],
      action_required: 'Register Salt Edge at https://www.saltedge.com',
    },
  ]

  const activeCount = rails.filter(r => r.status === 'ACTIVE').length

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    total_rails: rails.length,
    active_rails: activeCount,
    rails_operational: hasPsp && sepaConfigured(),  // minimum: PSP + SEPA
    rails,
    minimum_viable_config: 'STRIPE_SECRET_KEY + GOCARDLESS_ACCESS_TOKEN',
  })
}
