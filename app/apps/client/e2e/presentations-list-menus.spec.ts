import { expect, test } from '@playwright/test'

import { openActionsMenu } from './helpers/actions-menu'

/**
 * On the Prezentări list, loading a presentation from a file and saving one to
 * a file sit under "more" menus (T-016): the page's ⋮ beside "Prezentare nouă",
 * and each card's own ⋮, which opens without opening the presentation.
 */
test('loading and saving files sit in the list and card menus', async ({
  page,
  request,
}) => {
  const title = `E2E List Menus ${Date.now()}`
  const res = await request.post('/api/schedules', { data: { title } })
  expect(res.ok()).toBeTruthy()
  const { id } = (await res.json()).data as { id: number }

  try {
    await page.goto('/schedules')
    const card = page.getByRole('button').filter({ hasText: title })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: /^(Import|Importa|Importă)$/ }),
    ).toHaveCount(0)

    const pageMenu = await openActionsMenu(page, 'schedules-actions-menu')
    await expect(
      pageMenu.getByTestId('schedules-import-from-file-action'),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(pageMenu).toBeHidden()

    const cardMenu = card.getByTestId('schedule-card-actions-menu')
    await cardMenu.click()
    await expect(
      page.getByTestId('schedule-card-save-to-file-action'),
    ).toBeVisible()
    // Opening the card's menu does not open the presentation.
    await expect(page).toHaveURL(/\/schedules\/?$/)
  } finally {
    await request.delete(`/api/schedules/${id}`)
  }
})
