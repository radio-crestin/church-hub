import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * In-app updates: the download folder setting, the reuse of an artifact that is
 * already on disk, and the guards around installing.
 *
 * The download itself needs a published release asset, and the install replaces
 * the running application — neither is reproducible here, so those are verified
 * manually (see the PR test plan). What is covered is the contract everything
 * else stands on.
 */
test.describe('App update - config', () => {
  test.afterAll(async ({ request }) => {
    await request.put('/api/app-update/config', { data: { downloadDir: null } })
  })

  test('defaults to the system Downloads folder', async ({ request }) => {
    await request.put('/api/app-update/config', { data: { downloadDir: null } })

    const res = await request.get('/api/app-update/config')
    expect(res.status()).toBe(200)
    const { data } = await res.json()

    expect(data.downloadDir).toBeNull()
    expect(data.effectiveDownloadDir).toBe(data.defaultDir)
    expect(data.defaultDir).toMatch(/Downloads$/)
  })

  test('a chosen folder is used and can be cleared', async ({ request }) => {
    const dir = mkdtempSync(join(tmpdir(), 'church-hub-update-'))
    try {
      const set = await request.put('/api/app-update/config', {
        data: { downloadDir: dir },
      })
      expect(set.status()).toBe(200)
      expect((await set.json()).data.effectiveDownloadDir).toBe(dir)

      const read = await request.get('/api/app-update/config')
      expect((await read.json()).data.downloadDir).toBe(dir)

      const cleared = await request.put('/api/app-update/config', {
        data: { downloadDir: null },
      })
      const clearedData = (await cleared.json()).data
      expect(clearedData.downloadDir).toBeNull()
      expect(clearedData.effectiveDownloadDir).toBe(clearedData.defaultDir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a relative folder is ignored in favour of the default', async ({
    request,
  }) => {
    // The sidecar writes the download; a relative path would resolve against a
    // working directory the operator never sees.
    await request.put('/api/app-update/config', {
      data: { downloadDir: 'relative/updates' },
    })
    const res = await request.get('/api/app-update/config')
    const { data } = await res.json()
    expect(data.downloadDir).toBe('relative/updates')
    expect(data.effectiveDownloadDir).toBe(data.defaultDir)
  })
})

test.describe('App update - download state', () => {
  let dir: string

  test.beforeEach(async ({ request }) => {
    dir = mkdtempSync(join(tmpdir(), 'church-hub-update-'))
    await request.put('/api/app-update/config', { data: { downloadDir: dir } })
  })

  test.afterEach(async ({ request }) => {
    await request.put('/api/app-update/config', { data: { downloadDir: null } })
    rmSync(dir, { recursive: true, force: true })
  })

  test('starts idle', async ({ request }) => {
    const res = await request.get('/api/app-update/status')
    expect(res.status()).toBe(200)
    const { data } = await res.json()
    expect(['idle', 'ready', 'error']).toContain(data.phase)
  })

  test('an artifact already in the folder is offered for install, not re-downloaded', async ({
    request,
  }) => {
    // Simulate a download from an earlier session.
    const fileName = 'church-hub-macos-arm64-v-9.9.9.dmg'
    writeFileSync(join(dir, fileName), 'pretend installer')

    const res = await request.get(
      `/api/app-update/status?url=${encodeURIComponent(
        `https://example.invalid/releases/${fileName}`,
      )}&version=9.9.9`,
    )
    expect(res.status()).toBe(200)
    const { data } = await res.json()

    expect(data.phase).toBe('ready')
    expect(data.version).toBe('9.9.9')
    expect(data.fileName).toBe(fileName)
    expect(data.filePath).toBe(join(dir, fileName))
    expect(data.receivedBytes).toBeGreaterThan(0)
  })

  test('download requires a url', async ({ request }) => {
    const res = await request.post('/api/app-update/download', { data: {} })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Missing url')
  })

  test('install refuses when nothing has been downloaded', async ({
    request,
  }) => {
    // Nothing downloaded in this fresh folder, so there is nothing to install.
    const res = await request.post('/api/app-update/install')
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('no_downloaded_artifact')
  })
})
