import { type APIRequestContext, expect, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * A program's name can be changed after it is created: from the program page
 * (the always-visible pencil beside the title, or "Rename" in its menu) and
 * from the Programe panel the song and Bible pages share (the pencil in its
 * header, which opens a rename dialog). Renaming keeps the description.
 */

interface CreatedSchedule {
  id: number
  title: string
}

async function createSchedule(
  request: APIRequestContext,
  title: string,
  description: string | null = null,
): Promise<CreatedSchedule> {
  const res = await request.post('/api/schedules', {
    data: { title, description },
  })
  expect(res.ok()).toBeTruthy()
  const { data } = await res.json()
  return data
}

async function readSchedule(request: APIRequestContext, id: number) {
  const res = await request.get(`/api/schedules/${id}`)
  const { data } = await res.json()
  return data as { title: string; description: string | null }
}

test.describe('Schedule rename - API', () => {
  test('updating by id renames and keeps the description it is sent', async ({
    request,
  }) => {
    const uniq = Date.now()
    const schedule = await createSchedule(
      request,
      `E2E Rename API ${uniq}`,
      'Morning service',
    )

    try {
      const renamed = await request.post('/api/schedules', {
        data: {
          id: schedule.id,
          title: `E2E Renamed API ${uniq}`,
          description: 'Morning service',
        },
      })
      expect(renamed.ok()).toBeTruthy()

      const stored = await readSchedule(request, schedule.id)
      expect(stored.title).toBe(`E2E Renamed API ${uniq}`)
      expect(stored.description).toBe('Morning service')

      const empty = await request.post('/api/schedules', {
        data: { id: schedule.id, title: '' },
      })
      expect(empty.status()).toBe(400)
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
    }
  })
})

test.describe('Schedule rename - program page', () => {
  test('the pencil beside the title renames the program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const schedule = await createSchedule(
      request,
      `E2E Rename Page ${uniq}`,
      'Kept description',
    )

    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/schedules/${schedule.id}`)

      const edit = page.getByTestId('schedule-title-edit')
      await expect(edit).toBeVisible({ timeout: 15000 })
      await expect(edit).toContainText(schedule.title)

      await edit.click()
      const input = page.getByTestId('schedule-title-input')
      await expect(input).toHaveValue(schedule.title)
      await input.fill(`E2E Renamed Page ${uniq}`)
      await input.press('Enter')

      await expect(page.getByTestId('schedule-title-edit')).toContainText(
        `E2E Renamed Page ${uniq}`,
      )
      await expect
        .poll(async () => (await readSchedule(request, schedule.id)).title)
        .toBe(`E2E Renamed Page ${uniq}`)
      expect((await readSchedule(request, schedule.id)).description).toBe(
        'Kept description',
      )
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
    }
  })

  test('the menu opens the same editor on a phone, and Escape cancels', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const schedule = await createSchedule(request, `E2E Rename Menu ${uniq}`)

    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/schedules/${schedule.id}`)
      await expect(page.getByTestId('schedule-title-edit')).toBeVisible({
        timeout: 15000,
      })

      await selectAction(
        page,
        'schedule-presenter-actions-menu',
        'schedule-rename-action',
      )
      const input = page.getByTestId('schedule-title-input')
      await expect(input).toBeFocused()
      await input.fill(`E2E Not Saved ${uniq}`)
      await input.press('Escape')

      await expect(input).toHaveCount(0)
      await expect(page.getByTestId('schedule-title-edit')).toContainText(
        schedule.title,
      )
      expect((await readSchedule(request, schedule.id)).title).toBe(
        schedule.title,
      )
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
    }
  })
})

test.describe('Schedule rename - Programe panel', () => {
  test('the panel pencil opens a dialog that renames the selected program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const schedule = await createSchedule(
      request,
      `E2E Rename Panel ${uniq}`,
      'Panel description',
    )
    const songRes = await request.post('/api/songs', {
      data: {
        title: `E2E Rename Panel Song ${uniq}`,
        slides: [{ content: 'Verse', sortOrder: 0 }],
      },
    })
    const { data: song } = await songRes.json()

    try {
      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)

      const panel = page.getByTestId('schedule-songs-panel')
      const rename = panel.getByTestId('schedule-rename')
      await expect(rename).toBeVisible({ timeout: 15000 })
      await rename.click()

      const modal = page.getByTestId('rename-schedule-modal')
      await expect(modal).toBeVisible()
      const input = modal.getByTestId('rename-schedule-input')
      await expect(input).toHaveValue(schedule.title)
      // Saving the unchanged name does nothing, so the button waits for an edit.
      await expect(modal.getByTestId('rename-schedule-save')).toBeDisabled()

      await input.fill(`E2E Renamed Panel ${uniq}`)
      await modal.getByTestId('rename-schedule-save').click()

      await expect(modal).toBeHidden()
      await expect(panel).toContainText(`E2E Renamed Panel ${uniq}`)
      const stored = await readSchedule(request, schedule.id)
      expect(stored.title).toBe(`E2E Renamed Panel ${uniq}`)
      expect(stored.description).toBe('Panel description')
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
