import { expect, type Page, test } from '@playwright/test'

/**
 * Search results show titles, lyrics and verses as text, with only the
 * matched words highlighted: markup typed into a program or song title (or
 * left in imported lyrics) shows as typed and never becomes part of the page.
 */

const MARKUP = `<img src=x data-e2e-markup onerror="window.__e2eMarkupRan=true">`

async function expectNoMarkupOnPage(page: Page) {
  await expect(page.locator(`[data-e2e-markup]`)).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__e2eMarkupRan)).toBe(
    undefined,
  )
}

test.describe('Search result text', () => {
  test('program search shows the title as typed, with the match highlighted', async ({
    page,
    request,
  }) => {
    const uniq = String(Date.now())
    const title = `Seara ${uniq} ${MARKUP}`
    const created = await request.post('/api/schedules', { data: { title } })
    expect(created.ok()).toBeTruthy()
    const scheduleId = (await created.json()).data.id as number

    try {
      await page.goto('/schedules')
      await page.getByPlaceholder(/search schedules|cauta programe/i).fill(uniq)

      // Its own program only, for the same reason as the song below.
      const snippet = page
        .getByTestId('schedule-card-snippet')
        .filter({ hasText: `Seara ${uniq}` })
      await expect(snippet).toHaveCount(1)
      await expect(snippet.locator('mark')).toHaveText(uniq)
      await expect(snippet).toContainText(`<img src=x data-e2e-markup`)
      await expectNoMarkupOnPage(page)
    } finally {
      await request.delete(`/api/schedules/${scheduleId}`).catch(() => {})
    }
  })

  test('song search shows title and lyrics as text, entities decoded', async ({
    page,
    request,
  }) => {
    const uniq = String(Date.now())
    const created = await request.post('/api/songs', {
      data: {
        title: `Cantare ${uniq} ${MARKUP}`,
        slides: [{ content: `<p>Slavă ${uniq} &amp; har</p>`, sortOrder: 0 }],
      },
    })
    expect(created.status()).toBe(201)
    const songId = (await created.json()).data.id as number

    try {
      await page.goto('/songs')
      await page.getByPlaceholder(/search songs|caută cântări/i).fill(uniq)

      // Its own card only: a number also finds songs with similar numbers,
      // such as other specs' songs left behind by a run that died.
      const card = page
        .getByTestId('song-card')
        .filter({ hasText: `Cantare ${uniq}` })
      await expect(card).toHaveCount(1)

      const title = card.getByTestId('song-card-title')
      await expect(title.locator('mark')).toHaveText(uniq)
      await expect(title).toContainText(`<img src=x data-e2e-markup`)

      const snippet = card.getByTestId('song-card-snippet')
      await expect(snippet.locator('mark')).toHaveText(uniq)
      await expect(snippet).toContainText(`Slavă ${uniq} & har`)
      await expectNoMarkupOnPage(page)
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => {})
    }
  })
})
