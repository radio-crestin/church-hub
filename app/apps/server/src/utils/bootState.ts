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

/**
 * What the server is doing right now, finer than the phase: the client's
 * loading page lists these steps in plain words, with `progress` when known.
 */
export type BootStep = 'database' | 'songs' | 'bibles' | 'search' | 'finishing'

/** Done of total, for a step that counts (the song search index). */
export interface BootProgress {
  done: number
  total: number
}

/** Human-facing hint per phase — surfaced on the client loading screen. */
const PHASE_MESSAGE: Record<BootPhase, string> = {
  starting: 'Starting Church Hub',
  migrating: 'Updating the database',
  indexing: 'Building the search index',
  finalizing: 'Getting things ready',
  ready: 'Ready',
  failed: 'Startup failed',
}

/**
 * What `/health` reports about a failed boot. No stack trace: it is an HTTP
 * response; the stack goes to the log file and PostHog instead.
 */
interface BootError {
  phase: BootPhase
  message: string
}

export interface BootHealth {
  phase: BootPhase
  message: string
  ready: boolean
  /** Milliseconds since the boot sequence started. */
  elapsedMs: number
  error: BootError | null
  step: BootStep | null
  progress: BootProgress | null
  /** A new install: the database is being created and filled. */
  firstRun: boolean
}

type BootHealthListener = (health: BootHealth) => void

const startedAt = performance.now()
let currentPhase: BootPhase = 'starting'
let bootError: BootError | null = null
let currentStep: BootStep | null = null
let currentProgress: BootProgress | null = null
let firstRun = false
const listeners = new Set<BootHealthListener>()

function notify(): void {
  const health = getBootHealth()
  for (const listener of listeners) listener(health)
}

/** Calls `listener` on every boot state change; returns the unsubscribe. */
export function onBootHealthChange(listener: BootHealthListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Marks this start as a new install (no database file yet). */
export function setBootFirstRun(isFirstRun: boolean): void {
  firstRun = isFirstRun
  notify()
}

/** Moves to a new step; a repeated step keeps its progress. */
export function setBootStep(step: BootStep): void {
  if (step === currentStep) return
  currentStep = step
  currentProgress = null
  const elapsedMs = Math.round(performance.now() - startedAt)
  // biome-ignore lint/suspicious/noConsole: startup lifecycle logging
  console.log(`[boot] step=${step} elapsed=${elapsedMs}ms`)
  notify()
}

/** Progress of the current step, e.g. songs indexed of all songs. */
export function setBootProgress(done: number, total: number): void {
  currentProgress = { done, total }
  notify()
}

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
  notify()
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
  bootError = { phase, message: err.message }
  currentPhase = 'failed'
  notify()

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
    step: currentStep,
    progress: currentProgress,
    firstRun,
  }
}
