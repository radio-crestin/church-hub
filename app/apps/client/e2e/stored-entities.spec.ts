import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Songs already in a church's library store some characters as HTML codes:
 * `&#039;` for an apostrophe, `&quot;` for quotes, `&lt;` / `&gt;` for < and
 * > (real rows from a production database, 2026-10-04). Since the entity
 * decoder runs once instead of twice (#89) they must still show as the
 * characters, on the projection, its "next" strip, the slide list and search.
 */

const FIRST_SLIDE =
  '<p>A fost chemat în Cana Galileea</p><p>Acolo apa&#039;n vin se prefăcuse</p>'
const SECOND_SLIDE =
  '<p>&lt;number&gt; Isus, Isus al nostru soare</p><p>În locu&#039;n care ești &quot;chemat&quot;.</p>'

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: {
      title,
      slides: [
        { content: FIRST_SLIDE, sortOrder: 0 },
        { content: SECOND_SLIDE, sortOrder: 1 },
      ],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function createStageScreenWithNextSlide(request: APIRequestContext) {
  const created = await request.post('/api/screens', {
    data: { name: `E2E Entities stage ${Date.now()}`, type: 'stage' },
  })
  expect(created.ok()).toBeTruthy()
  const screen = (await created.json()).data as { id: number }
  const read = (await (await request.get(`/api/screens/${screen.id}`)).json())
    .data
  await request.put(`/api/screens/${screen.id}/next-slide-config`, {
    data: { config: { ...read.nextSlideConfig, enabled: true } },
  })
  return screen
}

test.describe('Stored HTML codes show as characters', () => {
  test('on the projection and its next-slide strip', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Entities ${Date.now()}`)
    const screen = await createStageScreenWithNextSlide(request)
    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id },
      })
      await page.goto(`/screen/${screen.id}`)
      await page.waitForLoadState('networkidle')

      const body = page.locator('body')
      await expect(body).toContainText("Acolo apa'n vin se prefăcuse", {
        timeout: 10000,
      })
      await expect(body).toContainText('<number> Isus, Isus al nostru soare')
      await expect(body).toContainText('În locu\'n care ești "chemat".')
      await expect(body).not.toContainText('&#039;')
      await expect(body).not.toContainText('&quot;')
      await expect(body).not.toContainText('&lt;')
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
      await request.delete(`/api/screens/${screen.id}`).catch(() => {})
    }
  })

  test('in the song page slide list', async ({ page, request }) => {
    const song = await createSong(request, `E2E Entities List ${Date.now()}`)
    try {
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')
      await expect(
        page.getByText("Acolo apa'n vin se prefăcuse").first(),
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByText('<number> Isus, Isus al nostru soare').first(),
      ).toBeVisible()
      await expect(page.getByText('&#039;')).toHaveCount(0)
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('in search, typed with a plain apostrophe', async ({ request }) => {
    const marker = `qzent${Date.now()}`
    const song = await createSong(request, `E2E Entities ${marker}`)
    try {
      await expect
        .poll(
          async () => {
            const response = await request.get(
              `/api/songs/search?q=${encodeURIComponent("apa'n vin se prefăcuse")}`,
            )
            const { data } = await response.json()
            return (data as Array<{ id: number }>).some((s) => s.id === song.id)
          },
          { timeout: 10000 },
        )
        .toBe(true)
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})
