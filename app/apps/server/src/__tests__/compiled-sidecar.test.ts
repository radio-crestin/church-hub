/**
 * Verifies `bun build --compile` produces a sidecar binary that actually
 * boots and serves the API. Guards against bundler regressions where a
 * dependency uses dynamic require (e.g. `require('cf'+'b')` in
 * `ppt-to-text`) and gets silently dropped from the bundle.
 *
 * The binary is laid out like the desktop bundle — on macOS inside
 * `<App>.app/Contents/MacOS/` with the resources in `Contents/Resources/`, on
 * Windows/Linux with the resources next to it — so resource lookups are
 * exercised the way the shipped app does them. Its database lives in the
 * temp folder, never in a real app-data or dev database.
 *
 * Skipped by default — compiling the binary takes ~30s. Opt in via
 *   RUN_COMPILE_TESTS=1 bun test
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type Subprocess, spawn } from 'bun'

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from 'bun:test'
import {
  DEFAULT_BACKGROUND_MEDIA,
  DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR,
} from '../service/background-media/constants'

const SHOULD_RUN = process.env.RUN_COMPILE_TESTS === '1'
const describeFn = SHOULD_RUN ? describe : describe.skip

setDefaultTimeout(180_000)

const TEST_PORT = 3098
// Use 127.0.0.1 (not "localhost") — Bun on Linux CI resolves "localhost"
// to ::1 first, but Bun.serve binds 0.0.0.0 (IPv4 only), so the fetch
// silently hangs until the test default timeout. 127.0.0.1 is
// unambiguous and routes through the bound interface.
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

// The checked-in resources the desktop bundle ships (tauri.conf.json).
const BUNDLED_BACKGROUNDS_DIR = resolve(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'tauri',
  'resources',
  DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR,
)

let proc: Subprocess | null = null
let stderrChunks = ''
let stdoutChunks = ''
let workDir = ''
let binaryPath = ''

/** Where the bundle puts the sidecar binary and its resources on this OS. */
function bundleLayout(root: string): { binDir: string; resourcesDir: string } {
  if (process.platform === 'darwin') {
    const contents = join(root, 'church-hub.app', 'Contents')
    return {
      binDir: join(contents, 'MacOS'),
      resourcesDir: join(contents, 'Resources'),
    }
  }
  return { binDir: root, resourcesDir: root }
}

async function waitForServer(url: string, maxAttempts = 240): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    // Per-attempt AbortController so a Bun fetch that opens the
    // connection but never gets a response (Bun 1.3.14 + Linux CI) can
    // be cancelled and retried instead of consuming the whole budget.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (res.ok) {
        clearTimeout(timeoutId)
        return
      }
    } catch {
      // not ready yet
    }
    clearTimeout(timeoutId)
    if (proc?.exitCode != null) {
      throw new Error(
        `Sidecar exited early with code ${proc.exitCode}.\nStdout:\n${stdoutChunks}\nStderr:\n${stderrChunks}`,
      )
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(
    `Compiled sidecar did not respond within ${maxAttempts * 500}ms.\nStdout:\n${stdoutChunks}\nStderr:\n${stderrChunks}`,
  )
}

describeFn('Compiled sidecar binary', () => {
  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'church-hub-compile-test-'))
    const { binDir, resourcesDir } = bundleLayout(workDir)
    mkdirSync(binDir, { recursive: true })
    cpSync(
      BUNDLED_BACKGROUNDS_DIR,
      join(resourcesDir, DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR),
      { recursive: true },
    )
    binaryPath = join(
      binDir,
      process.platform === 'win32' ? 'sidecar.exe' : 'sidecar',
    )

    const entry = resolve(import.meta.dir, '..', 'index.ts')
    const compile = spawn({
      cmd: [
        'bun',
        'build',
        '--compile',
        '--target',
        'bun',
        '--bundle',
        entry,
        '--outfile',
        binaryPath,
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const exitCode = await compile.exited
    if (exitCode !== 0) {
      const stderr = await new Response(compile.stderr).text()
      throw new Error(`bun build --compile failed (${exitCode}):\n${stderr}`)
    }
    if (!existsSync(binaryPath)) {
      throw new Error(`Expected compiled binary at ${binaryPath}`)
    }

    proc = spawn({
      cmd: [binaryPath],
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        TAURI_MODE: 'true',
        DATABASE_PATH: join(workDir, 'data', 'app.db'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Drain BOTH streams. Leaving stdout unread fills the pipe buffer
    // (~4 KiB on Windows) and the child blocks on its next console.log —
    // exactly what made this test hang on Windows even though it passed
    // on macOS/Linux where pipe buffers are larger. We buffer the output
    // in-memory and only surface it via the thrown error on failure;
    // mirroring to the runner's stdout introduced back-pressure that
    // stalled the test event loop.
    const drainStream = (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      sink: (chunk: string) => void,
    ) => {
      const decoder = new TextDecoder()
      void (async () => {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          sink(decoder.decode(value))
        }
      })()
    }
    drainStream(proc!.stdout.getReader(), (s) => {
      stdoutChunks += s
    })
    drainStream(proc!.stderr.getReader(), (s) => {
      stderrChunks += s
    })

    await waitForServer(`${BASE_URL}/api/database/info`)
  })

  afterAll(() => {
    proc?.kill()
    if (workDir) {
      try {
        rmSync(workDir, { recursive: true, force: true })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('sidecar responds to /api/database/info', async () => {
    const res = await fetch(`${BASE_URL}/api/database/info`)
    expect(res.status).toBe(200)
  })

  test('sidecar did not crash with "CFB is not defined"', () => {
    expect(stderrChunks).not.toContain('CFB is not defined')
  })

  test('sidecar did not throw any ReferenceError', () => {
    expect(stderrChunks).not.toContain('ReferenceError')
  })

  test('sidecar finds the bundled default backgrounds and adds them to the gallery', async () => {
    // Cookie-less localhost requests get the view permissions.
    const res = await fetch(`${BASE_URL}/api/media/backgrounds`)
    expect(res.status).toBe(200)
    const { data } = (await res.json()) as {
      data: { id: string; kind: string; size: number }[]
    }
    for (const { fileName, id } of DEFAULT_BACKGROUND_MEDIA) {
      expect(data.find((item) => item.id === id)).toMatchObject({
        kind: 'video',
        size: statSync(join(BUNDLED_BACKGROUNDS_DIR, fileName)).size,
      })
    }
  })
})
