import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Slide timing, like PowerPoint's "advance after" (T-016): by default a slide
 * stays up the presentation's seconds per slide (5 s), longer when it has more
 * text to read; an item can have its own time, set beside it in the list.
 */

/** 60 words: about 22 s to read (2 s to look up + 3 words a second). */
const LONG_TEXT = Array.from({ length: 60 }, (_, i) => `cuvânt${i}`).join(' ')

async function createPresentation(
  request: APIRequestContext,
  automation: Record<string, unknown>,
  announcements: string[],
): Promise<{ id: number; itemIds: number[] }> {
  const res = await request.post('/api/schedules', {
    data: { title: `E2E Slide Timing ${Date.now()}`, automation },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id
  const itemIds: number[] = []
  for (const text of announcements) {
    const item = await request.post(`/api/schedules/${id}/items`, {
      data: { slideType: 'announcement', slideContent: `<p>${text}</p>` },
    })
    expect(item.ok()).toBeTruthy()
    itemIds.push((await item.json()).data.id)
  }
  return { id, itemIds }
}

async function setAdvance(
  request: APIRequestContext,
  id: number,
  itemId: number,
  advanceSeconds: unknown,
) {
  return request.put(`/api/schedules/${id}/items/${itemId}/advance`, {
    data: { advanceSeconds },
  })
}

test.describe('Slide timing', () => {
  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
  })

  test('a slide stays up by its text, or by its own time', async ({
    request,
  }) => {
    const { id, itemIds } = await createPresentation(
      request,
      { autoplaySeconds: 5 },
      [LONG_TEXT, 'Bun venit!'],
    )
    const schedule = (await (await request.get(`/api/schedules/${id}`)).json())
      .data
    // By text is the default.
    expect(schedule.automation).toMatchObject({
      autoplaySeconds: 5,
      autoplayByText: true,
    })
    expect(schedule.items[0].advanceSeconds).toBeNull()

    // A long text gets the time to read it.
    let run = await request.post(`/api/schedules/${id}/run`)
    expect((await run.json()).data).toMatchObject({ stepSeconds: 22 })

    // Its own time wins.
    const first = itemIds[0] as number
    expect((await setAdvance(request, id, first, 12)).ok()).toBeTruthy()
    run = await request.post(`/api/schedules/${id}/run`)
    expect((await run.json()).data).toMatchObject({ stepSeconds: 12 })

    // Out of range is clamped; null gives back the presentation's timing.
    await setAdvance(request, id, first, 0)
    let items = (await (await request.get(`/api/schedules/${id}`)).json()).data
      .items
    expect(items[0].advanceSeconds).toBe(1)
    await setAdvance(request, id, first, null)
    items = (await (await request.get(`/api/schedules/${id}`)).json()).data
      .items
    expect(items[0].advanceSeconds).toBeNull()

    // By text off: every slide gets the seconds per slide.
    await request.post('/api/schedules', {
      data: {
        id,
        title: schedule.title,
        automation: { autoplayByText: false },
      },
    })
    run = await request.post(`/api/schedules/${id}/run`)
    expect((await run.json()).data).toMatchObject({ stepSeconds: 5 })

    expect((await setAdvance(request, id, first, 'x')).status()).toBe(400)
    expect((await setAdvance(request, id, 999_999, 3)).status()).toBe(404)
    await request.delete(`/api/schedules/${id}`)
  })

  test('each item shows its time and can get its own', async ({
    page,
    request,
  }) => {
    const { id } = await createPresentation(request, { autoplaySeconds: 5 }, [
      LONG_TEXT,
      'Bun venit!',
    ])
    await page.goto(`/schedules/${id}`)

    const times = page.getByTestId('schedule-item-advance')
    await expect(times).toHaveCount(2, { timeout: 15_000 })
    await expect(times.nth(0)).toHaveText('22 s')
    await expect(times.nth(1)).toHaveText('5 s')
    const summary = page.getByTestId('schedule-automation-summary')
    await expect(summary).toContainText('27 s')

    // Its own time, like PowerPoint's "After".
    await times.nth(1).click()
    const popover = page.getByTestId('schedule-item-advance-popover')
    await popover.getByTestId('schedule-item-advance-input').fill('9')
    await popover.getByTestId('schedule-item-advance-save').click()
    await expect(popover).toHaveCount(0)
    await expect(times.nth(1)).toHaveText('9 s')
    await expect(times.nth(1)).toHaveAttribute('data-custom', 'true')
    await expect(summary).toContainText('31 s')

    await page.reload()
    await expect(times.nth(1)).toHaveText('9 s', { timeout: 15_000 })

    // Back to the presentation's timing.
    await times.nth(1).click()
    await popover.getByTestId('schedule-item-advance-reset').click()
    await expect(times.nth(1)).toHaveText('5 s')
    await expect(times.nth(1)).not.toHaveAttribute('data-custom', 'true')

    // By text off: the long slide gets the seconds per slide too.
    await page.getByTestId('automation-by-text').click()
    await expect(times.nth(0)).toHaveText('5 s')

    // Autoplay off: no times beside the items.
    await page.getByTestId('automation-autoplay').click()
    await expect(times).toHaveCount(0)
    await request.delete(`/api/schedules/${id}`)
  })
})
