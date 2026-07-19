import { expect, test } from '@playwright/test'

/**
 * Google Drive library sync shares the backup feature's Drive connection, so
 * full sync round-trips need a real Google account. These tests exercise the
 * API contract and the not-connected states (what a fresh CI machine is in);
 * the actual two-device merge logic is unit tested server-side
 * (mergeLibraries.test.ts, add-sync.test.ts) and verified manually.
 */
test.describe('Sync - API', () => {
  test('status exposes sync + connection flags', async ({ request }) => {
    const response = await request.get('/api/sync/status')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    for (const key of [
      'enabled',
      'connected',
      'accountEmail',
      'pollIntervalMinutes',
      'lastSyncAt',
      'lastError',
      'pendingCount',
      'unseenUpdatesCount',
    ]) {
      expect(json.data).toHaveProperty(key)
    }
    // No Google account connected in CI/test env.
    expect(json.data.connected).toBe(false)
  })

  test('config can be read and updated, interval is clamped', async ({
    request,
  }) => {
    const updated = await request.put('/api/sync/config', {
      data: { pollIntervalMinutes: 15 },
    })
    expect(updated.status()).toBe(200)
    expect((await updated.json()).data.pollIntervalMinutes).toBe(15)

    // Values above the cap are clamped to 120.
    const clamped = await request.put('/api/sync/config', {
      data: { pollIntervalMinutes: 999 },
    })
    expect((await clamped.json()).data.pollIntervalMinutes).toBe(120)

    // Values below 1 are ignored (config unchanged).
    const ignored = await request.put('/api/sync/config', {
      data: { pollIntervalMinutes: 0 },
    })
    expect((await ignored.json()).data.pollIntervalMinutes).toBe(120)

    // Reset to the default.
    const reset = await request.put('/api/sync/config', {
      data: { pollIntervalMinutes: 5 },
    })
    expect((await reset.json()).data.pollIntervalMinutes).toBe(5)
  })

  test('sync now fails cleanly while sync is disabled', async ({ request }) => {
    await request.put('/api/sync/config', { data: { syncEnabled: false } })

    const response = await request.post('/api/sync/now')
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('disabled')
  })

  test('sync now fails cleanly when enabled but not connected', async ({
    request,
  }) => {
    await request.put('/api/sync/config', { data: { syncEnabled: true } })

    const response = await request.post('/api/sync/now')
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('not_connected')

    await request.put('/api/sync/config', { data: { syncEnabled: false } })
  })

  test('pending feed lists local changes waiting to upload', async ({
    request,
  }) => {
    const response = await request.get('/api/sync/pending')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(Array.isArray(json.data.pending)).toBe(true)
  })

  test('updates feed lists entries and marks them seen', async ({
    request,
  }) => {
    const response = await request.get('/api/sync/updates?unseenOnly=true')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(Array.isArray(json.data.updates)).toBe(true)

    const seen = await request.post('/api/sync/updates/seen', { data: {} })
    expect(seen.status()).toBe(200)
    expect(typeof (await seen.json()).data.markedSeen).toBe('number')

    // After marking all seen, the unseen feed is empty.
    const after = await request.get('/api/sync/updates?unseenOnly=true')
    expect((await after.json()).data.updates).toHaveLength(0)
  })
})

test.describe('Sync - UI', () => {
  test('sync section renders on the backup settings page', async ({ page }) => {
    await page.goto('/settings/backup')
    await page.waitForLoadState('networkidle')

    const section = page.locator('text=/sync|sincroniz/i')
    await expect(section.first()).toBeVisible({ timeout: 10000 })
  })
})
