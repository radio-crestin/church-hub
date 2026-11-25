import { type APIRequestContext, expect, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'
import { FakeOBS } from './helpers/fake-obs'

/**
 * Presentations started and stopped by what happens in OBS (T-182): a scene
 * being selected (in OBS or Church Hub), the livestream or the recording
 * starting or stopping. The triggers are set on the presentation's
 * Automation panel; the server's runner acts on them with no page open.
 *
 * Scene switches need no OBS (Church Hub's own switch fires the same event);
 * the livestream and recording come from a fake OBS speaking obs-websocket v5.
 */

type Request = APIRequestContext

interface Trigger {
  event: string
  sceneName?: string | null
}

async function createPresentation(
  request: Request,
  automation: { startTrigger?: Trigger | null; stopTrigger?: Trigger | null },
): Promise<number> {
  const res = await request.post('/api/schedules', {
    data: { title: `E2E Triggers ${Date.now()}`, automation },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id
  for (const text of ['Bun venit!', 'Slujba începe']) {
    const item = await request.post(`/api/schedules/${id}/items`, {
      data: { slideType: 'announcement', slideContent: `<p>${text}</p>` },
    })
    expect(item.ok()).toBeTruthy()
  }
  return id
}

/** The presentation on the projector now, or null. */
async function livePresentation(request: Request): Promise<number | null> {
  const res = await request.get('/api/presentation/state')
  const data = (await res.json()).data?.temporaryContent?.data
  return data?.scheduleId ?? null
}

async function createScene(request: Request, sceneName: string) {
  const res = await request.post('/api/livestream/obs/scenes', {
    data: { sceneName },
  })
  expect(res.status()).toBe(201)
  return (await res.json()).data as { id: number }
}

async function selectScene(request: Request, sceneName: string) {
  const res = await request.post(
    `/api/livestream/obs/scene/${encodeURIComponent(sceneName)}`,
  )
  expect(res.ok()).toBeTruthy()
}

test.describe('Presentation triggers', () => {
  const presentations: number[] = []
  const scenes: number[] = []

  test.afterEach(async ({ request }) => {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
    for (const id of presentations.splice(0)) {
      await request.delete(`/api/schedules/${id}`)
    }
    for (const id of scenes.splice(0)) {
      await request.delete(`/api/livestream/obs/scenes/${id}`)
    }
  })

  test('a scene starts the presentation and another scene stops it', async ({
    request,
  }) => {
    const stamp = Date.now()
    const welcome = `E2E Welcome ${stamp}`
    const sermon = `E2E Sermon ${stamp}`
    scenes.push(
      (await createScene(request, welcome)).id,
      (await createScene(request, sermon)).id,
    )
    const id = await createPresentation(request, {
      startTrigger: { event: 'scene_selected', sceneName: welcome },
      stopTrigger: { event: 'scene_selected', sceneName: sermon },
    })
    presentations.push(id)

    await selectScene(request, sermon)
    expect(await livePresentation(request)).toBeNull()

    await selectScene(request, welcome)
    await expect.poll(() => livePresentation(request)).toBe(id)

    await selectScene(request, sermon)
    await expect.poll(() => livePresentation(request)).toBeNull()
  })

  test('a scene trigger without a scene is refused', async ({ request }) => {
    const res = await request.post('/api/schedules', {
      data: {
        title: `E2E Triggers ${Date.now()}`,
        automation: { startTrigger: { event: 'scene_selected' } },
      },
    })
    expect(res.ok()).toBeFalsy()
  })

  test.describe('with OBS', () => {
    const obs = new FakeOBS()
    let savedConfig: { host: string; port: number } | undefined

    test.beforeEach(async ({ request }) => {
      const port = await obs.start()
      savedConfig = (
        await (await request.get('/api/livestream/obs/config')).json()
      ).data
      const config = await request.put('/api/livestream/obs/config', {
        data: { host: '127.0.0.1', port, password: '' },
      })
      expect(config.ok()).toBeTruthy()
    })

    test.afterEach(async ({ request }) => {
      await request.post('/api/livestream/obs/disconnect')
      await obs.stop()
      obs.streaming = false
      obs.recording = false
      if (savedConfig) {
        await request.put('/api/livestream/obs/config', {
          data: { host: savedConfig.host, port: savedConfig.port },
        })
      }
    })

    async function connect(request: Request) {
      const res = await request.post('/api/livestream/obs/connect')
      expect(res.ok()).toBeTruthy()
      // Connected once OBS's outputs have been read.
      await expect
        .poll(async () => {
          const status = await request.get('/api/livestream/obs/status')
          return (await status.json()).data.connected
        })
        .toBe(true)
    }

    test('the livestream starting starts it, and ending stops it', async ({
      request,
    }) => {
      const id = await createPresentation(request, {
        startTrigger: { event: 'stream_started' },
        stopTrigger: { event: 'stream_stopped' },
      })
      presentations.push(id)
      await connect(request)

      obs.setStreaming(true)
      await expect.poll(() => livePresentation(request)).toBe(id)

      obs.setStreaming(false)
      await expect.poll(() => livePresentation(request)).toBeNull()
    })

    test('a stream already live when Church Hub connects starts nothing', async ({
      request,
    }) => {
      const id = await createPresentation(request, {
        startTrigger: { event: 'stream_started' },
      })
      presentations.push(id)
      obs.streaming = true
      await connect(request)

      // The recording starting is a change, so it is seen; the stream is not.
      obs.setRecording(true)
      await expect
        .poll(async () => {
          const status = await request.get('/api/livestream/obs/status')
          return (await status.json()).data.isRecording
        })
        .toBe(true)
      expect(await livePresentation(request)).toBeNull()
    })

    test('the recording starting starts it', async ({ request }) => {
      const id = await createPresentation(request, {
        startTrigger: { event: 'recording_started' },
      })
      presentations.push(id)
      await connect(request)

      obs.setRecording(true)
      await expect.poll(() => livePresentation(request)).toBe(id)
    })
  })

  test('the Automation panel sets the triggers', async ({ page, request }) => {
    const sceneName = `E2E Welcome ${Date.now()}`
    scenes.push((await createScene(request, sceneName)).id)
    const id = await createPresentation(request, {})
    presentations.push(id)

    await page.goto(`/schedules/${id}`)
    await expect(page.getByTestId('schedule-run-button')).toBeVisible({
      timeout: 15_000,
    })
    await selectAction(
      page,
      'schedule-presenter-actions-menu',
      'schedule-automation-action',
    )
    const section = page.getByTestId('schedule-automation-section')
    await expect(section).toBeVisible()

    const automation = async () =>
      (await (await request.get(`/api/schedules/${id}`)).json()).data.automation

    await section
      .getByTestId('automation-start-trigger')
      .selectOption('scene_selected')
    await section
      .getByTestId('automation-start-trigger-scene')
      .selectOption(sceneName)
    await section
      .getByTestId('automation-stop-trigger')
      .selectOption('stream_stopped')
    await expect.poll(automation, { timeout: 5_000 }).toMatchObject({
      startTrigger: { event: 'scene_selected', sceneName },
      stopTrigger: { event: 'stream_stopped', sceneName: null },
    })
    await expect(section.getByTestId('schedule-automation-summary')).toHaveText(
      new RegExp(sceneName),
    )

    // Set up, it works: selecting the scene puts it on.
    await selectScene(request, sceneName)
    await expect.poll(() => livePresentation(request)).toBe(id)

    await section.getByTestId('automation-start-trigger').selectOption('never')
    await expect
      .poll(automation, { timeout: 5_000 })
      .toMatchObject({ startTrigger: null })
    await expect(
      section.getByTestId('automation-start-trigger-scene'),
    ).toHaveCount(0)
  })
})
