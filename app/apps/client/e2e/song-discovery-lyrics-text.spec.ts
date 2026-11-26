import { expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  publishSongFolder,
} from './helpers/song-folder-source'

/**
 * Song discovery's "Compare" reads a library song's lyrics as plain text:
 * markup left in the stored lyrics never becomes part of the page.
 */

const MARKUP = `<img src=x data-e2e-markup onerror="window.__e2eMarkupRan=true">`

// Must start with "<song": the importer's OpenSong detection requires it.
function openSongXml(title: string, lyrics: string[]): string {
  return `<song>
  <title>${title}</title>
  <lyrics>[V1]
${lyrics.map((line) => ` ${line}`).join('\n')}
</lyrics>
</song>`
}

test('Compare shows a library song lyrics as text', async ({
  page,
  request,
}) => {
  const ts = Date.now()
  // Song titles drop digits, so the unique part is written in letters.
  const alphaId = String(ts).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  const lyrics = [
    // Unique per run: the same lyrics as another run's leftover song would
    // make them the same song.
    `izvorul vietii ${alphaId} curge limpede peste inima mea`,
    'cant de bucurie negraita in fiecare dimineata',
    'lumina harului coboara peste cei smeriti',
    'si pasii mei se odihnesc in pacea Ta',
    'Tu esti stanca mea si adapostul meu',
    'in Tine ma incred cand vine furtuna',
  ]
  const libraryOnly = 'si cant cu bucurie pana la sfarsit'

  const seeded = await request.post('/api/songs', {
    data: {
      title: `Discovery Library Text ${alphaId}`,
      sourceFilename: `library-text-${ts}.xml`,
      slides: [
        {
          // One line more than the source's: a version of it, not the same
          // lyrics (which would make it the same song, T-176).
          content: `${[...lyrics, libraryOnly].map((line) => `<p>${line}</p>`).join('')}${MARKUP}`,
          sortOrder: 0,
        },
      ],
    },
  })
  expect(seeded.status()).toBe(201)
  const librarySongId = (await seeded.json()).data.id as number

  const candidateTitle = `Discovery Candidate Text ${alphaId}`
  const s3 = new FakeS3()
  await s3.start()
  const url = publishSongFolder(
    s3,
    `/lyrics-text/${alphaId}`,
    `E2E Lyrics ${alphaId}`,
    [
      {
        id: 'candidate',
        title: candidateTitle,
        xml: openSongXml(candidateTitle, lyrics),
      },
    ],
    'one',
  )
  // A version of the library song: left for review, never added on its own.
  const sourceId = await addLinkSource(request, url)
  await checkSource(request, sourceId)

  try {
    await page.goto(`/songs/discover?source=${sourceId}`)
    await page.getByText(candidateTitle).click({ timeout: 30_000 })
    // Other runs' songs can be similar too: compare with this run's.
    await page
      .locator('li', { hasText: `Discovery Library Text ${alphaId}` })
      .getByRole('button', { name: /^(Compare|Compară)$/ })
      .click()

    // The library song's lines were read as text: its own line shows as one.
    await expect(page.getByText(libraryOnly, { exact: true })).toBeVisible()

    await expect(page.locator('[data-e2e-markup]')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__e2eMarkupRan)).toBe(
      undefined,
    )
  } finally {
    await request.delete(`/api/songs/${librarySongId}`).catch(() => {})
    await request.delete(`/api/song-sources/${sourceId}`)
    await s3.stop()
  }
})
