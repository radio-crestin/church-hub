import { expect, test } from '@playwright/test'

/**
 * T-039: a search over all settings, above the settings menu, that opens the
 * matching page and highlights the setting there.
 */
test.describe('Settings search', () => {
  test('finds a setting on another page and highlights it there', async ({
    page,
  }) => {
    await page.goto('/settings/appearance')
    const search = page.getByTestId('settings-search')
    await search.fill('debug')

    const results = page.getByTestId('settings-search-results')
    const result = results.getByRole('button', {
      name: /(Debug Mode|Mod depanare)/i,
    })
    await expect(result).toBeVisible()
    // The menu's groups give way to the results while searching.
    await expect(
      page.getByRole('link', { name: /^(Appearance|Aspect)$/ }),
    ).toHaveCount(0)

    await result.click()
    await expect(page).toHaveURL(/\/settings\/developer$/)
    const highlighted = page
      .getByTestId('settings-panel')
      .locator('[data-search-highlight]')
    await expect(highlighted).toBeVisible()
    await expect(highlighted).toBeInViewport()
  })

  test('matches a page by its name and ignores case and diacritics', async ({
    page,
  }) => {
    await page.goto('/settings/appearance')
    const search = page.getByTestId('settings-search')
    await search.fill('SHORTCÜTS')
    await search.press('Enter')
    await expect(page).toHaveURL(/\/settings\/shortcuts$/)
  })

  test('says when nothing matches, and Escape brings the menu back', async ({
    page,
  }) => {
    await page.goto('/settings/appearance')
    const search = page.getByTestId('settings-search')
    await search.fill('qwertyuiop')
    await expect(page.getByTestId('settings-search-results')).toContainText(
      /(No settings match|Nu s-a găsit nicio setare)/,
    )
    await search.press('Escape')
    await expect(search).toHaveValue('')
    await expect(
      page.getByRole('link', { name: /^(Appearance|Aspect)$/ }),
    ).toBeVisible()
  })
})
