import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Projection windows stay above other windows by default, so a web page
 * opened on the projector's display can't cover the slides (T-026).
 */

interface ScreenRow {
  id: number
  name: string
  alwaysOnTop: boolean
}

async function createScreen(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<ScreenRow> {
  const response = await request.post('/api/screens', { data })
  expect([200, 201]).toContain(response.status())
  const { id } = (await response.json()).data as { id: number }
  const screen = await request.get(`/api/screens/${id}`)
  return (await screen.json()).data as ScreenRow
}

test.describe('Screens are always on top by default', () => {
  test('a new screen starts always on top, and shows it in settings', async ({
    page,
    request,
  }) => {
    const screen = await createScreen(request, {
      name: `E2E On Top ${Date.now()}`,
      type: 'primary',
    })
    try {
      expect(screen.alwaysOnTop).toBe(true)

      await page.goto('/settings/screens')
      const card = page.locator(`[data-screen-id="${screen.id}"]`)
      await expect(
        card.getByRole('button', { name: /Always on top|Mereu deasupra/ }),
      ).toBeVisible({ timeout: 10000 })
    } finally {
      await request.delete(`/api/screens/${screen.id}`)
    }
  })

  test('a screen created with it off stays off', async ({ request }) => {
    const screen = await createScreen(request, {
      name: `E2E Not On Top ${Date.now()}`,
      type: 'stage',
      alwaysOnTop: false,
    })
    try {
      expect(screen.alwaysOnTop).toBe(false)
    } finally {
      await request.delete(`/api/screens/${screen.id}`)
    }
  })

  test('the default screens are always on top', async ({ request }) => {
    const { data } = await (await request.get('/api/screens')).json()
    const defaults = (data as ScreenRow[]).filter((s) =>
      ['Main', 'Stage'].includes(s.name),
    )
    expect(defaults.length).toBeGreaterThan(0)
    for (const screen of defaults) {
      expect(screen.alwaysOnTop, screen.name).toBe(true)
    }
  })
})
