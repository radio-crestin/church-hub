import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { BUILT_IN_VIDEO } from './helpers/background-media'

/**
 * The control room's Add (T-907): the presentations' own add menu, opened
 * from the playlist header, puts a song, Bible verses, a gallery video or
 * another presentation's items into a presentation — right after the item on
 * the screens by default, else at its end — where Next steps through them.
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

/** Each item of the presentation, as its kind and what tells it apart. */
async function itemsOf(request: APIRequestContext, scheduleId: number) {
  const res = await request.get(`/api/schedules/${scheduleId}`)
  const items: {
    itemType: string
    slideType: string | null
    songId: number | null
    slideContent: string | null
  }[] = (await res.json()).data.items
  return items.map((item) =>
    item.itemType === 'song'
      ? `song:${item.songId}`
      : item.itemType === 'slide'
        ? `slide:${item.slideType}`
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

async function putFirstSlideLive(
  page: Page,
  request: APIRequestContext,
  scheduleId: number,
) {
  const entry = page.locator(
    `[data-testid="playlist-entry"][data-schedule-id="${scheduleId}"]`,
  )
  await entry.getByTestId('playlist-entry-toggle').click()
  await entry.getByTestId('schedule-item').first().click()
  await entry.getByTestId('schedule-sub-item-0').click()
  await expect
    .poll(() => liveStep(request))
    .toMatchObject({ scheduleId, index: 0 })
  return entry
}

test.describe('Adding to the control room queue', () => {
  test.describe.configure({ mode: 'serial' })

  let created: Created = { scheduleIds: [], songIds: [] }

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    for (const id of created.scheduleIds) {
      await request.delete(`/api/schedules/${id}`).catch(() => {})
    }
    for (const id of created.songIds) {
      await request.delete(`/api/songs/${id}`).catch(() => {})
    }
    created = { scheduleIds: [], songIds: [] }
  })

  test('a song, Bible verses and a gallery video go in right after the item on screen, and Next steps through them', async ({
    page,
    request,
  }) => {
    const tag = uniq()
    const liveSong = await createSong(request, created, `Coada vie ${tag}`, 3)
    const newSongTitle = `Coada noua ${tag}`
    const newSong = await createSong(request, created, newSongTitle, 2)
    const scheduleId = await createPresentation(
      request,
      created,
      `E2E Queue ${tag}`,
      [
        { songId: liveSong },
        { slideType: 'announcement', slideContent: '<p>Bun venit!</p>' },
      ],
    )
    await page.goto('/present')
    const entry = await putFirstSlideLive(page, request, scheduleId)

    const addMenu = page.getByTestId('add-schedule-item-modal')
    const openAdd = async (kind: string) => {
      await page.getByTestId('playlist-add').click()
      await expect(addMenu).toBeVisible()
      await expect(page.getByTestId('playlist-add-target')).toHaveValue(
        String(scheduleId),
      )
      await expect(
        page.getByTestId('playlist-add-position').getByRole('radio').first(),
      ).toHaveAttribute('aria-checked', 'true')
      await addMenu.getByTestId(`add-schedule-item-${kind}`).click()
    }

    // A song: searched, Enter shows it, Enter adds it.
    await openAdd('song')
    const search = addMenu.getByTestId('song-picker-search')
    await search.fill(newSongTitle)
    await expect(addMenu.getByText(newSongTitle).first()).toBeVisible()
    await search.press('Enter')
    await expect(
      addMenu.getByTestId('add-schedule-item-preview-add'),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(addMenu).toBeHidden()
    await expect
      .poll(() => itemsOf(request, scheduleId))
      .toEqual([`song:${liveSong}`, `song:${newSong}`, 'slide:announcement'])

    // Bible verses.
    await openAdd('verseteTineri')
    const verses = page.getByTestId('insert-slide-modal')
    await expect(verses).toBeVisible()
    await verses
      .getByRole('button', { name: /Adaugă intrare|Add Entry/ })
      .click()
    await verses.getByPlaceholder(/Numele persoanei|Person name/).fill('Ana')
    await verses.getByPlaceholder(/Gen 1:1/).fill('Ioan 3:16')
    await expect(verses.getByText('Ioan 3:16', { exact: true })).toBeVisible()
    await verses.getByTestId('insert-slide-save').click()
    await expect(verses).toBeHidden()
    await expect
      .poll(() => itemsOf(request, scheduleId))
      .toEqual([
        `song:${liveSong}`,
        'slide:versete_tineri',
        `song:${newSong}`,
        'slide:announcement',
      ])
    // The add menu comes back for the next item; Esc closes it.
    await expect(addMenu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(addMenu).toBeHidden()

    // A video of the gallery.
    await openAdd('video')
    const video = page.getByTestId('video-item-dialog')
    await video
      .locator(
        `[data-testid="video-item-option"][data-media-id="${BUILT_IN_VIDEO.id}"]`,
      )
      .click()
    await video.getByTestId('video-item-dialog-save').click()
    await expect(video).toBeHidden()
    await expect
      .poll(() => itemsOf(request, scheduleId))
      .toEqual([
        `song:${liveSong}`,
        'video',
        'slide:versete_tineri',
        `song:${newSong}`,
        'slide:announcement',
      ])

    // They are in the queue, and Next walks into them in their order.
    await expect(entry.getByTestId('schedule-item')).toHaveCount(5)
    const next = page.getByTestId('control-room-next')
    await next.click()
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toMatchObject({ scheduleId, index: 2 })
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ type: 'video', scheduleId, index: 3 })
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ type: 'versete_tineri', scheduleId, index: 4 })
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ type: 'song', scheduleId, index: 5 })
    await expect(entry.getByTestId('schedule-sub-item-5')).toHaveClass(
      /ring-live/,
    )
  })

  test("another presentation's items go at the end of the presentation picked", async ({
    page,
    request,
  }) => {
    const tag = uniq()
    const song = await createSong(request, created, `Coada sursa ${tag}`)
    const targetId = await createPresentation(
      request,
      created,
      `E2E Queue target ${tag}`,
      [{ slideType: 'announcement', slideContent: '<p>Primul</p>' }],
    )
    const sourceTitle = `E2E Queue source ${tag}`
    await createPresentation(request, created, sourceTitle, [
      { songId: song },
      { slideType: 'announcement', slideContent: '<p>Din sursă</p>' },
    ])
    await page.goto('/present')

    await page.getByTestId('playlist-add').click()
    const addMenu = page.getByTestId('add-schedule-item-modal')
    await page.getByTestId('playlist-add-target').selectOption(String(targetId))
    // Nothing of it is on the screens: there is no "after" to choose.
    await expect(page.getByTestId('playlist-add-position')).toHaveCount(0)
    await addMenu.getByTestId('add-schedule-item-presentation').click()

    const picker = page.getByTestId('add-presentation-items')
    await picker.getByTestId('add-presentation-items-search').fill(sourceTitle)
    await expect(
      picker.getByTestId('add-presentation-items-option'),
    ).toHaveCount(1)
    await picker.getByTestId('add-presentation-items-search').press('Enter')
    await expect(picker).toBeHidden()
    await expect
      .poll(() => itemsOf(request, targetId))
      .toEqual(['slide:announcement', `song:${song}`, 'slide:announcement'])

    // The presentation added to opens, listing them.
    const entry = page.locator(
      `[data-testid="playlist-entry"][data-schedule-id="${targetId}"]`,
    )
    await expect(entry.getByTestId('schedule-item')).toHaveCount(3)
  })

  test('on a phone the Add menu fits the screen, its search does not zoom, and Esc closes it', async ({
    page,
    request,
  }) => {
    const tag = uniq()
    await createPresentation(request, created, `E2E Queue phone ${tag}`, [
      { slideType: 'announcement', slideContent: '<p>Anunț</p>' },
    ])
    await page.setViewportSize(PHONE)
    await page.goto('/present')

    await page.getByTestId('playlist-add').click()
    const addMenu = page.getByTestId('add-schedule-item-modal')
    await expect(addMenu).toBeVisible()
    const box = await addMenu.boundingBox()
    expect(box?.width ?? 0).toBeLessThanOrEqual(PHONE.width)

    await addMenu.getByTestId('add-schedule-item-song').click()
    const fontSize = await addMenu
      .getByTestId('song-picker-search')
      .evaluate((el) => getComputedStyle(el).fontSize)
    expect(fontSize).toBe('16px')

    // Esc steps back to the kinds, then closes the menu.
    await page.keyboard.press('Escape')
    await expect(addMenu.getByTestId('add-schedule-item-song')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(addMenu).toBeHidden()
  })
})
