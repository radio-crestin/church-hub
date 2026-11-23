import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * T-038: a new install opens on an onboarding (language and theme, the pages
 * to keep in the side menu, a summary) before the app.
 */

const SIDEBAR_KEY = 'sidebar_configuration'

async function setSetting(
  request: APIRequestContext,
  key: string,
  value: string,
) {
  const res = await request.post('/api/settings/app_settings', {
    data: { key, value },
  })
  expect(res.ok()).toBeTruthy()
}

async function getSidebarConfig(request: APIRequestContext): Promise<string> {
  const res = await request.get(`/api/settings/app_settings/${SIDEBAR_KEY}`)
  const { data } = (await res.json()) as { data: { value: string } | null }
  return data?.value ?? ''
}

test.describe('first-run onboarding', () => {
  let sidebarConfig = ''

  test.beforeEach(async ({ request }) => {
    sidebarConfig = await getSidebarConfig(request)
    await setSetting(request, 'onboarding_pending', 'true')
  })

  // Leave the shared test database as the other specs expect it.
  test.afterEach(async ({ request }) => {
    await setSetting(request, 'onboarding_pending', 'false')
    if (sidebarConfig) await setSetting(request, SIDEBAR_KEY, sidebarConfig)
  })

  test('picks the pages the side menu keeps, step by step', async ({
    page,
  }) => {
    await page.goto('/')
    const onboarding = page.getByTestId('onboarding')
    await expect(onboarding).toBeVisible()
    const progress = onboarding.getByRole('progressbar')
    await expect(progress).toHaveAttribute('aria-valuenow', '33')
    await expect(
      onboarding.getByRole('heading', {
        name: /^(Welcome to Church Hub|Bun venit în Church Hub)$/,
      }),
    ).toBeVisible()

    await onboarding.getByRole('button', { name: /^(Next|Continuă)$/ }).click()
    await expect(progress).toHaveAttribute('aria-valuenow', '67')
    const gallery = onboarding.getByTestId('onboarding-feature-gallery')
    const livestream = onboarding.getByTestId('onboarding-feature-livestream')
    await expect(gallery.getByRole('checkbox')).toBeChecked()
    await gallery.click()
    await livestream.click()
    await expect(gallery.getByRole('checkbox')).not.toBeChecked()

    await onboarding.getByRole('button', { name: /^(Next|Continuă)$/ }).click()
    await expect(progress).toHaveAttribute('aria-valuenow', '100')
    const summary = onboarding.getByTestId('onboarding-summary')
    await expect(summary).toContainText(/(Songs|Cântări)/)
    await expect(summary).not.toContainText(/(Gallery|Galerie)/)

    await onboarding
      .getByRole('button', {
        name: /^(Start using Church Hub|Începe să folosești Church Hub)$/,
      })
      .click()
    await expect(onboarding).toHaveCount(0)
    const menu = page.getByRole('navigation').first()
    await expect(
      menu.getByRole('link', { name: /^(Songs|Cântări)/ }),
    ).toBeVisible()
    await expect(
      menu.getByRole('link', { name: /^(Gallery|Galerie)/ }),
    ).toHaveCount(0)
    await expect(menu.getByRole('link', { name: /^Live Stream/ })).toHaveCount(
      0,
    )

    // Done once: it doesn't come back.
    await page.reload()
    await expect(
      menu.getByRole('link', { name: /^(Songs|Cântări)/ }),
    ).toBeVisible()
    await expect(page.getByTestId('onboarding')).toHaveCount(0)
  })

  test('Skip opens the app with the side menu as it was', async ({ page }) => {
    await page.goto('/')
    const onboarding = page.getByTestId('onboarding')
    await onboarding
      .getByRole('button', { name: /^(Skip for now|Sari peste)$/ })
      .click()
    await expect(onboarding).toHaveCount(0)
    await expect(
      page
        .getByRole('navigation')
        .first()
        .getByRole('link', { name: /^(Gallery|Galerie)/ }),
    ).toBeVisible()
  })
})
