import { mkdir, stat, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { classifyDownloadError } from './classifyDownloadError'
import { fetchArtifact } from './fetchArtifact'
import type { UpdateDownloadState } from './types'
import { resolveDownloadDir } from './updateConfig'
import { createLogger } from '../../utils/logger'

const logger = createLogger('app-update')

// A dropped connection or a hiccup on GitHub's CDN should not leave the
// operator staring at an error they then fix by pressing the same button
// again. Three attempts, with a short pause between them.
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1_000, 3_000]

/**
 * One download at a time, held in module state.
 *
 * The client polls `getDownloadState()` while a download runs. A WebSocket
 * broadcast would push instead of pull, but this is a single, short-lived,
 * single-consumer operation — polling keeps the whole feature to one request
 * shape and needs no new message type.
 */
let state: UpdateDownloadState = {
  phase: 'idle',
  version: null,
  filePath: null,
  fileName: null,
  receivedBytes: 0,
  totalBytes: null,
  error: null,
  errorCode: null,
}

let abortController: AbortController | null = null

export function getDownloadState(): UpdateDownloadState {
  return { ...state }
}

/** The name the artifact is stored under — the release asset's own file name. */
function artifactNameFromUrl(url: string): string {
  try {
    return basename(new URL(url).pathname) || 'church-hub-update'
  } catch {
    return 'church-hub-update'
  }
}

/**
 * Reports an artifact for this version that is already on disk, so the operator
 * is offered "install" instead of a second download. A file is only accepted
 * when it is complete: a partial download from an interrupted attempt has a
 * `.part` suffix and is never mistaken for a finished one.
 */
export async function findDownloadedArtifact(
  url: string,
  version: string,
): Promise<UpdateDownloadState | null> {
  const dir = resolveDownloadDir()
  const fileName = artifactNameFromUrl(url)
  const filePath = join(dir, fileName)

  try {
    const info = await stat(filePath)
    if (!info.isFile() || info.size === 0) return null
    return {
      phase: 'ready',
      version,
      filePath,
      fileName,
      receivedBytes: info.size,
      totalBytes: info.size,
      error: null,
      errorCode: null,
    }
  } catch {
    return null
  }
}

/**
 * Downloads a release artifact into the configured folder.
 *
 * Written by the sidecar rather than the webview on purpose: the webview's
 * filesystem scope only covers `$HOME` and `$DOCUMENT`, so an operator pointing
 * this at an external drive would be refused. The sidecar has no such limit.
 *
 * Streams to a `.part` file and renames on completion, so an interrupted
 * download can never be mistaken for a usable installer.
 */
export async function startDownload(
  url: string,
  version: string,
): Promise<UpdateDownloadState> {
  if (state.phase === 'downloading') {
    return getDownloadState()
  }

  const existing = await findDownloadedArtifact(url, version)
  if (existing) {
    logger.info(`Update ${version} already downloaded: ${existing.filePath}`)
    state = existing
    return getDownloadState()
  }

  const dir = resolveDownloadDir()
  const fileName = artifactNameFromUrl(url)
  const filePath = join(dir, fileName)
  const partPath = `${filePath}.part`

  state = {
    phase: 'downloading',
    version,
    filePath: null,
    fileName,
    receivedBytes: 0,
    totalBytes: null,
    error: null,
    errorCode: null,
  }
  const controller = new AbortController()
  abortController = controller

  // Run detached from the request: the route answers immediately and the
  // client follows progress by polling.
  void (async () => {
    try {
      await mkdir(dir, { recursive: true })

      let received = 0
      for (let attempt = 1; ; attempt++) {
        try {
          received = await fetchArtifact(url, partPath, controller.signal, {
            onTotalBytes: (total) => {
              state = { ...state, totalBytes: total }
            },
            onReceivedBytes: (bytes) => {
              state = { ...state, receivedBytes: bytes }
            },
          })
          break
        } catch (error) {
          await unlink(partPath).catch(() => {})
          const failure = classifyDownloadError(error)
          const delay = RETRY_DELAYS_MS[attempt - 1]
          if (
            controller.signal.aborted ||
            !failure.retryable ||
            attempt >= MAX_ATTEMPTS ||
            delay === undefined
          ) {
            throw error
          }
          logger.warning(
            `Update download attempt ${attempt}/${MAX_ATTEMPTS} failed (${failure.message}); retrying in ${delay}ms`,
          )
          state = { ...state, receivedBytes: 0, totalBytes: null }
          await Bun.sleep(delay)
        }
      }

      await Bun.write(filePath, Bun.file(partPath))
      await unlink(partPath).catch(() => {})

      logger.info(`Update ${version} downloaded to ${filePath}`)
      state = {
        ...state,
        phase: 'ready',
        filePath,
        receivedBytes: received,
        totalBytes: state.totalBytes ?? received,
      }
    } catch (error) {
      await unlink(partPath).catch(() => {})
      // A cancel already put the state back to idle; nothing to report.
      if (controller.signal.aborted) return
      const failure = classifyDownloadError(error)
      logger.error(
        `Update download failed [${failure.code}]: ${failure.message}`,
      )
      state = {
        ...state,
        phase: 'error',
        error: failure.message,
        errorCode: failure.code,
      }
    } finally {
      if (abortController === controller) abortController = null
    }
  })()

  return getDownloadState()
}

/**
 * Aborts a download in flight and clears the partial file. Also dismisses a
 * failure once the operator has seen it: the state lives for as long as the
 * sidecar does, and an error from hours ago greeting them on the next visit
 * read as "the download you just asked for failed".
 */
export function cancelDownload(): void {
  abortController?.abort()
  abortController = null
  if (state.phase === 'downloading' || state.phase === 'error') {
    state = {
      ...state,
      phase: 'idle',
      receivedBytes: 0,
      totalBytes: null,
      error: null,
      errorCode: null,
    }
  }
}

/** Used by the install step to record that it has taken over. */
export function markInstalling(): void {
  state = { ...state, phase: 'installing' }
}
