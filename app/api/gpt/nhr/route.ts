import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json(
      {
        regime: 'IFICI+ (successor to NHR) — active from 2024',
        benefits: [
          '20% flat tax rate on Portuguese-source employment and self-employment income',
          'Tax exemption on most foreign-source income (dividends, interest, capital gains)',
          'No wealth tax in Portugal',
          'Pension income: 10% flat rate (NHR classic holders)',
          'Available for new tax residents not resident in Portugal in prior 5 years',
        ],
        eligibility:
          'Must not have been a Portuguese tax resident in the previous 5 calendar years. Apply within the year of becoming resident or by March 31 of the following year.',
        duration: '10 years (non-renewable)',
        flatTaxRate: '20% on PT-source income / exemption on foreign-source income',
        sectors: [
          'Technology',
          'Finance',
          'Scientific research',
          'Arts & culture',
          'Qualified professionals',
        ],
        howToApply:
          'Apply via Autoridade Tributária (AT) portal after obtaining NIF and fiscal residency',
        calculator:
          'https://www.agencygroup.pt/portal — NHR Calculator available in our portal',
        contact:
          'Agency Group connects clients with certified NHR lawyers. Email: geral@agencygroup.pt',
        link: 'https://www.agencygroup.pt/blog/nhr-ifici-guia-completo',
      },
      {
        headers: { 'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agencygroup.pt' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
