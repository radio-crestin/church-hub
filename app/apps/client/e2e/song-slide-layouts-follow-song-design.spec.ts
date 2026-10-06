import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A song's first slide (with a gama) and last slide (with "Amin") have their
 * own layouts. A screen made before those layouts existed never saved them,
 * and the factory design used in their place made the last slide of a song
 * jump to another font, size and position while stepping through a program
 * (T-110). Such a screen's first/last slide layouts follow its own song design.
 */

const TEST_DB_PATH = fileURLToPath(
  new URL('./.test-data/app.db', import.meta.url),
)
const CUSTOM_FONT = 'Times New Roman'

/** A primary screen as an older version left it: no first/last slide layouts. */
async function createScreenWithoutSongSlideLayouts(
  request: APIRequestContext,
): Promise<number> {
  const created = await request.post('/api/screens', {
    data: { name: `E2E Old Screen ${Date.now()}`, type: 'primary' },
  })
  expect(created.ok()).toBeTruthy()
  const screenId: number = (await created.json()).data.id

  const db = new DatabaseSync(TEST_DB_PATH)
  try {
    db.prepare(
      `DELETE FROM screen_content_configs
       WHERE screen_id = ? AND content_type IN ('song_first_slide', 'song_last_slide')`,
    ).run(screenId)
  } finally {
    db.close()
  }

  const screen = (await (await request.get(`/api/screens/${screenId}`)).json())
    .data
  const song = screen.contentConfigs.song
  const saved = await request.put(`/api/screens/${screenId}/config/song`, {
    data: {
      config: {
        ...song,
        mainText: {
          ...song.mainText,
          style: { ...song.mainText.style, fontFamily: CUSTOM_FONT },
        },
      },
    },
  })
  expect(saved.ok()).toBeTruthy()
  return screenId
}

/** The lyrics as the screen draws them (not its hidden measuring copy). */
function drawnLyrics(screen: Page, lyrics: string) {
  return screen.locator('[data-style-anchor]', { hasText: lyrics })
}

/** The font the screen draws a slide's lyrics in, once that slide is up. */
async function lyricsFont(screen: Page, lyrics: string): Promise<string> {
  const text = drawnLyrics(screen, lyrics)
  await expect(text).toBeVisible({ timeout: 10000 })
  return text.evaluate((el) => getComputedStyle(el).fontFamily)
}

test('the last slide of a song keeps the screen song design', async ({
  page,
  request,
  context,
}) => {
  const uniq = Date.now()
  const title = `E2E Bible Takeover ${uniq}`
  const song = (
    await (
      await request.post('/api/songs', {
        data: {
          title,
          slides: [0, 1].map((i) => ({
            content: `${title} slide ${i + 1}`,
            sortOrder: i,
          })),
        },
      })
    ).json()
  ).data
  const schedule = (
    await (await request.post('/api/schedules', { data: { title } })).json()
  ).data
  const screenId = await createScreenWithoutSongSlideLayouts(request)

  try {
    await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { songId: song.id },
    })

    const screen = await context.newPage()
    await screen.setViewportSize({ width: 960, height: 540 })
    await screen.goto(`/screen/${screenId}`)

    await page.addInitScript((id: number) => {
      window.localStorage.setItem('bible:programs-open', 'true')
      window.localStorage.setItem('songPage.selectedScheduleId', String(id))
    }, schedule.id)
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')
    const panel = page.getByTestId('schedule-songs-panel')
    await panel.getByTestId('schedule-song-present').click()

    expect(await lyricsFont(screen, `${title} slide 1`)).toContain(CUSTOM_FONT)
    await expect(page.getByTestId('schedule-sub-item-0')).toHaveClass(
      /ring-green-500/,
      { timeout: 10000 },
    )

    await page.keyboard.press('ArrowRight')

    // The last slide is its own slide, drawn in the same design.
    expect(await lyricsFont(screen, `${title} slide 2`)).toContain(CUSTOM_FONT)
    await expect(drawnLyrics(screen, `${title} slide 1`)).toHaveCount(0)
    await expect(
      screen.getByText('Amin!').filter({ visible: true }),
    ).toHaveCount(1)
  } finally {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await request.delete(`/api/screens/${screenId}`).catch(() => {})
    await request.delete(`/api/schedules/${schedule.id}`).catch(() => {})
    await request.delete(`/api/songs/${song.id}`).catch(() => {})
  }
})
