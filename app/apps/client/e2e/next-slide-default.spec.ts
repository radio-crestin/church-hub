import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The "Urmeaza:" strip is off unless someone turned it on.
 *
 * A screen carries the section only once it has been configured. When nothing
 * is stored the server used to switch it on for stage screens, so upgrading to
 * a release that added the section changed the shape of a projection someone
 * had already set up — the strip appeared over their screen between one
 * version and the next, with nobody having asked for it.
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

async function readScreen(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/screens/${id}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as {
    nextSlideConfig?: { enabled?: boolean; labelText?: string }
  }
}

test.describe('The next-slide section defaults to off', () => {
  const created: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of created) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  for (const type of ['stage', 'primary', 'livestream', 'kiosk']) {
    test(`a fresh ${type} screen has it switched off`, async ({ request }) => {
      const screen = await createScreen(
        request,
        `E2E Next Slide ${type} ${Date.now()}`,
        type,
      )
      created.push(screen.id)

      const read = await readScreen(request, screen.id)
      expect(read.nextSlideConfig?.enabled).toBe(false)
      // The section is still described, so the editor has something to show
      // the moment someone switches it on.
      expect(read.nextSlideConfig?.labelText).toBeTruthy()
    })
  }

  test('turning it on is remembered', async ({ request }) => {
    const screen = await createScreen(
      request,
      `E2E Next Slide Toggle ${Date.now()}`,
      'stage',
    )
    created.push(screen.id)

    const before = await readScreen(request, screen.id)
    const updated = await request.put(
      `/api/screens/${screen.id}/next-slide-config`,
      { data: { config: { ...before.nextSlideConfig, enabled: true } } },
    )
    expect(updated.ok()).toBeTruthy()

    expect(
      (await readScreen(request, screen.id)).nextSlideConfig?.enabled,
    ).toBe(true)
  })
})
