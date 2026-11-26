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
 * Windows: resources next to it; Linux, as the .deb and AppImage:
 * `usr/bin/` with resources in `usr/lib/church-hub/`), it gets the resources
 * folder as the desktop shell passes it, and its database lives in a temp
 * folder, never in real app data.
 *
 *   bun scripts/smoke-compiled-sidecar.ts      (from app/apps/server)
 *
 * Prints one line per check and exits 1 on the first failure.
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type Subprocess, spawn } from 'bun'

import { setLinuxRunpath } from './setLinuxRunpath'
import { WORKER_ENTRYPOINTS } from './workerEntrypoints'
import { Database } from 'bun:sqlite'
import {
  DEFAULT_BACKGROUND_MEDIA,
  DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR,
} from '../src/service/background-media/constants'
import {
  OS_STORE_SERVICE,
  osEntryName,
} from '../src/service/secret-store/data-key/osKeyStore'

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
  if (process.platform === 'linux') {
    return {
      binDir: join(root, 'usr', 'bin'),
      resourcesDir: join(root, 'usr', 'lib', 'church-hub'),
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
      '--env=CHURCH_HUB_BUILD_*',
      '--bundle',
      resolve(import.meta.dir, '../src/index.ts'),
      ...WORKER_ENTRYPOINTS.map((entry) =>
        resolve(import.meta.dir, '..', entry),
      ),
      '--outfile',
      binaryPath,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if ((await build.exited) !== 0)
    throw new Error(await new Response(build.stderr).text())
  if (!existsSync(binaryPath)) throw new Error(`no binary at ${binaryPath}`)
  // As compile.ts leaves it, so the check runs the sidecar the AppImage ships.
  if (process.platform === 'linux') await setLinuxRunpath(binaryPath)
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

/**
 * Removes the run's key from the OS secret store. macOS lets only the item's
 * creator (the sidecar) or Apple's security tool delete it.
 */
async function removeOsKey(keyId: string): Promise<void> {
  if (process.platform !== 'darwin') {
    await Bun.secrets.delete({
      service: OS_STORE_SERVICE,
      name: osEntryName(keyId),
    })
    return
  }
  execFileSync(
    '/usr/bin/security',
    [
      'delete-generic-password',
      '-s',
      OS_STORE_SERVICE,
      '-a',
      osEntryName(keyId),
    ],
    { stdio: 'pipe', timeout: 10_000 },
  )
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
  /** The run's throwaway key in the OS secret store, removed at the end. */
  let osKeyId: string | null = null

  try {
    await check('bun build --compile makes the sidecar', () =>
      compile(binaryPath),
    )

    proc = spawn({
      cmd: [binaryPath],
      env: {
        ...process.env,
        // Loopback only: no Windows firewall prompt per smoke run (T-193).
        CHURCH_HUB_LISTEN_HOST: '127.0.0.1',
        PORT: String(PORT),
        TAURI_MODE: 'true',
        // As the desktop shell passes it (Tauri's resource_dir)
        CHURCH_HUB_RESOURCES_DIR: resourcesDir,
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
    await check('the song updates run in their worker thread', async () => {
      const users = (await (
        await fetch(`${BASE_URL}/api/auth/local-users`)
      ).json()) as { data: { id: number; isSuperAdmin: boolean }[] }
      const admin = users.data.find((user) => user.isSuperAdmin)
      const login = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: admin?.id }),
      })
      const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
      // No sources: the worker starts, checks nothing, and reports back.
      const run = await fetch(`${BASE_URL}/api/song-sources/updates/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ sourceIds: [] }),
      })
      if (run.status !== 202) return false
      for (let i = 0; i < 50; i++) {
        if (output.stdout.includes('Checked 0 sources')) {
          return !output.stderr.includes('Song updates worker')
        }
        await Bun.sleep(200)
      }
      return false
    })
    await check(
      'saved secrets are sealed with a data key out of the database (Bun.secrets in the compiled sidecar)',
      async () => {
        const keyFile = JSON.parse(
          readFileSync(join(workDir, 'data', 'secret-key.json'), 'utf8'),
        ) as { id: string; store: 'os' | 'file' }
        if (keyFile.store === 'os') osKeyId = keyFile.id
        const status = (await (
          await fetch(`${BASE_URL}/api/secret-store`)
        ).json()) as { data?: { keptIn: string; locked: boolean } }
        process.stdout.write(`  data key kept in: ${status.data?.keptIn}\n`)
        const db = new Database(join(workDir, 'data', 'app.db'), {
          readonly: true,
        })
        const tokens = db
          .query<{ token: string }, []>('SELECT token FROM users')
          .all()
        db.close()
        return (
          status.data?.locked === false &&
          (status.data.keptIn === 'file') === (keyFile.store === 'file') &&
          tokens.length > 0 &&
          tokens.every(({ token }) => token.startsWith('enc:v1:'))
        )
      },
    )
    await check(
      'no ReferenceError on the way',
      () => !output.stderr.includes('ReferenceError'),
    )
  } finally {
    proc?.kill()
    // Windows keeps the .exe locked until the process has exited
    await proc?.exited
    rmSync(workDir, { recursive: true, force: true, maxRetries: 3 })
    if (osKeyId) await removeOsKey(osKeyId)
  }
}

await main()
