import { expect, test } from '@playwright/test'

/**
 * Google Drive backup authenticates through the ChurchHub OAuth worker (the
 * same Cloudflare worker the YouTube flow uses) — no Google credentials live
 * in the app. Full round-trips need a real Google account, so these tests
 * exercise the API contract and the not-connected states (what a fresh CI
 * machine is in). The connect/upload/restore flow is verified manually with a
 * real account (see the PR test plan).
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
      'maxBackups',
      'lastBackupAt',
      'storage',
    ]) {
      expect(json.data).toHaveProperty(key)
    }
    // No Google account connected in CI/test env.
    expect(json.data.connected).toBe(false)
    expect(json.data.driveReady).toBe(false)
    // Storage quota can only be read from a connected Drive.
    expect(json.data.storage).toBeNull()
  })

  test('connect returns the OAuth worker authorization URL', async ({
    request,
  }) => {
    const response = await request.get('/api/backup/google/connect')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(typeof json.data.authUrl).toBe('string')
    // The URL points at the worker's Drive flow and redirects back to the
    // local callback with the tokens.
    expect(json.data.authUrl).toContain('/auth/drive')
    expect(json.data.authUrl).toContain('mode=redirect')
    expect(json.data.authUrl).toContain(
      encodeURIComponent('/api/backup/google/callback'),
    )
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

  test('retention (maxBackups) can be updated and is clamped', async ({
    request,
  }) => {
    const updated = await request.put('/api/backup/config', {
      data: { maxBackups: 7 },
    })
    expect(updated.status()).toBe(200)
    expect((await updated.json()).data.maxBackups).toBe(7)

    // Values above the cap are clamped to 50.
    const clamped = await request.put('/api/backup/config', {
      data: { maxBackups: 999 },
    })
    expect((await clamped.json()).data.maxBackups).toBe(50)

    // Values below 1 are ignored (config unchanged).
    const ignored = await request.put('/api/backup/config', {
      data: { maxBackups: 0 },
    })
    expect((await ignored.json()).data.maxBackups).toBe(50)

    // Reset to the default.
    const reset = await request.put('/api/backup/config', {
      data: { maxBackups: 5 },
    })
    expect((await reset.json()).data.maxBackups).toBe(5)
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

  test('inspect requires a fileId', async ({ request }) => {
    const response = await request.post('/api/backup/inspect', { data: {} })
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json.error).toBeTruthy()
  })

  test('inspect fails cleanly when not connected', async ({ request }) => {
    const response = await request.post('/api/backup/inspect', {
      data: { fileId: 'nonexistent-file-id' },
    })
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json).toHaveProperty('error')
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
