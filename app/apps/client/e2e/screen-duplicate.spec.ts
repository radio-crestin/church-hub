import { expect, test } from '@playwright/test'

/**
 * Duplicating a screen must carry every setting over: the row's own options,
 * a copy of its template (every layout, the next-slide config) and its OBS
 * scene templates — while leaving the copy inactive and never handing it the
 * preview-screen role.
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
    // The screens' own templates and the scene's, deleted with them.
    const templateIds: number[] = []

    try {
      // Give the source a non-default look, an OBS scene override and a
      // next-slide config, so a shallow copy would be visibly wrong.
      const sourceWithConfigs = await request.get(`/api/screens/${source.id}`)
      const { data: full } = await sourceWithConfigs.json()
      templateIds.push(full.templateId)
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

      const sceneTemplate = await request.post('/api/slide-templates', {
        data: { name: `${name} scene`, fromId: full.templateId },
      })
      expect(sceneTemplate.status()).toBe(201)
      const sceneTemplateId = (await sceneTemplate.json()).data.id as number
      templateIds.push(sceneTemplateId)
      expect(
        (
          await request.put(
            `/api/screens/${source.id}/scene-templates/E2E%20Scene`,
            { data: { templateId: sceneTemplateId } },
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
      expect(copied.sceneTemplates).toEqual({ 'E2E Scene': sceneTemplateId })
      // Its own template is a copy: changing one never changes the other.
      expect(copied.templateId).not.toBe(full.templateId)
      templateIds.push(copied.templateId)

      // The source keeps its own configs — the copy is independent.
      const secondCopy = await request.post(
        `/api/screens/${source.id}/duplicate`,
      )
      expect(secondCopy.status()).toBe(201)
      const second = (await secondCopy.json()).data
      copyIds.push(second.id)
      templateIds.push(second.templateId)
    } finally {
      for (const id of copyIds) {
        await request.delete(`/api/screens/${id}`).catch(() => {})
      }
      await request.delete(`/api/screens/${source.id}`).catch(() => {})
      for (const id of templateIds) {
        await request.delete(`/api/slide-templates/${id}`).catch(() => {})
      }
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
