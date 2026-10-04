import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Slide HTML is turned into plain text in many places (the projection, the
 * slide list, exports). Tags are now removed until none is left and entities
 * are decoded in one pass, so text a user typed as `&lt;b&gt;` stays that
 * text instead of turning into `<b>`. The server's error and health replies
 * never carry a stack trace.
 */

const PLAIN_LINE = 'Tom & Jerry <3'
const ESCAPED_LINE = 'Type &lt;b&gt; for bold'
const SLIDE_HTML =
  '<p>Tom &amp; Jerry &lt;3</p><p>Type &amp;lt;b&amp;gt; for bold</p>'

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: SLIDE_HTML, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

test.describe('Slide text sanitization', () => {
  test('the projection shows entity-escaped text literally', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Sanitize Screen ${Date.now()}`)
    const screensResponse = await request.get('/api/screens')
    const { data: screens } = await screensResponse.json()
    const screen = screens[0] as { id: number } | undefined
    test.skip(!screen, 'no screens configured')

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id },
      })
      await page.goto(`/screen/${screen?.id}`)
      await page.waitForLoadState('networkidle')

      const body = page.locator('body')
      await expect(body).toContainText(PLAIN_LINE, { timeout: 10000 })
      await expect(body).toContainText(ESCAPED_LINE)
      await expect(body).not.toContainText('Type <b> for bold')
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the song page slide list shows the same text', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Sanitize List ${Date.now()}`)
    try {
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(PLAIN_LINE).first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByText(ESCAPED_LINE).first()).toBeVisible()
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})

test.describe('API replies carry no stack trace', () => {
  test('health reports the boot state without a stack', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(JSON.parse(text).ready).toBe(true)
    expect(text).not.toContain('stack')
  })
})
