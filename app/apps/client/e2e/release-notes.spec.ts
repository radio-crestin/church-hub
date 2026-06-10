import { expect, test } from '@playwright/test'

/**
 * Verifies the Release Notes section in Settings > About:
 *  - the section renders from the bundled changelog (offline baseline, no
 *    network dependency on the GitHub API),
 *  - at least one version entry with categorized changes is shown,
 *  - the "show all" toggle expands the full version history.
 *
 * The default `page` fixture carries the super-admin session (auth.setup.ts).
 */
test.describe('Settings · Release Notes', () => {
  test('about page shows the bundled release notes', async ({ page }) => {
    await page.goto('/settings/about')
    await page.waitForLoadState('networkidle')

    const section = page.getByTestId('release-notes-section')
    await expect(section).toBeVisible({ timeout: 10000 })

    // The section heading (releaseNotes namespace: title).
    await expect(
      section.getByRole('heading', { name: /release notes|note de lansare/i }),
    ).toBeVisible()

    // At least one version card from the bundled changelog.
    await expect(section.getByText(/^v0\.1\./).first()).toBeVisible()

    // At least one category heading is present (Features / Bug Fixes / Changes).
    await expect(
      section
        .getByText(
          /features|bug fixes|changes|funcționalități|corectări|modificări/i,
        )
        .first(),
    ).toBeVisible()
  })

  test('show-all toggle expands the full version history', async ({ page }) => {
    await page.goto('/settings/about')
    await page.waitForLoadState('networkidle')

    const section = page.getByTestId('release-notes-section')
    await expect(section).toBeVisible({ timeout: 10000 })

    const showAll = section.getByRole('button', {
      name: /show all|afișează toate/i,
    })
    // The bundled changelog has far more than the default visible count, so the
    // toggle must be present.
    await expect(showAll).toBeVisible()

    const before = await section.getByText(/^v0\.1\./).count()
    await showAll.click()
    const after = await section.getByText(/^v0\.1\./).count()
    expect(after).toBeGreaterThan(before)

    await expect(
      section.getByRole('button', { name: /show less|afișează mai puțin/i }),
    ).toBeVisible()
  })
})
