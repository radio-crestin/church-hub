import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Default sidebar keys run F4 upward in the sidebar's order, so F5 opens Songs
 * with its search focused. On an open song F5 keeps its presenter-remote
 * meaning: it presents the selected slide and stays on the song.
 */

const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'

async function sidebarKeys(
  request: APIRequestContext,
): Promise<Record<string, string | undefined>> {
  const { data } = await (await request.get(SIDEBAR_SETTING)).json()
  const config = JSON.parse(data.value) as {
    items: Array<{ builtinId?: string; settings?: { shortcuts?: string[] } }>
  }
  return Object.fromEntries(
    config.items
      .filter((item) => item.builtinId)
      .map((item) => [item.builtinId, item.settings?.shortcuts?.[0]]),
  )
}

test.describe('Songs F5 shortcut', () => {
  test.describe.configure({ mode: 'serial' })

  test('default page keys run F4 upward in sidebar order', async ({
    request,
  }) => {
    const keys = await sidebarKeys(request)
    expect(keys).toMatchObject({
      present: 'F4',
      songs: 'F5',
      bible: 'F6',
      schedules: 'F7',
    })
  })

  test('F5 opens Songs with the search focused', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    )

    await page.keyboard.press('F5')

    await expect(page).toHaveURL(/\/songs\/?(\?.*)?$/)
    await expect(page.getByPlaceholder(/search|caut/i).first()).toBeFocused()
  })

  test('F5 on an open song presents it and stays on the song', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    const created = await request.post('/api/songs', {
      data: {
        title: `E2E F5 ${Date.now()}`,
        slides: [{ content: 'F5 slide 1', type: 'verse' }],
      },
    })
    const songId = (await created.json()).data.id as number
    const presentedSongId = async () => {
      const { data } = await (
        await request.get('/api/presentation/state')
      ).json()
      return data?.temporaryContent?.data?.songId ?? null
    }

    try {
      await page.goto(`/songs/${songId}`)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      )

      await page.keyboard.press('F5')

      await expect.poll(presentedSongId, { timeout: 10000 }).toBe(songId)
      await expect(page).toHaveURL(new RegExp(`/songs/${songId}`))
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${songId}`).catch(() => {})
    }
  })
})
