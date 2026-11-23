import { type APIRequestContext, expect, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * Presentations run by themselves (T-016): autoplay moves a presentation on
 * every N seconds on the server, loop starts it over, an operator presenting
 * anything else takes it over, Stop clears the screens, and one presentation
 * at most starts with Church Hub.
 */

interface RunnerState {
  running: boolean
  scheduleId?: number
  stepIndex?: number
  stepCount?: number
}

const ANNOUNCEMENTS = ['Bun venit!', 'Închideți telefoanele', 'Slujba începe']

async function createPresentation(
  request: APIRequestContext,
  automation: Record<string, unknown> = {},
): Promise<{ id: number; title: string }> {
  const title = `E2E Automation ${Date.now()}`
  const res = await request.post('/api/schedules', {
    data: { title, automation },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id
  for (const text of ANNOUNCEMENTS) {
    const item = await request.post(`/api/schedules/${id}/items`, {
      data: { slideType: 'announcement', slideContent: `<p>${text}</p>` },
    })
    expect(item.ok()).toBeTruthy()
  }
  return { id, title }
}

async function runnerState(request: APIRequestContext): Promise<RunnerState> {
  const res = await request.get('/api/schedules/automation')
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data
}

/** The presentation step on screen: its presentation and position, or null. */
async function liveStep(request: APIRequestContext) {
  const res = await request.get('/api/presentation/state')
  const data = (await res.json()).data?.temporaryContent?.data
  if (!data) return null
  return {
    scheduleId: data.scheduleId as number | undefined,
    index: data.scheduleItemIndex as number | undefined,
    content: data.content as string | undefined,
  }
}

test.describe('Presentation automation', () => {
  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
  })

  test('autoplay walks every step, then ends and clears the screens', async ({
    request,
  }) => {
    const { id } = await createPresentation(request, { autoplaySeconds: 1 })

    const run = await request.post(`/api/schedules/${id}/run`)
    expect(run.ok()).toBeTruthy()
    expect((await run.json()).data).toMatchObject({
      running: true,
      scheduleId: id,
      stepIndex: 0,
      stepCount: 3,
    })
    expect(await liveStep(request)).toMatchObject({ scheduleId: id, index: 0 })

    const seen = new Set<number>()
    await expect
      .poll(
        async () => {
          const step = await liveStep(request)
          if (step?.scheduleId === id && step.index !== undefined) {
            seen.add(step.index)
          }
          return seen.size
        },
        { timeout: 10_000, intervals: [200] },
      )
      .toBe(3)

    // Past the last step, without loop: stopped and off the screens.
    await expect
      .poll(async () => (await runnerState(request)).running, {
        timeout: 5_000,
      })
      .toBe(false)
    expect(await liveStep(request)).toBeNull()
  })

  test('loop goes back to the first step and keeps running', async ({
    request,
  }) => {
    const { id } = await createPresentation(request, {
      autoplaySeconds: 1,
      loop: true,
    })
    await request.post(`/api/schedules/${id}/run`)

    // Reach the last step, then see the first one again.
    await expect
      .poll(async () => (await liveStep(request))?.index, { timeout: 8_000 })
      .toBe(2)
    await expect
      .poll(async () => (await liveStep(request))?.index, { timeout: 5_000 })
      .toBe(0)
    expect(await runnerState(request)).toMatchObject({
      running: true,
      scheduleId: id,
    })

    const stop = await request.post('/api/schedules/automation/stop')
    expect((await stop.json()).data).toEqual({ running: false })
    expect(await liveStep(request)).toBeNull()
  })

  test('an operator presenting something else takes over', async ({
    request,
  }) => {
    const { id } = await createPresentation(request, { autoplaySeconds: 2 })
    await request.post(`/api/schedules/${id}/run`)

    const manual = await request.post(
      '/api/presentation/temporary-announcement',
      { data: { content: '<p>Anunț de la operator</p>' } },
    )
    expect(manual.ok()).toBeTruthy()

    await expect
      .poll(async () => (await runnerState(request)).running, {
        timeout: 5_000,
      })
      .toBe(false)
    // The operator's content stays up.
    expect((await liveStep(request))?.content).toContain('Anunț de la operator')
  })

  test('only one presentation starts with Church Hub', async ({ request }) => {
    const first = await createPresentation(request, { startOnAppStart: true })
    const second = await createPresentation(request)

    const res = await request.post('/api/schedules', {
      data: {
        id: second.id,
        title: second.title,
        automation: { startOnAppStart: true },
      },
    })
    expect((await res.json()).data.automation.startOnAppStart).toBe(true)

    const firstNow = await request.get(`/api/schedules/${first.id}`)
    expect((await firstNow.json()).data.automation).toMatchObject({
      startOnAppStart: false,
    })

    // Settings not given keep their value; out-of-range ones are clamped.
    const clamped = await request.post('/api/schedules', {
      data: {
        id: second.id,
        title: second.title,
        automation: { musicVolume: 140, autoplaySeconds: 0 },
      },
    })
    expect((await clamped.json()).data.automation).toEqual({
      autoplaySeconds: 1,
      loop: false,
      musicVolume: 100,
      startOnAppStart: true,
    })

    await request.post('/api/schedules', {
      data: {
        id: second.id,
        title: second.title,
        automation: { startOnAppStart: false },
      },
    })
  })

  test('the presentation page sets it up, runs it and stops it', async ({
    page,
    request,
  }) => {
    const { id } = await createPresentation(request)
    await page.goto(`/schedules/${id}`)

    // Nothing is on yet: the section stays out of the way until it is asked for.
    const section = page.getByTestId('schedule-automation-section')
    await expect(page.getByTestId('schedule-run-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(section).toHaveCount(0)
    await selectAction(
      page,
      'schedule-presenter-actions-menu',
      'schedule-automation-action',
    )
    await expect(section).toBeVisible()

    await section.getByTestId('automation-autoplay').click()
    await section.getByTestId('automation-seconds').fill('1')
    await section.getByTestId('automation-loop').click()
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/schedules/${id}`)).json()).data
            .automation,
        { timeout: 5_000 },
      )
      .toMatchObject({ autoplaySeconds: 1, loop: true })
    await expect(section.getByTestId('schedule-automation-summary')).toHaveText(
      /1 s/,
    )

    // It is a panel to the right of the preview, and while something is on
    // it is there by itself after a reload.
    await page.reload()
    await expect(section).toBeVisible({ timeout: 15_000 })
    const preview = await page
      .getByTestId('schedule-preview-next')
      .boundingBox()
    const panel = await section.boundingBox()
    expect(preview && panel && panel.x > preview.x + preview.width).toBe(true)

    const runButton = page.getByTestId('schedule-run-button')
    await runButton.click()
    await expect(runButton).toHaveAttribute('data-running', 'true')
    // The progress follows the server as it moves on.
    await expect(page.getByTestId('schedule-run-progress')).toHaveText('2/3', {
      timeout: 5_000,
    })

    await expect(section.getByTestId('schedule-automation-running')).toHaveText(
      /\d\/3/,
    )

    await runButton.click()
    await expect(runButton).toHaveAttribute('data-running', 'false')
    await expect.poll(() => liveStep(request)).toBeNull()
  })

  test('the panel closes again once nothing in it is on', async ({
    page,
    request,
  }) => {
    const { id } = await createPresentation(request, { loop: true })
    await page.goto(`/schedules/${id}`)

    const section = page.getByTestId('schedule-automation-section')
    await expect(section).toBeVisible({ timeout: 15_000 })
    await expect(section.getByTestId('schedule-automation-close')).toHaveCount(
      0,
    )

    await section.getByTestId('automation-loop').click()
    await section.getByTestId('schedule-automation-close').click()
    await expect(section).toHaveCount(0)
  })

  test('Next on the last step starts over when the presentation loops', async ({
    page,
    request,
  }) => {
    const { id } = await createPresentation(request, { loop: true })
    await page.goto(`/schedules/${id}`)

    // Autoplay off: Run only puts the first step up.
    await page.getByTestId('schedule-run-button').click()
    await expect.poll(async () => (await liveStep(request))?.index).toBe(0)
    expect((await runnerState(request)).running).toBe(false)

    const next = page.getByTestId('schedule-preview-next')
    for (const expected of [1, 2, 0]) {
      await next.click()
      await expect
        .poll(async () => (await liveStep(request))?.index)
        .toBe(expected)
    }
  })
})
