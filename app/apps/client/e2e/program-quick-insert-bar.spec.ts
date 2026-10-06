import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The bar between two program entries inserts right there (T-018): its one
 * "Inserează element" button opens the add menu, and a song or Bible verses
 * picked there land after the entry above the bar, not at the end. The add
 * menu does not reopen afterwards.
 */

interface Item {
  itemType: string
  songId: number | null
  slideType: string | null
}

async function makeSong(request: APIRequestContext, title: string) {
  const res = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} line`, sortOrder: 0 }] },
  })
  return (await res.json()).data.id as number
}

async function programItems(request: APIRequestContext, id: number) {
  const { data } = await (await request.get(`/api/schedules/${id}`)).json()
  return (data.items as Item[]).map((item) =>
    item.itemType === 'song' ? item.songId : item.slideType,
  )
}

test('the bar between entries inserts a song and verses right there', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const first = await makeSong(request, `E2E Bar First ${stamp}`)
  const last = await makeSong(request, `E2E Bar Last ${stamp}`)
  const inserted = await makeSong(request, `E2E Bar Inserted ${stamp}`)
  const program = (
    await (
      await request.post('/api/schedules', {
        data: { title: `E2E Bar Program ${stamp}` },
      })
    ).json()
  ).data as { id: number }

  try {
    for (const songId of [first, last]) {
      await request.post(`/api/schedules/${program.id}/items`, {
        data: { songId },
      })
    }
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto(`/schedules/${program.id}`)

    // One bar, between the two entries (none after the last).
    const bars = page.getByTestId('schedule-quick-insert-bar')
    await expect(bars).toHaveCount(1, { timeout: 10000 })
    const insert = bars.getByTestId('schedule-quick-insert')
    await bars.hover()
    await insert.hover()
    await expect(
      page.getByText(/(Insert an item after|Inserează un element după)/),
    ).toBeVisible()

    // A song, picked from the add menu the button opens.
    await insert.click()
    const modal = page.getByTestId('add-schedule-item-modal')
    await modal.getByTestId('add-schedule-item-song').click()
    await modal
      .getByTestId('song-picker-search')
      .fill(`E2E Bar Inserted ${stamp}`)
    const row = modal
      .getByTestId('song-picker-row')
      .filter({ hasText: `E2E Bar Inserted ${stamp}` })
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.click()
    await modal.getByTestId('add-schedule-item-preview-add').click()
    await expect
      .poll(() => programItems(request, program.id))
      .toEqual([first, inserted, last])

    // Bible verses, after the inserted song.
    await expect(bars).toHaveCount(2)
    await bars.nth(1).hover()
    await bars.nth(1).getByTestId('schedule-quick-insert').click()
    await modal.getByTestId('add-schedule-item-verseteTineri').click()
    const verses = page.getByTestId('insert-slide-modal')
    await expect(verses).toBeVisible()
    await verses
      .getByRole('button', { name: /Adauga Intrare|Add Entry/ })
      .click()
    await verses
      .getByPlaceholder(/Nume persoana|Person name/)
      .first()
      .fill('Timeea')
    await verses
      .getByPlaceholder(/Gen 1:1/)
      .first()
      .fill('Ioan 3:16')
    // The reference is read as you type; save once it is recognised.
    await expect(verses.getByText('Ioan 3:16', { exact: true })).toBeVisible()
    await verses.getByTestId('insert-slide-save').click()
    await expect(verses).toBeHidden()
    await expect
      .poll(() => programItems(request, program.id))
      .toEqual([first, inserted, 'versete_tineri', last])
    // Done: the add menu does not pop up after an insert from the bar.
    await expect(page.getByTestId('add-schedule-item-modal')).toBeHidden()
  } finally {
    await request.delete(`/api/schedules/${program.id}`)
    for (const id of [first, last, inserted]) {
      await request.delete(`/api/songs/${id}`)
    }
  }
})
