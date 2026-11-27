// Temporary: records CH-177's demo sections. Not committed.
import { execFile } from 'node:child_process'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { signInCurator } from './helpers/curated-library'
import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'
import { makeTempDir } from './helpers/temp-dir'

const APP_DIR = fileURLToPath(new URL('../../..', import.meta.url))
const REC = '/home/sf/.superfactory/attachments/tasks/church-hub/T-177/demo/rec'
const SHOTS = process.env.DEMO_SHOTS ?? '/tmp'
const TOKEN = 'demo-publish-token'
const CURATOR = { sub: 'google-demo-curator', email: 'curator@example.com' }
const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()
const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const youth = `Youth songs ${tag.slice(-4)}`
const christmas = `Christmas ${tag.slice(-4)}`

async function song(
  request: APIRequestContext,
  title: string,
  categoryId?: number,
) {
  const res = await request.post('/api/songs', {
    data: {
      title,
      categoryId,
      slides: [{ content: `${title} ${tag} words`, sortOrder: 0 }],
    },
  })
  return (await res.json()).data as { id: number }
}

async function category(request: APIRequestContext, name: string) {
  return (
    (await (await request.post('/api/categories', { data: { name } })).json())
      .data as { id: number }
  ).id
}

async function record(
  browser: Browser,
  name: string,
  run: (page: Page) => Promise<void>,
) {
  const dir = makeTempDir('t177-rec-')
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
    storageState: 'e2e/.auth/super-admin-0.json',
  })
  const page = await context.newPage()
  await setAppLanguage(page, 'en')
  await run(page)
  await page.waitForTimeout(1500)
  const video = page.video()
  await context.close()
  mkdirSync(REC, { recursive: true })
  renameSync((await video?.path()) ?? '', join(REC, `${name}.webm`))
}

const slow = (page: Page) => page.waitForTimeout(900)

test.describe
  .serial('T-177 demo', () => {
    test.setTimeout(600_000)

    test.beforeAll(async ({ request }) => {
      await s3.start()
      await google.start()
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        LIBRARY_CURATORS: CURATOR.email,
        LIBRARY_PUBLISH_TOKEN: TOKEN,
        LIBRARY_RATE_LIMIT_PER_MINUTE: '1000',
      })
      await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      google.account = CURATOR
    })

    test('record', async ({ browser, request }) => {
      const youthId = await category(request, youth)
      for (const t of ['Lumina din vale', 'Drumul spre casa']) {
        await song(request, `${t} ${tag.slice(-4)}`, youthId)
      }
      const xmasId = await category(request, christmas)
      for (const t of ['O ce veste', 'Steaua sus rasare', 'Florile dalbe']) {
        await song(request, `${t} ${tag.slice(-4)}`, xmasId)
      }
      await song(request, `Cer senin ${tag.slice(-4)}`)

      await record(browser, 'bulk', async (page) => {
        await page.goto('/settings/songs')
        await slow(page)
        const button = page.getByTestId(`category-submit-to-library-${youthId}`)
        await button.scrollIntoViewIfNeeded()
        await slow(page)
        await button.click()
        const dialog = page.getByTestId('submit-to-library-dialog')
        await slow(page)
        await dialog
          .getByTestId('submit-to-library-search')
          .pressSequentially(`Cer senin`, { delay: 60 })
        await slow(page)
        await dialog
          .getByTestId('submit-to-library-results')
          .getByRole('checkbox')
          .first()
          .check()
        await slow(page)
        await dialog
          .getByTestId('submit-to-library-note')
          .pressSequentially('Songs our youth choir sings', { delay: 40 })
        await slow(page)
        await dialog.getByRole('button', { name: 'Submit 3 songs' }).click()
        await expect(page.getByText('3 songs sent. Thank you!')).toBeVisible()
        await page.waitForTimeout(1500)
        await signInCurator(request)
        await page.goto('/settings/song-library')
        await expect(page.getByTestId('library-submission')).toHaveCount(3, {
          timeout: 15_000,
        })
        await page.waitForTimeout(2500)
      })

      await record(browser, 'shares', async (page) => {
        await page.goto('/settings/songs')
        const section = page.getByTestId('share-my-songs')
        await section.scrollIntoViewIfNeeded()
        await slow(page)
        await section.getByRole('button', { name: 'New share' }).click()
        let form = section.getByTestId('share-form')
        await form.getByLabel('Name').pressSequentially(youth, { delay: 50 })
        await form
          .getByTestId('share-selection-categories')
          .getByLabel(youth)
          .check()
        await slow(page)
        await form.getByRole('button', { name: 'Share', exact: true }).click()
        await expect(section.getByTestId('library-share')).toHaveCount(1, {
          timeout: 30_000,
        })
        await slow(page)
        await section.getByRole('button', { name: 'New share' }).click()
        form = section.getByTestId('share-form')
        await form
          .getByLabel('Name')
          .pressSequentially('Christmas picks', { delay: 50 })
        for (const t of ['O ce veste', 'Florile dalbe']) {
          await form.getByTestId('share-selection-search').fill('')
          await form
            .getByTestId('share-selection-search')
            .pressSequentially(t, { delay: 50 })
          await form
            .getByTestId('share-selection-results')
            .getByLabel(`${t} ${tag.slice(-4)}`)
            .check()
          await slow(page)
        }
        await form.getByRole('button', { name: 'Share', exact: true }).click()
        await expect(section.getByTestId('library-share')).toHaveCount(2, {
          timeout: 30_000,
        })
        await section
          .getByTestId('library-share')
          .last()
          .scrollIntoViewIfNeeded()
        await page.waitForTimeout(3000)
      })

      // The build publishes a library with its token, as the workflow will.
      const folder = makeTempDir('t177-demo-')
      const file = join(folder, 'hymns.chsongs')
      const exported = await request.get(
        `/api/song-sources/export?categoryId=${xmasId}`,
      )
      writeFileSync(file, await exported.body())
      await new Promise<void>((resolve, reject) =>
        execFile(
          'bun',
          [
            'scripts/publish-library.ts',
            file,
            'christmas-carols',
            'Christmas carols',
            'Christmas carols',
          ],
          {
            cwd: join(APP_DIR, 'apps/server'),
            env: {
              ...process.env,
              CHURCH_HUB_SYNC_URL: service.url,
              LIBRARY_PUBLISH_TOKEN: TOKEN,
            },
          },
          (error) => (error ? reject(error) : resolve()),
        ),
      )
      await request.put('/api/song-library/featured', { data: { sources: [] } })

      await record(browser, 'featured', async (page) => {
        await page.goto('/settings/song-library')
        const editor = page.getByTestId('featured-sources')
        await editor.scrollIntoViewIfNeeded()
        await slow(page)
        await editor
          .getByTestId('featured-source-id')
          .pressSequentially('christmas-carols', { delay: 50 })
        await editor
          .getByTestId('featured-source-name')
          .pressSequentially('Christmas carols', { delay: 50 })
        await editor
          .getByTestId('featured-source-category')
          .pressSequentially('Christmas carols', { delay: 50 })
        await editor.getByTestId('featured-source-add').click()
        await slow(page)
        await editor.getByTestId('featured-sources-save').click()
        await expect(
          page.getByText('Sources saved.', { exact: false }),
        ).toBeVisible()
        await page.waitForTimeout(1500)
        await page.goto('/settings/songs')
        const listed = page.getByText('Christmas carols').first()
        await listed.scrollIntoViewIfNeeded()
        await page.waitForTimeout(3000)
      })

      // Light theme screenshots of the new UI.
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        storageState: 'e2e/.auth/super-admin-0.json',
      })
      const page = await context.newPage()
      await setAppLanguage(page, 'en')
      await page.route('**/api/settings/app_settings/theme*', (route) =>
        route.fulfill({ json: { data: { key: 'theme', value: 'light' } } }),
      )
      await page.goto('/settings/songs')
      await page.getByTestId('share-my-songs').scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)
      await page.screenshot({ path: join(SHOTS, 'light-shares.png') })
      await page
        .getByTestId('share-my-songs')
        .getByRole('button', { name: 'New share' })
        .click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: join(SHOTS, 'light-share-form.png') })
      await page.goto('/settings/song-library')
      await page.getByTestId('featured-sources').scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)
      await page.screenshot({ path: join(SHOTS, 'light-featured.png') })
      await context.close()

      await request.put('/api/song-library/featured', { data: { sources: [] } })
      for (const { id } of (
        await (await request.get('/api/song-sources/shares')).json()
      ).data as { id: number }[]) {
        await request.delete(`/api/song-sources/shares/${id}`)
      }
      await request.post('/api/sync/cloud/owner/sign-out')
      await request.delete('/api/sync/cloud')
      await service.dispose()
      await google.stop()
      await s3.stop()
    })
  })
