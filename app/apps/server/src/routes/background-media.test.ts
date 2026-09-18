import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { handleBackgroundMediaRoutes } from './background-media'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { RequestContext } from '../middleware/types'
import type { BackgroundMedia } from '../service/background-media'
import { BACKGROUND_MEDIA_MAX_REQUEST_BODY_BYTES } from '../service/background-media'

/**
 * Drives the route over real HTTP so Range, HEAD and status handling are
 * checked on the wire. The `X-Test-Role` header stands in for the auth
 * middleware: `editor` has displays.view + displays.edit, `viewer` has the
 * view-only set a cookie-less localhost display window gets, none → no context.
 */
const CONTEXTS: Record<string, RequestContext> = {
  editor: {
    authType: 'user',
    userId: 1,
    permissions: ['displays.view', 'displays.edit'],
  },
  viewer: { authType: 'user', permissions: ['displays.view'] },
}

const VIDEO_BYTES = new Uint8Array(10_000).map((_, i) => i % 253)

let tempDir: string
let previousDatabasePath: string | undefined
let server: ReturnType<typeof Bun.serve>
let base: string

function handleCors(req: Request, res: Response): Response {
  res.headers.set(
    'Access-Control-Allow-Origin',
    req.headers.get('Origin') ?? '*',
  )
  return res
}

function request(path: string, role: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (role) headers.set('X-Test-Role', role)
  return fetch(`${base}${path}`, { ...init, headers })
}

async function uploadVideo(): Promise<BackgroundMedia> {
  const response = await request(
    '/api/media/backgrounds?name=clip.mp4',
    'editor',
    {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: VIDEO_BYTES,
    },
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { data: BackgroundMedia }).data
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'background-media-route-'))
  previousDatabasePath = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = join(tempDir, 'app.db')

  server = Bun.serve({
    port: 0,
    maxRequestBodySize: BACKGROUND_MEDIA_MAX_REQUEST_BODY_BYTES,
    async fetch(req) {
      const role = req.headers.get('X-Test-Role')
      const context = role ? (CONTEXTS[role] ?? null) : null
      const response = await handleBackgroundMediaRoutes(
        req,
        new URL(req.url),
        handleCors,
        context,
      )
      return response ?? new Response('Not handled', { status: 599 })
    },
  })
  base = `http://127.0.0.1:${server.port}`
})

afterAll(() => {
  server.stop(true)
  if (previousDatabasePath === undefined) {
    delete process.env.DATABASE_PATH
  } else {
    process.env.DATABASE_PATH = previousDatabasePath
  }
  rmSync(tempDir, { recursive: true, force: true })
})

describe('background media routes', () => {
  test('upload returns the stored media and it is listed', async () => {
    const media = await uploadVideo()
    expect(media).toMatchObject({
      kind: 'video',
      mimeType: 'video/mp4',
      size: VIDEO_BYTES.length,
      url: `/api/media/backgrounds/${media.id}`,
    })

    const list = await request('/api/media/backgrounds', 'viewer')
    expect(list.status).toBe(200)
    const { data } = (await list.json()) as { data: BackgroundMedia[] }
    expect(data.map((m) => m.id)).toContain(media.id)
  })

  test('serves the file whole, by range, and for HEAD', async () => {
    const media = await uploadVideo()
    const path = `/api/media/backgrounds/${media.id}`

    const full = await request(path, 'viewer')
    expect(full.status).toBe(200)
    expect(full.headers.get('Accept-Ranges')).toBe('bytes')
    expect(full.headers.get('Content-Length')).toBe('10000')
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(VIDEO_BYTES)

    const partial = await request(path, 'viewer', {
      headers: { Range: 'bytes=0-1' },
    })
    expect(partial.status).toBe(206)
    expect(partial.headers.get('Content-Range')).toBe('bytes 0-1/10000')
    expect(partial.headers.get('Content-Length')).toBe('2')
    expect(new Uint8Array(await partial.arrayBuffer())).toEqual(
      VIDEO_BYTES.slice(0, 2),
    )

    const tail = await request(path, 'viewer', {
      headers: { Range: 'bytes=9000-' },
    })
    expect(tail.status).toBe(206)
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(
      VIDEO_BYTES.slice(9000),
    )

    const outside = await request(path, 'viewer', {
      headers: { Range: 'bytes=10000-' },
    })
    expect(outside.status).toBe(416)
    expect(outside.headers.get('Content-Range')).toBe('bytes */10000')

    const head = await request(path, 'viewer', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('Content-Length')).toBe('10000')
    expect((await head.arrayBuffer()).byteLength).toBe(0)
  })

  test('delete removes the file, then 404s', async () => {
    const media = await uploadVideo()
    const path = `/api/media/backgrounds/${media.id}`

    const deleted = await request(path, 'editor', { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ data: { success: true } })

    expect((await request(path, 'viewer')).status).toBe(404)
    expect((await request(path, 'editor', { method: 'DELETE' })).status).toBe(
      404,
    )
  })

  test('writes need displays.edit, reads need a context', async () => {
    const media = await uploadVideo()
    const path = `/api/media/backgrounds/${media.id}`

    const viewerUpload = await request('/api/media/backgrounds', 'viewer', {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: VIDEO_BYTES,
    })
    expect(viewerUpload.status).toBe(403)
    expect((await request(path, 'viewer', { method: 'DELETE' })).status).toBe(
      403,
    )
    expect((await request(path, null)).status).toBe(401)
    expect((await request('/api/media/backgrounds', null)).status).toBe(401)
  })

  test('validation errors use the JSON error envelope with CORS', async () => {
    const unsupported = await request('/api/media/backgrounds', 'editor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        Origin: 'tauri://localhost',
      },
      body: VIDEO_BYTES,
    })
    expect(unsupported.status).toBe(415)
    expect(unsupported.headers.get('Access-Control-Allow-Origin')).toBe(
      'tauri://localhost',
    )
    expect(((await unsupported.json()) as { error: string }).error).toContain(
      'application/pdf',
    )

    const empty = await request('/api/media/backgrounds', 'editor', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: new Uint8Array(0),
    })
    expect(empty.status).toBe(400)

    const badId = await request('/api/media/backgrounds/..%2Fapp.db', 'viewer')
    expect(badId.status).toBe(400)
    expect(await badId.json()).toEqual({ error: 'Invalid background media id' })
  })

  test('other paths are left to the next handler', async () => {
    expect((await request('/api/media/other', 'editor')).status).toBe(599)
    expect((await request('/api/media/backgrounds/a/b', 'editor')).status).toBe(
      599,
    )
  })
})
