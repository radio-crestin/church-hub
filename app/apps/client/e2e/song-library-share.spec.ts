import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import {
  buildLibrary,
  type LibraryManifest,
  type LibraryShard,
  type LibrarySongInput,
  lyricsFingerprint,
} from '@church-hub/song-formats'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  clearNotifications,
  deleteCategoriesNamed,
  openSongXml,
  setAutoUpdate,
  stopSongUpdates,
} from './helpers/song-folder-source'
import { SYNC_BUCKET, SyncService } from './helpers/sync-service'

/**
 * Shared song libraries (T-176, T-177): "Share my songs" publishes groups of
 * the church's songs (the whole library, or categories and songs picked),
 * each with its own link, through the sync service (no S3 keys of its own) as hash-named
 * gzipped shards plus a manifest under libraries/<sourceId>/, unlisted or in
 * the public catalog. Any church imports one through the one song-source
 * path: deduplicated by source song, then lyrics fingerprint; a song follows
 * its source only while nobody changed it here, else it is offered as a new
 * version with its lyrics diff; an update downloads only changed shards.
 */

// Letters only: titles lose their digits on the way in.
const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const ourCategory = `E2E Share ${tag}`
const shareName = `Cantarile noastre ${tag}`
const ours = [
  { title: `Lumina din vale ${tag}`, lyrics: `${tag} lumina coboara in vale` },
  {
    title: `Drumul spre casa ${tag}`,
    lyrics: `${tag} pe drumul spre casa cantam`,
  },
]
// A second share: two of these three songs, picked one by one.
const picksCategory = `E2E Picks ${tag}`
const picksName = `Alese ${tag}`
const picks = [`Cer senin ${tag}`, `Ape linistite ${tag}`, `Vant usor ${tag}`]
// Another church's library, put straight in the bucket.
const otherId = `OtherChurch${tag.slice(0, 5)}-lib`
const otherName = `Biserica vecina ${tag}`
const fresh = `Rasarit nou ${tag}`
const freshLyrics = (version: string) =>
  `${tag} soarele rasare ${version} peste dealuri`
// The same lyrics as ours[0], under another title: the same song.
const twinTitle = `Alt nume ${tag}`
const bigId = `BigLibrary${tag.slice(0, 6)}-big`
const bigName = `Biblioteca mare ${tag}`

const s3 = new FakeS3()
const service = new SyncService()
const libraryKey = (sourceId: string, path: string) =>
  `/${SYNC_BUCKET}/libraries/${sourceId}/${path}`

const song = (id: string, title: string, lyrics: string): LibrarySongInput => ({
  id,
  title,
  xml: openSongXml(title, [lyrics]),
  lyrics: [lyrics],
})

/** Builds a library and puts it in the bucket, as the service would. */
async function putLibrary(
  sourceId: string,
  name: string,
  songs: LibrarySongInput[],
): Promise<LibraryManifest> {
  const { manifest, shards } = await buildLibrary(
    { sourceId, name, categoryName: name, listed: false, publisher: 'E2E' },
    songs,
  )
  for (const [path, bytes] of shards) {
    s3.objects.set(libraryKey(sourceId, path), Buffer.from(bytes))
  }
  s3.objects.set(
    libraryKey(sourceId, 'manifest.json'),
    Buffer.from(JSON.stringify(manifest)),
  )
  return manifest
}

const manifestUrl = (sourceId: string) =>
  `${s3.endpoint}${libraryKey(sourceId, 'manifest.json')}`

async function songIdTitled(request: APIRequestContext, title: string) {
  const res = await request.get(
    `/api/songs/search?q=${encodeURIComponent(title)}`,
  )
  const hits = (await res.json()).data as { id: number; title: string }[]
  return hits.filter((hit) => hit.title === title).map((hit) => hit.id)
}

async function lyricsOf(request: APIRequestContext, id: number) {
  const res = await request.get(`/api/songs/${id}`)
  return ((await res.json()).data.slides as { content: string }[])
    .map((slide) => slide.content)
    .join('')
}

/** Songs whose lyrics contain this text, wherever they are filed. */
async function songsWithLyrics(request: APIRequestContext, text: string) {
  const res = await request.get(
    `/api/songs/search?q=${encodeURIComponent(text)}`,
  )
  return ((await res.json()).data as { id: number }[]).length
}

interface Share {
  id: number
  name: string
  sourceId: string
  manifestUrl: string | null
  listed: boolean
  songCount: number
}

async function shares(request: APIRequestContext): Promise<Share[]> {
  return (await (await request.get('/api/song-sources/shares')).json()).data
}

async function share(request: APIRequestContext, name = shareName) {
  return (await shares(request)).find((s) => s.name === name) ?? null
}

/** The listed libraries' names, as the bucket's public catalog has them. */
function bucketCatalog(): string[] {
  const text = s3.text(`/${SYNC_BUCKET}/libraries/catalog.json`)
  return text
    ? (JSON.parse(text).libraries as { name: string }[]).map((l) => l.name)
    : []
}

async function catalog(request: APIRequestContext) {
  const res = await request.get('/api/song-sources/catalog')
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data as { sourceId: string; name: string }[]
}

test.describe
  .serial('Shared song libraries', () => {
    test.setTimeout(180_000)

    let churchId = ''
    let categoryId = 0
    let otherSourceId = ''
    let bigSourceId = ''
    let picksSourceId = ''

    test.beforeAll(async ({ request }) => {
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, { SYNC_COMPACT_AFTER: '100000' })
      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      churchId = (await connected.json()).data.churchId

      const category = await request.post('/api/categories', {
        data: { name: ourCategory },
      })
      categoryId = (await category.json()).data.id
      for (const { title, lyrics } of ours) {
        const created = await request.post('/api/songs', {
          data: {
            title,
            categoryId,
            slides: [{ content: `<p>${lyrics}</p>`, sortOrder: 0 }],
          },
        })
        expect(created.ok()).toBeTruthy()
      }
      const picked = await request.post('/api/categories', {
        data: { name: picksCategory },
      })
      const picksCategoryId = (await picked.json()).data.id
      for (const title of picks) {
        const created = await request.post('/api/songs', {
          data: {
            title,
            categoryId: picksCategoryId,
            slides: [{ content: `<p>${title} versuri</p>`, sortOrder: 0 }],
          },
        })
        expect(created.ok()).toBeTruthy()
      }
    })

    test.beforeEach(({ page }) => setAppLanguage(page, 'en'))

    test.afterAll(async ({ request }) => {
      await stopSongUpdates(request)
      for (const { id } of await shares(request)) {
        await request.delete(`/api/song-sources/shares/${id}`)
      }
      for (const id of [otherSourceId, bigSourceId, picksSourceId]) {
        if (id) await request.delete(`/api/song-sources/${id}`)
      }
      await deleteCategoriesNamed(request, [
        ourCategory,
        picksCategory,
        otherName,
      ])
      await setAutoUpdate(request, true)
      await clearNotifications(request)
      await request.delete('/api/sync/cloud')
      await service.dispose()
      await s3.stop()
    })

    test('Share my songs publishes hash-named gzipped shards and a manifest through the service', async ({
      page,
      request,
    }) => {
      await page.goto('/settings/songs')
      const section = page.getByTestId('share-my-songs')
      await expect(section.getByText('Nothing shared yet.')).toBeVisible()
      await section.getByRole('button', { name: 'New share' }).click()
      const form = section.getByTestId('share-form')
      await form.getByLabel('Name').fill(shareName)
      // Nothing picked yet: there is nothing to share.
      await expect(
        form.getByRole('button', { name: 'Share', exact: true }),
      ).toBeDisabled()
      await form
        .getByTestId('share-selection-categories')
        .getByLabel(ourCategory)
        .check()
      await form.getByRole('button', { name: 'Share', exact: true }).click()
      await expect(form).toHaveCount(0)
      const link = section.getByTestId('library-share-link')
      await expect(link).toContainText('/libraries/')
      await expect(
        section
          .getByTestId('library-share')
          .getByText('unlisted', { exact: true }),
      ).toBeVisible()

      // The library's folder names this church: only it may write there.
      const shared = await share(request)
      expect(shared?.sourceId.startsWith(`${churchId}-`)).toBe(true)
      expect(shared?.manifestUrl).toBe(manifestUrl(shared?.sourceId ?? ''))
      expect(shared?.songCount).toBe(2)

      const manifest = JSON.parse(
        s3.text(libraryKey(shared?.sourceId ?? '', 'manifest.json')) ?? '{}',
      ) as LibraryManifest
      expect(manifest).toMatchObject({
        format: 'church-hub-song-bundle',
        version: 3,
        name: shareName,
        listed: false,
        songCount: 2,
      })
      expect(manifest.shards).toHaveLength(1)
      const [entry] = manifest.shards
      expect(entry.path).toMatch(/^shards\/[0-9a-f]{64}\.json\.gz$/)
      const key = libraryKey(manifest.sourceId, entry.path)
      expect(s3.cacheControl.get(key)).toBe(
        'public, max-age=31536000, immutable',
      )
      // Gzipped, and named by the SHA-256 of its JSON.
      const json = gunzipSync(s3.objects.get(key) as Buffer)
      const digest = createHash('sha256').update(json).digest('hex')
      expect(entry.path).toBe(`shards/${digest}.json.gz`)
      const shard = JSON.parse(json.toString('utf8')) as LibraryShard
      const first = shard.songs.find((s) => s.title === ours[0].title)
      expect(first?.fingerprint).toBe(
        await lyricsFingerprint([`<p>${ours[0].lyrics}</p>`]),
      )

      // Unlisted: not in the catalog.
      expect((await catalog(request)).map((l) => l.sourceId)).not.toContain(
        manifest.sourceId,
      )
    })

    test('a listed library is in the catalog; only its church may write it', async ({
      page,
      request,
    }) => {
      await page.goto('/settings/songs')
      const section = page.getByTestId('share-my-songs')
      await section
        .getByTestId('library-share')
        .getByRole('button', { name: 'Edit' })
        .click()
      const form = section.getByTestId('share-form')
      // The share's contents come back as they were saved.
      await expect(
        form.getByTestId('share-selection-categories').getByLabel(ourCategory),
      ).toBeChecked()
      await form.getByLabel('List it in the public catalog').check()
      await form.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(
        section
          .getByTestId('library-share')
          .getByText('in the catalog', { exact: true }),
      ).toBeVisible()
      const shared = await share(request)
      expect(bucketCatalog()).toContain(shareName)
      // Other churches see it; this one does not offer itself its own songs.
      expect((await catalog(request)).map((l) => l.name)).not.toContain(
        shareName,
      )
      await page.goto('/songs/discover')
      await page.getByRole('button', { name: 'Shared libraries' }).click()
      await expect(
        page
          .getByTestId('library-catalog')
          .getByText('No church has listed a library yet.'),
      ).toBeVisible()

      // Without the church's token, the service refuses to write it.
      for (const sourceId of [shared?.sourceId, 'church-hub']) {
        const refused = await fetch(
          `${service.url}/sync/libraries/${sourceId}/manifest`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseChecksum: null, manifest: {} }),
          },
        )
        expect(refused.status).toBeGreaterThanOrEqual(400)
        expect(refused.status).toBeLessThan(500)
      }
      const anonymous = await fetch(
        `${service.url}/sync/libraries/${shared?.sourceId}`,
        { method: 'DELETE' },
      )
      expect(anonymous.status).toBe(401)
    })

    test('a second share of two picked songs gets its own link, which brings exactly those songs', async ({
      page,
      request,
    }) => {
      const nothing = await request.post('/api/song-sources/shares', {
        data: { name: 'Empty', categoryIds: [], songIds: [], listed: false },
      })
      expect(nothing.status()).toBe(400)

      await page.goto('/settings/songs')
      const section = page.getByTestId('share-my-songs')
      await section.getByRole('button', { name: 'New share' }).click()
      const form = section.getByTestId('share-form')
      await form.getByLabel('Name').fill(picksName)
      for (const title of picks.slice(0, 2)) {
        await form.getByTestId('share-selection-search').fill(title)
        await form
          .getByTestId('share-selection-results')
          .getByLabel(title)
          .check()
      }
      await expect(
        form.getByTestId('share-selection-chosen').getByRole('listitem'),
      ).toHaveCount(2)
      await form.getByRole('button', { name: 'Share', exact: true }).click()
      await expect(section.getByTestId('library-share')).toHaveCount(2)

      const first = await share(request)
      const second = await share(request, picksName)
      expect(second?.songCount).toBe(2)
      expect(second?.manifestUrl).toBe(manifestUrl(second?.sourceId ?? ''))
      expect(second?.manifestUrl).not.toBe(first?.manifestUrl)
      await expect(
        section
          .getByTestId('library-share-link')
          .filter({ hasText: second?.sourceId ?? '' }),
      ).toBeVisible()

      // Added as a source here, the link holds just the two songs picked.
      picksSourceId = await addLinkSource(request, second?.manifestUrl ?? '')
      const read = await request.get(`/api/song-sources/${picksSourceId}/songs`)
      const files = (await read.json()).data as { xml: string }[]
      expect(files).toHaveLength(2)
      const xml = files.map((file) => file.xml).join('')
      expect(xml).toContain(picks[0])
      expect(xml).toContain(picks[1])
      expect(xml).not.toContain(picks[2])
      expect(xml).not.toContain(ours[0].title)
    })

    test('importing deduplicates by source song, then by lyrics fingerprint', async ({
      request,
    }) => {
      await setAutoUpdate(request, true)
      await putLibrary(otherId, otherName, [
        song('fresh', fresh, freshLyrics('v1')),
        song('twin', twinTitle, ours[0].lyrics),
      ])
      otherSourceId = await addLinkSource(request, manifestUrl(otherId))
      expect(otherSourceId).toBe(`library-${otherId}`)

      // The twin has our song's lyrics under another title: linked, not added.
      expect(await checkSource(request, otherSourceId)).toMatchObject({
        imported: 1,
      })
      expect(await songIdTitled(request, fresh)).toHaveLength(1)
      expect(await songIdTitled(request, twinTitle)).toHaveLength(0)
      expect(await songsWithLyrics(request, ours[0].lyrics)).toBe(1)

      // Checked again, its own song is found by its id: still one of each.
      expect(await checkSource(request, otherSourceId)).toMatchObject({
        newCount: 0,
        similarCount: 0,
      })
      expect(await songIdTitled(request, fresh)).toHaveLength(1)
    })

    test('a song follows its source only while untouched; changed here, it is offered as a new version', async ({
      page,
      request,
    }) => {
      const [id] = await songIdTitled(request, fresh)
      // Untouched: the new lyrics land on their own.
      await putLibrary(otherId, otherName, [
        song('fresh', fresh, freshLyrics('v2')),
        song('twin', twinTitle, ours[0].lyrics),
      ])
      expect(await checkSource(request, otherSourceId)).toMatchObject({
        updated: 1,
      })
      expect(await lyricsOf(request, id)).toContain(freshLyrics('v2'))

      // Changed here: never replaced on its own, offered with a badge.
      const edit = await request.post('/api/songs', {
        data: {
          id,
          title: fresh,
          slides: [
            { content: `<p>${tag} versurile noastre</p>`, sortOrder: 0 },
          ],
        },
      })
      expect(edit.ok()).toBeTruthy()
      await putLibrary(otherId, otherName, [
        song('fresh', fresh, freshLyrics('v3')),
        song('twin', twinTitle, ours[0].lyrics),
      ])
      expect(await checkSource(request, otherSourceId)).toMatchObject({
        updated: 0,
        changedCount: 1,
      })
      expect(await lyricsOf(request, id)).toContain('versurile noastre')
      const changed = (
        await (
          await request.get(`/api/song-sources/${otherSourceId}/changed`)
        ).json()
      ).data as { songId: number; edited: boolean }[]
      expect(changed).toEqual([
        expect.objectContaining({ songId: id, edited: true }),
      ])

      await page.goto(`/songs/discover?source=${otherSourceId}`)
      const updates = page.getByTestId('changed-songs')
      await expect(updates.getByTestId('changed-edited-badge')).toHaveText(
        'Edited here · new version',
      )
      // Never picked for "apply" by default: taking it is a choice.
      await expect(
        updates.getByRole('checkbox', { name: `Select ${fresh}` }),
      ).not.toBeChecked()
      await updates.getByRole('button', { name: new RegExp(fresh) }).click()
      await expect(page.getByText(`${tag} versurile noastre`)).toBeVisible()
      await expect(page.getByText(freshLyrics('v3'))).toBeVisible()
      // Taken on purpose, the new version replaces the edit.
      await page.getByRole('button', { name: 'Update', exact: true }).click()
      await expect(updates).toHaveCount(0)
      expect(await lyricsOf(request, id)).toContain(freshLyrics('v3'))
    })

    test('an update downloads only the shards that changed', async ({
      request,
    }) => {
      const songs = Array.from({ length: 600 }, (_, n) =>
        song(`big-${n}`, `Big ${n}`, `${tag} big song ${n}`),
      )
      const first = await putLibrary(bigId, bigName, songs)
      expect(first.shards).toHaveLength(2)
      bigSourceId = await addLinkSource(request, manifestUrl(bigId))
      const shardGets = () =>
        s3.requests.filter(
          (r) => r.startsWith('GET ') && r.includes(`/${bigId}/shards/`),
        ).length

      s3.requests.length = 0
      const read = await request.get(`/api/song-sources/${bigSourceId}/songs`)
      expect(((await read.json()).data as unknown[]).length).toBe(600)
      expect(shardGets()).toBe(2)

      songs[7] = song('big-7', 'Big 7', `${tag} big song 7, changed`)
      const second = await putLibrary(bigId, bigName, songs)
      const kept = second.shards.filter((s) =>
        first.shards.some((f) => f.path === s.path),
      )
      expect(kept).toHaveLength(1)

      s3.requests.length = 0
      const again = await request.get(`/api/song-sources/${bigSourceId}/songs`)
      const files = (await again.json()).data as { id: string; xml: string }[]
      expect(files.find((f) => f.id === 'big-7')?.xml).toContain('changed')
      expect(shardGets()).toBe(1)
    })

    test('stopping a share takes it out of the catalog and the bucket', async ({
      request,
    }) => {
      const shared = await share(request)
      const stopped = await request.delete(
        `/api/song-sources/shares/${shared?.id}`,
      )
      expect(stopped.ok()).toBeTruthy()
      expect(await share(request)).toBeNull()
      // The other share is still there.
      expect((await share(request, picksName))?.manifestUrl).toBeTruthy()
      expect(bucketCatalog()).not.toContain(shareName)
      const left = [...s3.objects.keys()].filter((key) =>
        key.includes(`/libraries/${shared?.sourceId}/`),
      )
      expect(left).toEqual([])
    })
  })
