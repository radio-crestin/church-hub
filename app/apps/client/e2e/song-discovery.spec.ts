import { expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  deleteCategoriesNamed,
  publishSongFolder,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * Song discovery: importing NEW songs from external sources. Covers the new
 * /api/songs/discovery/match endpoint (verdict classification) and the
 * /songs/discover staging UI end-to-end, with the external download mocked.
 */

// Must start with "<song" (no XML declaration) — the importer's OpenSong
// detection (isOpenSongContent) requires it, and the real Resurse Crestine
// files are shaped this way.
function openSongXml(title: string, lyrics: string): string {
  return `<song>
  <title>${title}</title>
  <lyrics>[V1]
 ${lyrics}
</lyrics>
</song>`
}

test.describe('Song Discovery — match API', () => {
  const createdSongIds: number[] = []
  const ts = Date.now()
  const seededTitle = `Discovery Izvorul Mantuirii ${ts}`
  const seededFilename = `discovery-seed-${ts}.xml`
  const seededLyrics =
    'izvorul mantuirii curge limpede peste inima mea cant de bucurie negraita'

  test.afterAll(async ({ request }) => {
    for (const id of createdSongIds) {
      await request.delete(`/api/songs/${id}`)
    }
  })

  test('classifies candidates by filename, title, similarity and novelty', async ({
    request,
  }) => {
    const seedRes = await request.post('/api/songs', {
      data: {
        title: seededTitle,
        sourceFilename: seededFilename,
        slides: [{ content: `<p>${seededLyrics}</p>`, sortOrder: 0 }],
      },
    })
    expect([201, 409]).toContain(seedRes.status())
    if (seedRes.status() === 409) {
      test.skip(true, 'Duplicate seed title detected')
      return
    }
    createdSongIds.push((await seedRes.json()).data.id)

    const res = await request.post('/api/songs/discovery/match', {
      data: {
        candidates: [
          {
            tempId: 'by-filename',
            title: `Whatever ${ts}`,
            lyrics: 'unrelated',
            sourceFilename: seededFilename,
          },
          {
            tempId: 'by-title',
            title: seededTitle,
            lyrics: 'different lyrics',
            sourceFilename: `other-${ts}.xml`,
          },
          {
            tempId: 'by-similarity',
            title: 'Cantarea Izvorului Celui Viu',
            lyrics: seededLyrics,
            sourceFilename: `sim-${ts}.xml`,
          },
          {
            tempId: 'brand-new',
            title: `Zymologica Quixotique Novum ${ts}`,
            lyrics: 'zymologica quixotique novum verba singularia distincta',
            sourceFilename: `new-${ts}.xml`,
          },
        ],
      },
    })
    expect(res.status()).toBe(200)
    const byTempId: Record<string, { verdict: string }> = Object.fromEntries(
      (await res.json()).data.map((r: { tempId: string }) => [r.tempId, r]),
    )
    expect(byTempId['by-filename'].verdict).toBe('exact-filename')
    expect(byTempId['by-title'].verdict).toBe('exact-title')
    expect(byTempId['by-similarity'].verdict).toBe('similar')
    expect(byTempId['brand-new'].verdict).toBe('new')
  })

  test('rejects batches larger than 500 candidates', async ({ request }) => {
    const candidates = Array.from({ length: 501 }, (_, i) => ({
      tempId: `c${i}`,
      title: `T${i}`,
      lyrics: 'x',
      sourceFilename: null,
    }))
    const res = await request.post('/api/songs/discovery/match', {
      data: { candidates },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Song Discovery — staging UI', () => {
  const createdSongIds: number[] = []
  const ts = Date.now()
  // sanitizeSongTitle strips digits, so a numeric timestamp would vanish from
  // the displayed/saved title. Encode the timestamp as letters for a unique,
  // sanitize-stable title token; the numeric ts is fine for filenames.
  const alphaId = String(ts).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  const newTitle = `UI New Discovery Song ${alphaId}`
  const s3 = new FakeS3()
  let sourceId = ''

  test.beforeAll(() => s3.start())

  test.afterAll(async ({ request }) => {
    await deleteCategoriesNamed(request, [`E2E Discovery ${alphaId}`])
    await setAutoUpdate(request, true)
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    await s3.stop()
    for (const id of createdSongIds) {
      await request.delete(`/api/songs/${id}`)
    }
    // Clean up the song the UI import created (look it up by its unique title).
    const search = await request.get(
      `/api/songs/search?q=${encodeURIComponent(newTitle)}`,
    )
    if (search.ok()) {
      const hits = (await search.json()).data as { id: number; title: string }[]
      for (const hit of hits) {
        if (hit.title === newTitle) {
          await request.delete(`/api/songs/${hit.id}`)
        }
      }
    }
  })

  test('shows only the songs the library lacks, all ticked, and imports the ticked ones', async ({
    page,
    request,
  }) => {
    // The library has this one already (same title): it must not show.
    const existingTitle = `UI Existing Song ${alphaId}`
    const seedRes = await request.post('/api/songs', {
      data: {
        title: existingTitle,
        slides: [
          { content: '<p>existing library content here</p>', sortOrder: 0 },
        ],
      },
    })
    expect(seedRes.status()).toBe(201)
    createdSongIds.push((await seedRes.json()).data.id)

    const brokenTitle = `UI Broken Song ${alphaId}`
    const url = publishSongFolder(
      s3,
      `/discovery/${alphaId}`,
      `E2E Discovery ${alphaId}`,
      [
        {
          id: 'dup',
          title: existingTitle,
          xml: openSongXml(existingTitle, 'existing content'),
        },
        {
          id: 'new',
          title: newTitle,
          xml: openSongXml(
            newTitle,
            'a fresh unseen verse never imported before today',
          ),
        },
        // A bare "&" is not valid XML: the song is still read, and so is the rest.
        {
          id: 'broken',
          title: brokenTitle,
          xml: openSongXml(brokenTitle, 'Bill & Gloria'),
        },
      ],
      'one',
    )
    // Left for review here, not added on their own.
    await setAutoUpdate(request, false)
    sourceId = await addLinkSource(request, url)
    await checkSource(request, sourceId)

    await page.goto(`/songs/discover?source=${sourceId}`)
    await expect(
      page.getByRole('heading', {
        name: /Download the latest songs|Descarcă ultimele cântări/,
      }),
    ).toBeVisible()
    const newBox = page.getByRole('checkbox', { name: new RegExp(newTitle) })
    const brokenBox = page.getByRole('checkbox', {
      name: new RegExp(brokenTitle),
    })
    await expect(newBox).toBeChecked({ timeout: 30_000 })
    await expect(brokenBox).toBeChecked()
    await expect(page.getByText(existingTitle)).toHaveCount(0)

    // Search narrows the list; untick one song, import the rest.
    await page.getByRole('searchbox').fill('broken')
    await expect(newBox).toHaveCount(0)
    await brokenBox.uncheck()
    await page.getByRole('searchbox').fill('')
    await page
      .getByRole('button', { name: /Import selected|Importă selecția/ })
      .click()

    await expect(async () => {
      const search = await request.get(
        `/api/songs/search?q=${encodeURIComponent(newTitle)}`,
      )
      const hits = (await search.json()).data as { title: string }[]
      expect(hits.some((h) => h.title === newTitle)).toBe(true)
    }).toPass({ timeout: 15_000 })
    await expect(newBox).toHaveCount(0)
    await expect(brokenBox).not.toBeChecked()
  })
})
