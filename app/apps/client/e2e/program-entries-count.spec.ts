import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A Versete Biblice entry on the program page counts its readings in the
 * app's language (T-108): it said "1 entries" even in Romanian.
 */

async function firstTranslationId(request: APIRequestContext) {
  const res = await request.get('/api/bible/translations')
  return (await res.json()).data[0].id as number
}

function ioan3(translationId: number, verse: number) {
  return {
    personName: `Cititor ${verse}`,
    translationId,
    bookCode: 'JHN',
    bookName: 'Ioan',
    startChapter: 3,
    startVerse: verse,
    endChapter: 3,
    endVerse: verse,
  }
}

test('Bible verse entries are counted in Romanian, one and few', async ({
  page,
  request,
}) => {
  const translationId = await firstTranslationId(request)
  const program = (
    await (
      await request.post('/api/schedules', {
        data: { title: `E2E Entries Count ${Date.now()}` },
      })
    ).json()
  ).data as { id: number }

  try {
    for (const verses of [[16], [16, 17]]) {
      const res = await request.post(`/api/schedules/${program.id}/items`, {
        data: {
          slideType: 'versete_tineri',
          verseteTineriEntries: verses.map((v) => ioan3(translationId, v)),
        },
      })
      expect(res.ok()).toBeTruthy()
    }

    await page.addInitScript(() =>
      window.localStorage.setItem('church-hub-language', 'ro'),
    )
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto(`/schedules/${program.id}`)

    const list = page.locator('main')
    await expect(list.getByText('1 intrare', { exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(list.getByText('2 intrari', { exact: true })).toBeVisible()
    await expect(list.getByText(/\d+ entries/)).toHaveCount(0)
  } finally {
    await request.delete(`/api/schedules/${program.id}`)
  }
})
