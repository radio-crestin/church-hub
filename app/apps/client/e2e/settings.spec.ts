import { expect, test } from '@playwright/test'

// Each settings category is a nested route under /settings. `text` is a
// bilingual (en/ro) regex matched inside the content pane (scoped via the
// `settings-panel` test id so sidebar labels don't produce false positives).
const SETTINGS_LEAVES: { path: string; text: RegExp }[] = [
  { path: '/settings/appearance', text: /appearance|aspect|language|limb/i },
  { path: '/settings/sidebar', text: /sidebar|bară|menu|meniu|custom/i },
  { path: '/settings/profile', text: /log ?out|deconect|account|cont|permis/i },
  { path: '/settings/users', text: /user|utilizator/i },
  { path: '/settings/songs', text: /categor|tag|synonym|sinonim|import/i },
  {
    path: '/settings/bible',
    text: /translation|traducer|import|download|descărc/i,
  },
  { path: '/settings/screens', text: /screen|ecran|slide|navig|shortcut/i },
  { path: '/settings/kiosk', text: /kiosk/i },
  {
    path: '/settings/livestream',
    text: /scene|scenă|stream|shortcut|scurtătur/i,
  },
  {
    path: '/settings/shortcuts',
    text: /presentation|prezentare|slide|shortcut|scurtătur/i,
  },
  { path: '/settings/midi', text: /midi/i },
  {
    path: '/settings/developer',
    text: /developer|dezvoltator|debug|depanare/i,
  },
  { path: '/settings/about', text: /version|versiune|about|despre|update/i },
]

test.describe('Settings Page', () => {
  test('navigating to /settings shows the sidebar and redirects to a leaf', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    // The category sidebar renders the "Settings" title.
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    // On desktop the bare /settings redirects to the first accessible category.
    await expect(page).toHaveURL(/\/settings\/[a-z]+/, { timeout: 10000 })
  })

  test('category rail shows the group labels', async ({ page }) => {
    await page.goto('/settings/appearance')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/^general$/i).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(/^advanced$|^avansat$/i).first()).toBeVisible()
  })

  test('every category is always visible (groups never collapse)', async ({
    page,
  }) => {
    await page.goto('/settings/appearance')
    await page.waitForLoadState('networkidle')

    // No collapsing: a deep leaf link (Developer, in the Advanced group) is
    // always visible without any interaction, and navigates on click.
    const developerLink = page
      .getByRole('link', { name: /developer|dezvoltator/i })
      .first()
    await expect(developerLink).toBeVisible({ timeout: 5000 })
    await developerLink.click()
    await expect(page).toHaveURL(/\/settings\/developer/, { timeout: 10000 })
  })

  for (const leaf of SETTINGS_LEAVES) {
    test(`category ${leaf.path} renders its panel`, async ({ page }) => {
      await page.goto(leaf.path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(leaf.path.replace(/\//g, '\\/')))
      const panel = page.getByTestId('settings-panel')
      await expect(panel).toBeVisible({ timeout: 10000 })
      await expect(panel).toContainText(leaf.text, { timeout: 10000 })
    })
  }

  test('appearance category has language and theme selectors', async ({
    page,
  }) => {
    await page.goto('/settings/appearance')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/language|limba/i').first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('text=/theme|tema/i').first()).toBeVisible({
      timeout: 5000,
    })
    // Two Combobox triggers (language + theme) render as buttons in the panel.
    const panel = page.getByTestId('settings-panel')
    expect(await panel.locator('button').count()).toBeGreaterThanOrEqual(2)
  })

  test('developer category has the debug toggle and API docs link', async ({
    page,
  }) => {
    await page.goto('/settings/developer')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/debug|depanare/i').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('a[href*="api/docs"]').first()).toBeVisible({
      timeout: 10000,
    })
  })
})

test.describe('Feature pages no longer open settings modals', () => {
  // The per-page gear buttons were removed; settings live only under /settings.
  for (const path of ['/songs', '/bible', '/present', '/livestream']) {
    test(`${path} has no settings gear button`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(
        page.getByRole('button', { name: /^settings$|^setări$/i }),
      ).toHaveCount(0)
    })
  }
})

test.describe('Settings API', () => {
  test('can read app settings', async ({ request }) => {
    const response = await request.get('/api/settings/app_settings')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can read user preferences', async ({ request }) => {
    const response = await request.get('/api/settings/user_preferences')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can upsert and read a setting', async ({ request }) => {
    const testKey = `e2e_test_${Date.now()}`
    const testValue = 'test_value_123'

    // Create setting
    const createResponse = await request.post('/api/settings/app_settings', {
      data: { key: testKey, value: testValue },
    })
    expect(createResponse.status()).toBe(200)

    // Read it back
    const readResponse = await request.get(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(readResponse.status()).toBe(200)
    const readData = await readResponse.json()
    expect(readData.data).toBeTruthy()
    expect(readData.data.value).toBe(testValue)

    // Clean up
    const deleteResponse = await request.delete(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(deleteResponse.status()).toBe(200)
  })

  test('can delete a setting', async ({ request }) => {
    const testKey = `e2e_delete_${Date.now()}`

    // Create it
    await request.post('/api/settings/app_settings', {
      data: { key: testKey, value: 'to_delete' },
    })

    // Delete it
    const deleteResponse = await request.delete(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(deleteResponse.status()).toBe(200)

    // Verify it is gone
    const readResponse = await request.get(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(readResponse.status()).toBe(200)
    const readData = await readResponse.json()
    expect(readData.data).toBeNull()
  })

  test('reading non-existent setting returns null', async ({ request }) => {
    const response = await request.get(
      '/api/settings/app_settings/nonexistent_key_12345',
    )
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.data).toBeNull()
  })
})
