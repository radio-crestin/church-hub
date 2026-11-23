import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * "Pe aceeași temă" (WhatsApp #76): the song page lists other songs on the
 * song's theme, found by the rare words they share. Versions of the song are
 * left out (they are in Versiuni), a song copied twice shows once, and a
 * click opens the song.
 */

// Words no other song in the library has, so only these songs share them.
const letters = Date.now()
  .toString()
  .replace(/\d/g, (d) => 'qwrtzpsdfg'[Number(d)])
const word = (stem: string) => stem + letters
const rare = ['zorvel', 'quintar'].map(word)

// Sharing two rare words is a theme; sharing most of the lyrics would be a
// version, so the song on the theme keeps words of its own.
const songs = {
  subject: { title: word('cina'), words: [...rare, 'pâine', 'vin', 'trup'] },
  onTheme: {
    title: word('masa'),
    words: [...rare, 'pahar', 'legământ', 'jertfă'],
  },
  copy: {
    title: word('masa'),
    words: [...rare, 'pahar', 'legământ', 'jertfă'],
  },
  version: { title: word('cina'), words: [...rare, 'pâine', 'vin', 'trup'] },
  unrelated: { title: word('primavara'), words: ['flori', 'soare', 'câmp'] },
}

test.describe('Songs on the same theme', () => {
  const ids: Record<keyof typeof songs, number> = {
    subject: 0,
    onTheme: 0,
    copy: 0,
    version: 0,
    unrelated: 0,
  }

  async function createSong(
    request: APIRequestContext,
    song: { title: string; words: string[] },
  ): Promise<number> {
    const res = await request.post('/api/songs', {
      data: {
        title: song.title,
        slides: [{ content: `<p>${song.words.join(' ')}</p>`, sortOrder: 0 }],
      },
    })
    expect(res.ok()).toBeTruthy()
    return (await res.json()).data.id
  }

  test.beforeAll(async ({ request }) => {
    for (const key of Object.keys(songs) as Array<keyof typeof songs>) {
      ids[key] = await createSong(request, songs[key])
    }
  })

  test.afterAll(async ({ request }) => {
    for (const id of Object.values(ids)) {
      if (id) await request.delete(`/api/songs/${id}`)
    }
  })

  test('lists songs on the theme, without versions or copies', async ({
    request,
  }) => {
    const res = await request.get(`/api/songs/${ids.subject}/same-theme`)
    expect(res.ok()).toBeTruthy()
    const found = ((await res.json()).data as Array<{ songId: number }>).map(
      (song) => song.songId,
    )

    const copies = found.filter((id) => id === ids.onTheme || id === ids.copy)
    expect(copies).toHaveLength(1)
    expect(found).not.toContain(ids.subject)
    expect(found).not.toContain(ids.version)
    expect(found).not.toContain(ids.unrelated)
  })

  test('the song page shows them and opens one on click', async ({ page }) => {
    await page.goto(`/songs/${ids.subject}`)
    const panel = page.getByTestId('same-theme-panel')

    const row = panel.getByRole('link', { name: songs.onTheme.title })
    await expect(row).toHaveCount(1)
    await row.click()
    await expect(page).toHaveURL(
      new RegExp(`/songs/(${ids.onTheme}|${ids.copy})$`),
    )
  })
})
