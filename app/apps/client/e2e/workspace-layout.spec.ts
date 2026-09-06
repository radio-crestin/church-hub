import { expect, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * Each page's panels live in a Workspace: columns of panels the operator can
 * resize, stack and drag anywhere. Two things are persisted to `localStorage`,
 * and both are a personal, per-PC preference that is deliberately NOT synced
 * through the database — rearranging on one computer never changes another's:
 *
 *   - `workspace.<id>.layout`    — which panel sits in which column;
 *   - `workspace.<id>.sizes.*`   — how wide each column and how tall each row is;
 *   - `workspace.<id>.heights`   — the height a collapsed panel goes back to.
 *
 * A panel is hidden by dragging its divider onto the edge, and shrinks to just
 * its header when its own collapse chevron is closed — and re-opening it puts
 * it back at the height it had, however long ago it was closed.
 *
 * Handles only fade in on hover, which nobody discovers on their own, so the
 * page menu has an "Edit layout" row that turns every handle on at once and
 * opens a toolbar with the way back to the default arrangement.
 */

const LAYOUT_KEY = 'workspace.song-detail.layout'

// The workspace only renders as columns on large (lg) screens.
test.use({ viewport: { width: 1440, height: 900 } })

type Page = import('@playwright/test').Page

/** The stored arrangement, as a list of columns of panel ids. */
async function readArrangement(page: Page): Promise<string[][] | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as { columns: { panelIds: string[] }[] }
      return parsed.columns.map((column) => column.panelIds)
    } catch {
      return null
    }
  }, LAYOUT_KEY)
}

async function panelBox(page: Page, panelId: string) {
  const box = await page.getByTestId(`workspace-panel-${panelId}`).boundingBox()
  if (!box) throw new Error(`panel ${panelId} is not visible`)
  return box
}

/** Drags from one point to another with enough steps for dnd-kit to track it. */
async function dragTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 20 })
  await page.mouse.move(to.x, to.y, { steps: 5 })
  await page.mouse.up()
}

// These tests share the dev database/localStorage, so run them in order.
test.describe.configure({ mode: 'serial' })

test.describe('Workspace layout', () => {
  let songId: number

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Workspace ${Date.now()}`,
        slides: [
          { content: 'First slide', sortOrder: 0 },
          { content: 'Second slide', sortOrder: 1 },
        ],
      },
    })
    expect(response.status()).toBe(201)
    const { data } = await response.json()
    songId = data.id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/songs/${songId}`)
  })

  test.beforeEach(async ({ page }) => {
    // Reset once per test, not on every load — these tests reload the page to
    // prove the arrangement survives it.
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('e2e-workspace-reset')) {
        for (const key of Object.keys(window.localStorage)) {
          if (key.startsWith('workspace.song-detail')) {
            window.localStorage.removeItem(key)
          }
        }
        window.sessionStorage.setItem('e2e-workspace-reset', '1')
      }
      // Marcaje expanded so its row has a real height to measure.
      window.localStorage.setItem('song-detail:bookmarks-open', 'true')
      window.localStorage.setItem('song-detail:versions-open', 'true')
      window.localStorage.setItem('song-editor-layout', 'normal')
    })
  })

  test('column widths survive a reload', async ({ page }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-slides')).toBeVisible({
      timeout: 15000,
    })

    const before = await panelBox(page, 'slides')

    // Drag the first column separator left, narrowing the Slides column.
    const separator = page.locator('[role="separator"]').first()
    const handle = await separator.boundingBox()
    if (!handle) throw new Error('no column separator')
    await dragTo(
      page,
      { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      { x: handle.x + handle.width / 2 - 150, y: handle.y + handle.height / 2 },
    )

    const narrowed = await panelBox(page, 'slides')
    expect(narrowed.width).toBeLessThan(before.width - 80)

    await page.reload()
    await expect(page.getByTestId('workspace-panel-slides')).toBeVisible({
      timeout: 15000,
    })
    const restored = await panelBox(page, 'slides')
    expect(Math.abs(restored.width - narrowed.width)).toBeLessThan(12)
  })

  test('a panel dragged under another one changes column, and the move sticks', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    const bookmarks = page.getByTestId('workspace-panel-bookmarks')
    await bookmarks.hover()
    const grip = await page
      .getByTestId('workspace-move-bookmarks')
      .boundingBox()
    if (!grip) throw new Error('no move handle on the Marcaje panel')

    // Drop it on the bottom half of the Slides panel — i.e. under the verses,
    // in the Slides column.
    const slides = await panelBox(page, 'slides')
    await dragTo(
      page,
      { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      { x: slides.x + slides.width / 2, y: slides.y + slides.height * 0.8 },
    )

    await expect
      .poll(async () => (await readArrangement(page))?.[0], { timeout: 5000 })
      .toEqual(['slides', 'bookmarks'])

    await page.reload()
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })
    // Still stacked under the verses rather than off in the right column.
    const slidesAfter = await panelBox(page, 'slides')
    const bookmarksAfter = await panelBox(page, 'bookmarks')
    expect(bookmarksAfter.y).toBeGreaterThan(slidesAfter.y)
    expect(Math.abs(bookmarksAfter.x - slidesAfter.x)).toBeLessThan(12)
  })

  test('re-expanding a panel brings back the height it had, even after a reload', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    const toggle = page.getByTestId('bookmarks-collapse-toggle')
    const expanded = await panelBox(page, 'bookmarks')
    expect(expanded.height).toBeGreaterThan(150)

    // Collapse: the neighbours take the space, so the height is gone from the
    // layout and has to have been remembered somewhere.
    await toggle.click()
    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).height, {
        timeout: 5000,
      })
      .toBeLessThan(90)

    await toggle.click()
    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).height, {
        timeout: 5000,
      })
      .toBeGreaterThan(expanded.height - 12)

    // And the memory outlives the page: collapse, come back tomorrow, expand.
    await toggle.click()
    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).height, {
        timeout: 5000,
      })
      .toBeLessThan(90)

    // The shared setup forces Marcaje open on every load; this test needs it to
    // come back collapsed, the way the operator left it.
    await page.addInitScript(() => {
      window.localStorage.setItem('song-detail:bookmarks-open', 'false')
    })
    await page.reload()
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    await page.getByTestId('bookmarks-collapse-toggle').click()
    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).height, {
        timeout: 5000,
      })
      .toBeGreaterThan(expanded.height - 12)
  })

  test('the page menu turns on layout editing and shows every handle at once', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-slides')).toBeVisible({
      timeout: 15000,
    })

    // Out of edit mode the handles are there but invisible until hovered.
    await expect(page.getByTestId('workspace-move-slides')).toHaveCSS(
      'opacity',
      '0',
    )
    await expect(page.getByTestId('workspace-edit-toolbar')).toHaveCount(0)

    await selectAction(page, 'song-actions-menu', 'workspace-edit-layout')

    await expect(page.getByTestId('workspace-edit-toolbar')).toBeVisible()
    for (const panelId of ['slides', 'control', 'bookmarks']) {
      await expect(page.getByTestId(`workspace-move-${panelId}`)).toHaveCSS(
        'opacity',
        '1',
      )
    }

    // Done puts the page back the way it was.
    await page.getByTestId('workspace-done-editing').click()
    await expect(page.getByTestId('workspace-edit-toolbar')).toHaveCount(0)
    await expect(page.getByTestId('workspace-move-slides')).toHaveCSS(
      'opacity',
      '0',
    )
  })

  test('a dragged panel shows where it will land while the others flow around it', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    await selectAction(page, 'song-actions-menu', 'workspace-edit-layout')
    await expect(page.getByTestId('workspace-edit-toolbar')).toBeVisible()

    const grip = await page
      .getByTestId('workspace-move-bookmarks')
      .boundingBox()
    if (!grip) throw new Error('no move handle on the Marcaje panel')
    const slides = await panelBox(page, 'slides')

    // Hold the drag over the bottom half of the Slides panel without letting go.
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      slides.x + slides.width / 2,
      slides.y + slides.height * 0.8,
      { steps: 20 },
    )

    // The panel's slot is drawn where it would land — under the verses, in the
    // verses column — and the verses panel has already made room for it.
    const ghost = page.getByTestId('workspace-panel-ghost')
    await expect(ghost).toBeVisible()
    const ghostBox = await ghost.boundingBox()
    const slidesDuringDrag = await panelBox(page, 'slides')
    if (!ghostBox) throw new Error('no drop preview')
    expect(ghostBox.y).toBeGreaterThan(slidesDuringDrag.y)
    expect(Math.abs(ghostBox.x - slidesDuringDrag.x)).toBeLessThan(20)
    // Nothing is committed until the operator lets go.
    expect(await readArrangement(page)).toBeNull()

    await page.mouse.up()

    await expect(ghost).toHaveCount(0)
    await expect
      .poll(async () => (await readArrangement(page))?.[0], { timeout: 5000 })
      .toEqual(['slides', 'bookmarks'])
  })

  test('a collapsed panel can be dragged out into a column of its own', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    // A collapsed row is pinned to its header through the panel API, and that
    // API only answers once the row's *new* column knows about it — moving one
    // used to take the whole page down with it.
    await page.getByTestId('bookmarks-collapse-toggle').click()
    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).height, {
        timeout: 5000,
      })
      .toBeLessThan(90)

    await selectAction(page, 'song-actions-menu', 'workspace-edit-layout')
    const grip = await page
      .getByTestId('workspace-move-bookmarks')
      .boundingBox()
    if (!grip) throw new Error('no move handle on the Marcaje panel')
    const slides = await panelBox(page, 'slides')

    // The left edge of the verses panel: a brand new column beside it.
    await dragTo(
      page,
      { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      { x: slides.x + slides.width * 0.05, y: slides.y + slides.height / 2 },
    )

    await expect
      .poll(async () => (await readArrangement(page))?.[0], { timeout: 5000 })
      .toEqual(['bookmarks'])
    // The page is still standing, and Marcaje now has the leftmost column to
    // itself. (A lone row fills its column, so its height is no longer the
    // measure of whether it is collapsed.)
    await expect(page.getByTestId('workspace-panel-slides')).toBeVisible()
    expect((await panelBox(page, 'bookmarks')).x).toBeLessThan(
      (await panelBox(page, 'slides')).x,
    )
  })

  test('the toolbar puts the page back to the arrangement it ships with', async ({
    page,
  }) => {
    // Arrive with a rearranged page, the way an operator who moved things last
    // week does.
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          columns: [
            { id: 'col-1', panelIds: ['slides', 'bookmarks'] },
            { id: 'col-2', panelIds: ['control'] },
            { id: 'col-3', panelIds: ['schedules', 'versions'] },
          ],
        }),
      )
    }, LAYOUT_KEY)

    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })
    const slides = await panelBox(page, 'slides')
    expect((await panelBox(page, 'bookmarks')).x).toBeLessThan(slides.x + 100)

    await selectAction(page, 'song-actions-menu', 'workspace-edit-layout')
    await page.getByTestId('workspace-reset-layout').click()

    // Marcaje is back in the right-hand column, and nothing is left stored.
    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).x, {
        timeout: 5000,
      })
      .toBeGreaterThan(slides.x + 100)
    expect(await readArrangement(page)).toBeNull()
    // Nothing left to undo, so the button says so.
    await expect(page.getByTestId('workspace-reset-layout')).toBeDisabled()
  })

  test('collapsing a panel shrinks its row to the header', async ({ page }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    const expanded = await panelBox(page, 'bookmarks')
    expect(expanded.height).toBeGreaterThan(150)

    await page.getByTestId('bookmarks-collapse-toggle').click()

    await expect
      .poll(async () => (await panelBox(page, 'bookmarks')).height, {
        timeout: 5000,
      })
      .toBeLessThan(90)
  })
})
