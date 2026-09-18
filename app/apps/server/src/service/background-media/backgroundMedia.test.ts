import {
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BackgroundMediaError } from './BackgroundMediaError'
import { BACKGROUND_MEDIA_MAX_BYTES } from './constants'
import { deleteBackgroundMedia } from './deleteBackgroundMedia'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { listBackgroundMedia } from './listBackgroundMedia'
import { saveBackgroundMedia } from './saveBackgroundMedia'
import { serveBackgroundMedia } from './serveBackgroundMedia'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

const PNG_BYTES = new Uint8Array(4096).map((_, i) => i % 251)
const MISSING_ID = '00000000-0000-4000-8000-000000000000.png'

let tempDir: string
let previousDatabasePath: string | undefined

/** A request-like body delivered in `chunkSize` pieces, as a socket would. */
function streamOf(bytes: Uint8Array, chunkSize = 1000) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize))
      }
      controller.close()
    },
  })
}

function upload(bytes: Uint8Array, contentType: string | null = 'image/png') {
  return saveBackgroundMedia({
    body: streamOf(bytes),
    contentType,
    contentLength: String(bytes.length),
    originalName: 'test.png',
  })
}

/** Resolves the error status a promise rejects with. */
async function rejectionStatus(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(BackgroundMediaError)
  return (error as BackgroundMediaError).status
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'background-media-'))
  previousDatabasePath = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = join(tempDir, 'app.db')
})

afterEach(() => {
  if (previousDatabasePath === undefined) {
    delete process.env.DATABASE_PATH
  } else {
    process.env.DATABASE_PATH = previousDatabasePath
  }
  rmSync(tempDir, { recursive: true, force: true })
})

describe('getBackgroundMediaDir', () => {
  test('lives next to the database and follows DATABASE_PATH', () => {
    expect(getBackgroundMediaDir()).toBe(join(tempDir, 'media', 'backgrounds'))
  })
})

describe('saveBackgroundMedia', () => {
  test('streams the body to disk and describes the stored file', async () => {
    const media = await upload(PNG_BYTES)

    expect(media.id).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(media).toMatchObject({
      kind: 'image',
      mimeType: 'image/png',
      size: PNG_BYTES.length,
      url: `/api/media/backgrounds/${media.id}`,
    })
    expect(media.createdAt).toBeGreaterThan(Date.now() - 60_000)

    const stored = await Bun.file(
      join(getBackgroundMediaDir(), media.id),
    ).bytes()
    expect(stored).toEqual(PNG_BYTES)
    // No leftover temp file
    expect(readdirSync(getBackgroundMediaDir())).toEqual([media.id])
  })

  test('maps the MIME type to kind and extension, ignoring parameters', async () => {
    const media = await upload(PNG_BYTES, 'Video/MP4; codecs="avc1"')
    expect(media.kind).toBe('video')
    expect(media.mimeType).toBe('video/mp4')
    expect(media.id.endsWith('.mp4')).toBe(true)
  })

  test('rejects a missing or unsupported type with 415', async () => {
    expect(await rejectionStatus(upload(PNG_BYTES, null))).toBe(415)
    expect(await rejectionStatus(upload(PNG_BYTES, 'image/svg+xml'))).toBe(415)
    expect(await rejectionStatus(upload(PNG_BYTES, 'video/quicktime'))).toBe(
      415,
    )
  })

  test('rejects an empty body with 400', async () => {
    expect(await rejectionStatus(upload(new Uint8Array(0)))).toBe(400)
    const noBody = saveBackgroundMedia({
      body: null,
      contentType: 'image/png',
      contentLength: null,
    })
    expect(await rejectionStatus(noBody)).toBe(400)
    // A zero-byte stream without Content-Length leaves nothing behind
    const emptyStream = saveBackgroundMedia({
      body: streamOf(new Uint8Array(0)),
      contentType: 'image/png',
      contentLength: null,
    })
    expect(await rejectionStatus(emptyStream)).toBe(400)
    expect(readdirSync(getBackgroundMediaDir())).toEqual([])
  })

  test('rejects a declared size over the limit with 413 before reading', async () => {
    let pulled = false
    // highWaterMark 0: pull() only runs when someone actually reads
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true
        },
      },
      { highWaterMark: 0 },
    )
    const result = saveBackgroundMedia({
      body,
      contentType: 'image/png',
      contentLength: String(BACKGROUND_MEDIA_MAX_BYTES.image + 1),
    })
    expect(await rejectionStatus(result)).toBe(413)
    expect(pulled).toBe(false)
  })

  test('aborts a streamed body that exceeds the limit and removes the partial file', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.length
        controller.enqueue(chunk)
      },
    })
    // No Content-Length (chunked upload): the limit is enforced while reading
    const result = saveBackgroundMedia({
      body,
      contentType: 'image/png',
      contentLength: null,
    })
    expect(await rejectionStatus(result)).toBe(413)
    expect(sent).toBeLessThanOrEqual(
      BACKGROUND_MEDIA_MAX_BYTES.image + 2 * 1024 * 1024,
    )
    expect(readdirSync(getBackgroundMediaDir())).toEqual([])
  })

  test('removes the partial file when the client disconnects', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(100))
        controller.error(new Error('The connection was closed.'))
      },
    })
    const result = saveBackgroundMedia({
      body,
      contentType: 'video/webm',
      contentLength: '5000',
    })
    await expect(result).rejects.toThrow('The connection was closed.')
    expect(readdirSync(getBackgroundMediaDir())).toEqual([])
  })
})

describe('listBackgroundMedia', () => {
  test('is empty when nothing was uploaded yet', async () => {
    expect(await listBackgroundMedia()).toEqual([])
  })

  test('lists uploads newest first and skips temp or foreign files', async () => {
    const older = await upload(PNG_BYTES)
    const newer = await upload(PNG_BYTES, 'image/webp')
    const dir = getBackgroundMediaDir()
    utimesSync(join(dir, older.id), new Date(1_000_000), new Date(1_000_000))
    writeFileSync(join(dir, `.${MISSING_ID}.part`), 'partial')
    writeFileSync(join(dir, 'notes.txt'), 'stray')

    const list = await listBackgroundMedia()
    expect(list.map((m) => m.id)).toEqual([newer.id, older.id])
    expect(list[1]?.createdAt).toBe(1_000_000)
    expect(list[0]).toEqual(newer)
  })
})

describe('deleteBackgroundMedia', () => {
  test('removes the file', async () => {
    const media = await upload(PNG_BYTES)
    await deleteBackgroundMedia(media.id)
    expect(await listBackgroundMedia()).toEqual([])
  })

  test('404 for an unknown id, 400 for a malformed one', async () => {
    expect(await rejectionStatus(deleteBackgroundMedia(MISSING_ID))).toBe(404)
    for (const id of [
      '../app.db',
      '..%2Fapp.db',
      `${MISSING_ID}.part`,
      'x.png',
    ]) {
      expect(await rejectionStatus(deleteBackgroundMedia(id))).toBe(400)
    }
  })
})

describe('serveBackgroundMedia', () => {
  test('serves the whole file with caching and range headers', async () => {
    const media = await upload(PNG_BYTES)
    const response = await serveBackgroundMedia(media.id, null, false)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    )
    expect(response.headers.get('Content-Length')).toBe(
      String(PNG_BYTES.length),
    )
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES)
  })

  test('answers a range with 206 and exactly those bytes', async () => {
    const media = await upload(PNG_BYTES, 'video/mp4')
    const response = await serveBackgroundMedia(
      media.id,
      'bytes=100-199',
      false,
    )

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Range')).toBe(
      `bytes 100-199/${PNG_BYTES.length}`,
    )
    expect(response.headers.get('Content-Length')).toBe('100')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      PNG_BYTES.slice(100, 200),
    )
  })

  test('answers open and suffix ranges', async () => {
    const media = await upload(PNG_BYTES, 'video/mp4')
    const size = PNG_BYTES.length

    const open = await serveBackgroundMedia(media.id, 'bytes=4000-', false)
    expect(open.headers.get('Content-Range')).toBe(
      `bytes 4000-${size - 1}/${size}`,
    )
    expect(new Uint8Array(await open.arrayBuffer())).toEqual(
      PNG_BYTES.slice(4000),
    )

    const suffix = await serveBackgroundMedia(media.id, 'bytes=-10', false)
    expect(suffix.headers.get('Content-Range')).toBe(
      `bytes ${size - 10}-${size - 1}/${size}`,
    )
    expect(new Uint8Array(await suffix.arrayBuffer())).toEqual(
      PNG_BYTES.slice(size - 10),
    )
  })

  test('answers an unsatisfiable range with 416', async () => {
    const media = await upload(PNG_BYTES, 'video/mp4')
    const response = await serveBackgroundMedia(media.id, 'bytes=9999-', false)

    expect(response.status).toBe(416)
    expect(response.headers.get('Content-Range')).toBe(
      `bytes */${PNG_BYTES.length}`,
    )
  })

  test('HEAD returns the same status and headers without a body', async () => {
    const media = await upload(PNG_BYTES, 'video/mp4')

    const full = await serveBackgroundMedia(media.id, null, true)
    expect(full.status).toBe(200)
    expect(full.headers.get('Content-Length')).toBe(String(PNG_BYTES.length))
    expect(full.body).toBeNull()

    const partial = await serveBackgroundMedia(media.id, 'bytes=0-9', true)
    expect(partial.status).toBe(206)
    expect(partial.headers.get('Content-Length')).toBe('10')
    expect(partial.body).toBeNull()
  })

  test('404 for an unknown id, 400 for a malformed one', async () => {
    expect(
      await rejectionStatus(serveBackgroundMedia(MISSING_ID, null, false)),
    ).toBe(404)
    expect(
      await rejectionStatus(serveBackgroundMedia('../../app.db', null, false)),
    ).toBe(400)
  })
})
