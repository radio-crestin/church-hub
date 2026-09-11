import { invoke } from '@tauri-apps/api/core'
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'
import { useSyncExternalStore } from 'react'

import {
  classifyUpdateError,
  type UpdateErrorCode,
} from './classifyUpdateError'

export type UpdateDownloadPhase =
  | 'idle'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdateDownloadState {
  phase: UpdateDownloadPhase
  /** Version the store holds a handle for, without a leading "v". */
  version: string | null
  receivedBytes: number
  /** Null until the server has sent a Content-Length. */
  totalBytes: number | null
  error: string | null
  errorCode: UpdateErrorCode | null
}

export interface InstallResult {
  success: boolean
  error?: string
}

// A dropped connection or a hiccup on GitHub's CDN should not leave the
// operator staring at an error they then fix by pressing the same button
// again. Three attempts, with a short pause between them.
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1_000, 3_000]
// Progress arrives per chunk, thousands of times for one installer; the
// bar only needs a few updates a second.
const PROGRESS_FLUSH_MS = 100

const IDLE: UpdateDownloadState = {
  phase: 'idle',
  version: null,
  receivedBytes: 0,
  totalBytes: null,
  error: null,
  errorCode: null,
}

/**
 * One update at a time, held in module state and shared by everything
 * that shows it: the sidebar badge and the updates page report the same
 * download whichever of them started it, and leaving the page does not
 * lose the bytes already fetched.
 *
 * The updater plugin keeps the downloaded installer in Rust memory behind
 * the `Update` handle; this store only tracks where things stand.
 */
let state: UpdateDownloadState = IDLE
let update: Update | null = null
const listeners = new Set<() => void>()

function setState(next: Partial<UpdateDownloadState>): void {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getUpdateState(): UpdateDownloadState {
  return state
}

export function useUpdateState(): UpdateDownloadState {
  return useSyncExternalStore(subscribe, getUpdateState, getUpdateState)
}

/**
 * Hands the store the updater's handle from the latest check.
 *
 * A different version than the one already held (or a check that found
 * nothing) discards what was fetched — it would install the wrong build.
 * The same version keeps the handle that has the bytes; the new one is
 * released, since the downloaded installer belongs to the old handle.
 */
export function setPendingUpdate(next: Update | null): void {
  const version = next?.version ?? null
  if (version === state.version && update) {
    if (next && next !== update) void next.close()
    return
  }
  if (update && update !== next) void update.close()
  update = next
  setState({ ...IDLE, version })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetches the installer for the update the store holds. The plugin
 * verifies the release signature before it hands the bytes back, so a
 * download that ends in `ready` is one that passed.
 */
export async function startDownload(): Promise<void> {
  if (state.phase !== 'idle' && state.phase !== 'error') return
  const target = update
  if (!target) throw new Error('no_update')

  setState({
    phase: 'downloading',
    receivedBytes: 0,
    totalBytes: null,
    error: null,
    errorCode: null,
  })

  for (let attempt = 1; ; attempt++) {
    try {
      await target.download(trackProgress())
      if (update !== target) return
      setState({
        phase: 'ready',
        receivedBytes: state.totalBytes ?? state.receivedBytes,
      })
      return
    } catch (error) {
      if (update !== target) return
      const failure = classifyUpdateError(error)
      const delay = RETRY_DELAYS_MS[attempt - 1]
      if (
        !failure.retryable ||
        attempt >= MAX_ATTEMPTS ||
        delay === undefined
      ) {
        setState({
          phase: 'error',
          error: failure.message,
          errorCode: failure.code,
        })
        return
      }
      setState({ receivedBytes: 0, totalBytes: null })
      await sleep(delay)
    }
  }
}

function trackProgress(): (event: DownloadEvent) => void {
  let received = 0
  let lastFlush = 0
  return (event) => {
    switch (event.event) {
      case 'Started':
        received = 0
        lastFlush = Date.now()
        setState({
          receivedBytes: 0,
          totalBytes: event.data.contentLength ?? null,
        })
        return
      case 'Progress': {
        received += event.data.chunkLength
        const now = Date.now()
        if (now - lastFlush >= PROGRESS_FLUSH_MS) {
          lastFlush = now
          setState({ receivedBytes: received })
        }
        return
      }
      case 'Finished':
        setState({ receivedBytes: received })
        return
    }
  }
}

/**
 * Installs the downloaded build and restarts into it.
 *
 * The order matters. First the Rust side writes the marker the next launch
 * checks and stops the sidecar, so the installer never meets a locked
 * `church-hub-sidecar.exe`. Then the updater takes over: on Windows
 * `install()` starts the installer and exits this process — nothing after
 * it runs; on macOS the bundle is swapped in place and the app relaunches
 * itself. Any failure puts the sidecar back and keeps the current version.
 */
export async function installUpdate(): Promise<InstallResult> {
  const target = update
  if (state.phase !== 'ready' || !target) {
    return { success: false, error: 'no_downloaded_update' }
  }
  setState({ phase: 'installing', error: null, errorCode: null })

  try {
    await invoke('prepare_update_install', { version: target.version })
    await target.install()
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
    return { success: true }
  } catch (error) {
    const failure = classifyUpdateError(error)
    // biome-ignore lint/suspicious/noConsole: the install failed; keep the reason visible in the devtools too
    console.error('Update install failed:', error)
    await invoke('abort_update_install').catch((abortError: unknown) => {
      // biome-ignore lint/suspicious/noConsole: the sidecar could not be brought back; the operator has to restart
      console.error(
        'Could not restore the sidecar after a failed install:',
        abortError,
      )
    })
    setState({
      phase: 'error',
      error: failure.message,
      errorCode: failure.code === 'unknown' ? 'install' : failure.code,
    })
    return { success: false, error: failure.message }
  }
}

/**
 * Clears a failure once it has been seen. The store lives as long as the
 * window does, so without this a download that failed hours ago would
 * greet the operator as a fresh error on every visit.
 */
export function dismissUpdateError(): void {
  if (state.phase !== 'error') return
  setState({
    phase: 'idle',
    receivedBytes: 0,
    totalBytes: null,
    error: null,
    errorCode: null,
  })
}

/** Test hook: back to a fresh store. */
export function resetUpdateStoreForTests(): void {
  update = null
  state = IDLE
  listeners.clear()
}
