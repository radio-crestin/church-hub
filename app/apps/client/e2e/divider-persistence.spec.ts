import { expect, test } from '@playwright/test'

/**
 * Resizable dividers persist their position to the database (under the
 * `divider.*` settings namespace) so the layout a user configures survives a
 * reload — and, because it lives in the DB rather than only localStorage, a
 * fresh browser/device too.
 *
 * We exercise this on the Songs list divider (a plain 50–85% width split with
 * no extra layout caps, so the on-screen position maps cleanly to the stored
 * percentage). The dividers on Bible, the Song detail page and Music share the
 * exact same `useDividerPosition` hook.
 */

const SONGS_DIVIDER_KEY = 'divider.songs_list'
const SETTINGS_URL = '/api/settings/app_settings'

// The divider only renders on large (lg) screens.
test.use({ viewport: { width: 1440, height: 900 } })

/** Position of the divider handle as a percentage of its container's width. */
async function readDividerPercent(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const handle = document.querySelector<HTMLElement>('.cursor-col-resize')
    const container = handle?.parentElement
    if (!handle || !container) return null
    const handleRect = handle.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const handleCenter = handleRect.left + handleRect.width / 2
    return ((handleCenter - containerRect.left) / containerRect.width) * 100
  })
}

// These tests share the dev database and several touch the same
// `divider.songs_list` key, so run them in order to avoid clobbering each
// other's seeded values.
test.describe.configure({ mode: 'serial' })

test.describe('Resizable divider persistence', () => {
  test('a divider.* setting is writable and readable via the settings API', async ({
    request,
  }) => {
    // Use a dedicated probe key so this test never interferes with the live
    // key the Songs page reads.
    const probeKey = 'divider.e2e_probe'
    const writeRes = await request.post(SETTINGS_URL, {
      data: { key: probeKey, value: '63' },
    })
    expect(writeRes.ok()).toBeTruthy()

    const readRes = await request.get(`${SETTINGS_URL}/${probeKey}`)
    expect(readRes.ok()).toBeTruthy()
    const { data } = (await readRes.json()) as {
      data: { key: string; value: string } | null
    }
    expect(data?.value).toBe('63')
  })

  test('the divider restores its position from the database on load', async ({
    page,
    request,
  }) => {
    // Seed a non-default position straight into the DB.
    await request.post(SETTINGS_URL, {
      data: { key: SONGS_DIVIDER_KEY, value: '58' },
    })

    await page.goto('/songs')
    // Drop the localStorage cache so the restored value can ONLY come from the
    // database, then reload to prove the DB drives the layout.
    await page.evaluate(
      (key) => window.localStorage.removeItem(key),
      SONGS_DIVIDER_KEY,
    )
    await page.reload()
    await page.locator('.cursor-col-resize').first().waitFor()

    // The position starts at the 75% default (localStorage was cleared) and
    // should settle near the seeded 58% once the async DB fetch resolves.
    await expect
      .poll(
        async () => {
          const p = await readDividerPercent(page)
          return p !== null && p > 54 && p < 62
        },
        { timeout: 5000 },
      )
      .toBe(true)
  })

  test('dragging the divider writes the new position to the database', async ({
    page,
    request,
  }) => {
    // Start from a known seed so the drag has somewhere to move from.
    await request.post(SETTINGS_URL, {
      data: { key: SONGS_DIVIDER_KEY, value: '75' },
    })

    await page.goto('/songs')
    const handle = page.locator('.cursor-col-resize').first()
    await handle.waitFor()

    const before = await readDividerPercent(page)
    expect(before).not.toBeNull()

    // Drag the handle towards the left (shrinking the song-list pane).
    const box = await handle.boundingBox()
    expect(box).not.toBeNull()
    const container = await page.evaluate(() => {
      const el =
        document.querySelector<HTMLElement>('.cursor-col-resize')?.parentElement
      const r = el?.getBoundingClientRect()
      return r ? { left: r.left, width: r.width, top: r.top } : null
    })
    expect(container).not.toBeNull()

    const startX = box!.x + box!.width / 2
    const startY = box!.y + box!.height / 2
    const targetX = container!.left + container!.width * 0.55

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(targetX, startY, { steps: 12 })
    await page.mouse.up()

    // Position should have changed on screen…
    const after = await readDividerPercent(page)
    expect(Math.abs((after ?? 0) - (before ?? 0))).toBeGreaterThan(5)

    // …and the debounced DB write should land with the new value.
    await expect
      .poll(
        async () => {
          const res = await request.get(`${SETTINGS_URL}/${SONGS_DIVIDER_KEY}`)
          const body = (await res.json()) as {
            data: { value: string } | null
          }
          return body.data ? Number(body.data.value) : null
        },
        { timeout: 5000 },
      )
      .toBeLessThan(70)
  })
})
