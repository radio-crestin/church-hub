import { expect, type Page, test } from '@playwright/test'

/**
 * The desktop window opens at once and its loading page follows the local
 * server's start: each step in plain words, the song-search progress, and on
 * a failure the reason with a way forward. The page runs only inside the
 * desktop shell, so the shell's commands are stubbed and /health is scripted.
 */

interface ScriptedHealth {
  phase?: string
  step?: string
  progress?: { done: number; total: number } | null
  firstRun?: boolean
  ready?: boolean
  error?: { phase: string; message: string } | null
}

/** Makes the page believe it runs in the desktop shell. */
async function stubDesktopShell(page: Page, { serverStopped = false } = {}) {
  await page.addInitScript((stopped) => {
    const calls: string[] = []
    const state = { serverStopped: stopped }
    Object.assign(window, {
      __shellCalls: calls,
      __shellState: state,
      __TAURI_INTERNALS__: {
        metadata: { currentWindow: { label: 'main' }, currentWebview: {} },
        transformCallback: () => 0,
        invoke: async (command: string) => {
          calls.push(command)
          if (command === 'get_server_config') {
            return {
              serverPort: Number(window.location.port),
              serverStopped: state.serverStopped,
            }
          }
          if (command === 'restart_server') {
            state.serverStopped = false
            return null
          }
          return null
        },
      },
    })
  }, serverStopped)
}

/** Answers /health with whatever `next` holds; `null` lets the real server answer. */
async function scriptHealth(page: Page) {
  const script: { next: ScriptedHealth | 'refused' | null } = { next: null }
  await page.route('**/health', async (route) => {
    const next = script.next
    if (next === null) return route.continue()
    if (next === 'refused') return route.abort('connectionrefused')
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ready: false, error: null, ...next }),
    })
  })
  return script
}

const loadingMessage = (page: Page) => page.locator('#loading-message')
const stepState = (page: Page, step: string) =>
  page.locator(`#loading-steps li[data-step="${step}"]`)

test.describe('start-up loading page', () => {
  test('a first start shows each step, the search progress, then the app', async ({
    page,
  }) => {
    await stubDesktopShell(page)
    const health = await scriptHealth(page)
    health.next = { phase: 'migrating', step: 'songs', firstRun: true }
    await page.goto('/')

    await expect(loadingMessage(page)).toHaveText('Adding the songs')
    await expect(stepState(page, 'database')).toHaveAttribute(
      'data-state',
      'done',
    )
    await expect(stepState(page, 'songs')).toHaveAttribute(
      'data-state',
      'active',
    )
    await expect(stepState(page, 'finishing')).toHaveAttribute(
      'data-state',
      'pending',
    )
    await expect(page.locator('#loading-hint')).toHaveText(
      'First start: setting everything up. This happens only once.',
    )

    health.next = {
      phase: 'indexing',
      step: 'search',
      firstRun: true,
      progress: { done: 12000, total: 26463 },
    }
    await expect(loadingMessage(page)).toHaveText('Preparing song search')
    await expect(page.locator('#loading-progress-label')).toHaveText(
      '12,000 of 26,463 songs',
    )
    await expect(page.locator('#loading-progress')).toHaveAttribute(
      'aria-valuenow',
      '45',
    )
    await expect(stepState(page, 'bibles')).toHaveAttribute(
      'data-state',
      'done',
    )

    // A quick step after the seeds never moves the list backwards.
    health.next = { phase: 'indexing', step: 'database', firstRun: true }
    await page.waitForTimeout(600)
    await expect(loadingMessage(page)).toHaveText('Preparing song search')

    health.next = null
    await expect(page.locator('#loading-screen')).toHaveCount(0)
  })

  test('a normal start shows no step list', async ({ page }) => {
    await stubDesktopShell(page)
    const health = await scriptHealth(page)
    health.next = { phase: 'migrating', step: 'database', firstRun: false }
    await page.goto('/')

    await expect(loadingMessage(page)).toHaveText('Preparing the database')
    await expect(page.locator('#loading-steps')).toBeHidden()
    await expect(page.locator('#loading-progress')).toBeHidden()
    health.next = null
    await expect(page.locator('#loading-screen')).toHaveCount(0)
  })

  test('a failed step says why and offers a retry', async ({ page }) => {
    await stubDesktopShell(page)
    const health = await scriptHealth(page)
    health.next = {
      phase: 'failed',
      error: { phase: 'migrating', message: 'migration 0042 failed' },
    }
    await page.goto('/')

    await expect(loadingMessage(page)).toHaveText(
      'Church Hub could not finish starting',
    )
    await expect(page.locator('#loading-detail')).toHaveText(
      'migration 0042 failed',
    )
    const retry = page.locator('#loading-retry')
    await expect(retry).toHaveText('Retry')

    health.next = null
    await retry.click()
    await expect(page.locator('#loading-screen')).toHaveCount(0)
  })

  test('a stopped server is offered a restart at once', async ({ page }) => {
    await stubDesktopShell(page, { serverStopped: true })
    const health = await scriptHealth(page)
    health.next = 'refused'
    await page.goto('/')

    await expect(loadingMessage(page)).toHaveText(
      "Church Hub's local server stopped",
      { timeout: 5000 },
    )
    const restart = page.locator('#loading-retry')
    await expect(restart).toHaveText('Restart the server')

    health.next = null
    await restart.click()
    await expect(page.locator('#loading-screen')).toHaveCount(0)
    const calls = await page.evaluate(
      () => (window as unknown as { __shellCalls: string[] }).__shellCalls,
    )
    expect(calls).toContain('restart_server')
  })

  test('the loading page speaks Romanian when the app does', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('church-hub-language', 'ro'),
    )
    await stubDesktopShell(page)
    const health = await scriptHealth(page)
    health.next = {
      phase: 'indexing',
      step: 'search',
      firstRun: true,
      progress: { done: 12000, total: 26463 },
    }
    await page.goto('/')

    await expect(loadingMessage(page)).toHaveText(
      'Pregătim căutarea cântărilor',
    )
    await expect(page.locator('#loading-progress-label')).toHaveText(
      'Cântări: 12.000 din 26.463',
    )
    health.next = null
    await expect(page.locator('#loading-screen')).toHaveCount(0)
  })
})
