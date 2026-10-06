import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { startWithCollapsedSidebar } from './helpers/collapsed-sidebar'

/**
 * The shared tooltip stays inside the window (T-107). The Programe panel sits
 * at the right edge of the song page; its last header button's tooltip used to
 * open centred under the button and run past the window's right edge. Now it
 * shifts left to fit, and its arrow still points at the button.
 */

const made: { songId?: number; scheduleId?: number } = {}

async function makeSongAndProgram(request: APIRequestContext) {
  const song = await request.post('/api/songs', {
    data: {
      title: `E2E Tooltip Song ${Date.now()}`,
      slides: [{ content: 'line', sortOrder: 0 }],
    },
  })
  made.songId = (await song.json()).data.id
  const program = await request.post('/api/schedules', {
    data: { title: `E2E Tooltip Program ${Date.now()}` },
  })
  made.scheduleId = (await program.json()).data.id
}

async function openSongPageWithProgram(page: Page) {
  await startWithCollapsedSidebar(page)
  await page.addInitScript((scheduleId: number) => {
    window.localStorage.setItem('song-editor-layout', 'normal')
    window.localStorage.setItem('song-detail:schedules-open', 'true')
    window.localStorage.setItem(
      'songPage.selectedScheduleId',
      String(scheduleId),
    )
  }, made.scheduleId as number)
  await page.goto(`/songs/${made.songId}`)
  await expect(
    page.getByTestId('schedule-songs-panel').getByTestId('schedule-delete'),
  ).toBeVisible({ timeout: 15000 })
}

async function expectTooltipInsideWindow(page: Page, triggerTestId: string) {
  const trigger = page
    .getByTestId('schedule-songs-panel')
    .getByTestId(triggerTestId)
  await trigger.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()

  const viewport = page.viewportSize() as { width: number; height: number }
  const box = await tooltip.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)

  // The arrow still points at the button it explains.
  const triggerBox = await trigger.boundingBox()
  const arrowBox = await page.getByTestId('tooltip-arrow').boundingBox()
  if (!triggerBox || !arrowBox) throw new Error('trigger or arrow not laid out')
  const triggerCenter = triggerBox.x + triggerBox.width / 2
  const arrowCenter = arrowBox.x + arrowBox.width / 2
  expect(Math.abs(arrowCenter - triggerCenter)).toBeLessThanOrEqual(2)
}

test.describe('tooltips stay inside the window', () => {
  test.beforeEach(async ({ request }) => {
    await makeSongAndProgram(request)
  })

  test.afterEach(async ({ request }) => {
    if (made.scheduleId)
      await request.delete(`/api/schedules/${made.scheduleId}`)
    if (made.songId) await request.delete(`/api/songs/${made.songId}`)
  })

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 800 },
  ]) {
    test(`the last Programe header button at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await openSongPageWithProgram(page)
      await expectTooltipInsideWindow(page, 'schedule-delete')
    })
  }
})
