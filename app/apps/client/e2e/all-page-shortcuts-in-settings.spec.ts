import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Settings > Shortcuts shows every sidebar page's shortcuts, not only Songs
 * and Bible: the other built-in pages and the custom pages sit in an "Other
 * pages" card, each with its switch-to-page keys (and focus-search keys when
 * the page has a search), stored where the sidebar item settings store them.
 */

const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'

interface SidebarItem {
  id: string
  type: string
  builtinId?: string
  order: number
  settings?: { shortcuts?: string[] }
  [key: string]: unknown
}

async function readSidebarConfig(request: APIRequestContext) {
  const response = await request.get(SIDEBAR_SETTING)
  if (response.status() === 404) return null
  const { data } = await response.json()
  return JSON.parse(data.value) as { version: number; items: SidebarItem[] }
}

async function writeSidebarConfig(request: APIRequestContext, value: string) {
  await request.post('/api/settings/app_settings', {
    data: { key: 'sidebar_configuration', value },
  })
}

test.describe('All page shortcuts in Settings > Shortcuts', () => {
  test('other built-in pages and custom pages are listed and editable', async ({
    page,
    request,
  }) => {
    const before = await request.get(SIDEBAR_SETTING)
    const original =
      before.status() === 200
        ? ((await before.json()).data.value as string)
        : null

    try {
      await page.goto('/settings/shortcuts')
      await page.waitForLoadState('networkidle')

      const otherPages = page.getByTestId('other-pages-shortcuts')
      await expect(otherPages).toBeVisible({ timeout: 10000 })

      // Songs and Bible keep their own cards, with their page keys.
      await expect(
        page.getByTestId('page-shortcuts-songs-showSlide'),
      ).toBeVisible()
      await expect(
        page.getByTestId('page-shortcuts-bible-showSlide'),
      ).toBeVisible()

      // Schedules has a search: switch and focus search, no page keys.
      await expect(
        otherPages.getByTestId('page-shortcuts-schedules-switch'),
      ).toBeVisible()
      await expect(
        otherPages.getByTestId('page-shortcuts-schedules-focus-search'),
      ).toBeVisible()
      await expect(
        otherPages.getByTestId('page-shortcuts-schedules-showSlide'),
      ).toHaveCount(0)

      // Present has no search: switching only.
      const present = otherPages.getByTestId('page-shortcuts-present-switch')
      await expect(present).toBeVisible()
      await expect(
        otherPages.getByTestId('page-shortcuts-present-focus-search'),
      ).toHaveCount(0)

      // A key recorded here is stored on the sidebar item.
      await present.getByTestId('page-shortcuts-present-switch-add').click()
      const input = present.getByRole('textbox').last()
      await input.focus()
      await input.press('Control+Shift+F8')
      await expect(input).toHaveValue(/F8/)
      await expect
        .poll(async () => {
          const config = await readSidebarConfig(request)
          return (
            config?.items.find((item) => item.builtinId === 'present')?.settings
              ?.shortcuts ?? []
          )
        })
        .toContainEqual(expect.stringMatching(/F8/))

      // A custom page shows up too, by its title.
      const config = await readSidebarConfig(request)
      if (!config) throw new Error('the sidebar configuration was not saved')
      const customId = `e2e-custom-${Date.now()}`
      const custom: SidebarItem = {
        id: customId,
        type: 'custom',
        title: 'E2E Custom Page',
        url: 'https://example.com',
        iconName: 'Globe',
        order: Math.max(...config.items.map((item) => item.order)) + 1,
        isVisible: true,
      }
      await writeSidebarConfig(
        request,
        JSON.stringify({ ...config, items: [...config.items, custom] }),
      )

      await page.reload()
      await page.waitForLoadState('networkidle')
      await expect(otherPages.getByText('E2E Custom Page')).toBeVisible({
        timeout: 10000,
      })
      await expect(
        otherPages.getByTestId(`page-shortcuts-${customId}-switch`),
      ).toBeVisible()
      await expect(
        otherPages.getByTestId(`page-shortcuts-${customId}-focus-search`),
      ).toHaveCount(0)
    } finally {
      if (original !== null) {
        await writeSidebarConfig(request, original)
      } else {
        await request.delete(SIDEBAR_SETTING).catch(() => {})
      }
    }
  })
})
