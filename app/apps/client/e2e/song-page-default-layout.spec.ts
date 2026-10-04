import { expect, type Page, test } from '@playwright/test'

/**
 * Song page default layout: Versiuni sits under the song preview (middle
 * column) instead of at the bottom of the third column. A device still on the
 * old default moves to the new one; a layout the operator arranged is kept.
 */

const LAYOUT_KEY = 'workspace.song-detail.layout'

const OLD_DEFAULT = {
  columns: [
    { id: 'col-1', panelIds: ['slides'] },
    { id: 'col-2', panelIds: ['control'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
}

const CHOSEN = {
  columns: [
    { id: 'col-1', panelIds: ['slides', 'versions'] },
    { id: 'col-2', panelIds: ['control'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules'] },
  ],
}

async function createSong(
  request: import('@playwright/test').APIRequestContext,
) {
  const response = await request.post('/api/songs', {
    data: {
      title: `E2E Default Layout ${Date.now()}`,
      slides: [{ content: '<p>Strofa</p>', sortOrder: 0 }],
    },
  })
  expect(response.status()).toBe(201)
  const { data } = await response.json()
  return data as { id: number }
}

async function openSongPage(
  page: Page,
  songId: number,
  storedLayout: object | null,
) {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.addInitScript(
    ({ key, layout }) => {
      window.localStorage.setItem('sidebar-collapsed', 'true')
      window.localStorage.setItem('church-hub-language', 'ro')
      // Only seed on the first load, so a reload sees what the page stored.
      if (window.sessionStorage.getItem('seeded')) return
      window.sessionStorage.setItem('seeded', '1')
      if (layout) window.localStorage.setItem(key, JSON.stringify(layout))
      else window.localStorage.removeItem(key)
    },
    { key: LAYOUT_KEY, layout: storedLayout },
  )
  await page.goto(`/songs/${songId}`)
  await expect(page.getByTestId('workspace-panel-control')).toBeVisible()
}

async function box(page: Page, panel: string) {
  const result = await page
    .getByTestId(`workspace-panel-${panel}`)
    .boundingBox()
  expect(result, `${panel} panel is visible`).not.toBeNull()
  return result as NonNullable<typeof result>
}

async function expectVersionsUnderPreview(page: Page) {
  await expect(page.getByTestId('workspace-panel-versions')).toBeVisible()
  const control = await box(page, 'control')
  const versions = await box(page, 'versions')
  const bookmarks = await box(page, 'bookmarks')
  // Same column as the preview, below it.
  expect(Math.abs(versions.x - control.x)).toBeLessThanOrEqual(2)
  expect(versions.y).toBeGreaterThanOrEqual(control.y + control.height - 2)
  // Marcaje keeps the third column to itself.
  expect(bookmarks.x).toBeGreaterThan(versions.x + versions.width - 2)
}

test.describe('Song page default layout', () => {
  test('a fresh device puts Versiuni under the preview', async ({
    page,
    request,
  }) => {
    const song = await createSong(request)
    try {
      await openSongPage(page, song.id, null)
      await expectVersionsUnderPreview(page)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('a device still on the old default moves to the new one', async ({
    page,
    request,
  }) => {
    const song = await createSong(request)
    try {
      await openSongPage(page, song.id, OLD_DEFAULT)
      await expectVersionsUnderPreview(page)
      const stored = await page.evaluate(
        (key) => window.localStorage.getItem(key),
        LAYOUT_KEY,
      )
      expect(stored).toBeNull()
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('an arrangement the operator chose is kept', async ({
    page,
    request,
  }) => {
    const song = await createSong(request)
    try {
      await openSongPage(page, song.id, CHOSEN)
      await expect(page.getByTestId('workspace-panel-versions')).toBeVisible()
      const slides = await box(page, 'slides')
      const versions = await box(page, 'versions')
      const control = await box(page, 'control')
      expect(Math.abs(versions.x - slides.x)).toBeLessThanOrEqual(2)
      expect(versions.x).toBeLessThan(control.x)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('stacks all panels on a phone as before', async ({ page, request }) => {
    const song = await createSong(request)
    try {
      await page.setViewportSize({ width: 390, height: 800 })
      await page.addInitScript(() => {
        window.localStorage.setItem('church-hub-language', 'ro')
      })
      await page.goto(`/songs/${song.id}`)
      await expect(page.getByTestId('workspace-panel-control')).toBeVisible()
      await expect(page.getByTestId('workspace-panel-versions')).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
