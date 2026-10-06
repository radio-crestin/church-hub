import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * OBS scene automation across a program: song → scene item ("Solo") → song.
 * The scene item switches OBS to its own scene; the song after it must switch
 * OBS back to the scene configured for program songs, not stay on "Solo".
 *
 * OBS itself is not running in e2e: custom scenes live only in the app, and
 * the app's current scene (what it asked OBS to show) is read back from
 * GET /api/livestream/obs/scenes.
 */

type Request = APIRequestContext

async function createScene(request: Request, sceneName: string) {
  const res = await request.post('/api/livestream/obs/scenes', {
    data: { sceneName },
  })
  expect(res.status()).toBe(201)
  return (await res.json()).data as { id: number; obsSceneName: string }
}

/** Scenes a failed earlier run left behind would claim the song content type first. */
async function deleteLeftoverE2EScenes(request: Request) {
  const res = await request.get('/api/livestream/obs/scenes')
  const { data } = await res.json()
  for (const scene of data as { id: number; obsSceneName: string }[]) {
    if (scene.obsSceneName.startsWith('E2E ')) {
      await request.delete(`/api/livestream/obs/scenes/${scene.id}`)
    }
  }
}

/** The default "Cântare" scene also claims songs: the first scene wins, so this one goes first. */
async function putSceneFirst(request: Request, sceneId: number) {
  const res = await request.get('/api/livestream/obs/scenes')
  const { data } = await res.json()
  const others = (data as { id: number }[])
    .map((scene) => scene.id)
    .filter((id) => id !== sceneId)
  const reorder = await request.put('/api/livestream/obs/scenes/reorder', {
    data: { sceneIds: [sceneId, ...others] },
  })
  expect(reorder.ok()).toBeTruthy()
}

async function readCurrentScene(request: Request): Promise<string | null> {
  const res = await request.get('/api/livestream/obs/scenes')
  const { data } = await res.json()
  const current = (data as { obsSceneName: string; isCurrent: boolean }[]).find(
    (scene) => scene.isCurrent,
  )
  return current?.obsSceneName ?? null
}

async function readLiveIndex(request: Request): Promise<number | undefined> {
  const res = await request.get('/api/presentation/state')
  const { data } = await res.json()
  return data?.temporaryContent?.data?.scheduleItemIndex
}

async function createSong(request: Request, title: string) {
  const res = await request.post('/api/songs', {
    data: {
      title,
      slides: [1, 2].map((n, i) => ({
        content: `${title} slide ${n}`,
        sortOrder: i,
      })),
    },
  })
  return (await res.json()).data as { id: number }
}

async function resetSceneAutomation(request: Request) {
  // Disabling clears the remembered scenes and the last content type.
  await request.put('/api/livestream/obs/scene-automation', {
    data: { enabled: false },
  })
  await request.put('/api/livestream/obs/scene-automation', {
    data: { enabled: true },
  })
}

test.describe('OBS scene automation in a program', () => {
  test('a song after a scene item switches OBS back to the song scene', async ({
    page,
    request,
  }) => {
    test.setTimeout(60000)
    const uniq = Date.now()
    const cameraName = `E2E Camera ${uniq}`
    const songSceneName = `E2E Cantare ${uniq}`
    const soloName = `E2E Solo ${uniq}`

    await deleteLeftoverE2EScenes(request)
    const camera = await createScene(request, cameraName)
    const songScene = await createScene(request, songSceneName)
    const solo = await createScene(request, soloName)
    await request.put(`/api/livestream/obs/scenes/${songScene.id}`, {
      data: { contentTypes: ['song_schedule'] },
    })
    await putSceneFirst(request, songScene.id)

    const songA = await createSong(request, `E2E OBS Song A ${uniq}`)
    const songB = await createSong(request, `E2E OBS Song B ${uniq}`)
    const scheduleRes = await request.post('/api/schedules', {
      data: { title: `E2E OBS Program ${uniq}` },
    })
    const schedule = (await scheduleRes.json()).data as { id: number }

    try {
      // Flat run: 0–1 song A, 2 the "Solo" scene, 3–4 song B.
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: songA.id },
      })
      const sceneItem = await request.post(
        `/api/schedules/${schedule.id}/items`,
        { data: { slideType: 'scene', obsSceneName: soloName } },
      )
      expect(sceneItem.status()).toBe(201)
      await request.post(`/api/schedules/${schedule.id}/items`, {
        data: { songId: songB.id },
      })

      await request.post('/api/presentation/stop')
      await resetSceneAutomation(request)
      await request.post(
        `/api/livestream/obs/scene/${encodeURIComponent(cameraName)}`,
      )
      expect(await readCurrentScene(request)).toBe(cameraName)

      await page.goto(`/schedules/${schedule.id}`)
      await page.waitForLoadState('networkidle')

      await page
        .getByRole('button', { name: /^(Expand all|Extinde tot)$/ })
        .click()
      await page.getByTestId('schedule-sub-item-0').click()
      await expect
        .poll(() => readCurrentScene(request), { timeout: 10000 })
        .toBe(songSceneName)

      // Next walks the program the way the operator does: slide 2, the scene, song B.
      const next = page.getByRole('button', { name: /^(Next|Următor)$/ })
      await next.click()
      await expect
        .poll(() => readLiveIndex(request), { timeout: 10000 })
        .toBe(1)
      await next.click()
      await expect
        .poll(() => readCurrentScene(request), { timeout: 10000 })
        .toBe(soloName)

      await next.click()
      await expect
        .poll(() => readCurrentScene(request), { timeout: 10000 })
        .toBe(songSceneName)

      // Stopping the program hands OBS back to the scene it was on before.
      await request.post('/api/presentation/stop')
      await expect
        .poll(() => readCurrentScene(request), { timeout: 10000 })
        .toBe(cameraName)
    } finally {
      await request.post('/api/presentation/stop')
      await request.delete(`/api/schedules/${schedule.id}`)
      await request.delete(`/api/songs/${songA.id}`)
      await request.delete(`/api/songs/${songB.id}`)
      for (const scene of [camera, songScene, solo]) {
        await request.delete(`/api/livestream/obs/scenes/${scene.id}`)
      }
      await resetSceneAutomation(request)
    }
  })
})
