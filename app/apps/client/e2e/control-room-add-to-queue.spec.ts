import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { BUILT_IN_VIDEO } from './helpers/background-media'

/**
 * The control room's queue (T-907): empty until the operator adds to it with
 * the presentations' own add menu (a song, Bible verses, a gallery video, a
 * program played in place, …); Next walks it item by item, into a nested
 * program and out again. While a program runs, the column shows that program
 * and what is added goes in right after its live item. A presentation can
 * hold another one, but never in a loop.
 */

const PHONE = { width: 390, height: 844 }

interface Created {
  scheduleIds: number[]
  songIds: number[]
}

function uniq() {
  return `${Date.now()}${Math.round(Math.random() * 1e6)}`
}

async function createSong(
  request: APIRequestContext,
  created: Created,
  title: string,
  slides = 1,
): Promise<number> {
  const res = await request.post('/api/songs', {
    data: {
      title,
      slides: Array.from({ length: slides }, (_, sortOrder) => ({
        content: `<p>${title} strofa ${sortOrder + 1}</p>`,
        sortOrder,
      })),
    },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id
  created.songIds.push(id)
  return id
}

async function createPresentation(
  request: APIRequestContext,
  created: Created,
  title: string,
  items: Record<string, unknown>[],
): Promise<number> {
  const res = await request.post('/api/schedules', {
    data: { title, automation: { autoplayByText: false } },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id
  created.scheduleIds.push(id)
  for (const data of items) {
    const item = await request.post(`/api/schedules/${id}/items`, { data })
    expect(item.ok()).toBeTruthy()
  }
  return id
}

async function queueId(request: APIRequestContext): Promise<number> {
  return (await (await request.get('/api/schedules/queue')).json()).data.id
}

async function clearQueue(request: APIRequestContext) {
  const id = await queueId(request)
  await request.put(`/api/schedules/${id}/items/replace`, {
    data: { items: [] },
  })
}

/** Each item of the presentation, as its kind and what tells it apart. */
async function itemsOf(request: APIRequestContext, scheduleId: number) {
  const res = await request.get(`/api/schedules/${scheduleId}`)
  const items: {
    itemType: string
    slideType: string | null
    songId: number | null
    childScheduleId: number | null
  }[] = (await res.json()).data.items
  return items.map((item) =>
    item.itemType === 'song'
      ? `song:${item.songId}`
      : item.itemType === 'slide'
        ? `slide:${item.slideType}`
        : item.itemType === 'schedule'
          ? `schedule:${item.childScheduleId}`
          : item.itemType,
  )
}

/** The presentation step on the screens, or null. */
async function liveStep(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state?.temporaryContent
  if (state?.isHidden || !content) return null
  return {
    type: content.type as string,
    scheduleId: content.data.scheduleId as number,
    index: content.data.scheduleItemIndex as number,
  }
}

function addMenu(page: Page) {
  return page.getByTestId('add-schedule-item-modal')
}

async function addSong(page: Page, title: string) {
  await addMenu(page).getByTestId('add-schedule-item-song').click()
  const search = addMenu(page).getByTestId('song-picker-search')
  await search.fill(title)
  await expect(addMenu(page).getByText(title).first()).toBeVisible()
  // Enter shows it, Enter adds it.
  await search.press('Enter')
  await expect(
    addMenu(page).getByTestId('add-schedule-item-preview-add'),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(addMenu(page)).toBeHidden()
}

async function addProgram(page: Page, title: string) {
  await addMenu(page).getByTestId('add-schedule-item-program').click()
  const picker = page.getByTestId('add-program')
  await picker.getByTestId('add-program-search').fill(title)
  await expect(picker.getByTestId('add-program-option')).toHaveCount(1)
  await picker.getByTestId('add-program-search').press('Enter')
  await expect(picker).toBeHidden()
}

test.describe('The control room queue', () => {
  test.describe.configure({ mode: 'serial' })

  let created: Created = { scheduleIds: [], songIds: [] }

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await clearQueue(request)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop').catch(() => {})
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await clearQueue(request).catch(() => {})
    for (const id of created.scheduleIds) {
      await request.delete(`/api/schedules/${id}`).catch(() => {})
    }
    for (const id of created.songIds) {
      await request.delete(`/api/songs/${id}`).catch(() => {})
    }
    created = { scheduleIds: [], songIds: [] }
  })

  test('the queue fills with a song, Bible verses, a gallery video and a program, and Next walks them all, into the program and out', async ({
    page,
    request,
  }) => {
    const tag = uniq()
    const songTitle = `Coada ${tag}`
    const song = await createSong(request, created, songTitle, 2)
    const programSong = await createSong(request, created, `Program ${tag}`)
    const programTitle = `E2E Queue program ${tag}`
    const programId = await createPresentation(request, created, programTitle, [
      { slideType: 'announcement', slideContent: '<p>Din program</p>' },
      { songId: programSong },
    ])
    const queue = await queueId(request)

    await page.goto('/present')
    const column = page.getByTestId('control-room-queue')
    // Empty by default: no list of every presentation.
    await expect(column).toHaveAttribute('data-showing', 'queue')
    await expect(column.getByTestId('queue-empty')).toBeVisible()
    await expect(page.getByText(programTitle)).toHaveCount(0)

    // A song, from the empty state's Add.
    await column.getByTestId('queue-add').click()
    await expect(page.getByTestId('queue-add-placement')).toBeVisible()
    // Nothing of the queue is on the screens: no "after" to choose.
    await expect(page.getByTestId('queue-add-position')).toHaveCount(0)
    await addSong(page, songTitle)
    await expect.poll(() => itemsOf(request, queue)).toEqual([`song:${song}`])

    // Bible verses.
    await column.getByTestId('queue-add').click()
    await addMenu(page).getByTestId('add-schedule-item-verseteTineri').click()
    const verses = page.getByTestId('insert-slide-modal')
    await verses
      .getByRole('button', { name: /Adaugă intrare|Add Entry/ })
      .click()
    await verses.getByPlaceholder(/Numele persoanei|Person name/).fill('Ana')
    await verses.getByPlaceholder(/Gen 1:1/).fill('Ioan 3:16')
    await expect(verses.getByText('Ioan 3:16', { exact: true })).toBeVisible()
    await verses.getByTestId('insert-slide-save').click()
    await expect(verses).toBeHidden()
    // The add menu comes back for the next item; Esc closes it.
    await expect(addMenu(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(addMenu(page)).toBeHidden()

    // A video of the gallery.
    await column.getByTestId('queue-add').click()
    await addMenu(page).getByTestId('add-schedule-item-video').click()
    const video = page.getByTestId('video-item-dialog')
    await video
      .locator(
        `[data-testid="video-item-option"][data-media-id="${BUILT_IN_VIDEO.id}"]`,
      )
      .click()
    await video.getByTestId('video-item-dialog-save').click()
    await expect(video).toBeHidden()

    // A program, played in its place.
    await column.getByTestId('queue-add').click()
    await addProgram(page, programTitle)
    await expect
      .poll(() => itemsOf(request, queue))
      .toEqual([
        `song:${song}`,
        'slide:versete_tineri',
        'video',
        `schedule:${programId}`,
      ])
    await expect(column.getByTestId('schedule-item')).toHaveCount(4)

    // Next starts the queue and walks it: the song's two slides, the verses,
    // the video, then into the program, then out at its end.
    const next = page.getByTestId('control-room-next')
    const expectLive = (type: string, index: number) =>
      expect
        .poll(() => liveStep(request))
        .toEqual({ type, scheduleId: queue, index })
    await next.click()
    await expectLive('song', 0)
    await next.click()
    await expectLive('song', 1)
    await next.click()
    await expectLive('versete_tineri', 2)
    await next.click()
    await expectLive('video', 3)
    // What has gone by reads quieter; what is live and next does not.
    const rows = column.getByTestId('schedule-item')
    await expect(rows.nth(0)).toHaveAttribute('data-past', 'true')
    await expect(rows.nth(1)).toHaveAttribute('data-past', 'true')
    await expect(rows.nth(2)).not.toHaveAttribute('data-past', 'true')
    await next.click()
    await expectLive('announcement', 4)
    // The program's live item is marked inside its group.
    const group = column.getByTestId('nested-schedule-items')
    await expect(group).toBeVisible()
    await expect(group.getByTestId('schedule-sub-item-4')).toHaveClass(
      /ring-live/,
    )
    await next.click()
    await expectLive('song', 5)
    await page.getByTestId('control-room-prev').click()
    await expectLive('announcement', 4)

    // Clearing empties it.
    await request.post('/api/presentation/clear-temporary')
    await column.getByTestId('queue-clear').click()
    await page
      .getByTestId('queue-clear-confirm')
      .getByRole('button', { name: /Clear|Golește/ })
      .click()
    await expect(column.getByTestId('queue-empty')).toBeVisible()
    await expect.poll(() => itemsOf(request, queue)).toEqual([])
  })

  test('while a program runs, the column shows it and what is added goes right after its live item', async ({
    page,
    request,
  }) => {
    const tag = uniq()
    const liveSong = await createSong(request, created, `Ruleaza ${tag}`, 3)
    const newTitle = `Adaugata ${tag}`
    const newSong = await createSong(request, created, newTitle)
    const title = `E2E Running ${tag}`
    const programId = await createPresentation(request, created, title, [
      { songId: liveSong },
      { slideType: 'announcement', slideContent: '<p>Final</p>' },
    ])
    await request.post(`/api/schedules/${programId}/run`)
    await expect
      .poll(() => liveStep(request))
      .toMatchObject({ scheduleId: programId, index: 0 })

    await page.goto('/present')
    const column = page.getByTestId('control-room-queue')
    await expect(column).toHaveAttribute('data-showing', 'program')
    await expect(column.getByTestId('control-room-queue-title')).toHaveText(
      title,
    )

    await column.getByTestId('queue-add').click()
    await expect(
      page.getByTestId('queue-add-position').getByRole('radio').first(),
    ).toHaveAttribute('aria-checked', 'true')
    await addSong(page, newTitle)
    await expect
      .poll(() => itemsOf(request, programId))
      .toEqual([`song:${liveSong}`, `song:${newSong}`, 'slide:announcement'])

    const next = page.getByTestId('control-room-next')
    for (let i = 0; i < 3; i++) await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ type: 'song', scheduleId: programId, index: 3 })

    // The new song's slide is lit in the column.
    await expect(column.getByTestId('schedule-sub-item-3')).toHaveClass(
      /ring-live/,
    )

    // Once it stops and is off the screens, the column is the queue again.
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
    await expect(column).toHaveAttribute('data-showing', 'queue')
  })

  test('a program holds another one as a group, and never one that would loop', async ({
    page,
    request,
  }) => {
    const tag = uniq()
    const innerTitle = `E2E Inner ${tag}`
    const inner = await createPresentation(request, created, innerTitle, [
      { slideType: 'announcement', slideContent: '<p>Interior</p>' },
    ])
    const outerTitle = `E2E Outer ${tag}`
    const outer = await createPresentation(request, created, outerTitle, [
      { slideType: 'announcement', slideContent: '<p>Primul</p>' },
    ])

    // On a normal program's page: Add → Program puts the other one in.
    await page.goto(`/schedules/${outer}`)
    await page.getByTestId('schedule-add-item').click()
    await addMenu(page).getByTestId('add-schedule-item-program').click()
    const picker = page.getByTestId('add-program')
    // This program itself is no choice.
    await expect(picker.locator(`[data-schedule-id="${outer}"]`)).toHaveCount(0)
    await picker.getByTestId('add-program-search').fill(innerTitle)
    await picker.getByTestId('add-program-search').press('Enter')
    await expect(picker).toBeHidden()
    await expect
      .poll(() => itemsOf(request, outer))
      .toEqual(['slide:announcement', `schedule:${inner}`])

    // It lists as a group, opened to its items, and its step presents.
    const group = page.getByTestId('schedule-item').nth(1)
    await expect(group).toContainText(innerTitle)
    await group.click()
    await group.getByTestId('schedule-sub-item-1').click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ type: 'announcement', scheduleId: outer, index: 1 })

    // From the inner program, the outer one (which holds it) is no choice:
    // it would make a loop.
    await request.post('/api/presentation/clear-temporary')
    await page.goto(`/schedules/${inner}`)
    await page.getByTestId('schedule-add-item').click()
    await addMenu(page).getByTestId('add-schedule-item-program').click()
    await expect(page.getByTestId('add-program')).toBeVisible()
    await expect(
      page.getByTestId('add-program').locator(`[data-schedule-id="${outer}"]`),
    ).toHaveCount(0)
    await expect(
      page.getByTestId('add-program').locator(`[data-schedule-id="${inner}"]`),
    ).toHaveCount(0)
    // And the server refuses it all the same.
    const refused = await request.post(`/api/schedules/${inner}/items`, {
      data: { childScheduleId: outer },
    })
    expect(refused.status()).toBe(400)
  })

  test('on a phone the empty queue offers Add, the menu fits, its search does not zoom, and Esc closes it', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/present')

    const column = page.getByTestId('control-room-queue')
    await expect(column.getByTestId('queue-empty')).toBeVisible()
    await column.getByTestId('queue-add').click()
    await expect(addMenu(page)).toBeVisible()
    const box = await addMenu(page).boundingBox()
    expect(box?.width ?? 0).toBeLessThanOrEqual(PHONE.width - 32)

    await addMenu(page).getByTestId('add-schedule-item-song').click()
    const fontSize = await addMenu(page)
      .getByTestId('song-picker-search')
      .evaluate((el) => getComputedStyle(el).fontSize)
    expect(fontSize).toBe('16px')

    // Esc steps back to the kinds, then closes the menu.
    await page.keyboard.press('Escape')
    await expect(
      addMenu(page).getByTestId('add-schedule-item-song'),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(addMenu(page)).toBeHidden()
  })
})
