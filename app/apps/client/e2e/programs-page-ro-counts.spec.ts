import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * In Romanian the Programs page counts items in Romanian (T-105). Romanian
 * has three plural forms: one (1), few (0, 2-19) and other (20+, "de").
 * Without the few form, 0 and 2-19 fell back to English ("2 items").
 */

async function programWithItems(
  request: APIRequestContext,
  title: string,
  songId: number,
  count: number,
): Promise<number> {
  const res = await request.post('/api/schedules', { data: { title } })
  const id = (await res.json()).data.id as number
  for (let i = 0; i < count; i++) {
    await request.post(`/api/schedules/${id}/items`, { data: { songId } })
  }
  return id
}

test('program item counts read as Romanian for 0, 1, 2 and 20', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const song = await request.post('/api/songs', {
    data: {
      title: `E2E Count Song ${stamp}`,
      slides: [{ content: 'line', sortOrder: 0 }],
    },
  })
  const songId = (await song.json()).data.id as number
  const expected: Record<number, string> = {
    0: '0 elemente',
    1: '1 element',
    2: '2 elemente',
    20: '20 de elemente',
  }
  const ids: number[] = []

  try {
    for (const count of Object.keys(expected).map(Number)) {
      ids.push(
        await programWithItems(
          request,
          `E2E Count ${stamp} (${count})`,
          songId,
          count,
        ),
      )
    }

    await page.addInitScript(() =>
      window.localStorage.setItem('church-hub-language', 'ro'),
    )
    await page.goto('/schedules')

    for (const [count, text] of Object.entries(expected)) {
      const card = page
        .getByRole('button')
        .filter({ hasText: `E2E Count ${stamp} (${count})` })
      await expect(card).toContainText(text, { timeout: 10000 })
      await expect(card).not.toContainText('items')
    }
  } finally {
    for (const id of ids) await request.delete(`/api/schedules/${id}`)
    await request.delete(`/api/songs/${songId}`)
  }
})
