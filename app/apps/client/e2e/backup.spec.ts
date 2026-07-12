import { expect, test } from '@playwright/test'

/**
 * Google Drive backup uses an independent, self-contained OAuth loopback flow.
 * Full round-trips need a real Google account + configured client, so these
 * tests exercise the API contract and the not-configured/not-connected states
 * (what a fresh CI machine is in). The connect/upload/restore flow is verified
 * manually with a real account (see the PR test plan).
 */
test.describe('Backup - API', () => {
  test('status exposes configuration + connection flags', async ({
    request,
  }) => {
    const response = await request.get('/api/backup/status')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    for (const key of [
      'configured',
      'connected',
      'driveReady',
      'requiresReconnect',
      'email',
      'autoBackupEnabled',
      'intervalHours',
      'lastBackupAt',
    ]) {
      expect(json.data).toHaveProperty(key)
    }
    // No Google account connected in CI/test env.
    expect(json.data.connected).toBe(false)
    expect(json.data.driveReady).toBe(false)
  })

  test('connect returns 400 when the Drive client is not configured', async ({
    request,
  }) => {
    const response = await request.get('/api/backup/google/connect')
    // Either 400 not_configured (no creds in CI) or 200 with an authUrl.
    if (response.status() === 200) {
      const json = await response.json()
      expect(typeof json.data.authUrl).toBe('string')
      expect(json.data.authUrl).toContain('accounts.google.com')
    } else {
      expect(response.status()).toBe(400)
      const json = await response.json()
      expect(json.error).toBeTruthy()
    }
  })

  test('disconnect succeeds (idempotent)', async ({ request }) => {
    const response = await request.post('/api/backup/google/disconnect')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.data.success).toBe(true)
  })

  test('config can be read and updated', async ({ request }) => {
    const updated = await request.put('/api/backup/config', {
      data: { autoBackupEnabled: true, intervalHours: 12 },
    })
    expect(updated.status()).toBe(200)
    const updatedJson = await updated.json()
    expect(updatedJson.data.autoBackupEnabled).toBe(true)
    expect(updatedJson.data.intervalHours).toBe(12)

    const reset = await request.put('/api/backup/config', {
      data: { autoBackupEnabled: false, intervalHours: 24 },
    })
    expect(reset.status()).toBe(200)
    const resetJson = await reset.json()
    expect(resetJson.data.autoBackupEnabled).toBe(false)
    expect(resetJson.data.intervalHours).toBe(24)
  })

  test('backup now fails cleanly when not connected', async ({ request }) => {
    const response = await request.post('/api/backup/now')
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json).toHaveProperty('error')
  })

  test('list fails cleanly when not connected', async ({ request }) => {
    const response = await request.get('/api/backup/list')
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json).toHaveProperty('error')
  })

  test('restore requires a fileId', async ({ request }) => {
    const response = await request.post('/api/backup/restore', { data: {} })
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json.error).toBeTruthy()
  })
})

test.describe('Backup - UI', () => {
  test('backup settings page renders', async ({ page }) => {
    await page.goto('/settings/backup')
    await page.waitForLoadState('networkidle')

    const section = page.locator('text=/google drive|backup|copie de rezerv/i')
    await expect(section.first()).toBeVisible({ timeout: 10000 })
  })
})
