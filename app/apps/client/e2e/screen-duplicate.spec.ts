import { expect, test } from '@playwright/test'

/**
 * Duplicating a screen must carry every setting over: the row's own options,
 * all content configs, the next-slide config and the OBS scene overrides — while
 * leaving the copy inactive and never handing it the preview-screen role.
 */
test.describe('Duplicate screen', () => {
  test('clones a screen with all of its settings', async ({ request }) => {
    const name = `E2E Duplicate Source ${Date.now()}`
    const createResponse = await request.post('/api/screens', {
      data: { name, type: 'stage', width: 1280, height: 720 },
    })
    expect([200, 201]).toContain(createResponse.status())
    const source = (await createResponse.json()).data as {
      id: number
      name: string
    }

    const copyIds: number[] = []

    try {
      // Give the source a non-default look, an OBS scene override and a
      // next-slide config, so a shallow copy would be visibly wrong.
      const sourceWithConfigs = await request.get(`/api/screens/${source.id}`)
      const { data: full } = await sourceWithConfigs.json()
      const songConfig = full.contentConfigs.song
      songConfig.mainText.style.maxFontSize = 123
      songConfig.mainText.style.alignment = 'left'

      expect(
        (
          await request.put(`/api/screens/${source.id}/config/song`, {
            data: { config: songConfig },
          })
        ).status(),
      ).toBe(200)

      expect(
        (
          await request.put(`/api/screens/${source.id}/global-settings`, {
            data: {
              settings: {
                ...full.globalSettings,
                defaultBackground: { type: 'color', color: '#123456' },
              },
            },
          })
        ).status(),
      ).toBe(200)

      expect(
        (
          await request.put(
            `/api/screens/${source.id}/scene-overrides/E2E%20Scene/song`,
            { data: { config: songConfig } },
          )
        ).status(),
      ).toBe(200)

      // Duplicate.
      const duplicateResponse = await request.post(
        `/api/screens/${source.id}/duplicate`,
      )
      expect(duplicateResponse.status()).toBe(201)
      const copy = (await duplicateResponse.json()).data as {
        id: number
        name: string
        type: string
        width: number
        height: number
        isActive: boolean
        isPreviewScreen: boolean
      }
      copyIds.push(copy.id)

      expect(copy.id).not.toBe(source.id)
      expect(copy.name).toBe(`${name} (copy)`)
      expect(copy.type).toBe('stage')
      expect(copy.width).toBe(1280)
      expect(copy.height).toBe(720)
      // Runtime and exclusive flags are never inherited.
      expect(copy.isActive).toBe(false)
      expect(copy.isPreviewScreen).toBe(false)

      const copyWithConfigs = await request.get(`/api/screens/${copy.id}`)
      const { data: copied } = await copyWithConfigs.json()

      expect(copied.contentConfigs.song.mainText.style.maxFontSize).toBe(123)
      expect(copied.contentConfigs.song.mainText.style.alignment).toBe('left')
      expect(copied.globalSettings.defaultBackground.color).toBe('#123456')
      expect(copied.nextSlideConfig).toEqual(full.nextSlideConfig)
      expect(Object.keys(copied.sceneOverrides)).toContain('E2E Scene')
      expect(
        copied.sceneOverrides['E2E Scene'].song.mainText.style.maxFontSize,
      ).toBe(123)

      // The source keeps its own configs — the copy is independent.
      const secondCopy = await request.post(
        `/api/screens/${source.id}/duplicate`,
      )
      expect(secondCopy.status()).toBe(201)
      copyIds.push((await secondCopy.json()).data.id)
    } finally {
      for (const id of copyIds) {
        await request.delete(`/api/screens/${id}`).catch(() => {})
      }
      await request.delete(`/api/screens/${source.id}`).catch(() => {})
    }
  })

  test('the settings button duplicates the screen it belongs to', async ({
    page,
    request,
  }) => {
    const name = `E2E Duplicate Button ${Date.now()}`
    const createResponse = await request.post('/api/screens', {
      data: { name, type: 'primary' },
    })
    expect([200, 201]).toContain(createResponse.status())
    const source = (await createResponse.json()).data as { id: number }

    const copies = async () => {
      const response = await request.get('/api/screens')
      const { data } = await response.json()
      return (data as Array<{ id: number; name: string }>).filter(
        (screen) => screen.name === `${name} (copy)`,
      )
    }

    try {
      await page.goto('/settings/screens')
      await page.waitForLoadState('networkidle')

      const card = page.locator(`[data-screen-id="${source.id}"]`)
      await expect(card).toBeVisible({ timeout: 10000 })
      await card.getByTestId('screen-duplicate').click()

      await expect
        .poll(async () => (await copies()).length, { timeout: 10000 })
        .toBe(1)
    } finally {
      for (const copy of await copies()) {
        await request.delete(`/api/screens/${copy.id}`).catch(() => {})
      }
      await request.delete(`/api/screens/${source.id}`).catch(() => {})
    }
  })

  test('returns 404 for a screen that does not exist', async ({ request }) => {
    const response = await request.post('/api/screens/99999999/duplicate')
    expect(response.status()).toBe(404)
  })
})
