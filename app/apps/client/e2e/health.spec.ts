import { expect, test } from '@playwright/test'

test.describe('Application Health', () => {
  test('app loads successfully', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
  })

  test('API health check returns 200', async ({ request }) => {
    const response = await request.get('/api/database/info')
    expect(response.status()).toBe(200)
  })

  test('API docs are accessible', async ({ page }) => {
    const response = await page.goto('/api/docs')
    expect(response?.status()).toBe(200)
  })
})
