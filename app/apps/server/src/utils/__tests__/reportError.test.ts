import { beforeEach, describe, expect, it, mock } from 'bun:test'

// reportError composes the on-disk logger + PostHog. Mock both (completely —
// mock.module is global for the run, so every export the real module has must
// be present or an unrelated test that imports a missing name would break) and
// assert it fans out to BOTH sinks.
const calls: {
  logs: Array<{
    category: string
    level: string
    message: string
    data?: unknown
  }>
  exceptions: Array<{ err: unknown; extra?: unknown }>
  messages: Array<{ msg: string; level: string; extra?: unknown }>
} = { logs: [], exceptions: [], messages: [] }

mock.module('../fileLogger', () => ({
  logToFile: (
    category: string,
    level: string,
    message: string,
    data?: unknown,
  ) => calls.logs.push({ category, level, message, data }),
  log: () => {},
  midiLogger: { debug() {}, info() {}, warn() {}, error() {} },
  wsLogger: { debug() {}, info() {}, warn() {}, error() {} },
}))

mock.module('../posthog', () => ({
  captureException: (err: unknown, extra?: unknown) =>
    calls.exceptions.push({ err, extra }),
  captureMessage: (msg: string, level: string, extra?: unknown) =>
    calls.messages.push({ msg, level, extra }),
  captureAppStarted: () => {},
  captureFeedbackReport: () => {},
  flushPostHog: async () => {},
  shutdownPostHog: async () => {},
}))

describe('reportError', () => {
  beforeEach(() => {
    calls.logs = []
    calls.exceptions = []
    calls.messages = []
  })

  it('writes the error to BOTH the log file and PostHog', async () => {
    const { reportError } = await import('../reportError')
    const err = new Error('disk is full')
    reportError(err, 'fts-rebuild', { table: 'songs' })

    expect(calls.logs).toHaveLength(1)
    expect(calls.logs[0]?.category).toBe('fts-rebuild')
    expect(calls.logs[0]?.level).toBe('error')
    expect(calls.logs[0]?.message).toBe('disk is full')
    expect((calls.logs[0]?.data as { table: string }).table).toBe('songs')
    expect((calls.logs[0]?.data as { stack?: string }).stack).toBeDefined()

    expect(calls.exceptions).toHaveLength(1)
    expect(calls.exceptions[0]?.err).toBe(err)
    expect((calls.exceptions[0]?.extra as { source: string }).source).toBe(
      'fts-rebuild',
    )
  })

  it('coerces non-Error throwables before reporting', async () => {
    const { reportError } = await import('../reportError')
    reportError('plain string boom', 'migration')
    expect(calls.logs[0]?.message).toBe('plain string boom')
    expect(calls.exceptions[0]?.err).toBeInstanceOf(Error)
  })

  it('reportWarning writes a warning to BOTH sinks', async () => {
    const { reportWarning } = await import('../reportError')
    reportWarning('slow query', 'db', { ms: 3000 })

    expect(calls.logs).toHaveLength(1)
    expect(calls.logs[0]?.level).toBe('warn')
    expect(calls.logs[0]?.message).toBe('slow query')

    expect(calls.messages).toHaveLength(1)
    expect(calls.messages[0]?.level).toBe('warning')
    expect(calls.messages[0]?.msg).toBe('slow query')
    expect((calls.messages[0]?.extra as { source: string }).source).toBe('db')
  })
})
