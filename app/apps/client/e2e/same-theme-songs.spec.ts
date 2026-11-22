import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * "Pe aceeași temă" (T-084): the song page suggests other songs on the same
 * theme as the opened one, found through their words (the library carries
 * no theme data), never its versions (those stay in Versiuni).
 */

const suffix = Math.random().toString(36).replace(/\d/g, '').slice(0, 6)
/** Words no other song holds, so these songs only meet each other. */
const word = (base: string) => `${base}${suffix}`

interface ThemeSong {
  songId: number
  title: string
  themes: string[]
  sharedWords: string[]
}

test.describe('Songs on the same theme', () => {
  const created: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of created) await request.delete(`/api/songs/${id}`)
  })

  async function createSong(
    request: APIRequestContext,
    title: string,
    verses: string[],
  ): Promise<number> {
    const res = await request.post('/api/songs', {
      data: {
        title,
        slides: verses.map((verse) => ({ content: `<p>${verse}</p>` })),
      },
    })
    expect(res.ok()).toBeTruthy()
    const id = (await res.json()).data.id as number
    created.push(id)
    return id
  }

  async function sameTheme(request: APIRequestContext, songId: number) {
    const res = await request.get(`/api/songs/${songId}/same-theme`)
    expect(res.ok()).toBeTruthy()
    return (await res.json()).data as ThemeSong[]
  }

  /** Each test its own set (`key`), so one test's songs never show in another's list. */
  async function createChristmasSongs(request: APIRequestContext, key: string) {
    const word = (base: string) => `${base}${suffix}${key}`
    const subject = await createSong(
      request,
      `A venit ${word('sarbatoarea')}`,
      [
        `Crăciunul vine iar la noi, ${word('colindul')} răsună`,
        `În ieslea din Betleem s-a născut ${word('pruncusor')}`,
      ],
    )
    const sameTheme = await createSong(request, `Noapte ${word('senina')}`, [
      `Magii vin cu daruri la iesle, ${word('colindul')} se aude`,
      `E Crăciun în Betleem, ${word('pruncusor')} ne cheamă`,
    ])
    const otherTheme = await createSong(request, `Pe ${word('marea')} vieții`, [
      `Valuri mari se ridică, ${word('corabia')} se clatină`,
      `Cârmaciul ține ${word('carma')} spre limanul sigur`,
    ])
    const version = await createSong(
      request,
      `A venit ${word('sarbatoarea')}`,
      [
        `Crăciunul vine iar la noi, ${word('colindul')} răsună`,
        `În ieslea din Betleem s-a născut ${word('pruncusor')}`,
      ],
    )
    return { subject, sameTheme, otherTheme, version, word }
  }

  test('suggests a song on the same theme, naming the theme and the shared words', async ({
    request,
  }) => {
    const songs = await createChristmasSongs(request, 'a')
    const { word } = songs

    const found = await sameTheme(request, songs.subject)
    const ids = found.map((song) => song.songId)
    expect(ids).toContain(songs.sameTheme)
    expect(ids).not.toContain(songs.otherTheme)
    // A version of the song is Versiuni's, not another song on its theme.
    expect(ids).not.toContain(songs.version)
    expect(ids).not.toContain(songs.subject)

    const match = found.find((song) => song.songId === songs.sameTheme)
    expect(match?.themes).toContain('christmas')
    expect(match?.sharedWords).toEqual(
      expect.arrayContaining([word('colindul'), word('pruncusor')]),
    )
  })

  test('the song page lists it under "Same theme" and opens it', async ({
    page,
    request,
  }) => {
    const songs = await createChristmasSongs(request, 'b')
    const { word } = songs

    await page.goto(`/songs/${songs.subject}`)
    const panel = page.getByTestId('same-theme-panel')
    const row = panel
      .getByTestId('same-theme-row')
      .filter({ hasText: `Noapte ${word('senina')}` })
    await expect(row).toBeVisible({ timeout: 15000 })
    await expect(row.getByTestId('same-theme-chip')).toHaveText(
      /Christmas|Crăciun/,
    )
    await expect(row.getByTestId('same-theme-words')).toContainText(
      word('colindul'),
    )
    await expect(panel).not.toContainText(`Pe ${word('marea')} vieții`)

    await row.click()
    await expect(page).toHaveURL(new RegExp(`/songs/${songs.sameTheme}$`))
  })

  test('a song with nothing in common says so', async ({ page, request }) => {
    const lonely = await createSong(request, word('singuratic'), [
      `${word('nimeni')} ${word('altcineva')} ${word('niciodata')}`,
    ])

    expect(await sameTheme(request, lonely)).toEqual([])
    await page.goto(`/songs/${lonely}`)
    await expect(page.getByTestId('same-theme-empty')).toBeVisible({
      timeout: 15000,
    })
  })
})
