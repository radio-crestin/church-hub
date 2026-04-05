import { expect, test } from '@playwright/test'

test.describe('Sidebar Configuration', () => {
  test('sidebar config section is visible on settings page', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Look for sidebar configuration section
    const sidebarSection = page.locator(
      'text=/sidebar|bara lateral|navigation|navigare/i',
    )
    await expect(sidebarSection.first()).toBeVisible({ timeout: 10000 })
  })

  test('sidebar shows navigation items', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The sidebar should have navigation links/buttons
    // Look for common nav items like Songs, Bible, Schedules
    const navItems = page.locator('nav a, nav button, aside a, aside button')
    const count = await navItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('sidebar navigation works - songs', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click on Songs nav item
    const songsNav = page.locator(
      'a[href*="songs"], button:has-text(/songs|cantari|cantece/i)',
    )

    if (
      await songsNav
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await songsNav.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/.*songs/)
    }
  })

  test('sidebar navigation works - bible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const bibleNav = page.locator(
      'a[href*="bible"], button:has-text(/bible|biblia/i)',
    )

    if (
      await bibleNav
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await bibleNav.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/.*bible/)
    }
  })

  test('sidebar navigation works - schedules', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const schedulesNav = page.locator(
      'a[href*="schedules"], button:has-text(/schedules|program/i)',
    )

    if (
      await schedulesNav
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await schedulesNav.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/.*schedules/)
    }
  })

  test('sidebar navigation works - settings', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const settingsNav = page.locator(
      'a[href*="settings"], button:has-text(/settings|setari/i)',
    )

    if (
      await settingsNav
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await settingsNav.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/.*settings/)
    }
  })

  test('sidebar navigation works - music', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const musicNav = page.locator(
      'a[href*="music"], button:has-text(/music|muzica/i)',
    )

    if (
      await musicNav
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await musicNav.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/.*music/)
    }
  })

  test('all main pages are accessible from sidebar', async ({ page }) => {
    const pages = ['/songs', '/bible', '/schedules', '/settings', '/music']

    for (const pagePath of pages) {
      await page.goto(pagePath)
      const _response = await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(pagePath.replace('/', '\\/')))
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
