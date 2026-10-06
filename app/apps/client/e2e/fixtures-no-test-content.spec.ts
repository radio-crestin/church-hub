import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * What the tests make stays in the test database (T-114): the songs every
 * install starts with hold no e2e song. One had reached them, "E2E Unique
 * Song …" with its "API test verse 1", when the fixtures were dumped from a
 * dev database a test run had once written into; installs that got it lose
 * it on their next start.
 */

const SONGS_FIXTURE = fileURLToPath(
  new URL('../../server/src/db/fixtures/default-songs.json', import.meta.url),
)

const SEEDED_TEST_SONG = 'E2E Unique Song 1779869811190 e9b5ambhv9n'

// The names e2e specs give what they create ("E2E Unique Song 17…"), and
// the lyrics of the API spec's song.
const TEST_CONTENT = /\be2e\b|\bAPI test\b/i

interface SongFixture {
  title: string
  slides: { content: string }[]
}

/** The e2e songs a search finds (it also returns loose matches). */
async function findTestSongs(api: APIRequestContext, q: string) {
  const res = await api.get(`/api/songs/search?q=${encodeURIComponent(q)}`)
  expect(res.ok()).toBe(true)
  return ((await res.json()).data as { title: string }[])
    .map((song) => song.title)
    .filter((title) => TEST_CONTENT.test(title))
}

test('the shipped songs have no e2e song', () => {
  const songs = JSON.parse(readFileSync(SONGS_FIXTURE, 'utf8')) as SongFixture[]
  expect(songs.length).toBeGreaterThan(0)

  const testSongs = songs
    .filter(
      (song) =>
        TEST_CONTENT.test(song.title) ||
        song.slides.some((slide) => TEST_CONTENT.test(slide.content)),
    )
    .map((song) => song.title)
  expect(testSongs).toEqual([])
})

test.describe('installs', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 })

  let server: ExtraServer

  test.beforeAll(async () => {
    server = new ExtraServer()
    await server.start()
  })

  test.afterAll(async () => {
    await server?.dispose()
  })

  test('a fresh install finds no e2e song', async () => {
    const api = await server.adminRequest()
    expect(await findTestSongs(api, 'E2E Unique Song')).toEqual([])
  })

  test('an install that got the e2e song loses it on its next start', async () => {
    let api = await server.adminRequest()
    // The API cleans digits out of titles, so the seeded title is set below.
    const created = await api.post('/api/songs', {
      data: {
        title: 'Seeded test song',
        slides: [{ content: '<p>API test verse 1</p>', sortOrder: 0 }],
      },
    })
    expect(created.status()).toBe(201)
    const id = (await created.json()).data.id as number

    // As an install seeded from the older default songs has it.
    await server.stop()
    const db = new DatabaseSync(server.databasePath)
    try {
      db.prepare('UPDATE songs SET title = ? WHERE id = ?').run(
        SEEDED_TEST_SONG,
        id,
      )
    } finally {
      db.close()
    }
    await server.start()
    api = await server.adminRequest()

    expect((await api.get(`/api/songs/${id}`)).status()).toBe(404)
    expect(await findTestSongs(api, 'E2E Unique Song')).toEqual([])
  })
})
