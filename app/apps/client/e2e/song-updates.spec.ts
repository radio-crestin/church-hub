import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  clearNotifications,
  type FolderSong,
  openSongXml,
  publishSongFolder,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * Song updates: the server checks the song sources in a worker thread and,
 * when syncing without approval (the default), adds the songs that are new
 * to the library and updates those nobody edited by hand. A song the library
 * has under another title is left for review. With syncing without approval
 * off, the songs wait until the user syncs them.
 */

// Letters only: titles lose their digits on the way in.
const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const categoryName = `E2E Updates ${tag}`
const folder = `/updates/${tag}`

const song = (id: string, title: string, lyrics: string): FolderSong => ({
  id,
  title,
  xml: openSongXml(title, [lyrics]),
})

async function songsTitled(request: APIRequestContext, title: string) {
  const res = await request.get(
    `/api/songs/search?q=${encodeURIComponent(title)}`,
  )
  return ((await res.json()).data as { id: number; title: string }[]).filter(
    (hit) => hit.title === title,
  )
}

test.describe('Song updates', () => {
  test.describe.configure({ mode: 'serial' })

  const s3 = new FakeS3()
  let sourceId = ''
  const libraryIds: number[] = []
  const fresh = [
    song('a', `Cantare noua ${tag} unu`, `${tag} zori de lumina peste vale`),
    song('b', `Cantare noua ${tag} doi`, `${tag} rauri curg spre marea larga`),
  ]
  const knownLyrics = `${tag} harul Tau ma poarta zi de zi pe drumul vietii mele`
  // The library has this one under a shorter title.
  const known = song('c', `Harul Tau ma poarta ${tag}`, knownLyrics)
  const third = song(
    'd',
    `Cantare noua ${tag} trei`,
    `${tag} stele mici aprinse`,
  )

  test.beforeAll(async ({ request }) => {
    await s3.start()
    const library = await request.post('/api/songs', {
      data: {
        title: `Harul Tau ${tag}`,
        slides: [{ content: `<p>${knownLyrics}</p>`, sortOrder: 0 }],
      },
    })
    libraryIds.push((await library.json()).data.id)
    const url = publishSongFolder(
      s3,
      folder,
      categoryName,
      [...fresh, known],
      'one',
    )
    sourceId = await addLinkSource(request, url)
  })

  test.afterAll(async ({ request }) => {
    await setAutoUpdate(request, true)
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    for (const { title } of [...fresh, known, third]) {
      for (const hit of await songsTitled(request, title)) {
        await request.delete(`/api/songs/${hit.id}`)
      }
    }
    for (const id of libraryIds) await request.delete(`/api/songs/${id}`)
    await clearNotifications(request)
    await s3.stop()
  })

  test('adds the new songs on its own and leaves a known one for review', async ({
    request,
  }) => {
    const state = (
      await (await request.get('/api/song-sources/updates')).json()
    ).data
    expect(state.autoUpdate).toBe(true)

    const result = await checkSource(request, sourceId)
    expect(result).toMatchObject({ imported: 2, newCount: 0, similarCount: 1 })
    for (const { title } of fresh) {
      expect(await songsTitled(request, title)).toHaveLength(1)
    }
    expect(await songsTitled(request, known.title)).toHaveLength(0)

    // Song discovery gets the one left at once, with its verdict.
    const lacking = (
      await (await request.get(`/api/song-sources/${sourceId}/lacking`)).json()
    ).data as { parsed: { title: string }; verdict: string }[]
    expect(lacking.map((s) => [s.parsed.title, s.verdict])).toEqual([
      [known.title, 'similar'],
    ])
  })

  test('with syncing without approval off, new songs wait until synced', async ({
    request,
  }) => {
    await setAutoUpdate(request, false)
    publishSongFolder(s3, folder, categoryName, [...fresh, known, third], 'two')
    const result = await checkSource(request, sourceId)
    expect(result).toMatchObject({ imported: 0, newCount: 1, similarCount: 1 })
    expect(await songsTitled(request, third.title)).toHaveLength(0)

    const sync = await request.post('/api/song-sources/updates/sync')
    expect(sync.ok()).toBeTruthy()
    const synced = (await sync.json()).data.sources.find(
      (s: { sourceId: string }) => s.sourceId === sourceId,
    )
    expect(synced).toMatchObject({ newCount: 0, imported: 1 })
    expect(await songsTitled(request, third.title)).toHaveLength(1)
    // The one the library has under another title still waits for review.
    expect(await songsTitled(request, known.title)).toHaveLength(0)
  })

  test('brings the songs nobody edited up to date, never one edited by hand', async ({
    request,
  }) => {
    await setAutoUpdate(request, true)
    const [kept, edited] = fresh
    const [editedSong] = await songsTitled(request, edited.title)
    // An edit in the app marks the song as edited by hand.
    const edit = await request.post('/api/songs', {
      data: {
        id: editedSong.id,
        title: edited.title,
        slides: [{ content: '<p>versurile noastre</p>', sortOrder: 0 }],
      },
    })
    expect(edit.ok()).toBeTruthy()

    const newer = (s: FolderSong, lyrics: string) => song(s.id, s.title, lyrics)
    publishSongFolder(
      s3,
      folder,
      categoryName,
      [
        newer(kept, `${tag} zori noi de lumina peste vale`),
        newer(edited, `${tag} alte versuri de la sursa`),
        known,
        third,
      ],
      'three',
    )
    const result = (await checkSource(request, sourceId)) as {
      updated?: number
    }
    expect(result.updated).toBe(1)

    const lyricsOf = async (title: string) => {
      const [hit] = await songsTitled(request, title)
      const res = await request.get(`/api/songs/${hit.id}`)
      return ((await res.json()).data.slides as { content: string }[])
        .map((slide) => slide.content)
        .join('')
    }
    expect(await lyricsOf(kept.title)).toContain('zori noi de lumina')
    expect(await lyricsOf(edited.title)).toContain('versurile noastre')
  })

  test('a check asked for while another runs follows right after it', async ({
    request,
  }) => {
    const other = song(
      'e',
      `Cantare din alta sursa ${tag}`,
      `${tag} munti inalti si vai adanci sub cer`,
    )
    const url = publishSongFolder(
      s3,
      `${folder}-other`,
      `${categoryName} B`,
      [other],
      'one',
    )
    const otherId = await addLinkSource(request, url)
    // The first source answers slowly, so its check is still running.
    s3.delays.set(`${folder}/manifest.json`, 3000)
    try {
      const first = await request.post('/api/song-sources/updates/run', {
        data: { sourceIds: [sourceId], force: true },
      })
      expect(first.status()).toBe(202)
      const second = await request.post('/api/song-sources/updates/run', {
        data: { sourceIds: [otherId] },
      })
      expect((await second.json()).data.running).toBe(true)

      await expect(async () => {
        const state = (
          await (await request.get('/api/song-sources/updates')).json()
        ).data
        expect(state.running).toBe(false)
        expect(
          state.sources.find(
            (s: { sourceId: string }) => s.sourceId === otherId,
          ),
        ).toMatchObject({ imported: 1 })
      }).toPass({ timeout: 60_000 })
      expect(await songsTitled(request, other.title)).toHaveLength(1)
    } finally {
      s3.delays.clear()
      await request.delete(`/api/song-sources/${otherId}`)
      for (const hit of await songsTitled(request, other.title)) {
        await request.delete(`/api/songs/${hit.id}`)
      }
    }
  })
})
