import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A church runs several projectors at once: every screen shows what is live,
 * each with its own design.
 */

async function createScreen(request: APIRequestContext, name: string) {
  const res = await request.post('/api/screens', {
    data: { name, type: 'primary' },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id as number
}

test.describe('Multi-Screen', () => {
  const screenIds: number[] = []
  let songId: number

  test.beforeAll(async ({ request }) => {
    screenIds.push(await createScreen(request, 'E2E Screen Alpha'))
    screenIds.push(await createScreen(request, 'E2E Screen Beta'))
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Multi Screen ${Date.now()}`,
        slides: [{ content: 'Both projectors show this', sortOrder: 0 }],
      },
    })
    songId = (await song.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop')
    for (const id of screenIds) await request.delete(`/api/screens/${id}`)
    await request.delete(`/api/songs/${songId}`)
  })

  test('every projector shows the live song', async ({
    page,
    context,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    const second = await context.newPage()
    await page.goto(`/screen/${screenIds[0]}`)
    await second.goto(`/screen/${screenIds[1]}`)

    for (const projector of [page, second]) {
      await expect(
        projector
          .getByText('Both projectors show this')
          .filter({ visible: true })
          .first(),
      ).toBeVisible()
    }
  })

  test("a screen's empty-slide background is its own", async ({
    page,
    request,
  }) => {
    const [sid] = screenIds
    const { data } = await (await request.get(`/api/screens/${sid}`)).json()
    const updated = await request.put(`/api/screens/${sid}/config/empty`, {
      data: {
        config: {
          ...data.contentConfigs.empty,
          background: { type: 'color', color: '#1a1a2e' },
        },
      },
    })
    expect(updated.ok()).toBeTruthy()
    await request.post('/api/presentation/stop')

    await page.goto(`/screen/${sid}`)
    await expect(page.getByTestId('screen-background')).toHaveCSS(
      'background-color',
      'rgb(26, 26, 46)',
    )
  })
})
