import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Google Drive library sync shares the backup feature's Drive connection, so
 * full sync round-trips need a real Google account. These tests exercise the
 * API contract and the not-connected states (what a fresh CI machine is in);
 * the two-device merge itself needs Google Drive and is verified by hand.
 * Local change tracking (what the next sync uploads) is covered below.
 */
interface PendingEntry {
  entityType: string
  localId: number | null
  title: string
}

async function pendingSong(request: APIRequestContext, songId: number) {
  const res = await request.get('/api/sync/pending')
  const { pending } = (await res.json()).data as { pending: PendingEntry[] }
  return pending.find((p) => p.entityType === 'song' && p.localId === songId)
}

test.describe('Sync - API', () => {
  test('local song changes are queued for upload; a deleted song leaves the queue', async ({
    request,
  }) => {
    const title = `E2E Sync Tracked ${Date.now()}`
    const created = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'one', sortOrder: 0, label: 'V1' }] },
    })
    expect(created.ok()).toBe(true)
    const songId = (await created.json()).data.id as number
    expect((await pendingSong(request, songId))?.title).toBe(title)

    const renamed = `${title} edited`
    await request.post('/api/songs', {
      data: { id: songId, title: renamed },
    })
    expect((await pendingSong(request, songId))?.title).toBe(renamed)

    expect((await request.delete(`/api/songs/${songId}`)).ok()).toBe(true)
    expect(await pendingSong(request, songId)).toBeUndefined()
  })

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
