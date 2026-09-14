import { buildPartnerAlertHtml } from '../../lib/partnerAlertEmail'

const base = {
  agencyName:  'Imobiliária Teste',
  agencyAMI:   '12345',
  agencyEmail: 'agente@teste.pt',
  agencyPhone: '+351911111111',
  nome:        'Apartamento Chiado',
  zona:        'Lisboa',
  tipo:        'Apartamento',
  preco:       450000,
  area:        85,
  quartos:     2,
  casasBanho:  1,
  features:    ['Piscina', 'Garagem'],
}

describe('buildPartnerAlertHtml — email template field correctness', () => {
  test('renders agency email value in Email field', () => {
    const html = buildPartnerAlertHtml(base)
    expect(html).toContain('agente@teste.pt')
  })

  test('renders agency phone value in Telefone field', () => {
    const html = buildPartnerAlertHtml(base)
    expect(html).toContain('+351911111111')
  })

  test('Email label contains email address, not phone number', () => {
    const html = buildPartnerAlertHtml(base)
    expect(html).toMatch(/<strong>Email:<\/strong>\s*agente@teste\.pt/)
    expect(html).not.toMatch(/<strong>Email:<\/strong>\s*\+351911111111/)
  })

  test('Telefone label contains phone number, not email address', () => {
    const html = buildPartnerAlertHtml(base)
    expect(html).toMatch(/<strong>Telefone:<\/strong>\s*\+351911111111/)
    expect(html).not.toMatch(/<strong>Telefone:<\/strong>\s*agente@teste\.pt/)
  })

  test('distinct email and phone cannot be swapped (swap detection)', () => {
    const swapped = { ...base, agencyEmail: 'email@x.pt', agencyPhone: '+351999000000' }
    const html = buildPartnerAlertHtml(swapped)
    // Email: label must show email, never phone
    expect(html).toMatch(/<strong>Email:<\/strong>\s*email@x\.pt/)
    expect(html).not.toMatch(/<strong>Email:<\/strong>\s*\+351999000000/)
    // Telefone: label must show phone, never email
    expect(html).toMatch(/<strong>Telefone:<\/strong>\s*\+351999000000/)
    expect(html).not.toMatch(/<strong>Telefone:<\/strong>\s*email@x\.pt/)
  })

  test('renders property details correctly', () => {
    const html = buildPartnerAlertHtml(base)
    expect(html).toContain('Apartamento Chiado')
    expect(html).toContain('Lisboa')
    expect(html).toContain('Apartamento')
    expect(html).toContain('450')
    expect(html).toContain('85 m²')
  })
})
