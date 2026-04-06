import { test, expect } from '@playwright/test'

test.describe('Neighborhood Intelligence API (/api/neighborhood)', () => {
  const ZONES = [
    { area: 'Chiado', zone: 'Lisboa' },
    { area: 'Cascais', zone: 'Cascais' },
    { area: 'Porto', zone: 'Porto' },
    { area: 'Comporta', zone: 'Comporta' },
    { area: 'Funchal', zone: 'Funchal' },
  ]

  for (const { area, zone } of ZONES) {
    test(`should return data for ${area}`, async ({ request }) => {
      const response = await request.get(`/api/neighborhood?area=${area}&zone=${zone}`)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('scores')
      expect(data.scores.overall).toBeGreaterThan(0)
      expect(data.scores.overall).toBeLessThanOrEqual(100)
    })
  }

  test('should return score object with at least 7 keys for Chiado', async ({ request }) => {
    const response = await request.get('/api/neighborhood?area=Chiado&zone=Lisboa')
    expect(response.status()).toBe(200)

    const data = await response.json()
    const scoreKeys = Object.keys(data.scores)
    expect(scoreKeys.length).toBeGreaterThanOrEqual(7)
  })

  test('should include schools, restaurants and transport fields', async ({ request }) => {
    const response = await request.get('/api/neighborhood?area=Cascais&zone=Cascais')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('schools')
    expect(data).toHaveProperty('restaurants')
    expect(data).toHaveProperty('transport')
  })

  test('should not crash with unknown zone', async ({ request }) => {
    const response = await request.get('/api/neighborhood?area=UnknownXYZ&zone=UnknownXYZ')
    // Should degrade gracefully, not 500
    expect(response.status()).not.toBe(500)
  })
})
