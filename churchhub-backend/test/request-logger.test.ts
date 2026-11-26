import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import app from '../src/index'

/**
 * The request log names the route pattern, never the raw path or query.
 * Run with `bun test` from churchhub-backend/.
 */
const ROOM_SECRET = 'roomsecret0123456789abcdefghijkl'
const OAUTH_CODE = '4/0AVGzR1Bsecret-code'

let lines: string[]
let logSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  lines = []
  logSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  })
})

afterEach(() => logSpy.mockRestore())

const env = {
  SIGNALING_KV: { get: async () => null },
  COOKIE_NAME: 'yt_oauth_state',
  COOKIE_ENCRYPTION_KEY: '00'.repeat(32),
}

test('logs the route pattern of a signaling call, not its secret', async () => {
  await app.request(
    `https://backend.test/signal/${ROOM_SECRET}/check?token=${ROOM_SECRET}`,
    {},
    env
  )
  expect(lines).toEqual([expect.stringMatching(/^GET \/signal\/:secret\/check 200 \d+ms$/)])
})

test('logs no OAuth code or state from a callback', async () => {
  await app.request(
    `https://backend.test/auth/youtube/callback?code=${encodeURIComponent(OAUTH_CODE)}&state=sealed`,
    {},
    env
  )
  expect(lines.join('\n')).not.toContain('secret-code')
  expect(lines.join('\n')).not.toContain('sealed')
  expect(lines).toEqual([expect.stringMatching(/^GET \/auth\/youtube\/callback 400 /)])
})
