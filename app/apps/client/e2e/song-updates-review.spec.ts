import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  clearNotifications,
  deleteCategoriesNamed,
  type FolderSong,
  openSongXml,
  publishSongFolder,
  setAutoUpdate,
  stopSongUpdates,
} from './helpers/song-folder-source'

/**
 * One Resurse Creștine importer (T-035): with syncing without approval off,
 * Download songs lists the library songs a source changed, each with its old
 * and new lyrics, to update or keep; a song edited by hand never shows up.
 * A source that cannot be downloaded says why, with the real HTTP status.
 */

// Letters only: titles lose their digits on the way in.
const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const categoryName = `E2E Review ${tag}`
const folder = `/review/${tag}`

const song = (id: string, title: string, lyrics: string): FolderSong => ({
  id,
  title,
  xml: openSongXml(title, [lyrics]),
})

const first = `Clopotul de seara ${tag}`
const second = `Steaua de pe deal ${tag}`
const firstOld = `${tag} clopotul suna incet peste livezi`
const firstNew = `${tag} clopotul bate incet peste livezi`
const secondOld = `${tag} luceste o stea pe cerul senin`
const secondNew = `${tag} straluceste o stea pe cerul senin`

async function songIdTitled(request: APIRequestContext, title: string) {
  const res = await request.get(
    `/api/songs/search?q=${encodeURIComponent(title)}`,
  )
  const hits = (await res.json()).data as { id: number; title: string }[]
  const hit = hits.find((h) => h.title === title)
  expect(hit, `${title} is in the library`).toBeTruthy()
  return (hit as { id: number }).id
}

async function lyricsOf(request: APIRequestContext, title: string) {
  const res = await request.get(
    `/api/songs/${await songIdTitled(request, title)}`,
  )
  return ((await res.json()).data.slides as { content: string }[])
    .map((slide) => slide.content)
    .join('')
}

/** Checks the source now even when its checksum did not change. */
async function forceCheck(request: APIRequestContext, sourceId: string) {
  const run = await request.post('/api/song-sources/updates/run', {
    data: { sourceIds: [sourceId], force: true },
  })
  expect(run.status()).toBe(202)
  let source: Record<string, unknown> | undefined
  await expect(async () => {
    const state = (
      await (await request.get('/api/song-sources/updates')).json()
    ).data
    expect(state.running).toBe(false)
    source = state.sources.find(
      (s: { sourceId: string }) => s.sourceId === sourceId,
    )
    expect(source).toBeTruthy()
  }).toPass({ timeout: 60_000 })
  return source as { changedCount: number; httpStatus?: string }
}

test.describe('Song updates: review each change', () => {
  test.describe.configure({ mode: 'serial' })

  const s3 = new FakeS3()
  let sourceId = ''

  test.beforeAll(async ({ request }) => {
    await s3.start()
    await setAutoUpdate(request, true)
    const url = publishSongFolder(
      s3,
      folder,
      categoryName,
      [song('a', first, firstOld), song('b', second, secondOld)],
      'one',
    )
    sourceId = await addLinkSource(request, url)
    expect(await checkSource(request, sourceId)).toMatchObject({ imported: 2 })

    await setAutoUpdate(request, false)
    publishSongFolder(
      s3,
      folder,
      categoryName,
      [song('a', first, firstNew), song('b', second, secondNew)],
      'two',
    )
    expect(await checkSource(request, sourceId)).toMatchObject({
      changedCount: 2,
    })
    await clearNotifications(request)
  })

  test.afterAll(async ({ request }) => {
    await stopSongUpdates(request)
    await deleteCategoriesNamed(request, [categoryName])
    await setAutoUpdate(request, true)
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    await clearNotifications(request)
    await s3.stop()
  })

  test('lists the changed songs with old and new lyrics, to update or keep', async ({
    page,
    request,
  }) => {
    await page.goto(`/songs/discover?source=${sourceId}`)
    const updates = page.getByTestId('changed-songs')
    await expect(updates.getByText('Updates (2)')).toBeVisible()

    // The first: its lyrics in the library against the source's.
    await updates.getByRole('button', { name: new RegExp(first) }).click()
    await expect(page.getByText(firstOld, { exact: true })).toBeVisible()
    await expect(page.getByText(firstNew, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Update', exact: true }).click()
    await expect(
      updates.getByRole('button', { name: new RegExp(first) }),
    ).toHaveCount(0)
    expect(await lyricsOf(request, first)).toContain(firstNew)

    // The second: the library's version is kept.
    await updates.getByRole('button', { name: new RegExp(second) }).click()
    await page.getByRole('button', { name: 'Keep mine', exact: true }).click()
    await expect(updates).toHaveCount(0)
    expect(await lyricsOf(request, second)).toContain(secondOld)

    // Nothing waits any more, and the kept version is not offered again.
    expect((await forceCheck(request, sourceId)).changedCount).toBe(0)
  })

  test('a kept song comes back only when the source changes it again', async ({
    request,
  }) => {
    publishSongFolder(
      s3,
      folder,
      categoryName,
      [
        song('a', first, firstNew),
        song('b', second, `${tag} a treia versiune a stelei`),
      ],
      'three',
    )
    expect(await checkSource(request, sourceId)).toMatchObject({
      changedCount: 1,
    })
    const changed = (
      await (await request.get(`/api/song-sources/${sourceId}/changed`)).json()
    ).data as { library: { title: string } }[]
    expect(changed.map((c) => c.library.title)).toEqual([second])
  })

  test('a song edited by hand is never offered, nor replaced', async ({
    request,
  }) => {
    const id = await songIdTitled(request, first)
    const edit = await request.post('/api/songs', {
      data: {
        id,
        title: first,
        slides: [{ content: '<p>versurile noastre</p>', sortOrder: 0 }],
      },
    })
    expect(edit.ok()).toBeTruthy()
    publishSongFolder(
      s3,
      folder,
      categoryName,
      [
        song('a', first, `${tag} alte versuri de la sursa`),
        song('b', second, `${tag} a treia versiune a stelei`),
      ],
      'four',
    )
    await checkSource(request, sourceId)
    const changed = (
      await (await request.get(`/api/song-sources/${sourceId}/changed`)).json()
    ).data as { songId: number }[]
    expect(changed.map((c) => c.songId)).not.toContain(id)

    // Asked to update it all the same, it stays as edited.
    const resolve = await request.post(
      `/api/song-sources/${sourceId}/changed`,
      { data: { songIds: [id], action: 'update' } },
    )
    expect(resolve.ok()).toBeTruthy()
    expect(await lyricsOf(request, first)).toContain('versurile noastre')
  })

  test('works on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/songs/discover?source=${sourceId}`)
    const updates = page.getByTestId('changed-songs')
    await updates.getByRole('button', { name: new RegExp(second) }).click()
    const keep = page.getByRole('button', { name: 'Keep mine', exact: true })
    await expect(keep).toBeInViewport()
    await keep.click()
    await expect(updates).toHaveCount(0)
  })

  test('a source that refuses the download shows the real HTTP status', async ({
    page,
    request,
  }) => {
    s3.statuses.set(`${folder}/manifest.json`, 403)
    try {
      expect((await forceCheck(request, sourceId)).httpStatus).toBe(
        '403 Forbidden',
      )
      await page.goto(`/songs/discover?source=${sourceId}`)
      await expect(page.getByTestId(`source-error-${sourceId}`)).toHaveText(
        'Download failed: 403 Forbidden',
      )
      await page.goto('/settings/songs')
      await expect(page.getByTestId(`source-error-${sourceId}`)).toContainText(
        'Download failed: 403 Forbidden',
      )
    } finally {
      s3.statuses.clear()
    }
    // Checked again once it answers, the error is gone.
    expect((await forceCheck(request, sourceId)).httpStatus).toBeUndefined()
  })

  test('settings have one importer: the song updates, with the title recovery', async ({
    page,
  }) => {
    await page.goto('/settings/songs')
    await expect(page.getByText('Recover the original titles')).toBeVisible()
    await expect(page.getByText('Import from Resurse Crestine')).toHaveCount(0)
    // The recovery sits in the song updates card, beside the sources.
    const card = page
      .getByTestId('recover-original-titles')
      .locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]')
    await expect(card.getByText('Song updates', { exact: true })).toBeVisible()
  })
})
