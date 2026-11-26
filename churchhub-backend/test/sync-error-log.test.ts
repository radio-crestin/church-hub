import { expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import { createBucket } from '../src/sync/createBucket'
import { handleSyncError } from '../src/sync/handleSyncError'
import { redactChurchPaths } from '../src/sync/redactChurchPaths'
import type { Bindings } from '../src/types'

/**
 * An unexpected /sync error is logged without the church path secret: storage
 * errors leave the key out, and the log redacts any church prefix left. Run with `bun test` from churchhub-backend/.
 */
const PATH_SECRET = 'fake-path-secret'.padEnd(43, 'x')

test('logs a storage failure without the church path secret', async () => {
  const lines: string[] = []
  const errorSpy = spyOn(console, 'error').mockImplementation(
    (...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    }
  )
  const app = new Hono()
  app.onError(handleSyncError)
  app.get('/fail', () => {
    throw new Error(
      `S3 PUT https://s3.test/bucket/churches/c-hurch_Id1-${PATH_SECRET}/head.json failed: 500 <Key>churches/c-hurch_Id1-${PATH_SECRET}/head.json</Key>`
    )
  })

  const response = await app.request('/fail')
  errorSpy.mockRestore()

  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({
    error: 'Internal server error',
    code: 'internal',
  })
  expect(lines.join('\n')).toContain('churches/<redacted>/head.json')
  expect(lines.join('\n')).not.toContain(PATH_SECRET)
})

test('a failed list() names neither the prefix nor S3 error body', async () => {
  const prefix = `churches/c-hurch_Id1-${PATH_SECRET}/`
  const realFetch = globalThis.fetch
  let requested = ''
  globalThis.fetch = (async (input: Request | string | URL) => {
    requested = input instanceof Request ? input.url : String(input)
    return new Response(
      `<Error><Code>AccessDenied</Code><Resource>/bucket?prefix=${encodeURIComponent(prefix)}</Resource><Key>${prefix}</Key></Error>`,
      { status: 403 }
    )
  }) as typeof fetch
  const bucket = createBucket({
    S3_ENDPOINT: 'https://s3.test',
    S3_BUCKET: 'bucket',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_PUBLIC_URL: 'https://public.test',
  } as Bindings)

  const error = await bucket.list(prefix).catch((caught: Error) => caught)
  globalThis.fetch = realFetch

  expect(requested).toContain('churches%2F')
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toBe('S3 GET failed: 403 AccessDenied')
  expect((error as Error).message).not.toContain(PATH_SECRET)
})

test('the redaction also catches percent-encoded and upper-case prefixes', () => {
  const text = `GET /bucket?prefix=churches%2Fid-${PATH_SECRET}%2F and CHURCHES/id-${PATH_SECRET}/head.json and Churches%2fid-${PATH_SECRET}`
  const redacted = redactChurchPaths(text)
  expect(redacted).not.toContain(PATH_SECRET)
  expect(redacted.match(/churches\/<redacted>/g)).toHaveLength(3)
})
