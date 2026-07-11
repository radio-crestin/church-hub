import { expect, test } from '@playwright/test'

/**
 * Google Drive backup. Full round-trips need a real Google account, so these
 * tests exercise the API contract and the not-connected UI state (the state a
 * fresh machine is in). The connect/upload/restore flow is verified manually
 * with a real account (see the PR test plan).
 */
test.describe('Backup - API', () => {
  test('status reports not connected on a fresh machine', async ({
    request,
  }) => {
    const response = await request.get('/api/backup/status')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('connected')
    expect(json.data).toHaveProperty('driveReady')
    expect(json.data).toHaveProperty('autoBackupEnabled')
    expect(json.data).toHaveProperty('intervalHours')
    expect(json.data).toHaveProperty('lastBackupAt')
    // No Google account connected in CI/test env.
    expect(json.data.connected).toBe(false)
    expect(json.data.driveReady).toBe(false)
  })

  test('config can be read and updated', async ({ request }) => {
    const updated = await request.put('/api/backup/config', {
      data: { autoBackupEnabled: true, intervalHours: 12 },
    })
    expect(updated.status()).toBe(200)
    const updatedJson = await updated.json()
    expect(updatedJson.data.autoBackupEnabled).toBe(true)
    expect(updatedJson.data.intervalHours).toBe(12)

    const read = await request.get('/api/backup/config')
    expect(read.status()).toBe(200)
    const readJson = await read.json()
    expect(readJson.data.autoBackupEnabled).toBe(true)
    expect(readJson.data.intervalHours).toBe(12)

    // Reset to defaults so other tests / the app are unaffected.
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
  test('backup settings page shows the connect prompt when not connected', async ({
    page,
  }) => {
    await page.goto('/settings/backup')
    await page.waitForLoadState('networkidle')

    const connect = page.locator(
      'text=/google drive|connect|conecteaz|copie de rezerv/i',
    )
    await expect(connect.first()).toBeVisible({ timeout: 10000 })
  })
})
