import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The control room's left column (CH-180, then T-907): the queue by default,
 * never the list of every presentation; while a presentation is on the
 * screens or runs by itself, that presentation instead, its items listed as
 * on the presentation page so the operator follows it slide by slide, with
 * Run / Stop; Next steps through it; on a phone the column sits under the
 * preview.
 */

const PHONE = { width: 390, height: 844 }

interface Presentation {
  id: number
  title: string
  songId: number
}

/** A song of three slides, then an announcement. */
async function createPresentation(
  request: APIRequestContext,
  automation: Record<string, unknown> = {},
): Promise<Presentation> {
  const uniq = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const song = await request.post('/api/songs', {
    data: {
      title: `E2E Playlist song ${uniq}`,
      slides: [1, 2, 3].map((n, sortOrder) => ({
        content: `<p>Strofa ${n}</p>`,
        sortOrder,
      })),
    },
  })
  const songId: number = (await song.json()).data.id
  const title = `E2E Playlist ${uniq}`
  const schedule = await request.post('/api/schedules', {
    data: { title, automation: { autoplayByText: false, ...automation } },
  })
  expect(schedule.ok()).toBeTruthy()
  const id: number = (await schedule.json()).data.id
  for (const data of [
    { songId },
    { slideType: 'announcement', slideContent: '<p>Bun venit!</p>' },
  ]) {
    const res = await request.post(`/api/schedules/${id}/items`, { data })
    expect(res.ok()).toBeTruthy()
  }
  return { id, title, songId }
}

/** The presentation step on the screens, or null. */
async function liveStep(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const data = state?.temporaryContent?.data
  if (state?.isHidden || !data) return null
  return { scheduleId: data.scheduleId, index: data.scheduleItemIndex }
}

function column(page: Page) {
  return page.getByTestId('control-room-queue')
}

test.describe('The control room column', () => {
  test.describe.configure({ mode: 'serial' })

  let created: Presentation[] = []

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop').catch(() => {})
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    for (const p of created) {
      await request.delete(`/api/schedules/${p.id}`).catch(() => {})
      await request.delete(`/api/songs/${p.songId}`).catch(() => {})
    }
    created = []
  })

  test('shows the queue, not every presentation; a presentation on the screens takes its place, and Next steps through it', async ({
    page,
    request,
  }) => {
    const presentation = await createPresentation(request)
    created.push(presentation)
    await page.goto('/present')

    await expect(column(page)).toHaveAttribute('data-showing', 'queue')
    await expect(column(page).getByText(presentation.title)).toHaveCount(0)

    // Put up from its own page, it takes the column, its slide lit.
    await request.post(`/api/schedules/${presentation.id}/run`)
    await expect(column(page)).toHaveAttribute('data-showing', 'program')
    await expect(
      column(page).getByTestId('control-room-queue-title'),
    ).toHaveText(presentation.title)
    await expect(column(page).getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-live/,
    )

    // A slide clicked in it goes live; Next walks through the song, into the
    // next item.
    await column(page).getByTestId('schedule-sub-item-1').click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 1 })
    const next = page.getByTestId('control-room-next')
    await next.click()
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 3 })
    await expect(column(page).getByTestId('schedule-sub-item-3')).toHaveClass(
      /ring-live/,
    )
    await page.getByTestId('control-room-prev').click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 2 })
  })

  test('a presentation that runs by itself shows with its step, and Stop takes it off', async ({
    page,
    request,
  }) => {
    const presentation = await createPresentation(request, {
      autoplaySeconds: 30,
      loop: true,
    })
    created.push(presentation)
    await page.goto('/present')

    await request.post(`/api/schedules/${presentation.id}/run`)
    await expect(column(page)).toHaveAttribute(
      'data-schedule-id',
      String(presentation.id),
    )
    await expect(column(page).getByTestId('schedule-run-progress')).toHaveText(
      '1/4',
    )
    await expect(column(page).getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-live/,
    )

    await column(page).getByTestId('schedule-run-button').click()
    await expect.poll(() => liveStep(request)).toBeNull()
    await expect(column(page)).toHaveAttribute('data-showing', 'queue')
  })

  test('on a phone the column sits under the preview and the bottom bar steps through the live presentation', async ({
    page,
    request,
  }) => {
    const presentation = await createPresentation(request)
    created.push(presentation)
    await page.setViewportSize(PHONE)
    await page.goto('/present')

    await request.post(`/api/schedules/${presentation.id}/run`)
    await expect(column(page)).toHaveAttribute('data-showing', 'program')
    const preview = await page.getByTestId('control-room-live').boundingBox()
    const list = await column(page).boundingBox()
    expect(list?.y ?? 0).toBeGreaterThan(preview?.y ?? 0)
    await expect(column(page).getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-live/,
    )
    // No horizontal scrolling on a phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    await page.getByTestId('control-room-phone-next').click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 1 })
    await expect(column(page).getByTestId('schedule-sub-item-1')).toHaveClass(
      /ring-live/,
    )
  })
})
