import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'

/**
 * Song updates: the server checks the song sources in a worker thread and,
 * when updating songs automatically, adds the songs that are new to the
 * library. A song the library has under another title is left for review.
 * With automatic updates off, new songs are only counted.
 */

const ts = Date.now()
// Letters only: titles lose their digits on the way in.
const tag = ts
  .toString()
  .split('')
  .map((d) => String.fromCharCode(97 + Number(d)))
  .join('')
const categoryName = `E2E Updates ${tag}`
const folder = `/updates/${tag}`

interface BundleSong {
  id: string
  title: string
  lyrics: string
}

function openSong({ title, lyrics }: BundleSong): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>${title}</title>
  <lyrics>[V1]
 ${lyrics}
</lyrics>
</song>`
}

/** A shared folder on the stand-in S3: manifest.json plus a file per song. */
function publish(s3: FakeS3, songs: BundleSong[], checksum: string) {
  const manifest = {
    format: 'church-hub-song-bundle',
    version: 2,
    name: categoryName,
    categoryName,
    checksum,
    updatedAt: new Date().toISOString(),
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      path: `songs/${song.id}.opensong`,
      hash: `${song.id}-${checksum}`,
    })),
  }
  s3.objects.set(
    `${folder}/manifest.json`,
    Buffer.from(JSON.stringify(manifest)),
  )
  for (const song of songs) {
    s3.objects.set(
      `${folder}/songs/${song.id}.opensong`,
      Buffer.from(openSong(song)),
    )
  }
}

async function runUpdates(request: APIRequestContext, sourceId: string) {
  const run = await request.post('/api/song-sources/updates/run', {
    data: { sourceIds: [sourceId] },
  })
  expect(run.status()).toBe(202)
  let source: { newCount: number; imported: number } | undefined
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
  return source as { newCount: number; imported: number }
}

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
  const fresh: BundleSong[] = [
    {
      id: 'a',
      title: `Cantare noua ${tag} unu`,
      lyrics: `${tag} zori de lumina peste vale`,
    },
    {
      id: 'b',
      title: `Cantare noua ${tag} doi`,
      lyrics: `${tag} rauri curg spre marea larga`,
    },
  ]
  // The library has this one under a shorter title.
  const known: BundleSong = {
    id: 'c',
    title: `Harul Tau ma poarta ${tag}`,
    lyrics: `${tag} harul Tau ma poarta zi de zi pe drumul vietii mele`,
  }

  test.beforeAll(async ({ request }) => {
    await s3.start()
    const library = await request.post('/api/songs', {
      data: {
        title: `Harul Tau ${tag}`,
        slides: [{ content: `<p>${known.lyrics}</p>`, sortOrder: 0 }],
      },
    })
    libraryIds.push((await library.json()).data.id)
    publish(s3, [...fresh, known], 'one')
    const added = await request.post('/api/song-sources', {
      data: { url: `${s3.endpoint}${folder}/manifest.json` },
    })
    expect(added.ok()).toBeTruthy()
    sourceId = (await added.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    await request.put('/api/song-sources/updates/settings', {
      data: { autoUpdate: true },
    })
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    for (const song of [
      ...fresh,
      known,
      { title: `Cantare noua ${tag} trei` },
    ]) {
      for (const hit of await songsTitled(request, song.title)) {
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

    const result = await runUpdates(request, sourceId)
    expect(result.imported).toBe(2)
    expect(result.newCount).toBe(1)
    for (const song of fresh) {
      await expect(async () => {
        expect(await songsTitled(request, song.title)).toHaveLength(1)
      }).toPass({ timeout: 10_000 })
    }
    expect(await songsTitled(request, known.title)).toHaveLength(0)
  })

  test('with automatic updates off, new songs are only counted', async ({
    request,
  }) => {
    const off = await request.put('/api/song-sources/updates/settings', {
      data: { autoUpdate: false },
    })
    expect((await off.json()).data.autoUpdate).toBe(false)

    const third: BundleSong = {
      id: 'd',
      title: `Cantare noua ${tag} trei`,
      lyrics: `${tag} stele mici aprinse peste sat`,
    }
    publish(s3, [...fresh, known, third], 'two')
    const result = await runUpdates(request, sourceId)
    expect(result.imported).toBe(0)
    expect(result.newCount).toBe(2)
    expect(await songsTitled(request, third.title)).toHaveLength(0)
  })
})
