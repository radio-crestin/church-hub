import { DatabaseSync } from 'node:sqlite'
import { type APIRequestContext, expect, test } from '@playwright/test'
import JSZip from 'jszip'

import { ExtraServer } from './helpers/extra-server'

/**
 * Songs carry no <i>, <b> and similar formatting tags (T-104): a start-up
 * migration cleans every song already in the library, and the Resurse
 * Creștine (OpenSong) import drops them from what it brings in. The text
 * inside the tags stays, and so do entities like &amp;.
 */

const MIGRATION_FLAG = 'strip_song_formatting_tags_v1'
// sanitizeSongTitle drops digits, so make the unique token out of letters.
const alphaId = String(Date.now()).replace(
  /\d/g,
  (d) => 'abcdefghij'[Number(d)],
)

interface Song {
  id: number
  title: string
  author: string | null
  alternateTitles: string[] | null
  updatedAt: number
  slides: { content: string }[]
}

async function getSong(api: APIRequestContext, id: number): Promise<Song> {
  const res = await api.get(`/api/songs/${id}`)
  expect(res.ok()).toBe(true)
  return (await res.json()).data as Song
}

async function searchTitles(api: APIRequestContext, q: string) {
  const res = await api.get(`/api/songs/search?q=${encodeURIComponent(q)}`)
  expect(res.ok()).toBe(true)
  return (await res.json()).data as { id: number; title: string }[]
}

test.describe('formatting tags migration', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 })

  let server: ExtraServer

  test.beforeAll(async () => {
    server = new ExtraServer()
    await server.start()
  })

  test.afterAll(async () => {
    await server?.dispose()
  })

  test('cleans songs saved with tags, keeps the text, leaves clean songs alone', async () => {
    let api = await server.adminRequest()

    const tagged = await api.post('/api/songs', {
      data: {
        title: `<i>Cântare</i> nouă ${alphaId}`,
        author: '<b>Autor</b> necunoscut',
        alternateTitles: [`<b>Cântați</b> Domnului ${alphaId}`],
        slides: [
          {
            content:
              '<p>&lt;b&gt;Cântați&lt;/b&gt; Domnului o cântare nouă</p>' +
              '<p><strong>Lăudați-L</strong> în adunare &amp; cu &amp;lt;i&amp;gt;bucurie&amp;lt;/i&amp;gt;</p>',
            sortOrder: 0,
          },
        ],
      },
    })
    expect(tagged.status()).toBe(201)
    const taggedId = (await tagged.json()).data.id as number

    const clean = await api.post('/api/songs', {
      data: {
        title: `Cântare curată ${alphaId}`,
        slides: [{ content: '<p>Fără etichete &amp; atât</p>', sortOrder: 0 }],
      },
    })
    expect(clean.status()).toBe(201)
    const cleanId = (await clean.json()).data.id as number
    const cleanBefore = await getSong(api, cleanId)

    // An older version stored them like this; run the migration again on it.
    await server.stop()
    const db = new DatabaseSync(server.databasePath)
    try {
      db.prepare('DELETE FROM app_settings WHERE key = ?').run(MIGRATION_FLAG)
      db.prepare('DELETE FROM sync_pending').run()
    } finally {
      db.close()
    }
    await server.start()
    api = await server.adminRequest()

    const song = await getSong(api, taggedId)
    expect(song.title).toBe(`Cântare nouă ${alphaId}`)
    expect(song.author).toBe('Autor necunoscut')
    expect(song.alternateTitles).toEqual([`Cântați Domnului ${alphaId}`])
    expect(song.slides[0].content).toBe(
      '<p>Cântați Domnului o cântare nouă</p>' +
        '<p>Lăudați-L în adunare &amp; cu bucurie</p>',
    )

    // Search finds it by its clean title, and shows no tags.
    const hits = await searchTitles(api, `cantare noua ${alphaId}`)
    const hit = hits.find((h) => h.id === taggedId)
    expect(hit, 'the cleaned song is found').toBeTruthy()
    expect(JSON.stringify(hit)).not.toMatch(
      /<\/?(i|b|strong)>|&lt;\/?(i|b)&gt;/,
    )

    // A song without tags is not rewritten.
    expect((await getSong(api, cleanId)).updatedAt).toBe(cleanBefore.updatedAt)

    // The cleaned song is queued for the library sync, the clean one is not.
    await server.stop()
    const check = new DatabaseSync(server.databasePath)
    try {
      const isPending = (id: number) =>
        check
          .prepare(
            `SELECT COUNT(*) AS n FROM sync_pending p JOIN songs s ON s.uuid = p.entity_uuid
             WHERE p.entity_type = 'song' AND s.id = ?`,
          )
          .get(id)?.n === 1
      expect(isPending(taggedId)).toBe(true)
      expect(isPending(cleanId)).toBe(false)
    } finally {
      check.close()
    }
  })
})

test.describe('Resurse Creștine import', () => {
  const cleanTitle = `Cântare nouă ${alphaId}`

  test.afterAll(async ({ request }) => {
    for (const hit of await searchTitles(request, cleanTitle)) {
      if (hit.title === cleanTitle) await request.delete(`/api/songs/${hit.id}`)
    }
  })

  test('brings songs in without formatting tags', async ({ page, request }) => {
    // Escaped in the XML, so the file's text holds the tags themselves.
    const xml = `<song>
  <title>&lt;i&gt;Cântare&lt;/i&gt; nouă ${alphaId}</title>
  <author>&lt;b&gt;Autor&lt;/b&gt; necunoscut</author>
  <lyrics>[V1]
 &lt;b&gt;Cântați&lt;/b&gt; Domnului o cântare nouă ${alphaId}
 &lt;i&gt;Lăudați-L&lt;/i&gt; în adunare &amp; cu bucurie
</lyrics>
</song>`
    const zip = new JSZip()
    zip.file(`tags-${alphaId}.xml`, xml)
    const body = await zip.generateAsync({ type: 'nodebuffer' })

    await page.route('**/api/song-sources/resurse-crestine/archive', (route) =>
      route.fulfill({ status: 200, contentType: 'application/zip', body }),
    )

    await page.goto('/songs/discover')
    await expect(page.getByText(cleanTitle, { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/<\/?(i|b)>/)).toHaveCount(0)

    await page.getByRole('checkbox', { name: new RegExp(cleanTitle) }).click()
    await page
      .getByRole('button', { name: /Import selected|Importă selecția/ })
      .click()

    let songId = 0
    await expect(async () => {
      const hit = (await searchTitles(request, cleanTitle)).find(
        (h) => h.title === cleanTitle,
      )
      expect(hit).toBeTruthy()
      songId = hit!.id
    }).toPass({ timeout: 15_000 })

    const song = await getSong(request, songId)
    expect(song.author).toBe('Autor necunoscut')
    expect(song.slides[0].content).toBe(
      `<p>Cântați Domnului o cântare nouă ${alphaId}</p>` +
        '<p>Lăudați-L în adunare &amp; cu bucurie</p>',
    )
  })
})
