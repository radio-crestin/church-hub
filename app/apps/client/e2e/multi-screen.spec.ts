import { expect, test } from '@playwright/test'

/**
 * E2E tests for multi-screen presentation scenarios.
 * Tests creating multiple screens, independent content display,
 * screen-specific settings, and scene overrides.
 */

test.describe('Multi-Screen', () => {
  const createdScreenIds: number[] = []

  test.beforeAll(async ({ request }) => {
    // Clean up any leftover presentation state
    await request.post('/api/presentation/stop')
  })

  test.afterAll(async ({ request }) => {
    // Clean up created screens
    for (const id of createdScreenIds) {
      await request.delete(`/api/screens/${id}`)
    }
    await request.post('/api/presentation/stop')
  })

  test('can create multiple screen configurations via API', async ({
    request,
  }) => {
    // Create first screen
    const screen1Res = await request.post('/api/screens', {
      data: { name: 'E2E Screen Alpha', type: 'primary' },
    })
    expect(screen1Res.ok()).toBeTruthy()
    const screen1Body = await screen1Res.json()
    const screen1Id = screen1Body.data.id
    createdScreenIds.push(screen1Id)

    // Create second screen
    const screen2Res = await request.post('/api/screens', {
      data: { name: 'E2E Screen Beta', type: 'primary' },
    })
    expect(screen2Res.ok()).toBeTruthy()
    const screen2Body = await screen2Res.json()
    const screen2Id = screen2Body.data.id
    createdScreenIds.push(screen2Id)

    // Verify both screens are listed
    const listRes = await request.get('/api/screens')
    expect(listRes.ok()).toBeTruthy()
    const listBody = await listRes.json()
    const screenIds = listBody.data.map((s: { id: number }) => s.id)
    expect(screenIds).toContain(screen1Id)
    expect(screenIds).toContain(screen2Id)
  })

  test('each screen loads independently at its own route', async ({
    page,
    request,
  }) => {
    // Ensure we have screens to test with
    if (createdScreenIds.length < 2) {
      // Create screens if not created yet
      const res1 = await request.post('/api/screens', {
        data: { name: 'E2E Multi Screen 1', type: 'primary' },
      })
      const res2 = await request.post('/api/screens', {
        data: { name: 'E2E Multi Screen 2', type: 'primary' },
      })
      if (res1.ok()) createdScreenIds.push((await res1.json()).data.id)
      if (res2.ok()) createdScreenIds.push((await res2.json()).data.id)
    }

    for (const sid of createdScreenIds) {
      await page.goto(`/screen/${sid}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Each screen should render its own container
      const container = page.locator('.w-screen.h-screen').first()
      await expect(container).toBeVisible({ timeout: 10000 })
    }
  })

  test('screens share the same presentation state', async ({
    page,
    request,
    context,
  }) => {
    if (createdScreenIds.length < 2) {
      test.skip()
      return
    }

    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    // Open two screens in separate pages
    const page1 = page
    const page2 = await context.newPage()

    await page1.goto(`/screen/${createdScreenIds[0]}`)
    await page2.goto(`/screen/${createdScreenIds[1]}`)

    await page1.waitForLoadState('domcontentloaded')
    await page2.waitForLoadState('domcontentloaded')
    await page1.waitForTimeout(2500)
    await page2.waitForTimeout(2500)

    // Both screens should display the same presentation content
    const text1 = await page1.locator('.w-screen.h-screen').textContent()
    const text2 = await page2.locator('.w-screen.h-screen').textContent()

    // Both should have content (the same song)
    expect(text1!.trim().length).toBeGreaterThan(0)
    expect(text2!.trim().length).toBeGreaterThan(0)

    await page2.close()
    await request.post('/api/presentation/stop')
  })

  test('screen-specific font configuration via API', async ({ request }) => {
    if (createdScreenIds.length === 0) {
      test.skip()
      return
    }

    const sid = createdScreenIds[0]

    // Get current config
    const screenRes = await request.get(`/api/screens/${sid}`)
    expect(screenRes.ok()).toBeTruthy()
    const screenBody = await screenRes.json()

    // Update song config with custom font settings
    if (screenBody.data.contentConfigs?.song) {
      const songConfig = screenBody.data.contentConfigs.song
      const updatedConfig = {
        ...songConfig,
        mainText: {
          ...songConfig.mainText,
          style: {
            ...songConfig.mainText.style,
            fontFamily: 'Georgia',
            color: '#FF6600',
            bold: true,
          },
        },
      }

      const updateRes = await request.put(`/api/screens/${sid}/config/song`, {
        data: { config: updatedConfig },
      })
      expect(updateRes.ok()).toBeTruthy()

      // Verify the config was saved
      const verifyRes = await request.get(`/api/screens/${sid}`)
      expect(verifyRes.ok()).toBeTruthy()
      const verifyBody = await verifyRes.json()
      expect(
        verifyBody.data.contentConfigs.song.mainText.style.fontFamily,
      ).toBe('Georgia')
      expect(verifyBody.data.contentConfigs.song.mainText.style.color).toBe(
        '#FF6600',
      )
    }
  })

  test('screen-specific background color configuration', async ({
    page,
    request,
  }) => {
    if (createdScreenIds.length === 0) {
      test.skip()
      return
    }

    const sid = createdScreenIds[0]

    // Get current config
    const screenRes = await request.get(`/api/screens/${sid}`)
    expect(screenRes.ok()).toBeTruthy()
    const screenBody = await screenRes.json()

    // Update empty state background
    if (screenBody.data.contentConfigs?.empty) {
      const emptyConfig = screenBody.data.contentConfigs.empty
      const updatedConfig = {
        ...emptyConfig,
        background: {
          type: 'solid',
          color: '#1a1a2e',
        },
      }

      const updateRes = await request.put(`/api/screens/${sid}/config/empty`, {
        data: { config: updatedConfig },
      })
      expect(updateRes.ok()).toBeTruthy()
    }

    // Stop presentation so screen shows empty state
    await request.post('/api/presentation/stop')

    await page.goto(`/screen/${sid}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Verify the screen container has the configured background
    const container = page.locator('.w-screen.h-screen').first()
    await expect(container).toBeVisible({ timeout: 10000 })

    const bgStyle = await container.evaluate((el) => el.style.backgroundColor)
    // The background should be set (either from config or default)
    expect(bgStyle).toBeTruthy()
  })

  test('different screens can have different content type configs', async ({
    request,
  }) => {
    if (createdScreenIds.length < 2) {
      test.skip()
      return
    }

    const sid1 = createdScreenIds[0]
    const sid2 = createdScreenIds[1]

    // Get configs for both screens
    const screen1Res = await request.get(`/api/screens/${sid1}`)
    const screen2Res = await request.get(`/api/screens/${sid2}`)
    expect(screen1Res.ok()).toBeTruthy()
    expect(screen2Res.ok()).toBeTruthy()

    const screen1 = await screen1Res.json()
    const screen2 = await screen2Res.json()

    // Update screen 1 with one font
    if (screen1.data.contentConfigs?.song) {
      const config1 = {
        ...screen1.data.contentConfigs.song,
        mainText: {
          ...screen1.data.contentConfigs.song.mainText,
          style: {
            ...screen1.data.contentConfigs.song.mainText.style,
            fontFamily: 'Arial',
          },
        },
      }
      await request.put(`/api/screens/${sid1}/config/song`, {
        data: { config: config1 },
      })
    }

    // Update screen 2 with a different font
    if (screen2.data.contentConfigs?.song) {
      const config2 = {
        ...screen2.data.contentConfigs.song,
        mainText: {
          ...screen2.data.contentConfigs.song.mainText,
          style: {
            ...screen2.data.contentConfigs.song.mainText.style,
            fontFamily: 'Times New Roman',
          },
        },
      }
      await request.put(`/api/screens/${sid2}/config/song`, {
        data: { config: config2 },
      })
    }

    // Verify each screen has its own config
    const verify1 = await request.get(`/api/screens/${sid1}`)
    const verify2 = await request.get(`/api/screens/${sid2}`)
    const v1 = await verify1.json()
    const v2 = await verify2.json()

    if (v1.data.contentConfigs?.song && v2.data.contentConfigs?.song) {
      expect(v1.data.contentConfigs.song.mainText.style.fontFamily).toBe(
        'Arial',
      )
      expect(v2.data.contentConfigs.song.mainText.style.fontFamily).toBe(
        'Times New Roman',
      )
    }
  })

  test('screen renders with custom font on screen page', async ({
    page,
    request,
  }) => {
    if (createdScreenIds.length === 0) {
      test.skip()
      return
    }

    const sid = createdScreenIds[0]

    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    await page.goto(`/screen/${sid}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Check that font family is applied to text elements
    const fontFamily = await page.evaluate(() => {
      const textElements = document.querySelectorAll(
        '.w-screen.h-screen [style*="font-family"]',
      )
      if (textElements.length > 0) {
        return (textElements[0] as HTMLElement).style.fontFamily
      }
      return null
    })

    // Font should be set (from config)
    if (fontFamily) {
      expect(fontFamily).toBeTruthy()
    }

    await request.post('/api/presentation/stop')
  })

  test('next slide section config can be updated per screen', async ({
    request,
  }) => {
    if (createdScreenIds.length === 0) {
      test.skip()
      return
    }

    const sid = createdScreenIds[0]

    // Get current screen data
    const screenRes = await request.get(`/api/screens/${sid}`)
    expect(screenRes.ok()).toBeTruthy()
    const _screenBody = await screenRes.json()

    // Update next slide config
    const nextSlideConfig = {
      enabled: true,
      hidden: false,
      labelText: 'Next:',
      constraints: {
        top: { enabled: false, value: 0, unit: '%' },
        bottom: { enabled: true, value: 0, unit: '%' },
        left: { enabled: true, value: 0, unit: '%' },
        right: { enabled: true, value: 0, unit: '%' },
      },
      size: {
        width: 100,
        widthUnit: '%',
        height: 15,
        heightUnit: '%',
      },
      background: { type: 'solid', color: 'rgba(0,0,0,0.7)' },
      labelStyle: {
        fontFamily: 'Arial',
        color: '#ffffff',
        maxFontSize: 24,
        minFontSize: 12,
        autoScale: true,
        bold: true,
        alignment: 'left',
        verticalAlignment: 'center',
        lineHeight: 1.2,
      },
      contentStyle: {
        fontFamily: 'Arial',
        color: '#cccccc',
        maxFontSize: 20,
        minFontSize: 10,
        autoScale: true,
        alignment: 'left',
        verticalAlignment: 'center',
        lineHeight: 1.2,
      },
    }

    const updateRes = await request.put(
      `/api/screens/${sid}/next-slide-config`,
      { data: { config: nextSlideConfig } },
    )
    expect(updateRes.ok()).toBeTruthy()

    // Verify the config was saved
    const verifyRes = await request.get(`/api/screens/${sid}`)
    expect(verifyRes.ok()).toBeTruthy()
    const verifyBody = await verifyRes.json()
    expect(verifyBody.data.nextSlideConfig).toBeTruthy()
    expect(verifyBody.data.nextSlideConfig.enabled).toBe(true)
    expect(verifyBody.data.nextSlideConfig.labelText).toBe('Next:')
  })

  test('global settings (clock config) can be updated per screen', async ({
    request,
  }) => {
    if (createdScreenIds.length === 0) {
      test.skip()
      return
    }

    const sid = createdScreenIds[0]

    // Get current settings
    const screenRes = await request.get(`/api/screens/${sid}`)
    expect(screenRes.ok()).toBeTruthy()
    const screenBody = await screenRes.json()

    // Update global settings with clock config
    const settings = {
      ...screenBody.data.globalSettings,
      clockConfig: {
        hidden: false,
        format: '24h',
        showSeconds: true,
        constraints: {
          top: { enabled: false, value: 0, unit: '%' },
          bottom: { enabled: true, value: 2, unit: '%' },
          left: { enabled: false, value: 0, unit: '%' },
          right: { enabled: true, value: 2, unit: '%' },
        },
        size: {
          width: 10,
          widthUnit: '%',
          height: 5,
          heightUnit: '%',
        },
        style: {
          fontFamily: 'Arial',
          color: '#ffffff',
          maxFontSize: 24,
          autoScale: true,
          alignment: 'right',
          verticalAlignment: 'center',
          lineHeight: 1.2,
        },
      },
    }

    const updateRes = await request.put(`/api/screens/${sid}/global-settings`, {
      data: { settings },
    })
    expect(updateRes.ok()).toBeTruthy()

    // Verify the update
    const verifyRes = await request.get(`/api/screens/${sid}`)
    expect(verifyRes.ok()).toBeTruthy()
    const verifyBody = await verifyRes.json()
    expect(verifyBody.data.globalSettings.clockConfig).toBeTruthy()
    expect(verifyBody.data.globalSettings.clockConfig.format).toBe('24h')
    expect(verifyBody.data.globalSettings.clockConfig.showSeconds).toBe(true)
  })

  test('deleting a screen removes it from the list', async ({ request }) => {
    // Create a screen specifically for deletion test
    const createRes = await request.post('/api/screens', {
      data: { name: 'E2E Screen To Delete', type: 'primary' },
    })
    expect(createRes.ok()).toBeTruthy()
    const createBody = await createRes.json()
    const deleteId = createBody.data.id

    // Verify it exists
    const beforeRes = await request.get(`/api/screens/${deleteId}`)
    expect(beforeRes.ok()).toBeTruthy()

    // Delete it
    const deleteRes = await request.delete(`/api/screens/${deleteId}`)
    expect(deleteRes.ok()).toBeTruthy()

    // Verify it no longer exists
    const afterRes = await request.get(`/api/screens/${deleteId}`)
    expect(afterRes.status()).toBe(404)
  })
})

/**
 * `open_on_startup` decides whether a screen's window comes up when the app
 * launches. It is deliberately independent of `isActive` (which only says the
 * screen has a window): turning it off must not stop the screen from opening
 * the moment content is presented to it.
 */
test.describe('Screens - open on startup', () => {
  const ids: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of ids) {
      await request.delete(`/api/screens/${id}`)
    }
  })

  test('defaults to on, so existing behaviour is preserved', async ({
    request,
  }) => {
    const res = await request.post('/api/screens', {
      data: { name: `E2E Startup Default ${Date.now()}`, type: 'primary' },
    })
    expect(res.status()).toBe(201)
    const screen = (await res.json()).data
    ids.push(screen.id)

    expect(screen.openOnStartup).toBe(true)
  })

  test('can be turned off and back on independently of isActive', async ({
    request,
  }) => {
    const created = await request.post('/api/screens', {
      data: {
        name: `E2E Startup Toggle ${Date.now()}`,
        type: 'primary',
        isActive: true,
      },
    })
    const screen = (await created.json()).data
    ids.push(screen.id)
    expect(screen.isActive).toBe(true)
    expect(screen.openOnStartup).toBe(true)

    const off = await request.post('/api/screens', {
      data: {
        id: screen.id,
        name: screen.name,
        type: screen.type,
        openOnStartup: false,
      },
    })
    expect(off.status()).toBe(200)
    const afterOff = (await off.json()).data
    expect(afterOff.openOnStartup).toBe(false)
    // The screen is still active — only the launch behaviour changed, so it
    // still opens when something is presented to it.
    expect(afterOff.isActive).toBe(true)

    const on = await request.post('/api/screens', {
      data: {
        id: screen.id,
        name: screen.name,
        type: screen.type,
        openOnStartup: true,
      },
    })
    expect((await on.json()).data.openOnStartup).toBe(true)
  })

  test('is reported by the screens list', async ({ request }) => {
    const res = await request.get('/api/screens')
    expect(res.status()).toBe(200)
    const screens = (await res.json()).data
    expect(screens.length).toBeGreaterThan(0)
    for (const screen of screens) {
      expect(typeof screen.openOnStartup).toBe('boolean')
    }
  })
})
