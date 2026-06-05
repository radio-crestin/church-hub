/**
 * Centralised server boot state.
 *
 * The sidecar runs DB migrations, FTS index rebuilds and data seeding before
 * it can serve real requests. On a fresh install — or the first launch after
 * an update that ships a new migration — that work can take several seconds,
 * and historically if any step threw BEFORE `Bun.serve()` bound, the process
 * died silently: `/ping` never answered, so the desktop shell sat on a blank
 * screen with an endless spinner.
 *
 * This module turns that opaque window into an observable, reportable boot
 * lifecycle. A lightweight boot HTTP server answers `/health` from t=0 with
 * the current {@link BootPhase}; the client renders real progress and, on a
 * hard failure, the actual error instead of a generic timeout. Failures are
 * mirrored to PostHog and the on-disk log so we hear about them in the field.
 */

import { logToFile } from './fileLogger'
import { captureException, captureMessage } from './posthog'

export type BootPhase =
  | 'starting'
  | 'migrating'
  | 'indexing'
  | 'finalizing'
  | 'ready'
  | 'failed'

/** Human-facing hint per phase — surfaced on the client loading screen. */
const PHASE_MESSAGE: Record<BootPhase, string> = {
  starting: 'Starting Church Hub',
  migrating: 'Updating the database',
  indexing: 'Building the search index',
  finalizing: 'Getting things ready',
  ready: 'Ready',
  failed: 'Startup failed',
}

interface BootError {
  phase: BootPhase
  message: string
  stack?: string
}

interface BootHealth {
  phase: BootPhase
  message: string
  ready: boolean
  /** Milliseconds since the boot sequence started. */
  elapsedMs: number
  error: BootError | null
}

const startedAt = performance.now()
let currentPhase: BootPhase = 'starting'
let bootError: BootError | null = null

/**
 * Advance to a new boot phase. The transition is logged to console + file so a
 * field log shows exactly where a slow or stuck boot got to.
 */
export function setBootPhase(phase: BootPhase): void {
  currentPhase = phase
  const elapsedMs = Math.round(performance.now() - startedAt)
  // biome-ignore lint/suspicious/noConsole: startup lifecycle logging
  console.log(`[boot] phase=${phase} elapsed=${elapsedMs}ms`)
  logToFile('boot', 'info', `phase=${phase}`, { elapsedMs })
}

/** Mark the server as fully ready to serve real requests. */
export function setBootReady(): void {
  setBootPhase('ready')
}

/**
 * Record a fatal startup failure. The boot server stays up afterwards so the
 * client can read the reason from `/health` and surface it (with a report
 * action) instead of spinning forever. Mirrored to PostHog + the log file.
 */
export function setBootFailed(phase: BootPhase, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error))
  bootError = { phase, message: err.message, stack: err.stack }
  currentPhase = 'failed'

  const elapsedMs = Math.round(performance.now() - startedAt)
  // biome-ignore lint/suspicious/noConsole: startup failure logging
  console.error(`[boot] FAILED during phase=${phase}: ${err.message}`)
  logToFile('boot', 'error', `FAILED during phase=${phase}: ${err.message}`, {
    elapsedMs,
    stack: err.stack,
  })

  captureException(err, { source: 'server-boot', boot_phase: phase, elapsedMs })
  captureMessage(
    `Server boot failed during ${phase}: ${err.message}`,
    'error',
    {
      boot_phase: phase,
      elapsedMs,
    },
  )
}

export function isBootReady(): boolean {
  return currentPhase === 'ready'
}

export function getBootPhase(): BootPhase {
  return currentPhase
}

/** Snapshot consumed by the `/health` endpoint. */
export function getBootHealth(): BootHealth {
  return {
    phase: currentPhase,
    message: PHASE_MESSAGE[currentPhase],
    ready: currentPhase === 'ready',
    elapsedMs: Math.round(performance.now() - startedAt),
    error: bootError,
  }
}
