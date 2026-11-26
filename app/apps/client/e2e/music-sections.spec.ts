import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { startFakeAudioServer } from './helpers/fake-audio'

/**
 * The Music page in sections (T-904): each column is one panel, split into
 * titled sections by hairlines. The library holds All music and Recently
 * played, then its Playlists and Folders groups; the track list carries the
 * view's title and count; the player holds Now playing and the Queue, with
 * its count and order. On a phone the same sections sit in the pinned player
 * and the Tracks, Library and Queue tabs, and nothing needs a hover.
 */

let stopFakeAudio: (() => void) | undefined
test.beforeAll(async () => {
  stopFakeAudio = await startFakeAudioServer()
})
test.afterAll(() => stopFakeAudio?.())

const section = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true })

async function openWithTwoQueued(page: Page) {
  await setAppLanguage(page, 'en')
  await page.goto('/music')
  const rows = page.getByTestId('music-track-row')
  await expect(rows).toHaveCount(3, { timeout: 20_000 })
  // On a phone the queue, and its clear button, sit in their own tab.
  const queueTab = page.getByTestId('workspace-tab-queue')
  if (await queueTab.isVisible()) await queueTab.click()
  const clear = page.getByTestId('music-clear-queue')
  if (await clear.isVisible()) await clear.click()
  await expect(clear).toBeHidden()
  if (await queueTab.isVisible()) {
    await page.getByTestId('workspace-tab-tracks').click()
  }
  await rows.nth(0).click()
  await expect(rows.nth(0)).toHaveAttribute('data-playing', 'true')
  await rows.nth(1).getByTestId('music-track-queue').click()
}

test.describe('Music page sections (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('each column is a panel of titled sections', async ({ page }) => {
    await openWithTwoQueued(page)

    const library = page.getByTestId('music-library-nav')
    for (const name of ['Library', 'Playlists', 'Folders']) {
      await expect(library.getByRole('region', { name })).toBeVisible()
    }
    await expect(
      library
        .getByRole('region', { name: 'Library' })
        .getByTestId('music-view-all'),
    ).toBeVisible()
    await expect(
      library
        .getByRole('region', { name: 'Folders' })
        .getByText('Sample Hymns'),
    ).toBeVisible()

    // The open view, its count beside it.
    const tracks = section(page, 'All music')
    await expect(tracks.getByTestId('music-view-title')).toHaveText('All music')
    await expect(tracks).toContainText('3 tracks')
    await expect(tracks.getByTestId('music-track-row')).toHaveCount(3)

    // The player: what plays, then the queue with its count and order.
    const nowPlaying = section(page, 'Now playing')
    await expect(nowPlaying.getByTestId('music-progress')).toBeVisible()
    await expect(
      nowPlaying.getByRole('slider', { name: 'Volume' }),
    ).toBeVisible()
    const queue = section(page, 'Queue')
    await expect(queue).toContainText('2 tracks in queue')
    await expect(
      queue.getByRole('radio', { name: 'In order' }),
    ).toHaveAttribute('aria-checked', 'true')
    await expect(queue.getByTestId('music-queue-item')).toHaveCount(2)

    // Sections are panels of the design: a 1px border, no shadow.
    const panel = await page
      .getByTestId('workspace-panel-player')
      .locator('.bg-panel')
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el)
        return { border: style.borderTopWidth, shadow: style.boxShadow }
      })
    expect(panel).toEqual({ border: '1px', shadow: 'none' })
  })
})

test.describe('Music page sections on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the pinned player and each tab show their sections', async ({
    page,
  }) => {
    await openWithTwoQueued(page)

    await expect(section(page, 'Now playing')).toBeVisible()
    await expect(section(page, 'All music')).toBeVisible()

    await page.getByTestId('workspace-tab-library').click()
    const library = page.getByTestId('music-library-nav')
    await expect(library.getByRole('region', { name: 'Library' })).toBeVisible()
    await expect(library.getByRole('region', { name: 'Folders' })).toBeVisible()

    await page.getByTestId('workspace-tab-queue').click()
    const queue = section(page, 'Queue')
    await expect(queue.getByTestId('music-queue-item')).toHaveCount(2)
    // On a touch screen a track leaves the queue without a hover.
    const remove = queue
      .getByTestId('music-queue-item')
      .nth(1)
      .getByRole('button', { name: 'Remove from queue' })
    await expect(remove).toBeVisible()
    await remove.click()
    await expect(queue.getByTestId('music-queue-item')).toHaveCount(1)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
