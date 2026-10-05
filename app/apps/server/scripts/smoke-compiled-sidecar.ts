#!/usr/bin/env bun
/**
 * Release smoke check: `bun build --compile` must give a sidecar that boots
 * and serves the API (the v0.1.60 lesson: a sidecar that runs from source can
 * still die once compiled, e.g. a dependency's dynamic require dropped from
 * the bundle). Run before every release on macOS, Windows and Linux
 * (.github/workflows/test.yml, build-desktop.yml); ~30 s.
 *
 * The binary is laid out like the desktop bundle (macOS: inside
 * `<App>.app/Contents/MacOS/` with resources in `Contents/Resources/`;
 * Windows/Linux: resources next to it), and its database lives in a temp
 * folder, never in real app data.
 *
 *   bun scripts/smoke-compiled-sidecar.ts      (from app/apps/server)
 *
 * Prints one line per check and exits 1 on the first failure.
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
  DEFAULT_BACKGROUND_MEDIA,
  DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR,
} from '../src/service/background-media/constants'

const PORT = 3098
// 127.0.0.1, not "localhost": Bun on Linux resolves localhost to ::1 first
// while the server binds IPv4 only, so a fetch would hang.
const BASE_URL = `http://127.0.0.1:${PORT}`
const BUNDLED_BACKGROUNDS_DIR = resolve(
  import.meta.dir,
  '../../../tauri/resources',
  DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR,
)

const output = { stdout: '', stderr: '' }

function fail(message: string): never {
  process.stderr.write(
    `✗ ${message}\n--- stdout ---\n${output.stdout.slice(-4000)}\n--- stderr ---\n${output.stderr.slice(-4000)}\n`,
  )
  process.exit(1)
}

async function check(name: string, run: () => unknown | Promise<unknown>) {
  try {
    if ((await run()) === false) fail(name)
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : error}`)
  }
  process.stdout.write(`✓ ${name}\n`)
}

/** Where the bundle puts the sidecar binary and its resources on this OS. */
function bundleLayout(root: string) {
  if (process.platform === 'darwin') {
    const contents = join(root, 'church-hub.app', 'Contents')
    return {
      binDir: join(contents, 'MacOS'),
      resourcesDir: join(contents, 'Resources'),
    }
  }
  return { binDir: root, resourcesDir: root }
}

async function compile(binaryPath: string) {
  const build = spawn({
    cmd: [
      'bun',
      'build',
      '--compile',
      // The release flags (scripts/compile.ts): the boot server's worker is
      // built from function source, which minification rewrites.
      '--production',
      '--minify',
      '--minify-syntax',
      '--target',
      'bun',
      '--bundle',
      resolve(import.meta.dir, '../src/index.ts'),
      '--outfile',
      binaryPath,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if ((await build.exited) !== 0)
    throw new Error(await new Response(build.stderr).text())
  if (!existsSync(binaryPath)) throw new Error(`no binary at ${binaryPath}`)
}

/**
 * Drains a pipe into `output`: an unread pipe fills (~4 KiB on Windows) and
 * blocks the child on its next log line.
 */
function drain(stream: ReadableStream<Uint8Array>, sink: 'stdout' | 'stderr') {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  void (async () => {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      output[sink] += decoder.decode(value)
    }
  })()
}

async function waitForServer(proc: Subprocess, url: string) {
  for (let attempt = 0; attempt < 240; attempt++) {
    // A fetch that connects but never answers is cancelled and retried.
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
    } catch {
      // not ready yet
    }
    if (proc.exitCode != null)
      throw new Error(`sidecar exited early with code ${proc.exitCode}`)
    await Bun.sleep(500)
  }
  throw new Error('sidecar did not answer within 2 minutes')
}

async function main() {
  const workDir = mkdtempSync(join(tmpdir(), 'church-hub-smoke-'))
  const { binDir, resourcesDir } = bundleLayout(workDir)
  mkdirSync(binDir, { recursive: true })
  cpSync(
    BUNDLED_BACKGROUNDS_DIR,
    join(resourcesDir, DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR),
    { recursive: true },
  )
  const binaryPath = join(
    binDir,
    process.platform === 'win32' ? 'sidecar.exe' : 'sidecar',
  )
  let proc: Subprocess<'ignore', 'pipe', 'pipe'> | undefined

  try {
    await check('bun build --compile makes the sidecar', () =>
      compile(binaryPath),
    )

    proc = spawn({
      cmd: [binaryPath],
      env: {
        ...process.env,
        PORT: String(PORT),
        TAURI_MODE: 'true',
        DATABASE_PATH: join(workDir, 'data', 'app.db'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    drain(proc.stdout, 'stdout')
    drain(proc.stderr, 'stderr')
    const sidecar = proc

    await check('the sidecar starts and answers /api/database/info', () =>
      waitForServer(sidecar, `${BASE_URL}/api/database/info`),
    )
    await check(
      'no "CFB is not defined" (a dependency dropped from the bundle)',
      () => !output.stderr.includes('CFB is not defined'),
    )
    await check(
      'the boot server ran in its worker, not on the main thread',
      () =>
        output.stdout.includes('Boot server listening') &&
        !output.stderr.includes('boot server runs on the main thread'),
    )
    await check(
      'the first start seeded the songs from the embedded fixture',
      async () => {
        const health = (await (await fetch(`${BASE_URL}/health`)).json()) as {
          ready: boolean
          firstRun: boolean
        }
        return (
          health.ready &&
          health.firstRun &&
          /Seeded \d+ song\(s\) from fixtures/.test(output.stdout)
        )
      },
    )
    await check(
      'MIDI start-up finished and MIDI requests answer',
      async () =>
        (await fetch(`${BASE_URL}/api/midi/status`)).status === 200 &&
        !output.stderr.includes('panic'),
    )
    await check(
      'the bundled default backgrounds are in the gallery',
      async () => {
        // Cookie-less localhost requests get the view permissions.
        const res = await fetch(`${BASE_URL}/api/media/backgrounds`)
        const { data } = (await res.json()) as {
          data: { id: string; kind: string; size: number }[]
        }
        return DEFAULT_BACKGROUND_MEDIA.every(({ fileName, id }) => {
          const item = data.find((media) => media.id === id)
          return (
            item?.kind === 'video' &&
            item.size === statSync(join(BUNDLED_BACKGROUNDS_DIR, fileName)).size
          )
        })
      },
    )
    if (process.platform === 'darwin') {
      // The helper must exit on its own, never boot a second server: a server
      // started by the probe used to kill the app on its port (v0.1.60).
      await check(
        'the CoreMIDI warm-up helper exits without starting a server',
        async () => {
          const helper = spawn({
            cmd: [binaryPath, '--warm-up-coremidi'],
            env: { PATH: process.env.PATH ?? '' },
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 20_000,
          })
          // 0: CoreMIDI gave a client; 2: it refused (the server retries).
          return (
            [0, 2].includes(await helper.exited) &&
            !(await new Response(helper.stdout).text()).includes('Server Ready')
          )
        },
      )
    }
    await check(
      'no ReferenceError on the way',
      () => !output.stderr.includes('ReferenceError'),
    )
  } finally {
    proc?.kill()
    rmSync(workDir, { recursive: true, force: true, maxRetries: 3 })
  }
}

await main()
