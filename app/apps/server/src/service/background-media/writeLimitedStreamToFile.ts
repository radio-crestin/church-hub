import { rm } from 'node:fs/promises'

import { BackgroundMediaError } from './BackgroundMediaError'

/**
 * Streams `body` to `path` chunk by chunk and returns the number of bytes
 * written. Memory stays flat regardless of file size: each chunk is flushed
 * before the next one is pulled, which also back-pressures the socket.
 *
 * Throws a 413 {@link BackgroundMediaError} as soon as the byte count passes
 * `maxBytes` (the request body is cancelled). On any failure — over the limit,
 * client disconnect, disk error — the partial file is removed.
 *
 * Reads with an explicit reader rather than `for await`: in Bun 1.3 async
 * iteration of a request body throws "undefined is not a function" when the
 * stream was obtained before an earlier `await` (the route hands `req.body`
 * over before the media folder is created).
 */
export async function writeLimitedStreamToFile(
  body: ReadableStream<Uint8Array>,
  path: string,
  maxBytes: number,
): Promise<number> {
  const reader = body.getReader()
  const writer = Bun.file(path).writer()
  let written = 0
  let completed = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      written += value.byteLength
      if (written > maxBytes) {
        await reader.cancel()
        throw new BackgroundMediaError(
          413,
          `File is larger than the ${maxBytes}-byte limit`,
        )
      }
      writer.write(value)
      await writer.flush()
    }
    completed = true
    return written
  } finally {
    // Close before deleting: Windows refuses to remove an open file.
    await writer.end()
    if (!completed) {
      await rm(path, { force: true })
    }
  }
}
