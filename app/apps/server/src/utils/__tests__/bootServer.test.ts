// biome-ignore-all lint/suspicious/noConsole: Tests stub console to keep output quiet
import { afterAll, describe, expect, it, mock } from 'bun:test'

// Same global PostHog mock as bootState.test.ts: every export, no network.
mock.module('../posthog', () => ({
  captureException: () => {},
  captureMessage: () => {},
  captureAppStarted: () => {},
  captureFeedbackReport: () => {},
  flushPostHog: async () => {},
  shutdownPostHog: async () => {},
}))

const origLog = console.log
console.log = () => {}
afterAll(() => {
  console.log = origLog
})

const PORT = 4399

/** Busy main thread, like a synchronous seed or search-index build. */
function blockMainThread(ms: number) {
  const end = performance.now() + ms
  while (performance.now() < end) {
    // spin
  }
}

/** Fetches /health from a child process, so the blocked test thread can't delay it. */
function fetchHealthFromAnotherProcess(delayMs: number) {
  return Bun.spawn(
    [
      process.execPath,
      '-e',
      `await Bun.sleep(${delayMs}); const r = await fetch('http://127.0.0.1:${PORT}/health'); console.log(await r.text())`,
    ],
    { stdout: 'pipe' },
  )
}

describe('boot server', () => {
  it('answers /health with the current step while the main thread is busy', async () => {
    const boot = await import('../bootState')
    const { startBootServer } = await import('../bootServer')
    boot.setBootPhase('migrating')
    boot.setBootStep('database')
    const server = await startBootServer(PORT)
    try {
      const probe = fetchHealthFromAnotherProcess(300)
      boot.setBootPhase('indexing')
      boot.setBootStep('search')
      boot.setBootProgress(5000, 26463)
      blockMainThread(1500)
      const answer = JSON.parse(await new Response(probe.stdout).text())
      expect(answer).toMatchObject({
        step: 'search',
        progress: { done: 5000, total: 26463 },
        phase: 'indexing',
        ready: false,
      })
      expect(answer.elapsedMs).toBeGreaterThan(0)

      const ping = await fetch(`http://127.0.0.1:${PORT}/ping`)
      expect(ping.status).toBe(200)
      const other = await fetch(`http://127.0.0.1:${PORT}/api/songs`)
      expect(other.status).toBe(503)
    } finally {
      await server.stop()
    }

    // The port is free again for the real server.
    const real = Bun.serve({ port: PORT, fetch: () => new Response('real') })
    expect(await (await fetch(`http://127.0.0.1:${PORT}/`)).text()).toBe('real')
    real.stop(true)
  })
})
