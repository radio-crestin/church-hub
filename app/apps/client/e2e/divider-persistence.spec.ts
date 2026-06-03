import { expect, test } from '@playwright/test'

/**
 * Resizable dividers persist their position to `localStorage` (keyed by
 * `divider.*`), so the layout each operator configures survives a reload and
 * an app restart — and stays local to THIS machine. Divider positions are a
 * personal, per-PC UI preference; they are deliberately NOT synced through the
 * database, so moving a divider on one computer never changes another's layout.
 *
 * We exercise:
 *   1. the Songs-list Marcaje edge — which has no key of its own: it MIRRORS
 *      the Song detail page by deriving its position from the shared Slides +
 *      Stage dividers, and writes a drag back into the Stage divider so the two
 *      pages stay identical;
 *   2. the Marcaje↔Versiuni vertical divider on the Song detail page (the
 *      feature this spec was extended for).
 */

// The songs-list Marcaje edge mirrors these two song-detail dividers — it has
// no `divider.songs_list` key of its own. Edge = left + (100-left)*right/100.
const SONG_DETAIL_LEFT_KEY = 'divider.song_detail_left'
const SONG_DETAIL_RIGHT_KEY = 'divider.song_detail_right'
const LEGACY_SONGS_DIVIDER_KEY = 'divider.songs_list'
const ACCORDION_DIVIDER_KEY = 'divider.song_detail_accordion'

// Dividers only render on large (lg) screens.
test.use({ viewport: { width: 1440, height: 900 } })

type Page = import('@playwright/test').Page

/** Reads a stored divider percentage straight out of localStorage. */
function readStored(page: Page, key: string): Promise<number | null> {
  return page.evaluate((k) => {
    const raw = window.localStorage.getItem(k)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, key)
}

/** Horizontal position of a `.cursor-col-resize` handle, as a % of its container. */
async function readColResizePercent(page: Page) {
  return page.evaluate(() => {
    const handle = document.querySelector<HTMLElement>('.cursor-col-resize')
    const container = handle?.parentElement
    if (!handle || !container) return null
    const h = handle.getBoundingClientRect()
    const c = container.getBoundingClientRect()
    return ((h.left + h.width / 2 - c.left) / c.width) * 100
  })
}

// These tests share the dev database/localStorage, so run them in order.
test.describe.configure({ mode: 'serial' })

test.describe('Resizable divider persistence (localStorage, per-PC)', () => {
  test('the songs-list Marcaje edge mirrors the shared song-detail layout', async ({
    page,
  }) => {
    await page.goto('/songs')
    // The list page has no key of its own — it derives the Marcaje edge from
    // the song-detail Slides (left) + Stage (right) dividers:
    //   edge = left + (100 - left) * right / 100.
    // Seed left=30, right=20 -> edge = 30 + 70*0.20 = 44%.
    await page.evaluate(
      (keys) => {
        window.localStorage.setItem(keys.left, '30')
        window.localStorage.setItem(keys.right, '20')
        window.localStorage.removeItem(keys.legacy)
      },
      {
        left: SONG_DETAIL_LEFT_KEY,
        right: SONG_DETAIL_RIGHT_KEY,
        legacy: LEGACY_SONGS_DIVIDER_KEY,
      },
    )
    await page.reload()
    await page.locator('.cursor-col-resize').first().waitFor()

    await expect
      .poll(
        async () => {
          const p = await readColResizePercent(page)
          return p !== null && p > 40 && p < 48 // ~44%
        },
        { timeout: 5000 },
      )
      .toBe(true)
  })

  test('dragging the songs-list divider rewrites the shared song-detail Stage divider', async ({
    page,
  }) => {
    await page.goto('/songs')
    // Default-ish layout: left=30, right=57 -> edge ~70%.
    await page.evaluate(
      (keys) => {
        window.localStorage.setItem(keys.left, '30')
        window.localStorage.setItem(keys.right, '57')
        window.localStorage.removeItem(keys.legacy)
      },
      {
        left: SONG_DETAIL_LEFT_KEY,
        right: SONG_DETAIL_RIGHT_KEY,
        legacy: LEGACY_SONGS_DIVIDER_KEY,
      },
    )
    await page.reload()

    const handle = page.locator('.cursor-col-resize').first()
    await handle.waitFor()

    const before = await readColResizePercent(page)
    expect(before).not.toBeNull()

    const box = await handle.boundingBox()
    expect(box).not.toBeNull()
    const container = await page.evaluate(() => {
      const el =
        document.querySelector<HTMLElement>('.cursor-col-resize')?.parentElement
      const r = el?.getBoundingClientRect()
      return r ? { left: r.left, width: r.width } : null
    })
    expect(container).not.toBeNull()

    const startY = box!.y + box!.height / 2
    // Drag the Marcaje edge left (smaller List) -> the shared Stage divider shrinks.
    const targetX = container!.left + container!.width * 0.55

    // hover() does real hit-testing on the 8px-wide handle before pressing —
    // a manual mouse.move() to computed coords can land on the inner grip icon
    // and miss the divider's onMouseDown entirely, so the drag never engages.
    await handle.hover()
    await page.mouse.down()
    await page.mouse.move(targetX, startY, { steps: 20 })
    await page.waitForTimeout(50)
    await page.mouse.up()

    // The drag is written back to the SHARED Stage divider (now smaller) — this
    // is the real contract and the most robust signal that the drag took.
    await expect
      .poll(() => readStored(page, SONG_DETAIL_RIGHT_KEY), { timeout: 3000 })
      .toBeLessThan(57)

    // …and it moved on screen too.
    await expect
      .poll(
        async () => {
          const after = await readColResizePercent(page)
          return Math.abs((after ?? 0) - (before ?? 0))
        },
        { timeout: 2000 },
      )
      .toBeGreaterThan(5)
    // …and the legacy per-list key is never resurrected.
    expect(await readStored(page, LEGACY_SONGS_DIVIDER_KEY)).toBeNull()
  })

  test('the Marcaje↔Versiuni divider persists its split to localStorage across a reload', async ({
    page,
    request,
  }) => {
    // A real song is needed for the Versiuni section (and thus the divider).
    const create = await request.post('/api/songs', {
      data: {
        title: `E2E Divider ${Date.now()}`,
        slides: [{ content: 'verse 1' }],
      },
    })
    expect([200, 201]).toContain(create.status())
    const songId = (await create.json()).data.id as number

    try {
      await page.goto(`/songs/${songId}`)
      // Start from a clean default so the drag has a known origin.
      await page.evaluate(
        (k) => window.localStorage.removeItem(k),
        ACCORDION_DIVIDER_KEY,
      )
      await page.reload()

      // The divider only renders with both sections expanded (the default) on
      // a large screen — exactly our setup.
      const handle = page.locator('.cursor-row-resize').first()
      await handle.waitFor({ timeout: 10000 })

      const box = await handle.boundingBox()
      expect(box).not.toBeNull()

      // Drag the handle UP to give Marcaje a smaller share. hover() hit-tests
      // the thin handle before pressing (a manual mouse.move to computed coords
      // can land on the inner grip icon and miss the divider's onMouseDown).
      const startX = box!.x + box!.width / 2
      const startY = box!.y + box!.height / 2
      await handle.hover()
      await page.mouse.down()
      await page.mouse.move(startX, startY - 120, { steps: 16 })
      await page.waitForTimeout(50)
      await page.mouse.up()

      // localStorage now holds the new split (default was 50; dragging up shrinks it).
      await expect
        .poll(() => readStored(page, ACCORDION_DIVIDER_KEY), { timeout: 2000 })
        .toBeLessThan(50)
      const stored = await readStored(page, ACCORDION_DIVIDER_KEY)
      expect(stored).not.toBeNull()

      // Reload: the value is untouched and the divider comes back where we left it.
      await page.reload()
      await page
        .locator('.cursor-row-resize')
        .first()
        .waitFor({ timeout: 10000 })
      expect(await readStored(page, ACCORDION_DIVIDER_KEY)).toBe(stored)
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => undefined)
    }
  })
})
