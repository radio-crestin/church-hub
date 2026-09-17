import { expect, type Page, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * The song page's last column (Marcaje / Programe / Versiuni) can be hidden
 * from the button on its divider, handing its width to the preview, and it
 * keeps a sane arrangement when the operator switches editing layouts: the
 * classic and PowerPoint layouts each own a workspace id, and swapping ids
 * without leaving the page used to reuse the old id's columns, piling every
 * panel into one column with no divider left to collapse.
 */

// The workspace only renders as columns on large (lg) screens.
test.use({ viewport: { width: 1440, height: 900 } })

const TOGGLE = 'workspace-last-column-toggle'

async function createSong(page: Page): Promise<number> {
  const response = await page.request.post('/api/songs', {
    data: {
      title: `E2E Column Toggle ${Date.now()}`,
      slides: [
        { content: 'Verse one', sortOrder: 0 },
        { content: 'Verse two', sortOrder: 1 },
      ],
    },
  })
  expect(response.status()).toBe(201)
  const { data } = await response.json()
  return data.id
}

async function widthOf(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox()
  return box?.width ?? 0
}

/** Panel ids of the workspace column holding `panelId`. */
async function columnOf(page: Page, panelId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const panel = document.querySelector(
      `[data-testid="workspace-panel-${id}"]`,
    )
    const column = panel?.closest('[data-testid^="workspace-column-col"]')
    if (!column) return []
    return Array.from(
      column.querySelectorAll('[data-testid^="workspace-panel-"]'),
    ).map((element) =>
      (element as HTMLElement).dataset.testid?.replace('workspace-panel-', ''),
    ) as string[]
  }, panelId)
}

test.describe('Workspace last column toggle', () => {
  let songId: number

  test.beforeEach(async ({ page }) => {
    // Start every test from the default arrangements, once per test: a reload
    // inside the test must still see what the test stored.
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('e2e-column-toggle')) return
      window.sessionStorage.setItem('e2e-column-toggle', '1')
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('workspace.song-detail')) {
          window.localStorage.removeItem(key)
        }
      }
      window.localStorage.setItem('song-editor-layout', 'normal')
    })
    songId = await createSong(page)
  })

  test.afterEach(async ({ page }) => {
    await page.request.delete(`/api/songs/${songId}`)
  })

  test('switching to PowerPoint keeps the side panels in their own column', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-control')).toBeVisible({
      timeout: 15000,
    })

    await selectAction(page, 'song-actions-menu', 'song-toggle-layout')
    await expect(page.getByTestId('workspace-panel-stage')).toBeVisible({
      timeout: 15000,
    })

    expect(await columnOf(page, 'stage')).toEqual(['stage'])
    expect(await columnOf(page, 'versions')).toContain('versions')
    await expect(page.getByTestId(TOGGLE)).toBeVisible()

    // And back: the classic page gets its three columns again.
    await selectAction(page, 'song-actions-menu', 'song-toggle-layout')
    await expect(page.getByTestId('workspace-panel-control')).toBeVisible()
    expect(await columnOf(page, 'slides')).toEqual(['slides'])
    expect(await columnOf(page, 'control')).toEqual(['control'])
  })

  test('the divider button hides and shows the side column in PowerPoint', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('song-editor-layout', 'powerpoint')
    })
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-stage')).toBeVisible({
      timeout: 15000,
    })

    const toggle = page.getByTestId(TOGGLE)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const stageWidth = await widthOf(page, 'workspace-panel-stage')
    expect(await widthOf(page, 'workspace-panel-versions')).toBeGreaterThan(100)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect
      .poll(() => widthOf(page, 'workspace-panel-versions'))
      .toBeLessThan(1)
    expect(await widthOf(page, 'workspace-panel-stage')).toBeGreaterThan(
      stageWidth + 200,
    )

    // The hidden column is remembered on this device.
    await page.reload()
    await expect(page.getByTestId('workspace-panel-stage')).toBeVisible({
      timeout: 15000,
    })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect
      .poll(() => widthOf(page, 'workspace-panel-versions'))
      .toBeGreaterThan(100)
  })

  test('dragging the divider by its button resizes without hiding', async ({
    page,
  }) => {
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-control')).toBeVisible({
      timeout: 15000,
    })

    const toggle = page.getByTestId(TOGGLE)
    const box = await toggle.boundingBox()
    if (!box) throw new Error('toggle is not visible')
    const sideWidth = await widthOf(page, 'workspace-panel-versions')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 40, y, { steps: 5 })
    await page.mouse.move(x - 80, y, { steps: 5 })
    await page.mouse.up()

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await widthOf(page, 'workspace-panel-versions')).toBeGreaterThan(
      sideWidth + 40,
    )
  })
})
