import type { Page } from '@playwright/test'

/**
 * Starts every page load of this test with the main sidebar collapsed (the
 * user's saved choice). The sidebar is expanded on a fresh install, which
 * leaves the pages ~144px less room; call this in specs that measure a layout
 * written for the wider page.
 */
export async function startWithCollapsedSidebar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sidebar-collapsed', 'true')
  })
}
