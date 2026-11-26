import { copyFileSync } from 'node:fs'
import { buildLibrary, type LibrarySongInput } from '@church-hub/song-formats'
import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import {
  checkSource,
  deleteCategoriesNamed,
  openSongXml,
  setAutoUpdate,
  stopSongUpdates,
} from './helpers/song-folder-source'
import { SYNC_BUCKET, SyncService } from './helpers/sync-service'

// Demo recording for CH-176 (not committed).
const OUT =
  '/home/sf/projects/church-hub/.superfactory/worktrees/T-176/.demo/T-176/rec'
test.use({
  viewport: { width: 1920, height: 1080 },
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
})

const ourCategory = 'Cantari de Craciun'
const other = 'Biserica Harul'
const s3 = new FakeS3()
const service = new SyncService()
const key = (id: string, p: string) => `/${SYNC_BUCKET}/libraries/${id}/${p}`
const song = (id: string, title: string, lyrics: string): LibrarySongInput => ({
  id,
  title,
  xml: openSongXml(title, [lyrics]),
  lyrics: [lyrics],
})
async function put(id: string, songs: LibrarySongInput[]) {
  const { manifest, shards } = await buildLibrary(
    {
      sourceId: id,
      name: other,
      categoryName: other,
      listed: true,
      publisher: other,
    },
    songs,
  )
  for (const [p, b] of shards) s3.objects.set(key(id, p), Buffer.from(b))
  s3.objects.set(
    key(id, 'manifest.json'),
    Buffer.from(JSON.stringify(manifest)),
  )
}
async function save(page: Page, name: string) {
  const video = page.video()
  await page.close()
  copyFileSync((await video?.path()) as string, `${OUT}/${name}.mp4`)
}

test.describe
  .serial('demo', () => {
    test.setTimeout(180_000)
    let sourceId = ''
    test.beforeAll(async ({ request }) => {
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, { SYNC_COMPACT_AFTER: '100000' })
      expect(
        (
          await request.post('/api/sync/cloud', {
            data: { serviceUrl: service.url },
          })
        ).status(),
      ).toBe(200)
      const cat = await request.post('/api/categories', {
        data: { name: ourCategory },
      })
      const categoryId = (await cat.json()).data.id
      for (const [title, lyrics] of [
        ['O ce veste minunata', 'O ce veste minunata in Betleem ni se arata'],
        ['Steaua sus rasare', 'Steaua sus rasare ca o taina mare'],
      ]) {
        await request.post('/api/songs', {
          data: {
            title,
            categoryId,
            slides: [{ content: `<p>${lyrics}</p>`, sortOrder: 0 }],
          },
        })
      }
    })
    test.beforeEach(({ page }) => setAppLanguage(page, 'en'))
    test.afterAll(async ({ request }) => {
      await stopSongUpdates(request)
      await request.delete('/api/song-sources/share')
      if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
      await deleteCategoriesNamed(request, [ourCategory, other])
      await setAutoUpdate(request, true)
      await request.delete('/api/sync/cloud')
      await service.dispose()
      await s3.stop()
    })

    test('share', async ({ page }) => {
      await page.goto('/settings/songs')
      const section = page.getByTestId('share-my-songs')
      await section.scrollIntoViewIfNeeded()
      await page.waitForTimeout(1500)
      await section
        .getByLabel('Name')
        .pressSequentially('Cantarile bisericii noastre', { delay: 40 })
      await section.getByLabel('Chosen categories').check()
      await page.waitForTimeout(800)
      await section
        .getByTestId('share-categories')
        .getByLabel(ourCategory)
        .check()
      await page.waitForTimeout(800)
      await section.getByRole('button', { name: 'Share', exact: true }).click()
      await expect(section.getByTestId('library-share-link')).toBeVisible()
      await page.waitForTimeout(2500)
      await section.getByLabel('List it in the public catalog').check()
      await section.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(
        section
          .getByTestId('library-share')
          .getByText('in the catalog', { exact: true }),
      ).toBeVisible()
      await page.waitForTimeout(2500)
      await save(page, 'share')
    })

    test('catalog', async ({ page, request }) => {
      await put('OtherChurchHarul-lib', [
        song('a', 'Rasarit nou', 'Soarele rasare peste dealuri'),
        song('b', 'Alt nume', 'O ce veste minunata in Betleem ni se arata'),
      ])
      // The catalog lists libraries the service published; this one is put by hand.
      const cat = JSON.parse(
        s3.text(`/${SYNC_BUCKET}/libraries/catalog.json`) ?? '{"libraries":[]}',
      )
      cat.libraries.push({
        sourceId: 'OtherChurchHarul-lib',
        name: other,
        publisher: other,
        songCount: 2,
        updatedAt: new Date().toISOString(),
      })
      s3.objects.set(
        `/${SYNC_BUCKET}/libraries/catalog.json`,
        Buffer.from(JSON.stringify(cat)),
      )
      await setAutoUpdate(request, true)
      await page.goto('/songs/discover')
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: 'Shared libraries' }).click()
      await page.waitForTimeout(2000)
      await page
        .getByTestId('library-catalog')
        .locator('li', { hasText: other })
        .getByRole('button', { name: 'Add' })
        .click()
      await expect(
        page
          .getByTestId('library-catalog')
          .locator('li', { hasText: other })
          .getByRole('button', { name: 'Added' }),
      ).toBeVisible()
      sourceId = 'library-OtherChurchHarul-lib'
      expect(await checkSource(request, sourceId)).toMatchObject({
        imported: 1,
      })
      await page.waitForTimeout(2500)
      await save(page, 'catalog')
    })

    test('badge', async ({ page, request }) => {
      const res = await request.get(
        `/api/songs/search?q=${encodeURIComponent('Rasarit nou')}`,
      )
      const id = (
        (await res.json()).data as { id: number; title: string }[]
      ).find((h) => h.title === 'Rasarit nou')?.id
      await request.post('/api/songs', {
        data: {
          id,
          title: 'Rasarit nou',
          slides: [
            {
              content: '<p>Soarele rasare peste dealurile noastre</p>',
              sortOrder: 0,
            },
          ],
        },
      })
      await put('OtherChurchHarul-lib', [
        song('a', 'Rasarit nou', 'Soarele rasare iar peste dealuri si vai'),
        song('b', 'Alt nume', 'O ce veste minunata in Betleem ni se arata'),
      ])
      await checkSource(request, sourceId)
      await page.goto(`/songs/discover?source=${sourceId}`)
      const updates = page.getByTestId('changed-songs')
      await expect(updates.getByTestId('changed-edited-badge')).toBeVisible()
      await page.waitForTimeout(2000)
      await updates.getByRole('button', { name: /Rasarit nou/ }).click()
      await page.waitForTimeout(4000)
      await save(page, 'badge')
    })
  })
