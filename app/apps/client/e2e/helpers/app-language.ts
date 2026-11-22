import type { Page } from '@playwright/test'

/**
 * Shows the app in `lang` whatever the test database's saved language: the
 * saved preference wins over localStorage, so it is answered here.
 */
export async function setAppLanguage(page: Page, lang: 'en' | 'ro') {
  await page.route('**/api/settings/app_settings/language', (route) =>
    route.fulfill({ json: { data: { key: 'language', value: lang } } }),
  )
}
