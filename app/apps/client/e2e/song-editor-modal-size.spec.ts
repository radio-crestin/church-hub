import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The song editor modal (opened from the Marcaje pencil, the same one the
 * Programe pencil opens) must use most of a desktop screen, and still fit a
 * small window without spilling off its edges.
 */

const SCREENSHOT_DIR = process.env.SONG_MODAL_SCREENSHOT_DIR

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function openModal(page: Page, hostId: number, markedTitle: string) {
  await page.goto(`/songs/${hostId}`)
  await page.waitForLoadState('networkidle')
  const row = page.getByTestId('bookmark-item').filter({ hasText: markedTitle })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.getByTestId('bookmark-song-edit').click()
  const modal = page.getByTestId('song-editor-modal')
  await expect(modal).toBeVisible({ timeout: 10000 })
  await expect(modal.getByTestId('song-editor-modal-save')).toBeEnabled({
    timeout: 10000,
  })
  return modal
}

test.describe('Song editor modal size', () => {
  const uniq = Date.now()
  const markedTitle = `E2E Size Marked ${uniq}`
  let hostId = 0
  let markedId = 0

  test.beforeAll(async ({ request }) => {
    hostId = (await createSong(request, `E2E Size Host ${uniq}`)).id
    markedId = (await createSong(request, markedTitle)).id
    await request.post('/api/song-bookmarks', { data: { songId: markedId } })
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/songs/${hostId}`)
    await request.delete(`/api/songs/${markedId}`)
  })

  test('uses most of a desktop screen', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    const modal = await openModal(page, hostId, markedTitle)
    const box = await modal.boundingBox()
    if (SCREENSHOT_DIR)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop.png` })
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(1200)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(1080 * 0.85)
  })

  // The panels that open this modal show only on wide layouts, so this checks
  // the narrowest, shortest window they appear in.
  test('fits a small window', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 })
    const modal = await openModal(page, hostId, markedTitle)
    const box = await modal.boundingBox()
    if (SCREENSHOT_DIR)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/small.png` })
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1024)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(600)
    await expect(modal.getByTestId('song-editor-modal-save')).toBeInViewport()
  })
})
