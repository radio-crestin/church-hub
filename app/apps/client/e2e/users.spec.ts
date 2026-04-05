import { expect, test } from '@playwright/test'

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('settings page loads with user list section', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible()
    const userSection = page.locator(
      'text=/authorized|users|devices|utilizatori|dispozitive/i',
    )
    await expect(userSection.first()).toBeVisible({ timeout: 10000 })
  })

  test('can view the list of users via API', async ({ request }) => {
    const response = await request.get('/api/users')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can create a user via API', async ({ request }) => {
    const response = await request.post('/api/users', {
      data: {
        name: `E2E Test User ${Date.now()}`,
      },
    })

    expect([200, 201]).toContain(response.status())

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('user')
    expect(json.data).toHaveProperty('token')
    expect(typeof json.data.token).toBe('string')

    // Clean up
    const userId = json.data.user.id
    await request.delete(`/api/users/${userId}`)
  })
})
