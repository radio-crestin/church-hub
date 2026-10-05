import type { HealthSnapshot } from './healthSnapshot'
import { renderStartupProgress, updateLoadingHint } from './loadingScreen'
import { startupText } from './startupText'

/** Outcome of polling `/health` until the server is ready or we give up. */
export type StartupResult =
  | { status: 'ready'; totalWaitMs: number; attempts: number }
  | {
      status: 'boot_failed'
      phase: string
      message: string
      totalWaitMs: number
      attempts: number
    }
  | {
      status: 'unreachable' | 'stopped'
      totalWaitMs: number
      attempts: number
      lastError: string
      everReachable: boolean
    }

// Never saw a single response: the sidecar process likely failed to spawn or
// crashed before binding. Generous so a slow first launch on a cold disk isn't
// mistaken for a crash.
const UNREACHABLE_BUDGET_MS = 90_000
// Saw the boot server but it never reached `ready`: a wedged migration that
// neither completes nor throws. Surfaced as a reportable failure after this.
const STUCK_BUDGET_MS = 300_000
const LONG_HINT_AFTER_MS = 20_000
const FETCH_TIMEOUT_MS = 2000

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export interface PollOptions {
  fetchFn: FetchFn
  retryDelayMs: number
  /** Desktop: true once the bundled server process failed or exited. */
  isServerStopped?: () => Promise<boolean>
}

async function fetchHealth(
  url: string,
  fetchFn: FetchFn,
): Promise<HealthSnapshot | string> {
  // Per-attempt abort: a stale connection must not burn the whole budget.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!response.ok) return `HTTP ${response.status}`
    return ((await response.json().catch(() => null)) ?? {}) as HealthSnapshot
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'timeout'
    }
    return err instanceof Error ? err.message : 'fetch failed'
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Polls the server's `/health` until it reports `ready`, fails, or the budget
 * runs out, showing each start-up step on the loading page meanwhile. A hard
 * boot failure, or a desktop server process that stopped, ends it at once.
 */
export async function pollServerHealth(
  apiUrl: string,
  { fetchFn, retryDelayMs, isServerStopped }: PollOptions,
): Promise<StartupResult> {
  const start = performance.now()
  let everReachable = false
  let lastError = 'no response'
  let attempts = 0
  let longHintShown = false

  for (;;) {
    attempts++
    const elapsed = performance.now() - start
    const totalWaitMs = Math.round(elapsed)
    const health = await fetchHealth(`${apiUrl}/health`, fetchFn)

    if (typeof health === 'string') {
      lastError = health
      if (await isServerStopped?.()) {
        return {
          status: 'stopped',
          totalWaitMs,
          attempts,
          lastError,
          everReachable,
        }
      }
    } else {
      everReachable = true
      if (health.error) {
        // biome-ignore lint/suspicious/noConsole: startup failure logging
        console.error(
          `[client-startup] server boot failed (phase=${health.error.phase}): ${health.error.message}`,
        )
        return {
          status: 'boot_failed',
          phase: health.error.phase,
          message: health.error.message,
          totalWaitMs,
          attempts,
        }
      }
      if (health.ready) {
        // biome-ignore lint/suspicious/noConsole: startup timing logging
        console.log(
          `[client-startup] server ready: attempt=${attempts}, totalWait=${totalWaitMs}ms`,
        )
        return { status: 'ready', totalWaitMs, attempts }
      }
      renderStartupProgress(health)
    }

    if (!longHintShown && elapsed > LONG_HINT_AFTER_MS) {
      updateLoadingHint(startupText('longHint'))
      longHintShown = true
    }
    if (!everReachable && elapsed > UNREACHABLE_BUDGET_MS) {
      return {
        status: 'unreachable',
        totalWaitMs,
        attempts,
        lastError,
        everReachable,
      }
    }
    if (everReachable && elapsed > STUCK_BUDGET_MS) {
      return {
        status: 'unreachable',
        totalWaitMs,
        attempts,
        lastError: 'boot did not complete within 5 minutes',
        everReachable,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  }
}
