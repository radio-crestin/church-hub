import { expect, test } from 'bun:test'
import app from '../src/index'

/**
 * Body limits hold for a streamed body that declares no Content-Length.
 * Run with `bun test` from churchhub-backend/.
 */
function streamedBody(bytes: number): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(1024 * 1024).fill(32)
  let sent = 0
  return new ReadableStream({
    pull(controller) {
      if (sent >= bytes) return controller.close()
      controller.enqueue(chunk)
      sent += chunk.length
    },
  })
}

function post(path: string, bytes: number) {
  return app.request(
    `https://backend.test${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: streamedBody(bytes),
      duplex: 'half',
    } as RequestInit,
    {
      FEATURE_REQUEST_RATE_LIMITER: { limit: async () => ({ success: true }) },
    }
  )
}

test('a /sync body over 8 MB is refused while it streams', async () => {
  const response = await post('/sync/churches', 9 * 1024 * 1024)
  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ code: 'too_large' })
})

test('an owner route body over 8 MB is refused too', async () => {
  const response = await post('/sync/owner/churches/abc/transfer', 9 * 1024 * 1024)
  expect(response.status).toBe(413)
})

test('a feature request body over 8 MB is refused while it streams', async () => {
  const response = await post('/feature-requests', 9 * 1024 * 1024)
  expect(response.status).toBe(413)
})

test('a token refresh body over 16 KB is refused', async () => {
  const response = await post('/auth/youtube/refresh', 64 * 1024)
  expect(response.status).toBe(413)
})
