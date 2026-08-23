import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { HttpStatusError } from './HttpStatusError'

export interface FetchArtifactProgress {
  onTotalBytes: (total: number | null) => void
  onReceivedBytes: (received: number) => void
}

/**
 * One attempt at streaming the artifact into `partPath`. Resolves with the
 * number of bytes written; rejects with the underlying error so the caller
 * can decide whether another attempt is worthwhile.
 */
export async function fetchArtifact(
  url: string,
  partPath: string,
  signal: AbortSignal,
  progress: FetchArtifactProgress,
): Promise<number> {
  const response = await fetch(url, { signal, redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new HttpStatusError(response.status)
  }

  const length = response.headers.get('content-length')
  progress.onTotalBytes(length ? Number(length) : null)

  let received = 0
  const source = Readable.fromWeb(
    response.body as Parameters<typeof Readable.fromWeb>[0],
  )
  source.on('data', (chunk: Buffer) => {
    received += chunk.length
    progress.onReceivedBytes(received)
  })

  await pipeline(source, createWriteStream(partPath))
  return received
}
