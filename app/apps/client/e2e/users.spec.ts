import { expect, test } from '@playwright/test'

test.describe('User Management', () => {
  test('user management lives in Settings → Users', async ({ page }) => {
    // Users management moved from a top-level sidebar page into the Settings
    // page, reached via the /settings/users category now.
    await page.goto('/settings/users')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toBeVisible()
    const heading = page
      .getByRole('heading')
      .filter({ hasText: /authorized|users|utilizatori/i })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
  })

  test('clicking a user row opens the edit modal pre-filled', async ({
    page,
    request,
  }) => {
    const name = `E2E Click ${Date.now()}`
    const create = await request.post('/api/users', {
      data: { name, permissions: ['songs.view'] },
    })
    const userId = (await create.json()).data.user.id as number

    try {
      await page.goto('/settings/users')
      await page.waitForLoadState('networkidle')

      // The whole card is a click target (an overlay button whose accessible
      // name embeds the user's name). Clicking it opens the edit modal.
      await page.getByRole('button', { name: new RegExp(name) }).click()

      // Modal: title, the name pre-filled, and Save + Close in the footer.
      await expect(
        page.getByRole('heading', { name: /edit user|editează utilizator/i }),
      ).toBeVisible({ timeout: 10000 })
      await expect(page.locator('#user-name')).toHaveValue(name)
      await expect(
        page.getByRole('button', { name: /save changes|salvează/i }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /^close$|^închide$/i }),
      ).toBeVisible()
    } finally {
      await request.delete(`/api/users/${userId}`)
    }
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
