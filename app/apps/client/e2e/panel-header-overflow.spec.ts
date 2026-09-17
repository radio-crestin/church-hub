import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

import { openActionsMenu } from './helpers/actions-menu'

/**
 * The Marcaje and Programe headers carry a row of small action buttons. When
 * the side column gets too narrow for all of them, the rightmost ones move
 * into a "More" (⋮) menu — the title truncates first, but keeps its icon and a
 * few letters — and they come back out as the column widens again. Every
 * action still works from the menu, including the ones that open a dialog.
 */

test.use({ viewport: { width: 1440, height: 900 } })

// In the order the buttons sit in each header.
const SCHEDULE_ACTIONS = [
  'schedule-add-item',
  'schedule-search-toggle',
  'schedule-add-all-bookmarks',
  'schedule-open',
  'schedule-rename',
  'schedule-delete',
]
const BOOKMARK_ACTIONS = [
  'bookmarks-add-note',
  'bookmarks-export',
  'bookmarks-add-all-to-schedule',
  'bookmarks-clear',
]

async function cleanup(
  request: APIRequestContext,
  ids: { songId?: number; scheduleId?: number },
) {
  if (ids.songId) {
    const response = await request.get('/api/song-bookmarks')
    const bookmarks = (await response.json()).data as Array<{
      id: number
      songId: number
    }>
    for (const bookmark of bookmarks) {
      if (bookmark.songId === ids.songId) {
        await request.delete(`/api/song-bookmarks/${bookmark.id}`)
      }
    }
  }
  if (ids.scheduleId) await request.delete(`/api/schedules/${ids.scheduleId}`)
  if (ids.songId) await request.delete(`/api/songs/${ids.songId}`)
}

async function headerBox(panel: Locator) {
  const box = await panel.locator('[data-panel-header]').boundingBox()
  if (!box) throw new Error('panel header is not visible')
  return box
}

/**
 * Drags the divider on the side column's left edge until its panel headers are
 * about `targetWidth` wide. Dragging it right narrows the column.
 */
async function resizeSideColumn(
  page: Page,
  panel: Locator,
  targetWidth: number,
) {
  const panelBox = await panel.boundingBox()
  if (!panelBox) throw new Error('side panel is not visible')

  // The column divider is the tall separator just left of the side column.
  let divider: { x: number; y: number; width: number; height: number } | null =
    null
  for (const separator of await page.locator('[role="separator"]').all()) {
    const box = await separator.boundingBox()
    if (!box || box.height < 200 || box.x > panelBox.x) continue
    if (!divider || box.x > divider.x) divider = box
  }
  if (!divider) throw new Error('no divider left of the side column')

  const { width } = await headerBox(panel)
  const x = divider.x + divider.width / 2
  const y = divider.y + divider.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + (width - targetWidth), y, { steps: 12 })
  await page.mouse.up()

  await expect
    .poll(async () => Math.abs((await headerBox(panel)).width - targetWidth), {
      timeout: 5000,
    })
    .toBeLessThan(10)
}

async function expectAllInline(panel: Locator, ids: string[], more: string) {
  for (const id of ids) {
    await expect(panel.getByTestId(id)).toBeVisible()
  }
  await expect(panel.getByTestId(more)).toHaveCount(0)
}

test.describe('Panel header actions overflow into a More menu', () => {
  test('narrowing the side column gathers the actions under More, widening puts them back', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const ids: { songId?: number; scheduleId?: number } = {}

    try {
      const songResponse = await request.post('/api/songs', {
        data: {
          title: `E2E Header Overflow ${uniq}`,
          slides: [{ content: 'Verse', sortOrder: 0 }],
        },
      })
      expect(songResponse.status()).toBe(201)
      ids.songId = (await songResponse.json()).data.id

      const scheduleTitle = `E2E Header Overflow Program ${uniq}`
      const scheduleResponse = await request.post('/api/schedules', {
        data: { title: scheduleTitle },
      })
      expect(scheduleResponse.ok()).toBeTruthy()
      ids.scheduleId = (await scheduleResponse.json()).data.id

      // A bookmark, so Marcaje shows its actions and both headers offer
      // "add all bookmarked songs to a program".
      const bookmarkResponse = await request.post('/api/song-bookmarks', {
        data: { songId: ids.songId },
      })
      expect(bookmarkResponse.ok()).toBeTruthy()

      await page.addInitScript((scheduleId: number) => {
        // Start from the default column widths, once per test: the page is
        // not reloaded, but a stored layout from elsewhere must not leak in.
        if (!window.sessionStorage.getItem('e2e-header-overflow-reset')) {
          for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith('workspace.song-detail')) {
              window.localStorage.removeItem(key)
            }
          }
          window.sessionStorage.setItem('e2e-header-overflow-reset', '1')
        }
        window.localStorage.setItem('song-editor-layout', 'normal')
        window.localStorage.setItem('song-detail:bookmarks-open', 'true')
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem(
          'songPage.selectedScheduleId',
          String(scheduleId),
        )
      }, ids.scheduleId as number)
      await page.goto(`/songs/${ids.songId}`)

      const schedules = page.getByTestId('schedule-songs-panel')
      const bookmarks = page.getByTestId('bookmarks-drop-zone')
      await expect(schedules.getByTestId('schedule-rename')).toBeVisible({
        timeout: 15000,
      })

      // Wide: every action sits in the header and there is no menu.
      await expectAllInline(schedules, SCHEDULE_ACTIONS, 'schedule-header-more')
      await expectAllInline(
        bookmarks,
        BOOKMARK_ACTIONS,
        'bookmarks-header-more',
      )
      const wideWidth = (await headerBox(schedules)).width
      const headerHeight = (await headerBox(schedules)).height

      // Narrow: room for one button beside the trigger. The rightmost actions
      // left first; the first stays.
      await resizeSideColumn(page, schedules, 190)
      await expect(schedules.getByTestId('schedule-header-more')).toBeVisible()
      await expect(schedules.getByTestId('schedule-add-item')).toBeVisible()
      for (const id of SCHEDULE_ACTIONS.slice(1)) {
        await expect(schedules.getByTestId(id)).toBeHidden()
      }
      await expect(bookmarks.getByTestId('bookmarks-header-more')).toBeVisible()
      await expect(bookmarks.getByTestId('bookmarks-add-note')).toBeVisible()
      for (const id of BOOKMARK_ACTIONS.slice(1)) {
        await expect(bookmarks.getByTestId(id)).toBeHidden()
      }
      // The header keeps its height: the trigger is the size of the buttons.
      expect((await headerBox(schedules)).height).toBe(headerHeight)

      // The menu lists exactly what left the row, in the same order.
      const scheduleMenu = await openActionsMenu(page, 'schedule-header-more')
      const menuIds = await scheduleMenu
        .locator('[data-testid]')
        .evaluateAll((rows) =>
          rows.map((row) => (row as HTMLElement).dataset.testid),
        )
      expect(menuIds).toEqual(
        SCHEDULE_ACTIONS.slice(1).map((id) => `${id}-menu`),
      )

      // A toggle keeps its on/off meaning from the menu.
      const searchRow = scheduleMenu.getByTestId('schedule-search-toggle-menu')
      await expect(searchRow).toHaveAttribute('aria-checked', 'false')
      await searchRow.click()
      await expect(page.getByTestId('schedule-search-input')).toBeFocused()
      await expect(
        (await openActionsMenu(page, 'schedule-header-more')).getByTestId(
          'schedule-search-toggle-menu',
        ),
      ).toHaveAttribute('aria-checked', 'true')

      // A dialog opens from its menu row just as from its button.
      await page.getByTestId('schedule-rename-menu').click()
      const renameModal = page.getByTestId('rename-schedule-modal')
      await expect(renameModal).toBeVisible()
      await expect(page.getByTestId('rename-schedule-input')).toHaveValue(
        scheduleTitle,
      )
      // Closed from the backdrop: Escape in a dialog on this page also walks
      // back to the song list, which is not what is under test here.
      await page.mouse.click(20, 450)
      await expect(renameModal).toBeHidden()

      // Marcaje: exporting from the menu still downloads the list.
      const bookmarkMenu = await openActionsMenu(page, 'bookmarks-header-more')
      const bookmarkMenuIds = await bookmarkMenu
        .locator('[data-testid]')
        .evaluateAll((rows) =>
          rows.map((row) => (row as HTMLElement).dataset.testid),
        )
      expect(bookmarkMenuIds).toEqual(
        BOOKMARK_ACTIONS.slice(1).map((id) => `${id}-menu`),
      )
      const download = page.waitForEvent('download')
      await bookmarkMenu.getByTestId('bookmarks-export-menu').click()
      expect((await download).suggestedFilename()).toMatch(
        /^bookmarks-.*\.txt$/,
      )

      // Narrowest: every action is in the menu, and "+" — whose dialogs used
      // to live beside the button — still opens the add dialog from there.
      await resizeSideColumn(page, schedules, 150)
      for (const id of SCHEDULE_ACTIONS) {
        await expect(schedules.getByTestId(id)).toBeHidden()
      }
      await expect(schedules.getByTestId('schedule-header-more')).toBeVisible()
      // The title still shows the start of its name rather than a bare "…".
      const title = await schedules
        .locator('[data-panel-header] .truncate')
        .boundingBox()
      expect(title?.width ?? 0).toBeGreaterThan(30)
      const narrowestMenu = await openActionsMenu(page, 'schedule-header-more')
      await narrowestMenu.getByTestId('schedule-add-item-menu').click()
      const addModal = page.getByTestId('add-schedule-item-modal')
      await expect(addModal).toBeVisible()
      await page.mouse.click(20, 450)
      await expect(addModal).toBeHidden()

      // Wide again: everything is back in the header and the menu is gone.
      await resizeSideColumn(page, schedules, wideWidth)
      await expectAllInline(schedules, SCHEDULE_ACTIONS, 'schedule-header-more')
      await expectAllInline(
        bookmarks,
        BOOKMARK_ACTIONS,
        'bookmarks-header-more',
      )
    } finally {
      await cleanup(request, ids)
    }
  })
})
