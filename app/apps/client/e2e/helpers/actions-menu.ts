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
  const panel = page.getByTestId(`${triggerTestId}-panel`)

  if ((await trigger.getAttribute('aria-expanded')) === 'true') {
    await expect(panel).toBeVisible()
    return panel
  }

  // dnd-kit's pointer sensor (see e.g. SongBookmarksPanel's useSensor call)
  // installs a document-level, capture-phase `click` listener the moment a
  // drag starts, and only tears it down ~50ms AFTER the drop
  // (AbstractPointerSensor#detach uses `setTimeout(removeAll, 50)`). That
  // listener stops propagation, which is deliberate: it swallows the
  // synthetic click a browser fires from the drag's own mousedown/mouseup.
  // But it also swallows a *real* click on this trigger if it lands in that
  // window - which a script can do (e.g. right after `page.mouse.up()`) even
  // though a human moving the mouse to the trigger can't. When that happens
  // the click never reaches ActionMenu's onClick, so aria-expanded stays
  // false and the panel never mounts. Retry the click a few times with short
  // waits rather than failing outright - this costs nothing when the first
  // click lands cleanly (the common case), and only pays the retry cost
  // right after a drag.
  for (let attempt = 1; ; attempt++) {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click()
    }
    try {
      await expect(panel).toBeVisible({ timeout: 200 })
      return panel
    } catch (error) {
      if (attempt >= 5) throw error
    }
  }
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
