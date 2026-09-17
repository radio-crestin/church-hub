import type { Page } from '@playwright/test'

/**
 * Fires a configured Next/Prev shortcut (Settings → Shortcuts) the way the app
 * receives one. Those keys are held OS-wide by the desktop shell, so a browser
 * cannot press them; the shortcut manager hands every one it catches to the
 * page as this event, and that hand-off is what runs here.
 */
export async function pressNavigationShortcut(
  page: Page,
  direction: 'next' | 'prev',
  shortcut: string,
): Promise<void> {
  await page.evaluate(
    ([eventDirection, eventShortcut]) => {
      window.dispatchEvent(
        new CustomEvent('navigation-shortcut', {
          detail: { direction: eventDirection, shortcut: eventShortcut },
          cancelable: true,
        }),
      )
    },
    [direction, shortcut] as const,
  )
}
