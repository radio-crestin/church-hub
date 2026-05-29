import { expect, test } from '@playwright/test'

test.describe('User Management', () => {
  test('users page loads with the user management section', async ({
    page,
  }) => {
    await page.goto('/users')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toBeVisible()
    // The user-management heading is a real heading (the sidebar nav label is a
    // span, so matching by heading role avoids the hidden mobile label).
    const heading = page
      .getByRole('heading')
      .filter({ hasText: /authorized|users|utilizatori/i })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
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
