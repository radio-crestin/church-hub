import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The control room is a playlist of presentations (CH-180): the one on the
 * screens comes first, opened and marked LIVE, its items listed as on the
 * presentation page so the operator follows it slide by slide; Next steps
 * through it; a presentation that runs by itself shows Running / In a loop
 * with Run and Stop; on a phone the playlist sits under the preview.
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

function entryOf(page: Page, presentation: Presentation) {
  return page
    .getByTestId('playlist-entry')
    .filter({ hasText: presentation.title })
}

test.describe('The control room playlist', () => {
  test.describe.configure({ mode: 'serial' })

  let created: Presentation[] = []

  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop').catch(() => {})
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    for (const p of created) {
      await request.delete(`/api/schedules/${p.id}`).catch(() => {})
      await request.delete(`/api/songs/${p.songId}`).catch(() => {})
    }
    created = []
  })

  test('a slide clicked in the playlist goes live, its presentation comes first, marked LIVE, and Next steps through it', async ({
    page,
    request,
  }) => {
    const presentation = await createPresentation(request)
    created.push(presentation)
    await page.goto('/present')

    const entry = entryOf(page, presentation)
    await expect(entry).toBeVisible()
    await expect(entry).toHaveAttribute('data-live', 'false')

    // Opened, it lists its items as the presentation page does.
    await entry.getByTestId('playlist-entry-toggle').click()
    await entry.getByTestId('schedule-item').first().click()
    await entry.getByTestId('schedule-sub-item-0').click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 0 })

    await expect(entry).toHaveAttribute('data-live', 'true')
    await expect(entry.getByTestId('live-badge')).toBeVisible()
    await expect(page.getByTestId('playlist-entry').first()).toHaveAttribute(
      'data-schedule-id',
      String(presentation.id),
    )
    await expect(entry.getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-green-500/,
    )

    // Next walks the live presentation: through the song, into the next item.
    const next = page.getByTestId('control-room-next')
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 1 })
    await expect(entry.getByTestId('schedule-sub-item-1')).toHaveClass(
      /ring-green-500/,
    )
    await next.click()
    await next.click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 3 })
    await expect(entry.getByTestId('schedule-sub-item-3')).toHaveClass(
      /ring-green-500/,
    )

    await page.getByTestId('control-room-prev').click()
    await expect
      .poll(() => liveStep(request))
      .toEqual({ scheduleId: presentation.id, index: 2 })
  })

  test('a presentation that runs by itself shows Running and In a loop, with Run and Stop', async ({
    page,
    request,
  }) => {
    const presentation = await createPresentation(request, {
      autoplaySeconds: 30,
      loop: true,
    })
    created.push(presentation)
    await page.goto('/present')

    const entry = entryOf(page, presentation)
    await expect(entry.getByTestId('playlist-looping')).toBeVisible()
    await expect(entry.getByTestId('playlist-running')).toHaveCount(0)

    await entry.getByTestId('schedule-run-button').click()
    await expect(entry.getByTestId('playlist-running')).toBeVisible()
    await expect(entry).toHaveAttribute('data-live', 'true')
    await expect(entry.getByTestId('schedule-run-progress')).toHaveText('1/4')
    // Running, it is opened at its live step.
    await expect(entry.getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-green-500/,
    )

    await entry.getByTestId('schedule-run-button').click()
    await expect(entry.getByTestId('playlist-running')).toHaveCount(0)
    await expect.poll(() => liveStep(request)).toBeNull()
  })

  test('on a phone the playlist sits under the preview and the bottom bar steps through the live presentation', async ({
    page,
    request,
  }) => {
    const presentation = await createPresentation(request)
    created.push(presentation)
    await page.setViewportSize(PHONE)
    await request.post('/api/presentation/temporary-song', {
      data: {
        songId: presentation.songId,
        slideIndex: 0,
        scheduleId: presentation.id,
        scheduleItemIndex: 0,
      },
    })
    await page.goto('/present')

    const entry = entryOf(page, presentation)
    await expect(entry).toHaveAttribute('data-live', 'true')
    const preview = await page.getByTestId('control-room-live').boundingBox()
    const playlist = await entry.boundingBox()
    expect(playlist?.y ?? 0).toBeGreaterThan(preview?.y ?? 0)
    await expect(entry.getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-green-500/,
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
    await expect(entry.getByTestId('schedule-sub-item-1')).toHaveClass(
      /ring-green-500/,
    )
  })
})
