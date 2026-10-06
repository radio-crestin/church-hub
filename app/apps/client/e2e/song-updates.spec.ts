import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  type FolderSong,
  openSongXml,
  publishSongFolder,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * Song updates: the server checks the song sources in a worker thread and,
 * when updating songs automatically, adds the songs that are new to the
 * library. A song the library has under another title is left for review.
 * With automatic updates off, new songs are only counted.
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
    expect(result.imported).toBe(2)
    expect(result.newCount).toBe(1)
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

  test('with automatic updates off, new songs are only counted', async ({
    request,
  }) => {
    await setAutoUpdate(request, false)
    publishSongFolder(s3, folder, categoryName, [...fresh, known, third], 'two')
    const result = await checkSource(request, sourceId)
    expect(result.imported).toBe(0)
    expect(result.newCount).toBe(2)
    expect(await songsTitled(request, third.title)).toHaveLength(0)
  })
})
