// biome-ignore-all lint/suspicious/noConsole: Tests stub console to keep output quiet
import { beforeEach, describe, expect, it, mock } from 'bun:test'

// bootState pulls in PostHog (network client) and the file logger at import
// time. Replace both with spies BEFORE importing it so the unit test stays
// hermetic and we can assert the failure-reporting side effects.
const captured: {
  exceptions: Array<{ err: unknown; extra?: unknown }>
  messages: Array<{ msg: string; level: string; extra?: unknown }>
} = { exceptions: [], messages: [] }

// NOTE: mock.module is GLOBAL for the whole `bun test` run, so the mock must
// export EVERY name the real module does — otherwise an unrelated test file
// that imports a different export breaks. We mock only PostHog (to spy on the
// failure-reporting side effects and avoid network); fileLogger is left real
// (logToFile silently no-ops when it can't write).
mock.module('../posthog', () => ({
  captureException: (err: unknown, extra?: unknown) =>
    captured.exceptions.push({ err, extra }),
  captureMessage: (msg: string, level: string, extra?: unknown) =>
    captured.messages.push({ msg, level, extra }),
  captureAppStarted: () => {},
  captureFeedbackReport: () => {},
  flushPostHog: async () => {},
  shutdownPostHog: async () => {},
}))

// Silence the lifecycle logging the module emits.
const origLog = console.log
const origError = console.error
console.log = () => {}
console.error = () => {}

describe('bootState', () => {
  beforeEach(() => {
    captured.exceptions = []
    captured.messages = []
  })

  it('starts in the "starting" phase and is not ready', async () => {
    const boot = await import('../bootState')
    const health = boot.getBootHealth()
    expect(health.phase).toBe('starting')
    expect(health.ready).toBe(false)
    expect(health.error).toBeNull()
    expect(boot.isBootReady()).toBe(false)
  })

  it('advances through phases and exposes a localized message', async () => {
    const boot = await import('../bootState')
    boot.setBootPhase('migrating')
    expect(boot.getBootPhase()).toBe('migrating')
    expect(boot.getBootHealth().message).toBe('Updating the database')

    boot.setBootPhase('indexing')
    expect(boot.getBootHealth().message).toBe('Building the search index')
    expect(boot.getBootHealth().ready).toBe(false)
  })

  it('records a failure: phase=failed, error payload, PostHog capture', async () => {
    const boot = await import('../bootState')
    const err = new Error('migration 0042 failed: no such column')
    boot.setBootFailed('migrating', err)

    const health = boot.getBootHealth()
    expect(health.phase).toBe('failed')
    expect(health.ready).toBe(false)
    expect(health.error).not.toBeNull()
    expect(health.error?.phase).toBe('migrating')
    expect(health.error?.message).toBe('migration 0042 failed: no such column')

    // Mirrored to PostHog (exception + filterable message), both tagged with
    // the boot phase so a field failure is attributable.
    expect(captured.exceptions).toHaveLength(1)
    expect(captured.exceptions[0]?.err).toBe(err)
    expect((captured.exceptions[0]?.extra as { boot_phase: string }).boot_phase).toBe(
      'migrating',
    )
    expect(captured.messages).toHaveLength(1)
    expect(captured.messages[0]?.level).toBe('error')
  })

  it('coerces non-Error throwables into an Error before reporting', async () => {
    const boot = await import('../bootState')
    boot.setBootFailed('indexing', 'raw string failure')
    const health = boot.getBootHealth()
    expect(health.error?.message).toBe('raw string failure')
    expect(captured.exceptions[0]?.err).toBeInstanceOf(Error)
  })

  it('setBootReady flips ready to true', async () => {
    const boot = await import('../bootState')
    boot.setBootReady()
    const health = boot.getBootHealth()
    expect(health.phase).toBe('ready')
    expect(health.ready).toBe(true)
    expect(boot.isBootReady()).toBe(true)
  })
})

// Restore console after the suite registers (Bun runs synchronously enough that
// this keeps later files unaffected).
process.on('exit', () => {
  console.log = origLog
  console.error = origError
})
