import { expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import { handleSyncError } from '../src/sync/handleSyncError'

/**
 * An unexpected /sync error is logged without the church path secret its
 * message names. Run with `bun test` from churchhub-backend/.
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
