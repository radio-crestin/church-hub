import { expect, type Page, test } from '@playwright/test'

/**
 * The mouse's back/forward side buttons and the keyboard's Alt+←/→ (⌘[ / ⌘]
 * on macOS) go to the previous / next page everywhere in the app, the desktop
 * app included, whose webview does not do it by itself. Typing in a field
 * on macOS keeps Option+← for the field (it moves by a word there).
 */

const RECORD_DIR = process.env.RECORD_DIR

if (RECORD_DIR) {
  test.use({
    viewport: { width: 1920, height: 1080 },
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
  })
}

const sidebarLink = (page: Page, name: RegExp) =>
  page.getByTestId('main-sidebar').getByRole('link', { name })

/** Presses a mouse side button the way a webview reports it: 3 back, 4 forward. */
async function pressMouseSideButton(page: Page, button: 3 | 4) {
  await page.evaluate((which) => {
    for (const type of ['mousedown', 'mouseup'] as const) {
      document.body.dispatchEvent(
        new MouseEvent(type, {
          button: which,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
  }, button)
}

/** Opens Songs, then Bible, then Settings from the sidebar. */
async function visitThreePages(page: Page) {
  await page.goto('/songs')
  await expect(page).toHaveURL(/\/songs/)
  await sidebarLink(page, /^(Bible|Biblia)\b/).click()
  await expect(page).toHaveURL(/\/bible/)
  await sidebarLink(page, /^(Settings|Setări)$/).click()
  await expect(page).toHaveURL(/\/settings/)
}

const pause = (page: Page) => page.waitForTimeout(RECORD_DIR ? 1200 : 0)

test.describe('Back and forward navigation', () => {
  test('mouse side buttons go back and forward', async ({ page }) => {
    await visitThreePages(page)
    await pause(page)

    await pressMouseSideButton(page, 3)
    await expect(page).toHaveURL(/\/bible/)
    await pause(page)
    await pressMouseSideButton(page, 3)
    await expect(page).toHaveURL(/\/songs/)
    await pause(page)

    await pressMouseSideButton(page, 4)
    await expect(page).toHaveURL(/\/bible/)
    await pause(page)
  })

  test('Alt+Left and Alt+Right go back and forward', async ({ page }) => {
    // Alt+←/→ is the Windows/Linux shortcut; on a Mac runner it would be ⌘[ / ⌘].
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' })
    })
    await visitThreePages(page)
    await pause(page)

    await page.keyboard.press('Alt+ArrowLeft')
    await expect(page).toHaveURL(/\/bible/)
    await pause(page)
    await page.keyboard.press('Alt+ArrowRight')
    await expect(page).toHaveURL(/\/settings/)
    await pause(page)
  })

  test('on macOS, Option+Left in a text field stays there and Cmd+[ goes back', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })
    })
    await page.goto('/songs')
    await sidebarLink(page, /^(Bible|Biblia)\b/).click()
    await expect(page).toHaveURL(/\/bible/)

    await page.getByRole('textbox').first().click()
    await page.keyboard.press('Alt+ArrowLeft')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(/\/bible/)

    await page.keyboard.press('Meta+BracketLeft')
    await expect(page).toHaveURL(/\/songs/)
  })
})
