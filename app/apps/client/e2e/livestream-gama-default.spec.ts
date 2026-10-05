import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A livestream screen hides the song key (gama) by default.
 *
 * The stream audience reads the lyrics; the key is for the musicians in the
 * room. Other screen types keep showing it.
 */

async function createScreen(
  request: APIRequestContext,
  name: string,
  type: string,
) {
  const response = await request.post('/api/screens', { data: { name, type } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

async function readSongConfig(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/screens/${id}`)
  expect(response.ok()).toBeTruthy()
  const screen = (await response.json()).data as {
    contentConfigs: { song: { displayKeyLine?: boolean } }
  }
  return screen.contentConfigs.song
}

test.describe('Song key line default per screen type', () => {
  const created: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of created) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  test('a fresh livestream screen hides the gama', async ({ request }) => {
    const screen = await createScreen(
      request,
      `E2E Gama livestream ${Date.now()}`,
      'livestream',
    )
    created.push(screen.id)
    expect((await readSongConfig(request, screen.id)).displayKeyLine).toBe(
      false,
    )
  })

  for (const type of ['primary', 'stage']) {
    test(`a fresh ${type} screen still shows the gama`, async ({ request }) => {
      const screen = await createScreen(
        request,
        `E2E Gama ${type} ${Date.now()}`,
        type,
      )
      created.push(screen.id)
      expect(
        (await readSongConfig(request, screen.id)).displayKeyLine ?? true,
      ).toBe(true)
    })
  }
})
