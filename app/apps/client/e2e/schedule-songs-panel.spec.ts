import { expect, test } from '@playwright/test'

/**
 * The Programe work on the song page:
 *  1. The per-schedule "already sung" marker (API contract + scoping).
 *  2. The Programe panel in the song page's right column — tabs, check, remove.
 *  3. The Programe toolbar modal that stages a selection and only applies on
 *     Save.
 *  4. The merged add-item modal on the program page: one dialog, song search as
 *     a second step, back arrow returns to the type menu.
 */

interface CreatedSong {
  id: number
  title: string
}

async function createSong(
  request: import('@playwright/test').APIRequestContext,
  title: string,
): Promise<CreatedSong> {
  const res = await request.post('/api/songs', {
    data: { title, slides: [{ content: title, sortOrder: 0 }] },
  })
  const { data } = await res.json()
  return data
}

async function createSchedule(
  request: import('@playwright/test').APIRequestContext,
  title: string,
): Promise<{ id: number; title: string }> {
  const res = await request.post('/api/schedules', { data: { title } })
  const { data } = await res.json()
  return data
}

test.describe('Schedule item sung marker - API', () => {
  test('is scoped per program, so the same song can differ between them', async ({
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Sched Song ${uniq}`)
    const scheduleA = await createSchedule(request, `E2E Program A ${uniq}`)
    const scheduleB = await createSchedule(request, `E2E Program B ${uniq}`)

    try {
      const addA = await request.post(`/api/schedules/${scheduleA.id}/items`, {
        data: { songId: song.id },
      })
      const addB = await request.post(`/api/schedules/${scheduleB.id}/items`, {
        data: { songId: song.id },
      })
      const itemA = (await addA.json()).data
      const itemB = (await addB.json()).data

      // Fresh items are not sung, and carry the metadata the panel renders.
      expect(itemA.isSung).toBe(false)
      expect(itemA.sungAt).toBeNull()
      expect(itemA.song).toHaveProperty('tagNames')
      expect(Array.isArray(itemA.song.tagNames)).toBe(true)
      expect(itemA).toHaveProperty('keyLine')

      // Mark it sung in program A only.
      const marked = await request.put(
        `/api/schedules/${scheduleA.id}/items/${itemA.id}/sung`,
        { data: { isSung: true } },
      )
      expect(marked.status()).toBe(200)
      expect((await marked.json()).data.success).toBe(true)

      const afterA = await request.get(`/api/schedules/${scheduleA.id}`)
      const storedA = (await afterA.json()).data.items.find(
        (i: { id: number }) => i.id === itemA.id,
      )
      expect(storedA.isSung).toBe(true)
      expect(storedA.sungAt).toBeGreaterThan(0)

      // Program B is untouched — the marker belongs to the program, not the song.
      const afterB = await request.get(`/api/schedules/${scheduleB.id}`)
      const storedB = (await afterB.json()).data.items.find(
        (i: { id: number }) => i.id === itemB.id,
      )
      expect(storedB.isSung).toBe(false)

      // Unmarking clears the timestamp again.
      await request.put(
        `/api/schedules/${scheduleA.id}/items/${itemA.id}/sung`,
        { data: { isSung: false } },
      )
      const cleared = await request.get(`/api/schedules/${scheduleA.id}`)
      const storedCleared = (await cleared.json()).data.items.find(
        (i: { id: number }) => i.id === itemA.id,
      )
      expect(storedCleared.isSung).toBe(false)
      expect(storedCleared.sungAt).toBeNull()
    } finally {
      await request.delete(`/api/schedules/${scheduleA.id}`).catch(() => {})
      await request.delete(`/api/schedules/${scheduleB.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('marking an item that belongs to another program is refused', async ({
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Sched Guard ${uniq}`)
    const owner = await createSchedule(request, `E2E Owner ${uniq}`)
    const other = await createSchedule(request, `E2E Other ${uniq}`)

    try {
      const added = await request.post(`/api/schedules/${owner.id}/items`, {
        data: { songId: song.id },
      })
      const item = (await added.json()).data

      const response = await request.put(
        `/api/schedules/${other.id}/items/${item.id}/sung`,
        { data: { isSung: true } },
      )
      expect(response.status()).toBe(404)
      expect((await response.json()).data.success).toBe(false)
    } finally {
      await request.delete(`/api/schedules/${owner.id}`).catch(() => {})
      await request.delete(`/api/schedules/${other.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})

test.describe('Programe panel on the song page', () => {
  test('lists the program songs, filters them and marks one sung', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const songA = await createSong(request, `E2E Panel A ${uniq}`)
    const songB = await createSong(request, `E2E Panel B ${uniq}`)
    const schedule = await createSchedule(request, `E2E Panel Prog ${uniq}`)

    try {
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: songA.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: songB.id },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem(
          'song-detail:accordion-column-visible',
          'true',
        )
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${songA.id}`)
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible({ timeout: 10000 })

      const rowA = panel
        .getByTestId('schedule-song-item')
        .filter({ hasText: `E2E Panel A ${uniq}` })
      const rowB = panel
        .getByTestId('schedule-song-item')
        .filter({ hasText: `E2E Panel B ${uniq}` })
      await expect(rowA).toBeVisible({ timeout: 10000 })
      await expect(rowB).toBeVisible()

      // Mark A sung from the panel; it reaches the server.
      await rowA.getByTestId('schedule-song-sung-toggle').click()
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.find(
              (i: { songId: number }) => i.songId === songA.id,
            )?.isSung
          },
          { timeout: 10000 },
        )
        .toBe(true)

      // The three tabs split the list the same way Marcaje does.
      await panel.getByTestId('schedule-filter-sung').click()
      await expect(rowA).toBeVisible()
      await expect(rowB).toHaveCount(0)

      await panel.getByTestId('schedule-filter-pending').click()
      await expect(rowB).toBeVisible()
      await expect(rowA).toHaveCount(0)

      await panel.getByTestId('schedule-filter-all').click()
      await expect(rowA).toBeVisible()
      await expect(rowB).toBeVisible()

      // The X drops the song from the program.
      await rowB.getByTestId('schedule-song-remove').click()
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.length
          },
          { timeout: 10000 },
        )
        .toBe(1)
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${songA.id}`).catch(() => {})
      await request.delete(`/api/songs/${songB.id}`).catch(() => {})
    }
  })

  test('songs can be dragged into a new order, leaving other item types put', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const songA = await createSong(request, `E2E Drag A ${uniq}`)
    const songB = await createSong(request, `E2E Drag B ${uniq}`)
    const schedule = await createSchedule(request, `E2E Drag Prog ${uniq}`)

    try {
      // song A, an announcement, song B — the announcement sits between them so
      // the test proves reordering songs does not disturb other item types.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: songA.id },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { slideType: 'announcement', slideContent: 'Anunt' },
      })
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: songB.id },
      })

      await page.addInitScript((scheduleId: number) => {
        window.localStorage.setItem(
          'song-detail:accordion-column-visible',
          'true',
        )
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, schedule.id)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${songA.id}`)
      await page.waitForLoadState('networkidle')

      const panel = page.getByTestId('schedule-songs-panel')
      const rows = panel.getByTestId('schedule-song-item')
      await expect(rows).toHaveCount(2, { timeout: 10000 })
      await expect(rows.first()).toContainText(`E2E Drag A ${uniq}`)

      // Drag song A below song B.
      const handle = rows.first().getByTestId('schedule-song-drag-handle')
      const target = rows.nth(1)
      const from = await handle.boundingBox()
      const to = await target.boundingBox()
      if (!from || !to) throw new Error('drag targets not laid out')

      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      // A couple of intermediate moves so the 8px activation constraint trips
      // and dnd-kit registers the drop target.
      await page.mouse.move(
        from.x + from.width / 2,
        from.y + from.height / 2 + 20,
      )
      await page.mouse.move(to.x + to.width / 2, to.y + to.height + 5, {
        steps: 10,
      })
      await page.mouse.up()

      await expect(rows.first()).toContainText(`E2E Drag B ${uniq}`, {
        timeout: 10000,
      })

      // The new order persists, and the announcement is still the middle item.
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.map(
              (i: { itemType: string; songId: number | null }) =>
                i.itemType === 'song' ? i.songId : i.itemType,
            )
          },
          { timeout: 10000 },
        )
        .toEqual([songB.id, 'slide', songA.id])
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${songA.id}`).catch(() => {})
      await request.delete(`/api/songs/${songB.id}`).catch(() => {})
    }
  })
})

test.describe('Programe modal from the song toolbar', () => {
  test('nothing is applied until Save, and Save applies to every ticked program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Modal Song ${uniq}`)
    const scheduleA = await createSchedule(request, `E2E Modal AAA ${uniq}`)
    const scheduleB = await createSchedule(request, `E2E Modal BBB ${uniq}`)

    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')

      // Cancel must not touch anything.
      await page.getByTestId('song-add-to-schedule').click()
      const modal = page.getByTestId('add-song-to-schedule-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })

      await modal
        .getByTestId('add-song-to-schedule-search')
        .fill(`E2E Modal AAA ${uniq}`)
      const optionA = modal
        .getByTestId('schedule-option')
        .filter({ hasText: `E2E Modal AAA ${uniq}` })
      await expect(optionA).toBeVisible()
      await optionA.click()
      await modal.getByTestId('add-song-to-schedule-cancel').click()
      await expect(modal).toBeHidden()

      const afterCancel = await request.get(`/api/schedules/${scheduleA.id}`)
      expect((await afterCancel.json()).data.items.length).toBe(0)

      // Now tick both programs and save.
      await page.getByTestId('song-add-to-schedule').click()
      await expect(modal).toBeVisible()

      await modal.getByTestId('add-song-to-schedule-search').fill(`${uniq}`)
      await modal
        .getByTestId('schedule-option')
        .filter({ hasText: `E2E Modal AAA ${uniq}` })
        .click()
      await modal
        .getByTestId('schedule-option')
        .filter({ hasText: `E2E Modal BBB ${uniq}` })
        .click()
      await modal.getByTestId('add-song-to-schedule-save').click()
      await expect(modal).toBeHidden({ timeout: 10000 })

      for (const schedule of [scheduleA, scheduleB]) {
        await expect
          .poll(
            async () => {
              const res = await request.get(`/api/schedules/${schedule.id}`)
              const { data } = await res.json()
              return data.items.map((i: { songId: number }) => i.songId)
            },
            { timeout: 10000 },
          )
          .toEqual([song.id])
      }
    } finally {
      await request.delete(`/api/schedules/${scheduleA.id}`).catch(() => {})
      await request.delete(`/api/schedules/${scheduleB.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the + row creates a brand-new program on Save', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E New Prog Song ${uniq}`)
    const newProgramTitle = `E2E Created Prog ${uniq}`
    let createdId: number | null = null

    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('song-add-to-schedule').click()
      const modal = page.getByTestId('add-song-to-schedule-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })

      await modal.getByTestId('add-song-to-schedule-new').click()
      const draft = modal.getByTestId('schedule-draft-row')
      await expect(draft).toBeVisible()
      await draft.locator('input').fill(newProgramTitle)

      await modal.getByTestId('add-song-to-schedule-save').click()
      await expect(modal).toBeHidden({ timeout: 10000 })

      // The program exists and holds the song.
      await expect
        .poll(
          async () => {
            const res = await request.get('/api/schedules')
            const { data } = await res.json()
            const created = data.find(
              (s: { title: string }) => s.title === newProgramTitle,
            )
            createdId = created?.id ?? null
            return created?.songCount ?? 0
          },
          { timeout: 10000 },
        )
        .toBe(1)
    } finally {
      if (createdId) {
        await request.delete(`/api/schedules/${createdId}`).catch(() => {})
      }
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('an emptied + row is discarded instead of creating a program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Empty Draft ${uniq}`)

    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('song-add-to-schedule').click()
      const modal = page.getByTestId('add-song-to-schedule-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })

      await modal.getByTestId('add-song-to-schedule-new').click()
      const draft = modal.getByTestId('schedule-draft-row')
      await expect(draft).toBeVisible()

      // Typing then clearing removes the row on blur, and Save stays disabled
      // because there is nothing left to apply.
      await draft.locator('input').fill('Temporary')
      await draft.locator('input').fill('')
      await modal.getByTestId('add-song-to-schedule-search').click()
      await expect(draft).toHaveCount(0)
      await expect(
        modal.getByTestId('add-song-to-schedule-save'),
      ).toBeDisabled()
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})

test.describe('Add-item modal on the program page', () => {
  test('song search is a step inside the same dialog, with a back arrow', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E Picker Song ${uniq}`)
    const schedule = await createSchedule(request, `E2E Picker Prog ${uniq}`)

    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/schedules/${schedule.id}`)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('schedule-add-item').click()
      const modal = page.getByTestId('add-schedule-item-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })

      // Step 1: the type menu.
      await expect(modal.getByTestId('add-schedule-item-song')).toBeVisible()
      await modal.getByTestId('add-schedule-item-song').click()

      // Step 2: the song search, still the same dialog — no second modal.
      await expect(page.getByTestId('add-schedule-item-modal')).toHaveCount(1)
      await expect(modal.getByTestId('song-picker-search')).toBeVisible()

      // The back arrow returns to the menu, so a change of mind is one click.
      await modal.getByTestId('add-schedule-item-back').click()
      await expect(
        modal.getByTestId('add-schedule-item-biblePassage'),
      ).toBeVisible()

      // Forward again, search, and pick the song.
      await modal.getByTestId('add-schedule-item-song').click()
      await modal
        .getByTestId('song-picker-search')
        .fill(`E2E Picker Song ${uniq}`)
      const row = modal
        .getByTestId('song-picker-row')
        .filter({ hasText: `E2E Picker Song ${uniq}` })
      await expect(row).toBeVisible({ timeout: 10000 })
      await row.click()

      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/schedules/${schedule.id}`)
            const { data } = await res.json()
            return data.items.map((i: { songId: number }) => i.songId)
          },
          { timeout: 10000 },
        )
        .toEqual([song.id])
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the browse list loads in pages instead of the whole library', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const schedule = await createSchedule(request, `E2E Paging Prog ${uniq}`)

    try {
      // Capture every /api/songs browse request the picker makes. The old
      // picker issued a single limit=100000 request that froze the app.
      const limits: number[] = []
      await page.route('**/api/songs?*', async (route) => {
        const limit = new URL(route.request().url()).searchParams.get('limit')
        if (limit) limits.push(Number(limit))
        await route.continue()
      })

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/schedules/${schedule.id}`)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('schedule-add-item').click()
      const modal = page.getByTestId('add-schedule-item-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })
      await modal.getByTestId('add-schedule-item-song').click()
      await expect(modal.getByTestId('song-picker-list')).toBeVisible()
      await expect
        .poll(() => limits.length, { timeout: 10000 })
        .toBeGreaterThan(0)

      expect(Math.max(...limits)).toBeLessThanOrEqual(50)
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
    }
  })
})
