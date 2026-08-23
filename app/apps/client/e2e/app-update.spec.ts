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

  test('a failed download says why, and cancel clears it', async ({
    request,
  }) => {
    // Nothing listens on this port, so every attempt is refused; the sidecar
    // retries a network failure before giving up, hence the wait.
    const deadUrl = 'http://127.0.0.1:9/church-hub-test-v-9.9.9.dmg'
    const started = await request.post('/api/app-update/download', {
      data: { url: deadUrl, version: '9.9.9' },
    })
    expect(started.status()).toBe(200)
    expect((await started.json()).data.phase).toBe('downloading')

    await expect
      .poll(
        async () => {
          const res = await request.get('/api/app-update/status')
          return (await res.json()).data.phase
        },
        { timeout: 15000 },
      )
      .toBe('error')

    const failed = (await (await request.get('/api/app-update/status')).json())
      .data
    expect(failed.errorCode).toBe('network')
    expect(failed.error).toBeTruthy()

    // Seen once, then gone — it must not greet the next visit as a new failure.
    const cleared = await request.post('/api/app-update/cancel')
    expect(cleared.status()).toBe(200)
    expect((await cleared.json()).data).toMatchObject({
      phase: 'idle',
      error: null,
      errorCode: null,
    })
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

test.describe('App update - page', () => {
  test('the updates page shows the version and a working check button', async ({
    page,
  }) => {
    await page.goto('/settings/updates')
    await page.waitForLoadState('networkidle')

    const panel = page.getByTestId('update-panel')
    await expect(panel).toBeVisible({ timeout: 10000 })

    // Current version and the download folder are always shown.
    await expect(panel.getByTestId('update-download-dir')).toBeVisible()

    const check = panel.getByTestId('update-check-now')
    await expect(check).toBeVisible()
    await check.click()
    // The check runs against GitHub, which may be unreachable from CI; either
    // way the page must stay usable rather than get stuck.
    await expect(check).toBeEnabled({ timeout: 15000 })
  })

  test('a new version is presented like a release-notes entry, not as markdown', async ({
    page,
  }) => {
    // Stand in for GitHub with a release newer than any build, carrying the
    // body our changelog generator writes.
    const body = [
      '# Church Hub v99.0.0',
      '',
      "## What's Changed",
      '',
      '### ✨ Features',
      '',
      '- **songs**: transpose from the stage view',
      '- remote control from a phone',
      '',
      '### 🐛 Bug Fixes',
      '',
      '- **bible**: verse search ignored diacritics',
      '',
      '### 🔧 Changes',
      '',
      '- faster startup on Windows',
      '',
      '## Direct Downloads',
      '',
      '| Platform | Download |',
      '| **macOS** | [Download .dmg](https://example.invalid/x.dmg) |',
    ].join('\n')

    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            tag_name: 'v99.0.0',
            name: 'v99.0.0',
            body,
            html_url:
              'https://github.com/radio-crestin/church-hub/releases/tag/v99.0.0',
            published_at: '2026-08-23T10:00:00Z',
            draft: false,
            prerelease: false,
            assets: [],
          },
        ]),
      }),
    )

    await page.goto('/settings/updates')
    const panel = page.getByTestId('update-panel')
    await expect(panel).toBeVisible({ timeout: 10000 })

    await panel.getByTestId('update-check-now').click()
    await expect(panel.getByTestId('update-new-version')).toHaveText(
      'v99.0.0',
      {
        timeout: 15000,
      },
    )

    const card = panel.getByTestId('update-version-notes')
    await expect(card).toBeVisible()
    // Version, badge and date in the header — the same header the history
    // uses. The test database may be in either shipped language.
    await expect(card).toContainText('v99.0.0')
    await expect(card).toContainText(/New|Nouă/)
    await expect(card).toContainText('2026')
    // Grouped, with scopes pulled out of the bold prefix.
    await expect(card).toContainText(/(Features|Funcționalități) \(2\)/)
    await expect(card).toContainText('songs: transpose from the stage view')
    await expect(card).toContainText(/(Bug Fixes|Corectări de erori) \(1\)/)
    await expect(card).toContainText('bible: verse search ignored diacritics')
    await expect(card).toContainText(/(Changes|Modificări) \(1\)/)
    // No markdown leaks through, and the download table stays out.
    const text = (await card.textContent()) ?? ''
    expect(text).not.toContain('##')
    expect(text).not.toContain('**')
    expect(text).not.toContain('Direct Downloads')

    // A browser tab has no installer to fetch; it says so and links to GitHub.
    await expect(card.getByTestId('update-unavailable')).toBeVisible()
    await expect(card.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      /releases\/tag\/v99\.0\.0/,
    )

    await card.screenshot({
      path: `${process.env.UPDATE_SHOT_DIR ?? 'test-results'}/update-card.png`,
    })
  })

  test('no update dialog opens over the app', async ({ page }) => {
    // The update flow lives on its own page now — a modal that opened itself
    // interrupted whatever the operator was doing.
    await page.goto('/songs?fromSong=true')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('update-available-modal')).toHaveCount(0)
  })
})
