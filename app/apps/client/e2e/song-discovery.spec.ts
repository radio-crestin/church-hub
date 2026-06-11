import JSZip from 'jszip'
import { expect, test } from '@playwright/test'

/**
 * Song discovery: importing NEW songs from external sources. Covers the new
 * /api/songs/discovery/match endpoint (verdict classification) and the
 * /songs/discover staging UI end-to-end, with the external download mocked.
 */

function openSongXml(title: string, lyrics: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<song>
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
  const newTitle = `UI New Discovery Song ${ts}`

  test.afterAll(async ({ request }) => {
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

  test('shows only new songs, lets the user import an approved candidate', async ({
    page,
    request,
  }) => {
    // Seed a library song whose filename matches one catalog entry → that entry
    // must be hidden from the staging list as already-present.
    const dupFilename = `ui-dup-${ts}.xml`
    const seedRes = await request.post('/api/songs', {
      data: {
        title: `UI Existing Song ${ts}`,
        sourceFilename: dupFilename,
        slides: [{ content: '<p>existing library content here</p>', sortOrder: 0 }],
      },
    })
    expect([201, 409]).toContain(seedRes.status())
    if (seedRes.status() === 201) {
      createdSongIds.push((await seedRes.json()).data.id)
    }

    // Build a tiny OpenSong ZIP: one duplicate (by filename) + one brand-new.
    const zip = new JSZip()
    zip.file(dupFilename, openSongXml(`UI Existing Song ${ts}`, 'existing content'))
    zip.file(
      `ui-new-${ts}.xml`,
      openSongXml(newTitle, 'a fresh unseen verse never imported before today'),
    )
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    // Mock the external download (browser mode proxies through /api/proxy/download).
    await page.route('**/api/proxy/download**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: zipBuffer,
      }),
    )
    // The background sync issues a cheap HEAD change-check — stub it too so the
    // test never reaches the real external host.
    await page.route('**/api/proxy/head**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { lastModified: 'test', etag: null, contentLength: '1' },
        }),
      }),
    )

    // The screen auto-fetches on open (reusing the mocked download) — no click.
    await page.goto('/songs/discover')
    await expect(
      page.getByRole('heading', { name: /Discover new songs|Descoperă/ }),
    ).toBeVisible()

    // Wait for the diff to stream in and surface the new song.
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 30_000 })

    // The duplicate-by-filename entry must NOT appear in staging.
    await expect(page.getByText(`UI Existing Song ${ts}`)).toHaveCount(0)

    // Approve the new candidate and import it.
    await page.getByRole('button', { name: /^(Import|Importă)$/ }).first().click()
    await page
      .getByRole('button', { name: /Import selected|Importă selecția/ })
      .click()

    // It now exists in the library.
    await expect(async () => {
      const search = await request.get(
        `/api/songs/search?q=${encodeURIComponent(newTitle)}`,
      )
      const hits = (await search.json()).data as { title: string }[]
      expect(hits.some((h) => h.title === newTitle)).toBe(true)
    }).toPass({ timeout: 15_000 })
  })
})
