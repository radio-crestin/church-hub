import { expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * T-165: leaving a new song asked to discard changes even when nothing was
 * typed, because a new song with no saved state counted as changed. An
 * untouched one now closes quietly; one with something typed still asks.
 */
test.describe('New song: discard prompt', () => {
  test.beforeEach(async ({ page }) => {
    await setAppLanguage(page, 'en')
  })

  test('an untouched new song closes without a prompt', async ({ page }) => {
    await page.goto('/songs/new')
    await page.getByTestId('song-editor-done').click()
    await expect(page).toHaveURL(/\/songs\/?(\?|$)/)
    await expect(page.getByText('Unsaved Changes')).toBeHidden()
  })

  test('a new song with a typed title asks first', async ({ page }) => {
    await page.goto('/songs/new')
    await page.getByPlaceholder('Enter song title...').fill('Half-typed song')
    await page.getByTestId('song-editor-done').click()
    await expect(
      page.getByRole('heading', { name: 'Unsaved Changes' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/songs\/new/)
  })
})
