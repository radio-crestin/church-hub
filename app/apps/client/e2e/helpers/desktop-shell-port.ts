import type { Page } from '@playwright/test'

/**
 * A page that stands in for the desktop shell (`__TAURI_INTERNALS__`) asks
 * for the server on the client build's port until the shell has answered
 * `get_server_config`, and code that runs at load (the usage-data check)
 * asks before that. Every worker has its own server (playwright.config.ts),
 * so the page is told its own server's port from the start.
 */
export async function pinShellServerPort(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.assign(window, {
      __serverConfig: { serverPort: Number(window.location.port) },
    })
  })
}
