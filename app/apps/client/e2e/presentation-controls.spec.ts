import { expect, test } from '@playwright/test'

/**
 * The control room (/present): its LIVE lamp says whether something is on the
 * projection, and its Hide button takes the live slide off.
 */

test.describe('Presentation Controls', () => {
  let songId: number

  test.beforeAll(async ({ request }) => {
    const created = await request.post('/api/songs', {
      data: {
        title: `E2E Control Room ${Date.now()}`,
        slides: [
          { content: 'First slide', sortOrder: 0 },
          { content: 'Second slide', sortOrder: 1 },
        ],
      },
    })
    expect(created.status()).toBe(201)
    songId = (await created.json()).data.id
  })

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/stop')
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop')
    await request.delete(`/api/songs/${songId}`)
  })

  test('the LIVE lamp is off with nothing on the projection', async ({
    page,
  }) => {
    await page.goto('/present')
    // Stopping leaves the projection unhidden with nothing on it. The lamp
    // reports what is on the screen, not whether the screen is hidden.
    await expect(page.getByTestId('control-room-live')).toHaveAttribute(
      'data-live',
      'false',
    )
  })

  test('Hide takes the live song off the projection', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto('/present')
    const lamp = page.getByTestId('control-room-live')
    await expect(lamp).toHaveAttribute('data-live', 'true')

    await page.getByRole('button', { name: /^(hide|ascunde)/i }).click()
    await expect(lamp).toHaveAttribute('data-live', 'false')
  })
})
