#!/usr/bin/env bun
/**
 * Builds the desktop app of this checkout for review on this computer and
 * keeps it in `.review-build/<task id>/` in the checkout, ready to open.
 *
 * It never meets the user's real Church Hub:
 *   - its own port, 4100 + task number (not 3000, not the e2e port 3100 + n:
 *     the app kills whatever holds its port at start),
 *   - its own data folder, `.review-build/<task id>/data` (database, logs, backups),
 *   - its own bundle identifier, so a running Church Hub (single instance)
 *     and its window state, settings and web storage stay apart,
 *   - no updater: an update would replace it with the real release.
 * The port and folder are baked in at compile time (CHURCH_HUB_SERVER_PORT,
 * CHURCH_HUB_DATA_DIR); a branch without those hooks is refused.
 *
 * One build at a time: worktrees share the main checkout's Cargo target dir.
 *
 * Usage, from anywhere inside the checkout (run worktree-setup.ts first):
 *   bun app/scripts/review-build.ts T-023 [--out <dir>]
 *
 * Cross-platform: the .app on macOS, the AppImage on Linux, the NSIS
 * installer on Windows.
 */

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { mainCheckoutRoot, portFor, run, step } from './worktree-common'

const USAGE =
  'usage: bun app/scripts/review-build.ts <task id, e.g. T-023> [--out <dir>]'
const REVIEW_PORT_BASE = 4100
const LOCK_WAIT_MS = 30 * 60 * 1000

const BUNDLES: Record<string, { bundle: string; folder: string; ext: string }> =
  {
    darwin: { bundle: 'app', folder: 'macos', ext: '.app' },
    linux: { bundle: 'appimage', folder: 'appimage', ext: '.AppImage' },
    win32: { bundle: 'nsis', folder: 'nsis', ext: '-setup.exe' },
  }

function parseArgs() {
  const taskId = process.argv[2]
  const e2ePort = portFor(taskId, USAGE)
  const outFlag = process.argv.indexOf('--out')
  const root = realpathSync(
    run('git', ['rev-parse', '--show-toplevel'], process.cwd()),
  )
  const out =
    outFlag > 0
      ? resolve(process.argv[outFlag + 1])
      : join(root, '.review-build', taskId.toUpperCase())
  return {
    taskId: taskId.toUpperCase(),
    e2ePort,
    port: REVIEW_PORT_BASE + (e2ePort - 3100),
    root,
    out,
  }
}

/** The build must carry the port and data-dir hooks, or it would use 3000 and the real data. */
function checkHooks(app: string) {
  const shell = readFileSync(join(app, 'tauri', 'src', 'lib.rs'), 'utf8')
  const paths = readFileSync(
    join(app, 'apps', 'server', 'src', 'utils', 'paths.ts'),
    'utf8',
  )
  if (
    !shell.includes('CHURCH_HUB_SERVER_PORT') ||
    !paths.includes('CHURCH_HUB_DATA_DIR')
  ) {
    throw new Error(
      'this branch predates review builds (no CHURCH_HUB_SERVER_PORT/CHURCH_HUB_DATA_DIR hooks): rebase it on main first',
    )
  }
  return 'port and data-dir hooks present'
}

function cargoTargetDir(app: string) {
  const config = join(app, 'tauri', '.cargo', 'config.toml')
  const shared = existsSync(config)
    ? readFileSync(config, 'utf8').match(/target-dir\s*=\s*(".*")/)?.[1]
    : undefined
  return shared ? (JSON.parse(shared) as string) : join(app, 'tauri', 'target')
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** A lock folder in the Cargo target dir; a dead holder's lock is taken over. */
function acquireLock(targetDir: string) {
  const lock = join(targetDir, '.review-build.lock')
  const started = Date.now()
  mkdirSync(targetDir, { recursive: true })
  while (true) {
    try {
      mkdirSync(lock)
      writeFileSync(join(lock, 'pid'), String(process.pid))
      process.on('exit', () => rmSync(lock, { recursive: true, force: true }))
      return lock
    } catch {
      const holder = Number(readFileSync(join(lock, 'pid'), 'utf8') || 0)
      if (holder && !isAlive(holder)) {
        rmSync(lock, { recursive: true, force: true })
        continue
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new Error(`another review build holds ${lock}`)
      }
      Bun.sleepSync(5000)
    }
  }
}

function writeConfig(app: string, taskId: string, out: string) {
  const base = JSON.parse(
    readFileSync(join(app, 'tauri', 'tauri.conf.json'), 'utf8'),
  )
  const slug = taskId.toLowerCase().replace(/[^a-z0-9]/g, '')
  const config = {
    productName: `church-hub-${taskId}`,
    identifier: `com.church-hub.review.${slug}`,
    app: {
      // A merge patch replaces arrays whole, so keep each window's settings.
      windows: base.app.windows.map((window: { title?: string }) => ({
        ...window,
        title: `Church Hub ${taskId} (review build)`,
      })),
    },
    bundle: { createUpdaterArtifacts: false },
    plugins: {
      updater: {
        endpoints: ['https://127.0.0.1:9/review-builds-never-update'],
      },
    },
  }
  const file = join(out, 'tauri.review.conf.json')
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
  return file
}

function buildApp(
  app: string,
  configFile: string,
  bundle: string,
  env: NodeJS.ProcessEnv,
) {
  const result = spawnSync(
    process.execPath,
    ['x', 'tauri', 'build', '--bundles', bundle, '--config', configFile],
    { cwd: app, env, stdio: 'inherit' },
  )
  if (result.status !== 0)
    throw new Error(`tauri build failed (exit ${result.status})`)
  return undefined
}

function keepBuild(
  targetDir: string,
  platform: (typeof BUNDLES)[string],
  out: string,
  name: string,
) {
  const bundleDir = join(targetDir, 'release', 'bundle', platform.folder)
  const built = readdirSync(bundleDir).find(
    (file) => file.startsWith(name) && file.endsWith(platform.ext),
  )
  if (!built) throw new Error(`no ${name}*${platform.ext} in ${bundleDir}`)
  const kept = join(out, built)
  rmSync(kept, { recursive: true, force: true })
  cpSync(join(bundleDir, built), kept, {
    recursive: true,
    verbatimSymlinks: true,
  })
  return kept
}

/** The tauri build rebuilt dist/ for the review port; put back the e2e one. */
function restoreE2eClient(app: string, e2ePort: number) {
  run(process.execPath, ['run', 'build'], join(app, 'apps', 'client'), {
    ...process.env,
    VITE_API_PORT: String(e2ePort),
    VITE_SERVER_PORT: String(e2ePort),
  })
  return `dist/ talks to port ${e2ePort} again`
}

function changedFiles(root: string) {
  const names = run('git', ['diff', '--name-only'], root)
  return new Set(names.split('\n').filter(Boolean))
}

/** Undo what the build regenerated (e.g. the embedded migrations), so it leaves no diff. */
function restoreGenerated(root: string, before: Set<string>) {
  const generated = [...changedFiles(root)].filter((file) => !before.has(file))
  if (generated.length > 0) run('git', ['checkout', '--', ...generated], root)
  return generated.join(', ') || 'nothing'
}

const platform = BUNDLES[process.platform]
if (!platform) throw new Error(`no review build for ${process.platform}`)
const { taskId, e2ePort, port, root, out } = parseArgs()
const app = join(root, 'app')
const dataDir = join(out, 'data')
const name = `church-hub-${taskId}`
const isWorktree = root !== mainCheckoutRoot(root)
const started = performance.now()

step('hooks', () => checkHooks(app))
mkdirSync(dataDir, { recursive: true })
const targetDir = cargoTargetDir(app)
step('build lock', () => acquireLock(targetDir))
const configFile = writeConfig(app, taskId, out)
const dirtyBefore = changedFiles(root)
step('tauri build', () =>
  buildApp(app, configFile, platform.bundle, {
    ...process.env,
    CHURCH_HUB_SERVER_PORT: String(port),
    CHURCH_HUB_DATA_DIR: dataDir,
    VITE_API_PORT: String(port),
    VITE_SERVER_PORT: String(port),
  }),
)
let kept = ''
step('kept', () => {
  kept = keepBuild(targetDir, platform, out, name)
  return kept
})
step('restored generated files', () => restoreGenerated(root, dirtyBefore))
if (isWorktree) step('e2e client', () => restoreE2eClient(app, e2ePort))

const minutes = ((performance.now() - started) / 60000).toFixed(1)
// biome-ignore lint/suspicious/noConsole: the script's result
console.log(
  `\n${taskId} review build (${minutes} min): ${kept}\nOpen: ${pathToFileURL(kept).href}\nPort ${port}, data in ${dataDir}`,
)
