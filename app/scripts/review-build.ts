#!/usr/bin/env bun
/**
 * Builds the desktop app of this checkout for review on this computer and
 * keeps it in `.review-build/<task id>/` in the MAIN checkout, ready to open:
 * a standalone copy that outlives the task's worktree. It is the one thing a
 * reviewer opens (installers for other platforms only on request:
 * pr-build.yml); worktree-cleanup.ts deletes it once the task is merged.
 *
 * Fast, and several at once: the Rust shell is compiled once and reused
 * (review-shell.ts); each review build only builds the task's web client and
 * sidecar (seconds) and puts them next to a copy of the shell. Rust compiles
 * only when the task changed app/tauri or app/tauri-plugins.
 *
 * It never meets the user's real Church Hub; its `review-build.json`
 * (read by tauri/src/review.rs) gives it:
 *   - its own port, 4100 + task number (not 3000/3001, not the e2e port 3100 + n:
 *     the app kills whatever holds its port at start),
 *   - its own data folder, `.review-build/<task id>/data` (database, logs, backups),
 *   - its own bundle identifier, so a running Church Hub (single instance)
 *     and its window state, settings and web storage stay apart,
 *   - no updater: an update would replace it with the real release.
 *
 * Usage, from anywhere inside the checkout (run worktree-setup.ts first):
 *   bun app/scripts/review-build.ts T-023 [--out <dir>]
 * --out puts the app (and its data) elsewhere.
 *
 * Cross-platform, laid out as Tauri's installers do, so it finds its
 * resources and sidecar: macOS `church-hub-T-023.app`; Windows a folder with
 * `church-hub.exe` and the resources beside it; Linux a folder with
 * `usr/bin/church-hub` and `usr/lib/church-hub/`.
 */

import {
  constants,
  copyFileSync,
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ensureShell, SHELL_BINARY, shellEntry } from './review-shell'
import {
  mainCheckoutRoot,
  reviewIdentifier,
  reviewPortFor,
  run,
  step,
} from './worktree-common'

const USAGE =
  'usage: bun app/scripts/review-build.ts <task id, e.g. T-023> [--out <dir>]'
const REVIEW_DIR = '.review-build'
const SIDECAR = 'church-hub-sidecar'
const CLIENT_DIST = 'client-dist'

function parseArgs() {
  const taskId = process.argv[2]
  const port = reviewPortFor(taskId, USAGE)
  const outFlag = process.argv.indexOf('--out')
  const root = realpathSync(
    run('git', ['rev-parse', '--show-toplevel'], process.cwd()),
  )
  const reviewRoot = join(mainCheckoutRoot(root), REVIEW_DIR)
  const out =
    outFlag > 0
      ? resolve(process.argv[outFlag + 1])
      : join(reviewRoot, taskId.toUpperCase())
  return { taskId: taskId.toUpperCase(), port, root, reviewRoot, out }
}

/** Without the review shell this branch's app would use port 3000 and the real data. */
function checkShellSupport(app: string) {
  const manifest = readFileSync(join(app, 'tauri', 'Cargo.toml'), 'utf8')
  if (!manifest.includes('review-shell')) {
    throw new Error(
      'this branch predates the shared review shell (no `review-shell` feature in app/tauri/Cargo.toml): rebase it on main first',
    )
  }
  return 'review-shell feature present'
}

/** Where things go inside the review app: Tauri's installed layout per OS. */
function layoutOf(out: string, name: string) {
  if (process.platform === 'darwin') {
    const app = join(out, `${name}.app`)
    const resources = join(app, 'Contents', 'Resources')
    return {
      app,
      exeDir: join(app, 'Contents', 'MacOS'),
      resources,
      settingsDir: resources,
      open: app,
    }
  }
  const app = join(out, name)
  if (process.platform === 'win32') {
    return {
      app,
      exeDir: app,
      resources: app,
      settingsDir: app,
      open: join(app, SHELL_BINARY),
    }
  }
  const exeDir = join(app, 'usr', 'bin')
  return {
    app,
    exeDir,
    resources: join(app, 'usr', 'lib', 'church-hub'),
    settingsDir: exeDir,
    open: join(exeDir, SHELL_BINARY),
  }
}

type Layout = ReturnType<typeof layoutOf>

function buildSidecar(app: string) {
  run(process.execPath, ['run', '--filter', 'server', 'compile'], app)
  return 'tauri/bin'
}

/** The task's own web client, built for the review port straight into the app. */
function buildClient(app: string, port: number, outDir: string) {
  run(
    process.execPath,
    ['x', 'vite', 'build', '--outDir', outDir, '--emptyOutDir'],
    join(app, 'apps', 'client'),
    {
      ...process.env,
      VITE_API_PORT: String(port),
      VITE_SERVER_PORT: String(port),
    },
  )
  return `talks to port ${port}`
}

function copyShell(shell: string, layout: Layout) {
  rmSync(layout.app, { recursive: true, force: true })
  if (process.platform === 'darwin') {
    cpSync(join(shell, shellEntry()), layout.app, {
      recursive: true,
      verbatimSymlinks: true,
    })
  } else {
    mkdirSync(layout.exeDir, { recursive: true })
    copyFileSync(join(shell, SHELL_BINARY), join(layout.exeDir, SHELL_BINARY))
  }
  return layout.app
}

/** The newest compiled sidecar for this OS, named as Tauri's bundler names it. */
function copySidecar(app: string, layout: Layout) {
  const bin = join(app, 'tauri', 'bin')
  const newest = readdirSync(bin)
    .filter((file) => file.startsWith(`${SIDECAR}-`))
    .sort(
      (a, b) => statSync(join(bin, b)).mtimeMs - statSync(join(bin, a)).mtimeMs,
    )[0]
  if (!newest) throw new Error(`no ${SIDECAR}-* in ${bin}`)
  const name = process.platform === 'win32' ? `${SIDECAR}.exe` : SIDECAR
  copyFileSync(
    join(bin, newest),
    join(layout.exeDir, name),
    constants.COPYFILE_FICLONE,
  )
  return newest
}

/** The task's bundle resources (tauri.conf.json), the web client aside. */
function copyResources(app: string, layout: Layout) {
  const conf = JSON.parse(
    readFileSync(join(app, 'tauri', 'tauri.conf.json'), 'utf8'),
  )
  const resources = conf.bundle.resources as Record<string, string>
  const copied = Object.entries(resources).filter(
    ([, target]) => target !== CLIENT_DIST,
  )
  for (const [source, target] of copied) {
    cpSync(join(app, 'tauri', source), join(layout.resources, target), {
      recursive: true,
    })
  }
  return copied.map(([, target]) => target).join(', ')
}

function writeSettings(
  layout: Layout,
  taskId: string,
  port: number,
  dataDir: string,
) {
  const settings = {
    port,
    dataDir,
    identifier: reviewIdentifier(taskId),
    title: `Church Hub ${taskId} (review build)`,
    clientDist: join(layout.resources, CLIENT_DIST),
  }
  const file = join(layout.settingsDir, 'review-build.json')
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
  return `port ${port}, ${settings.identifier}`
}

/** macOS reads the app's identity (web storage, single instance) from Info.plist. */
function renameMacApp(layout: Layout, taskId: string, name: string) {
  if (process.platform !== 'darwin') return 'not macOS'
  const plist = join(layout.app, 'Contents', 'Info.plist')
  const values: Record<string, string> = {
    CFBundleIdentifier: reviewIdentifier(taskId),
    CFBundleName: name,
    CFBundleDisplayName: name,
  }
  for (const [key, value] of Object.entries(values)) {
    run('plutil', ['-replace', key, '-string', value, plist], layout.app)
  }
  return reviewIdentifier(taskId)
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

if (!['darwin', 'win32', 'linux'].includes(process.platform))
  throw new Error(`no review build for ${process.platform}`)
const { taskId, port, root, reviewRoot, out } = parseArgs()
const app = join(root, 'app')
const dataDir = join(out, 'data')
const name = `church-hub-${taskId}`
const layout = layoutOf(out, name)
const started = performance.now()

step('review shell support', () => checkShellSupport(app))
mkdirSync(dataDir, { recursive: true })
// Ignored even on a branch whose .gitignore predates review builds.
writeFileSync(join(out, '.gitignore'), '*\n')
const dirtyBefore = changedFiles(root)
try {
  step('sidecar', () => buildSidecar(app))
  let shell = ''
  step('shell', () => {
    const result = ensureShell(root, join(reviewRoot, '.shells'))
    shell = result.shell
    return `${result.built ? 'built' : 'reused'} ${result.key}`
  })
  step('app copied', () => copyShell(shell, layout))
  step('client', () =>
    buildClient(app, port, join(layout.resources, CLIENT_DIST)),
  )
  step('sidecar copied', () => copySidecar(app, layout))
  step('resources', () => copyResources(app, layout))
  step('settings', () => writeSettings(layout, taskId, port, dataDir))
  step('identity', () => renameMacApp(layout, taskId, name))
} finally {
  step('restored generated files', () => restoreGenerated(root, dirtyBefore))
}

const seconds = ((performance.now() - started) / 1000).toFixed(0)
const link = pathToFileURL(layout.open).href
// biome-ignore lint/suspicious/noConsole: the script's result
console.log(
  `\n${taskId} review build (${seconds} s): ${layout.open}\nOpen: ${link}\nPort ${port}, data in ${dataDir}\nTask note: app: ${link}`,
)
