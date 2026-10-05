import { expect, type Page, test } from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * The screen (monitor) editor in Settings → Screens is fully translated: in
 * Romanian no English section titles or labels are left in the sidebar.
 */

const ENGLISH_LEFTOVERS = [
  'Screen Settings',
  'Screen Size',
  'Width (px)',
  'Text Style',
  'Font Family',
  'Horizontal Alignment',
  'Vertical Alignment',
  'Bold',
  'Italic',
  'Underline',
  'Position',
  'Main Text',
  'Left',
  'Center',
  'Justify',
  'Middle',
  'System Default',
]

async function openSongEditor(page: Page, screenId: number) {
  await page.goto('/settings/screens')
  await page
    .locator(`[data-testid="screen-card"][data-screen-id="${screenId}"]`)
    .getByRole('button', {
      name: label('settings', 'sections.screens.actions.edit'),
    })
    .click()
  await expect(page.getByTestId('screen-editor-save')).toBeVisible({
    timeout: 10000,
  })
}

test('the screen editor sidebar has no English leftovers in Romanian', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/screens', {
    data: { name: `E2E i18n ${Date.now()}`, type: 'primary' },
  })
  const screenId = (await created.json()).data.id as number

  try {
    await openSongEditor(page, screenId)
    const sidebar = page.locator('body')
    await expect(
      sidebar.getByText('Setări ecran', { exact: true }),
    ).toBeVisible()

    // Select the lyrics so the element's style panels show.
    await page.getByTestId('screen-editor-content-type').click()
    await page
      .getByTestId('screen-editor-content-type-option')
      .filter({ hasText: label('presentation', 'screens.contentTypes.song') })
      .locator('button')
      .first()
      .click()
    await page.getByText('Mărire Domnului!').first().click()
    await expect(
      sidebar
        .getByText(label('presentation', 'screens.textStyle.fontFamily'))
        .first(),
    ).toBeVisible()

    for (const text of ENGLISH_LEFTOVERS) {
      await expect(sidebar.getByText(text, { exact: true })).toHaveCount(0)
    }
  } finally {
    await request.delete(`/api/screens/${screenId}`)
  }
})
