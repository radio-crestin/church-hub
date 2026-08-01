import { createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import type { UpdateDownloadState } from './types'
import { resolveDownloadDir } from './updateConfig'
import { createLogger } from '../../utils/logger'

const logger = createLogger('app-update')

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
  }
  abortController = new AbortController()

  // Run detached from the request: the route answers immediately and the
  // client follows progress by polling.
  void (async () => {
    try {
      await mkdir(dir, { recursive: true })

      const response = await fetch(url, {
        signal: abortController?.signal,
        redirect: 'follow',
      })
      if (!response.ok || !response.body) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const length = response.headers.get('content-length')
      state = { ...state, totalBytes: length ? Number(length) : null }

      let received = 0
      const source = Readable.fromWeb(
        response.body as Parameters<typeof Readable.fromWeb>[0],
      )
      source.on('data', (chunk: Buffer) => {
        received += chunk.length
        state = { ...state, receivedBytes: received }
      })

      await pipeline(source, createWriteStream(partPath))
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
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Update download failed: ${message}`)
      await unlink(partPath).catch(() => {})
      state = { ...state, phase: 'error', error: message }
    } finally {
      abortController = null
    }
  })()

  return getDownloadState()
}

/** Aborts a download in flight and clears the partial file. */
export function cancelDownload(): void {
  abortController?.abort()
  abortController = null
  if (state.phase === 'downloading') {
    state = { ...state, phase: 'idle', receivedBytes: 0, error: null }
  }
}

/** Used by the install step to record that it has taken over. */
export function markInstalling(): void {
  state = { ...state, phase: 'installing' }
}
