import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Turning the marked songs (Marcaje) into a program.
 *
 * The action used to live in the Marcaje header; it now sits in the Programe
 * header, where it was hidden behind "a program is selected" — so with no
 * program yet there was no way to make one out of the marked songs, which is
 * exactly when an operator wants it. These tests hold that entry point open.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

async function deleteAllSchedules(request: APIRequestContext) {
  const response = await request.get('/api/schedules')
  const { data } = (await response.json()) as { data: Array<{ id: number }> }
  for (const schedule of data) {
    await request.delete(`/api/schedules/${schedule.id}`)
  }
}

async function scheduleTitles(request: APIRequestContext) {
  const response = await request.get('/api/schedules')
  const { data } = (await response.json()) as {
    data: Array<{ id: number; title: string; songCount: number }>
  }
  return data
}

test.describe.configure({ mode: 'serial' })

test.describe('Marcaje to a program', () => {
  test('makes a program out of the marked songs when there is none yet', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const programTitle = `E2E Bookmarks Program ${uniq}`
    const first = await createSong(request, `E2E Marked A ${uniq}`)
    const second = await createSong(request, `E2E Marked B ${uniq}`)
    let createdId: number | null = null

    try {
      await deleteAllSchedules(request)
      await request.delete('/api/song-bookmarks')
      for (const song of [first, second]) {
        const response = await request.post('/api/song-bookmarks', {
          data: { songId: song.id },
        })
        expect(response.status()).toBe(201)
      }

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/songs')
      await page.waitForLoadState('networkidle')

      const addAll = page.getByTestId('schedule-add-all-bookmarks')
      await expect(addAll).toBeVisible({ timeout: 10000 })
      await addAll.click()

      const modal = page.getByTestId('add-song-to-schedule-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })
      await modal.getByTestId('add-song-to-schedule-new').click()
      const draft = modal.getByTestId('schedule-draft-row')
      await expect(draft).toBeVisible()
      await draft.locator('input').fill(programTitle)
      await modal.getByTestId('add-song-to-schedule-save').click()
      await expect(modal).toBeHidden({ timeout: 10000 })

      await expect
        .poll(
          async () => {
            const created = (await scheduleTitles(request)).find(
              (schedule) => schedule.title === programTitle,
            )
            createdId = created?.id ?? null
            return created?.songCount ?? 0
          },
          { timeout: 10000 },
        )
        .toBe(2)
    } finally {
      if (createdId) await request.delete(`/api/schedules/${createdId}`)
      await request.delete('/api/song-bookmarks')
      await request.delete(`/api/songs/${first.id}`)
      await request.delete(`/api/songs/${second.id}`)
    }
  })

  test('offers no program actions for a program that is gone', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Marked C ${uniq}`)

    try {
      await deleteAllSchedules(request)
      await request.delete('/api/song-bookmarks')
      await request.post('/api/song-bookmarks', { data: { songId: song.id } })

      // The panel remembers the last program across reloads. With that program
      // deleted, its actions must not come back up pointing at nothing.
      await page.addInitScript(() => {
        localStorage.setItem('songPage.selectedScheduleId', '999999')
      })
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/songs')
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('schedule-add-all-bookmarks')).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByTestId('schedule-delete')).toBeHidden()
      await expect(page.getByTestId('schedule-add-candidate-song')).toBeHidden()
    } finally {
      await request.delete('/api/song-bookmarks')
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
