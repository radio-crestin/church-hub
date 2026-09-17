import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The live preview mirrors the preview screen, so it must keep that screen's
 * proportions at every width: on a phone the Control Room used to stretch it
 * into a tall box, which moved and clipped elements such as the clock. Where
 * the space is wider than the screen, the height limits the box instead; there
 * WebKit (the macOS desktop app) grew it past its frame and cut its bottom off.
 * The projected text must also carry fallbacks for fonts Linux lacks.
 */

interface ScreenSummary {
  type: string
  isPreviewScreen: boolean
  sortOrder: number
  width: number
  height: number
}

/** Same choice LivePreview makes: the flagged preview screen, else the first primary. */
async function getPreviewScreenRatio(
  request: APIRequestContext,
): Promise<number> {
  const response = await request.get('/api/screens')
  expect(response.ok()).toBeTruthy()
  const screens: ScreenSummary[] = (await response.json()).data
  const screen =
    screens.find((s) => s.isPreviewScreen) ??
    screens
      .filter((s) => s.type === 'primary')
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  expect(screen, 'a preview screen exists').toBeTruthy()
  return screen.width / screen.height
}

async function measurePreview(page: Page) {
  const preview = page.getByTestId('live-preview')
  await expect(preview).toBeVisible({ timeout: 15000 })
  return preview.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const clippedBy: string[] = []
    for (
      let ancestor = element.parentElement;
      ancestor && ancestor !== document.documentElement;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor)
      if (style.overflowX === 'visible' && style.overflowY === 'visible') {
        continue
      }
      const bounds = ancestor.getBoundingClientRect()
      if (
        box.left < bounds.left - 1 ||
        box.top < bounds.top - 1 ||
        box.right > bounds.right + 1 ||
        box.bottom > bounds.bottom + 1
      ) {
        clippedBy.push(ancestor.className.toString())
      }
    }
    return {
      ratio: box.width / box.height,
      clippedBy,
      insideViewport:
        box.left >= -1 &&
        box.top >= -1 &&
        box.right <= window.innerWidth + 1 &&
        box.bottom <= window.innerHeight + 1,
    }
  })
}

test.describe('Live preview sizing', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
    // Wider than the screen's proportions: the height limits the box.
    { width: 1920, height: 1080 },
    { width: 1600, height: 800 },
  ]) {
    test(`Control Room preview keeps the screen's aspect ratio at ${viewport.width}x${viewport.height}`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize(viewport)
      const screenRatio = await getPreviewScreenRatio(request)

      await page.goto('/present')

      // Within 0.2%: sub-pixel rounding stays far below that, while the old
      // stretched box was 1.8% off even on a desktop, and WebKit's overgrown
      // one 0.7%.
      await expect
        .poll(
          async () =>
            Math.abs((await measurePreview(page)).ratio / screenRatio - 1),
          { timeout: 10000 },
        )
        .toBeLessThan(0.002)

      const { clippedBy, insideViewport } = await measurePreview(page)
      expect(clippedBy).toEqual([])
      expect(insideViewport).toBe(true)
    })
  }
})

test.describe('Screen font fallbacks', () => {
  test('text configured with Times New Roman falls back to Liberation Serif', async ({
    page,
    request,
  }) => {
    const created = await request.post('/api/screens', {
      data: {
        name: `E2E Font Stack ${Date.now()}`,
        type: 'stage',
        isActive: false,
      },
    })
    expect(created.ok()).toBeTruthy()
    const screenId: number = (await created.json()).data.id

    try {
      const screen = (
        await (await request.get(`/api/screens/${screenId}`)).json()
      ).data
      const clockConfig = screen.globalSettings.clockConfig
      const settings = await request.put(
        `/api/screens/${screenId}/global-settings`,
        {
          data: {
            settings: {
              ...screen.globalSettings,
              clockConfig: {
                ...clockConfig,
                hidden: false,
                style: { ...clockConfig.style, fontFamily: 'Times New Roman' },
              },
            },
          },
        },
      )
      expect(settings.ok()).toBeTruthy()

      // Show the clock whatever is (or is not) on screen right now, so the
      // check never needs to present anything.
      for (const [contentType, config] of Object.entries(
        screen.contentConfigs as Record<string, object>,
      )) {
        const updated = await request.put(
          `/api/screens/${screenId}/config/${contentType}`,
          { data: { config: { ...config, clockEnabled: true } } },
        )
        expect(updated.ok()).toBeTruthy()
      }

      await page.goto(`/screen/${screenId}`)

      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                [...document.querySelectorAll<HTMLElement>('[style]')]
                  .map((element) => getComputedStyle(element).fontFamily)
                  .find((family) => family.includes('Times New Roman')) ?? null,
            ),
          { timeout: 10000 },
        )
        .toContain('Liberation Serif')
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })
})
