import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { startFakeAudioServer } from './helpers/fake-audio'

/**
 * The Music page, laid out like the Songs page: the library's views on the
 * left, one track list searched across everything, the player on the right.
 * The suite's server plays through a stand-in audio server this spec starts
 * (helpers/fake-audio-server.ts), so a click really starts a track and counts it.
 *
 * The library is the bundled sample hymns. Play counts add up across runs,
 * so each test reads them before it acts.
 */

let stopFakeAudio: (() => void) | undefined
test.beforeAll(async () => {
  stopFakeAudio = await startFakeAudioServer()
})
test.afterAll(() => stopFakeAudio?.())

const AMAZING = 'Amazing Grace'
const NEARER = 'Nearer, My God, to Thee'
const BURG = 'Ein feste Burg ist unser Gott'

interface Track {
  id: number
  title: string | null
  playCount: number
}

async function tracksByTitle(
  request: APIRequestContext,
): Promise<Map<string, Track>> {
  const response = await request.get('/api/music/files')
  const { data } = (await response.json()) as { data: Track[] }
  return new Map(data.map((track) => [track.title ?? '', track]))
}

const row = (page: Page, title: string) =>
  page.getByTestId('music-track-row').filter({ hasText: title })

async function openMusic(page: Page) {
  await page.goto('/music')
  await expect(page.getByTestId('music-track-row')).toHaveCount(3, {
    timeout: 20_000,
  })
}

async function clearQueue(page: Page) {
  const clear = page.getByTitle('Clear Queue')
  if (await clear.isVisible()) await clear.click()
  await expect(page.getByTestId('music-queue-item')).toHaveCount(0)
}

async function queueTitles(page: Page): Promise<string[]> {
  return page.getByTestId('music-queue-item').allInnerTexts()
}

test.describe('Music page', () => {
  test.beforeEach(async ({ page }) => {
    await setAppLanguage(page, 'en')
  })

  test('lists all music beside the library views', async ({ page }) => {
    await openMusic(page)

    const nav = page.getByTestId('music-library-nav')
    await expect(nav.getByTestId('music-view-all')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByTestId('music-view-all')).toContainText('3')
    await expect(nav.getByTestId('music-view-recent')).toBeVisible()
    await expect(nav.getByText('Sample Hymns')).toBeVisible()
    await expect(page.getByTestId('music-view-title')).toHaveText('All music')

    // Sorted by title, with the play count and last played columns.
    await expect(page.getByTestId('music-track-title')).toHaveText([
      AMAZING,
      BURG,
      NEARER,
    ])
    await expect(
      row(page, AMAZING).getByTestId('music-track-plays'),
    ).toBeVisible()
  })

  test('a click plays the track and counts it', async ({ page, request }) => {
    const before = (await tracksByTitle(request)).get(AMAZING)!
    await openMusic(page)
    await clearQueue(page)

    await row(page, AMAZING).click()

    await expect(row(page, AMAZING)).toHaveAttribute('data-playing', 'true')
    await expect(page.getByTestId('workspace-panel-player')).toContainText(
      AMAZING,
    )
    await expect(
      row(page, AMAZING).getByTestId('music-track-plays'),
    ).toHaveText(String(before.playCount + 1))
    await expect(
      row(page, AMAZING).getByTestId('music-track-last-played'),
    ).toHaveText('today')

    // Recently played lists it, the last played first.
    await page.getByTestId('music-view-recent').click()
    await expect(page.getByTestId('music-track-title').first()).toHaveText(
      AMAZING,
    )
  })

  test('playlists group tracks from the ⋮ menu', async ({ page }) => {
    const name = `Known ${Date.now()}`
    await openMusic(page)

    await row(page, AMAZING).getByTestId('music-track-menu').click()
    await page.getByTestId('music-new-playlist-with-track').click()
    const dialog = page.getByTestId('music-name-modal')
    await dialog.getByRole('textbox').fill(name)
    await dialog.getByRole('button', { name: 'Create Playlist' }).click()

    // The new playlist opens with the track it was made from.
    await expect(page.getByTestId('music-view-title')).toHaveText(name)
    await expect(page.getByTestId('music-track-title')).toHaveText([AMAZING])

    // Another track joins it from the whole library.
    await page.getByTestId('music-view-all').click()
    await row(page, NEARER).getByTestId('music-track-menu').click()
    await page.getByRole('menuitem', { name: `Add to ${name}` }).click()
    const playlistNav = page
      .getByTestId('music-library-nav')
      .getByRole('button', { name })
    await expect(playlistNav).toContainText('2')
    await playlistNav.click()
    await expect(page.getByTestId('music-track-title')).toHaveText([
      AMAZING,
      NEARER,
    ])

    // Out of the playlist, still in the library.
    await row(page, AMAZING).getByTestId('music-track-menu').click()
    await page.getByTestId('music-remove-from-playlist').click()
    await expect(page.getByTestId('music-track-title')).toHaveText([NEARER])

    // The playlist goes, its tracks stay.
    await page.getByTestId('music-view-actions').click()
    await page.getByTestId('music-view-delete').click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByTestId('music-view-title')).toHaveText('All music')
    await expect(playlistNav).toHaveCount(0)
    await expect(page.getByTestId('music-track-row')).toHaveCount(3)
  })

  test('search looks through all music and is remembered', async ({ page }) => {
    await openMusic(page)
    await page.getByTestId('music-view-recent').click()

    const search = page.getByPlaceholder('Search all music…')
    await search.fill('burg')
    await search.press('Enter')

    // Whatever view was open, the search covers the whole library.
    await expect(page.getByTestId('music-view-title')).toHaveText(
      'Results for “burg”',
    )
    await expect(page.getByTestId('music-track-title')).toHaveText([BURG])

    await page.reload()
    const recent = page.getByTestId('music-recent-searches')
    await recent.getByRole('button', { name: 'burg' }).click()
    await expect(search).toHaveValue('burg')
    await expect(page.getByTestId('music-track-title')).toHaveText([BURG])
  })

  test('the queue order decides what plays next', async ({ page, request }) => {
    await openMusic(page)
    await clearQueue(page)

    // One track plays; two wait in the queue.
    await row(page, NEARER).click()
    await expect(page.getByTestId('music-queue-item')).toHaveCount(1)
    await row(page, AMAZING).getByTestId('music-track-queue').click()
    await row(page, BURG).getByTestId('music-track-queue').click()
    await expect(page.getByTestId('music-queue-item')).toHaveCount(3)

    // Amazing Grace was played by the tests above, the Burg hymn never.
    const plays = await tracksByTitle(request)
    expect(plays.get(AMAZING)!.playCount).toBeGreaterThan(
      plays.get(BURG)!.playCount,
    )
    const order = page.getByTestId('music-queue-order')

    await order.getByRole('radio', { name: 'Least played' }).click()
    await expect(
      order.getByRole('radio', { name: 'Least played' }),
    ).toHaveAttribute('aria-checked', 'true')
    // The playing track keeps its place; only what comes after it moves.
    await expect
      .poll(() => queueTitles(page))
      .toEqual([
        expect.stringContaining(NEARER),
        expect.stringContaining(BURG),
        expect.stringContaining(AMAZING),
      ])

    await order.getByRole('radio', { name: 'Most played' }).click()
    await expect
      .poll(() => queueTitles(page))
      .toEqual([
        expect.stringContaining(NEARER),
        expect.stringContaining(AMAZING),
        expect.stringContaining(BURG),
      ])

    // Back in the order they were added.
    await order.getByRole('radio', { name: 'In order' }).click()
    await expect
      .poll(() => queueTitles(page))
      .toEqual([
        expect.stringContaining(NEARER),
        expect.stringContaining(AMAZING),
        expect.stringContaining(BURG),
      ])

    await order.getByRole('radio', { name: 'Random' }).click()
    await expect(order.getByRole('radio', { name: 'Random' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByTestId('music-queue-item').first()).toContainText(
      NEARER,
    )
    await expect(page.getByTestId('music-queue-item')).toHaveCount(3)

    // Leave the next tests the default order.
    await order.getByRole('radio', { name: 'In order' }).click()
    await expect(
      order.getByRole('radio', { name: 'In order' }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('Music page on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the views scroll in a row and a tap plays a track', async ({
    page,
  }) => {
    await setAppLanguage(page, 'en')
    await openMusic(page)

    await expect(page.getByTestId('music-view-all')).toBeVisible()
    await expect(row(page, BURG)).toBeVisible()
    // Nothing is wider than the screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    await row(page, NEARER).click()
    await expect(row(page, NEARER)).toHaveAttribute('data-playing', 'true')
  })
})

test.describe('Music page layout (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 800 } })

  test('the page stays bounded and the queue scrolls inside the player', async ({
    page,
  }) => {
    await openMusic(page)
    const playerPanel = page.getByTestId('workspace-panel-player')
    await expect(playerPanel).toBeVisible()

    const metrics = await playerPanel.evaluate((panel) => {
      const rect = panel.getBoundingClientRect()
      const scroller = panel.querySelector<HTMLElement>('.lg\\:overflow-y-auto')
      return {
        bottom: Math.round(rect.bottom),
        viewportHeight: window.innerHeight,
        queueOverflowY: scroller ? getComputedStyle(scroller).overflowY : null,
      }
    })

    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1)
    expect(metrics.queueOverflowY).toBe('auto')
  })
})
