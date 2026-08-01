import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
      'localBackupPath',
      'lastLocalBackupAt',
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

/**
 * Local backups need no Google account, so unlike the Drive flow the whole
 * round-trip is exercised here: point the app at a temp folder, back up, list,
 * delete.
 */
test.describe('Backup - local', () => {
  let folder: string

  test.beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'church-hub-e2e-backup-'))
  })

  test.afterEach(async ({ request }) => {
    await request.put('/api/backup/config', { data: { localBackupPath: null } })
    rmSync(folder, { recursive: true, force: true })
  })

  test('writes, lists and deletes a backup in the configured folder', async ({
    request,
  }) => {
    const configured = await request.put('/api/backup/config', {
      data: { localBackupPath: folder },
    })
    expect(configured.status()).toBe(200)
    expect((await configured.json()).data.localBackupPath).toBe(folder)

    const created = await request.post('/api/backup/local/now')
    expect(created.status()).toBe(200)
    const createdJson = await created.json()
    expect(createdJson.data.success).toBe(true)
    expect(createdJson.data.path).toContain(folder)

    // The file really landed on disk, not just in the response.
    const onDisk = readdirSync(folder).filter((name) => name.endsWith('.db'))
    expect(onDisk.length).toBe(1)

    const listed = await request.get('/api/backup/local/list')
    expect(listed.status()).toBe(200)
    const backups = (await listed.json()).data.backups
    expect(backups.length).toBe(1)
    expect(backups[0].name).toBe(onDisk[0])
    expect(backups[0].sizeBytes).toBeGreaterThan(0)

    const deleted = await request.post('/api/backup/local/delete', {
      data: { fileName: backups[0].name },
    })
    expect(deleted.status()).toBe(200)
    expect((await deleted.json()).data.success).toBe(true)
    expect(readdirSync(folder).filter((n) => n.endsWith('.db')).length).toBe(0)
  })

  test('backing up fails cleanly with no folder configured', async ({
    request,
  }) => {
    await request.put('/api/backup/config', { data: { localBackupPath: null } })

    const response = await request.post('/api/backup/local/now')
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('no_local_path')

    // Listing is not an error state — it is simply empty.
    const listed = await request.get('/api/backup/local/list')
    expect(listed.status()).toBe(200)
    expect((await listed.json()).data.backups).toEqual([])
  })

  test('a relative path is refused so backups never land in the CWD', async ({
    request,
  }) => {
    await request.put('/api/backup/config', {
      data: { localBackupPath: 'relative/backups' },
    })

    const response = await request.post('/api/backup/local/now')
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('no_local_path')
  })

  test('delete refuses names outside the backup naming convention', async ({
    request,
  }) => {
    await request.put('/api/backup/config', {
      data: { localBackupPath: folder },
    })

    for (const fileName of [
      '../../etc/hosts',
      'notes.txt',
      'church-hub-backup-v1.db/../x',
    ]) {
      const response = await request.post('/api/backup/local/delete', {
        data: { fileName },
      })
      expect(response.status()).toBe(400)
      expect((await response.json()).error).toBe('invalid_file_name')
    }

    const missingName = await request.post('/api/backup/local/delete', {
      data: {},
    })
    expect(missingName.status()).toBe(400)
  })

  /**
   * A restore swaps the live database out, so these tests restore a backup the
   * test itself just made — the file is byte-for-byte the database already in
   * use, which exercises the whole close/copy/reopen path without changing any
   * data. The assertion that matters is that the server still answers queries
   * afterwards: that is what proves the connection was reopened in-process
   * rather than left closed.
   */
  test('restores a backup from the configured folder', async ({ request }) => {
    await request.put('/api/backup/config', {
      data: { localBackupPath: folder },
    })
    expect((await request.post('/api/backup/local/now')).status()).toBe(200)

    const backups = (await (await request.get('/api/backup/local/list')).json())
      .data.backups
    expect(backups.length).toBe(1)

    const restored = await request.post('/api/backup/local/restore', {
      data: { fileName: backups[0].name },
    })
    expect(restored.status()).toBe(200)
    const json = (await restored.json()).data
    expect(json.success).toBe(true)
    expect(json.requiresRestart).toBe(false)

    // The database reopened — a real query still works.
    const alive = await request.get('/api/backup/local/list')
    expect(alive.status()).toBe(200)
  })

  test('restores from a folder that is not the configured one', async ({
    request,
  }) => {
    await request.put('/api/backup/config', {
      data: { localBackupPath: folder },
    })
    expect((await request.post('/api/backup/local/now')).status()).toBe(200)
    const fileName = readdirSync(folder).find((n) => n.endsWith('.db'))
    expect(fileName).toBeTruthy()

    // Local backups off: the folder is now somewhere the app has never written.
    await request.put('/api/backup/config', { data: { localBackupPath: null } })
    expect(
      (await (await request.get('/api/backup/local/list')).json()).data.backups,
    ).toEqual([])

    // Browsing it still finds the backup, without reconfiguring anything.
    const browsed = await request.get(
      `/api/backup/local/list?dir=${encodeURIComponent(folder)}`,
    )
    expect(browsed.status()).toBe(200)
    expect((await browsed.json()).data.backups.length).toBe(1)

    // Browsing alone did not make it the configured folder.
    const whileBrowsing = await (
      await request.get('/api/backup/config')
    ).json()
    expect(whileBrowsing.data.localBackupPath).toBeNull()

    const restored = await request.post('/api/backup/local/restore', {
      data: { path: join(folder, fileName as string) },
    })
    expect(restored.status()).toBe(200)
    expect((await restored.json()).data.success).toBe(true)

    // Settings live in the database, so a restore brings back the ones the
    // backup was taken with — including the folder that was configured then.
    // That is the whole point of a restore, not a side effect of browsing.
    const afterRestore = await (await request.get('/api/backup/config')).json()
    expect(afterRestore.data.localBackupPath).toBe(folder)
  })

  test('browsing a relative folder lists nothing', async ({ request }) => {
    const browsed = await request.get('/api/backup/local/list?dir=relative/dir')
    expect(browsed.status()).toBe(200)
    expect((await browsed.json()).data.backups).toEqual([])
  })

  test('restore refuses sources outside the backup naming convention', async ({
    request,
  }) => {
    await request.put('/api/backup/config', {
      data: { localBackupPath: folder },
    })

    const cases: { data: Record<string, string>; error: string }[] = [
      { data: {}, error: 'no_source' },
      { data: { fileName: '../../etc/hosts' }, error: 'invalid_file_name' },
      { data: { fileName: 'notes.txt' }, error: 'invalid_file_name' },
      {
        data: { path: 'relative/church-hub-backup-v1-2026-01-01.db' },
        error: 'path_not_absolute',
      },
      { data: { path: '/etc/hosts' }, error: 'invalid_file_name' },
    ]

    for (const { data, error } of cases) {
      const response = await request.post('/api/backup/local/restore', { data })
      expect(response.status()).toBe(400)
      expect((await response.json()).error).toBe(error)
    }
  })

  test('restore by file name needs a configured folder', async ({
    request,
  }) => {
    await request.put('/api/backup/config', { data: { localBackupPath: null } })

    const response = await request.post('/api/backup/local/restore', {
      data: { fileName: 'church-hub-backup-v1-2026-01-01T00-00-00-000Z.db' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('no_local_path')
  })

  test('retention prunes older local backups', async ({ request }) => {
    await request.put('/api/backup/config', {
      data: { localBackupPath: folder, maxBackups: 2 },
    })

    for (let i = 0; i < 3; i++) {
      const response = await request.post('/api/backup/local/now')
      expect(response.status()).toBe(200)
      // Backup file names carry a millisecond timestamp; a small gap keeps
      // them distinct.
      await new Promise((resolve) => setTimeout(resolve, 1100))
    }

    const listed = await request.get('/api/backup/local/list')
    expect((await listed.json()).data.backups.length).toBe(2)

    await request.put('/api/backup/config', { data: { maxBackups: 5 } })
  })
})
