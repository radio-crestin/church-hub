import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Page actions live behind one labelled menu (`~/ui/menu/ActionMenu`), so a
 * test that used to click a bare icon button now has to open the menu first.
 * Selecting an item closes the menu, which is why every helper opens it fresh.
 */
export async function openActionsMenu(
  page: Page,
  triggerTestId: string,
): Promise<Locator> {
  const trigger = page.getByTestId(triggerTestId)
  await expect(trigger).toBeVisible({ timeout: 15000 })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  const panel = page.getByTestId(`${triggerTestId}-panel`)
  await expect(panel).toBeVisible()
  return panel
}

/** Opens the menu and hands back one of its rows. */
export async function actionsMenuItem(
  page: Page,
  triggerTestId: string,
  itemTestId: string,
): Promise<Locator> {
  await openActionsMenu(page, triggerTestId)
  return page.getByTestId(itemTestId)
}

/** Opens the menu, clicks a row, and waits for the menu to close. */
export async function selectAction(
  page: Page,
  triggerTestId: string,
  itemTestId: string,
): Promise<void> {
  const item = await actionsMenuItem(page, triggerTestId, itemTestId)
  await item.click()
  await expect(page.getByTestId(`${triggerTestId}-panel`)).toBeHidden()
}
