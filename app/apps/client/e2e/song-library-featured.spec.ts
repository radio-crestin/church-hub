import { execFile } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { signInCurator } from './helpers/curated-library'
import { ExtraServer } from './helpers/extra-server'
import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import { checkSource } from './helpers/song-folder-source'
import { SyncService } from './helpers/sync-service'
import { makeTempDir, removeTempDir } from './helpers/temp-dir'

/**
 * The song sources Church Hub offers every app (CH-177): a library the
 * build publishes with its token (scripts/publish-library.ts), listed by
 * a curator on the Church Hub Library page, offered by the app, shipped
 * with the installer (scripts/bundle-song-libraries.ts) and imported from
 * that copy with no internet.
 */

const APP_DIR = fileURLToPath(new URL('../../..', import.meta.url))
const PUBLISH_TOKEN = 'e2e-library-publish-token'
const CURATOR = { sub: 'google-curator-3', email: 'curator@example.com' }
const SOURCE_ID = 'e2e-hymns'

const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()

/**
 * Runs one of the server's scripts as the build does; asynchronously, as
 * the sync service it talks to runs in this test's own process.
 */
function runScript(
  args: string[],
  env: Record<string, string>,
): Promise<{ status: number; output: string }> {
  return new Promise((resolve) => {
    execFile(
      'bun',
      args,
      {
        cwd: join(APP_DIR, 'apps/server'),
        env: { ...process.env, CHURCH_HUB_SYNC_URL: service.url, ...env },
        timeout: 120_000,
      },
      (error, stdout, stderr) =>
        resolve({
          status: error ? Number(error.code ?? 1) || 1 : 0,
          output: `${stdout}${stderr}`,
        }),
    )
  })
}

test.describe
  .serial('Featured song sources', () => {
    test.setTimeout(180_000)
    let folder = ''
    let s3Running = false

    test.beforeAll(async ({ request }) => {
      folder = makeTempDir('church-hub-e2e-featured-')
      await s3.start()
      s3Running = true
      await google.start()
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        LIBRARY_CURATORS: CURATOR.email,
        LIBRARY_PUBLISH_TOKEN: PUBLISH_TOKEN,
        LIBRARY_RATE_LIMIT_PER_MINUTE: '1000',
      })
      await request.post('/api/sync/cloud/owner/sign-out')
    })

    test.beforeEach(({ page }) => setAppLanguage(page, 'en'))

    test.afterAll(async ({ request }) => {
      await request.post('/api/sync/cloud/owner/sign-out')
      await service.dispose()
      await google.stop()
      if (s3Running) await s3.stop()
      removeTempDir(folder)
    })

    test('the build publishes a library with its token, and only with it', async ({
      request,
    }) => {
      const uniq = Date.now()
      const category = (
        await (
          await request.post('/api/categories', {
            data: { name: `Featured ${uniq}` },
          })
        ).json()
      ).data as { id: number }
      for (const title of [`Hymn A ${uniq}`, `Hymn B ${uniq}`]) {
        await request.post('/api/songs', {
          data: {
            title,
            categoryId: category.id,
            slides: [{ content: `${title} words`, sortOrder: 0 }],
          },
        })
      }
      const file = join(folder, 'hymns.chsongs')
      const exported = await request.get(
        `/api/song-sources/export?categoryId=${category.id}`,
      )
      writeFileSync(file, await exported.body())

      const args = [
        'scripts/publish-library.ts',
        file,
        SOURCE_ID,
        'E2E Hymns',
        'E2E Hymns',
      ]
      const refused = await runScript(args, {
        LIBRARY_PUBLISH_TOKEN: 'wrong-token',
      })
      expect(refused.status).not.toBe(0)
      const published = await runScript(args, {
        LIBRARY_PUBLISH_TOKEN: PUBLISH_TOKEN,
      })
      expect(published.output).toContain('published 2 songs')
      expect(published.status).toBe(0)
      // Nothing changed: nothing is sent again.
      expect(
        (await runScript(args, { LIBRARY_PUBLISH_TOKEN: PUBLISH_TOKEN }))
          .output,
      ).toContain('unchanged')
    })

    test('a curator lists it, and the app offers it as a song source', async ({
      page,
      request,
    }) => {
      google.account = CURATOR
      await signInCurator(request)
      // This test PC may keep a list from an earlier run.
      expect(
        (
          await request.put('/api/song-library/featured', {
            data: { sources: [] },
          })
        ).ok(),
      ).toBe(true)
      await page.goto('/settings/song-library')
      const editor = page.getByTestId('featured-sources')
      await expect(editor).toBeVisible({ timeout: 15_000 })
      await editor.getByTestId('featured-source-id').fill(SOURCE_ID)
      await editor.getByTestId('featured-source-name').fill('E2E Hymns')
      await editor.getByTestId('featured-source-category').fill('E2E Hymns')
      await editor.getByTestId('featured-source-add').click()
      await editor.getByTestId('featured-sources-save').click()
      await expect(
        page.getByText('Sources saved.', { exact: false }),
      ).toBeVisible()
      await expect(editor.getByTestId('featured-source')).toHaveCount(1)

      const sources = (await (await request.get('/api/song-sources')).json())
        .data as Array<{ id: string; format: string; origin: string }>
      expect(sources.find((source) => source.id === SOURCE_ID)).toMatchObject({
        format: 'song-bundle-folder',
        origin: 'built-in',
      })
      // The built-in sources it does not name are still offered.
      expect(sources.some((source) => source.id === 'resurse-crestine')).toBe(
        true,
      )
    })

    test('the installer ships it, and a PC with no internet imports it', async ({
      request,
    }) => {
      const bundled = join(folder, 'song-libraries')
      const bundle = await runScript(
        ['scripts/bundle-song-libraries.ts', bundled],
        {
          CI: 'true',
        },
      )
      expect(bundle.output).toContain('Bundled E2E Hymns: 2 songs')
      expect(existsSync(join(bundled, 'featured.json'))).toBe(true)
      expect(existsSync(join(bundled, SOURCE_ID, 'manifest.json'))).toBe(true)

      // This test PC forgets the list; the bucket goes away: no internet.
      expect(
        (
          await request.put('/api/song-library/featured', {
            data: { sources: [] },
          })
        ).ok(),
      ).toBe(true)
      await s3.stop()
      s3Running = false

      const offline = new ExtraServer()
      await offline.start({
        CHURCH_HUB_BUNDLED_LIBRARIES_DIR: bundled,
        CHURCH_HUB_SYNC_URL: 'http://127.0.0.1:9',
        CHURCH_HUB_ALLOW_LOOPBACK_LINKS: 'true',
        CHURCH_HUB_SONG_UPDATES_AT_START: 'false',
      })
      try {
        const api = await offline.adminRequest()
        const sources = (await (await api.get('/api/song-sources')).json())
          .data as Array<{ id: string }>
        expect(sources.some((source) => source.id === SOURCE_ID)).toBe(true)
        const check = await checkSource(api, SOURCE_ID)
        expect(check.newCount + check.imported).toBe(2)
        await api.dispose()
      } finally {
        await offline.dispose()
      }
    })
  })
