/**
 * The review shell: the Tauri (Rust) app built once with the `review-shell`
 * feature (tauri/src/review.rs) and reused by every task's review build, so a
 * review build compiles no Rust unless the task changed the shell itself.
 *
 * Shells live in the main checkout's `.review-build/.shells/<key>/`. The key
 * hashes every file the binary is built from (app/tauri without its
 * per-task resources and sidecar, app/tauri-plugins), committed or not, so a
 * task that touches the shell gets its own, built from its own code.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { run } from './worktree-common'

const SHELL_SOURCES = ['app/tauri', 'app/tauri-plugins']
// Copied per task, so they never make a new shell.
const PER_TASK = ['app/tauri/bin/', 'app/tauri/resources/']
const SHELLS_KEPT = 3
const LOCK_WAIT_MS = 30 * 60 * 1000

export const SHELL_BINARY =
  process.platform === 'win32' ? 'church-hub.exe' : 'church-hub'

/** What the shell folder holds: the .app on macOS, the executable elsewhere. */
export function shellEntry() {
  return process.platform === 'darwin' ? 'church-hub.app' : SHELL_BINARY
}

export function shellKey(root: string) {
  const files = run(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...SHELL_SOURCES,
    ],
    root,
  )
    .split('\n')
    .filter((file) => file && !PER_TASK.some((dir) => file.startsWith(dir)))
    .sort()
  const hash = createHash('sha256').update(
    `${process.platform}-${process.arch}\n`,
  )
  for (const file of files) {
    const path = join(root, file)
    if (!existsSync(path)) continue // deleted, not yet staged
    hash.update(`${file}\n`).update(readFileSync(path))
  }
  return hash.digest('hex').slice(0, 16)
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Who holds the lock: its pid, or null while the holder is still writing it. */
function lockHolder(lock: string): number | null {
  try {
    return Number(readFileSync(join(lock, 'pid'), 'utf8')) || null
  } catch {
    return null
  }
}

/** A pid-less lock older than a minute: its holder died before writing the pid. */
function isAbandoned(lock: string) {
  try {
    return Date.now() - statSync(lock).mtimeMs > 60_000
  } catch {
    return false
  }
}

/**
 * A lock folder in the Cargo target dir, held only while a shell compiles
 * (worktrees share that target dir). A lock whose holder died (dead pid, or
 * no pid written for a minute) is taken over; any other is waited for.
 */
function withLock(targetDir: string, action: () => void) {
  const lock = join(targetDir, '.review-build.lock')
  const started = Date.now()
  mkdirSync(targetDir, { recursive: true })
  while (true) {
    try {
      mkdirSync(lock)
      break
    } catch {
      const holder = lockHolder(lock)
      if (holder ? !isAlive(holder) : isAbandoned(lock)) {
        rmSync(lock, { recursive: true, force: true })
        continue
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new Error(`another review shell build holds ${lock}`)
      }
      Bun.sleepSync(5000)
    }
  }
  const release = () => rmSync(lock, { recursive: true, force: true })
  process.on('exit', release)
  try {
    writeFileSync(join(lock, 'pid'), String(process.pid))
    action()
  } finally {
    release()
  }
}

export function cargoTargetDir(app: string) {
  const config = join(app, 'tauri', '.cargo', 'config.toml')
  const shared = existsSync(config)
    ? readFileSync(config, 'utf8').match(/target-dir\s*=\s*(".*")/)?.[1]
    : undefined
  return shared ? (JSON.parse(shared) as string) : join(app, 'tauri', 'target')
}

/** Its resources and sidecar come from each task, so the template carries none. */
function stripPerTaskFiles(app: string, template: string) {
  if (process.platform !== 'darwin') return
  const conf = JSON.parse(
    readFileSync(join(app, 'tauri', 'tauri.conf.json'), 'utf8'),
  )
  const resources = join(template, 'Contents', 'Resources')
  for (const target of Object.values(
    conf.bundle.resources as Record<string, string>,
  ))
    rmSync(join(resources, target), { recursive: true, force: true })
  rmSync(join(template, 'Contents', 'MacOS', 'church-hub-sidecar'), {
    force: true,
  })
}

function compileShell(app: string, targetDir: string, staging: string) {
  const config = join(staging, 'tauri.shell.conf.json')
  // The task's web build and sidecar are built by review-build.ts itself.
  writeFileSync(
    config,
    JSON.stringify({
      build: { beforeBuildCommand: null },
      bundle: { createUpdaterArtifacts: false },
    }),
  )
  // macOS needs the .app around the binary (Info.plist, icons); elsewhere the binary is the shell.
  const bundling =
    process.platform === 'darwin' ? ['--bundles', 'app'] : ['--no-bundle']
  const args = [
    'x',
    'tauri',
    'build',
    ...bundling,
    '--features',
    'review-shell',
  ]
  const result = spawnSync(
    process.execPath,
    [...args, '--config', config, '--', '--profile', 'review'],
    { cwd: app, stdio: 'inherit' },
  )
  if (result.status !== 0)
    throw new Error(`review shell build failed (exit ${result.status})`)
  const built =
    process.platform === 'darwin'
      ? join(targetDir, 'review', 'bundle', 'macos', 'church-hub.app')
      : join(targetDir, 'review', SHELL_BINARY)
  const template = join(staging, shellEntry())
  cpSync(built, template, { recursive: true, verbatimSymlinks: true })
  stripPerTaskFiles(app, template)
  rmSync(config)
}

/** Old shells go, the newest few stay (switching between branches reuses them). */
function pruneShells(shellsDir: string, keep: string) {
  const shells = readdirSync(shellsDir)
    .filter((name) => name !== keep && !name.startsWith('.'))
    .map((name) => join(shellsDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  for (const old of shells.slice(SHELLS_KEPT - 1))
    rmSync(old, { recursive: true, force: true })
}

/**
 * The shell for this checkout's code: the cached one, or built now (under
 * the lock, then cached). Returns its folder and whether it was built.
 */
export function ensureShell(root: string, shellsDir: string) {
  const app = join(root, 'app')
  const key = shellKey(root)
  const shell = join(shellsDir, key)
  let built = false
  if (!existsSync(shell)) {
    const targetDir = cargoTargetDir(app)
    withLock(targetDir, () => {
      if (existsSync(shell)) return // another task built it while we waited
      const staging = join(shellsDir, `.building-${key}-${process.pid}`)
      rmSync(staging, { recursive: true, force: true })
      mkdirSync(staging, { recursive: true })
      try {
        compileShell(app, targetDir, staging)
        renameSync(staging, shell) // appears whole or not at all
      } finally {
        rmSync(staging, { recursive: true, force: true })
      }
      built = true
    })
  }
  const now = new Date()
  utimesSync(shell, now, now) // last used, for pruning
  pruneShells(shellsDir, key)
  return { shell, key, built }
}
