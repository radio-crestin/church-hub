#!/usr/bin/env bun
/**
 * Makes a fresh git worktree ready for e2e tests in seconds by reusing the
 * main checkout's caches instead of rebuilding them:
 *
 *   1. node_modules from bun's global cache (`bun install` clones or hardlinks),
 *   2. Cargo's target dir: the worktree's app/tauri/.cargo/config.toml points
 *      at the main checkout's (the user cache's when the main checkout is
 *      read-only, see sharedCargoTarget), so `cargo check`/`clippy`/`test`
 *      and the review shell reuse its crates,
 *   3. the built sidecar binary, which tauri-build requires before compiling,
 *   4. the Playwright browser in the shared per-user cache (checked, never downloaded),
 *   5. then builds the client for the worktree's own port (the first of the
 *      task's port block, see portFor).
 *
 * Usage, from anywhere inside the worktree:
 *   bun app/scripts/worktree-setup.ts T-052
 *
 * Cross-platform: pure Node/Bun APIs, no shell path interpolation.
 */

import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import {
  mainCheckoutRoot,
  portFor,
  run,
  sharedCargoTarget,
  step,
  WORKTREE_E2E_WORKERS,
} from './worktree-common'

const SIDECAR_PREFIX = 'church-hub-sidecar'
const USAGE = 'usage: bun app/scripts/worktree-setup.ts <task id, e.g. T-052>'

function findCheckouts() {
  const worktreeRoot = realpathSync(
    run('git', ['rev-parse', '--show-toplevel'], process.cwd()),
  )
  const mainRoot = mainCheckoutRoot(process.cwd())
  if (worktreeRoot === mainRoot) {
    throw new Error('this is the main checkout: run it inside a worktree')
  }
  return {
    worktreeApp: join(worktreeRoot, 'app'),
    mainRoot,
    mainApp: join(mainRoot, 'app'),
  }
}

function installDependencies(worktreeApp: string) {
  run(process.execPath, ['install'], worktreeApp)
  return undefined
}

function shareCargoTarget(worktreeApp: string, mainRoot: string) {
  const mainTarget = sharedCargoTarget(mainRoot)
  const cargoDir = join(worktreeApp, 'tauri', '.cargo')
  mkdirSync(cargoDir, { recursive: true })
  // JSON string escaping is valid TOML, so Windows backslashes survive.
  writeFileSync(
    join(cargoDir, 'config.toml'),
    `[build]\ntarget-dir = ${JSON.stringify(mainTarget)}\n`,
  )
  return mainTarget
}

function copySidecar(worktreeApp: string, mainApp: string) {
  const mainBin = join(mainApp, 'tauri', 'bin')
  const sidecars = readdirSync(mainBin).filter((name) =>
    name.startsWith(SIDECAR_PREFIX),
  )
  if (sidecars.length === 0) {
    return 'none in the main checkout; cargo check needs one (bun run --filter server compile)'
  }
  for (const name of sidecars) {
    const target = join(worktreeApp, 'tauri', 'bin', name)
    // Clones on APFS/btrfs/ReFS, plain copy elsewhere.
    if (!existsSync(target))
      copyFileSync(join(mainBin, name), target, constants.COPYFILE_FICLONE)
  }
  return sidecars.join(', ')
}

function checkBrowser(worktreeApp: string) {
  const plan = run(
    process.execPath,
    ['x', 'playwright', 'install', '--dry-run', 'chromium-headless-shell'],
    worktreeApp,
  )
  const location = plan.match(/Install location:\s*(.+)/)?.[1]?.trim()
  if (location && existsSync(join(location, 'INSTALLATION_COMPLETE')))
    return location
  return `MISSING ${location}: run \`bunx playwright install chromium-headless-shell\` once (see .claude/rules/task-worktrees.md if it hangs)`
}

function buildClient(worktreeApp: string, port: number) {
  const env = {
    ...process.env,
    VITE_API_PORT: String(port),
    VITE_SERVER_PORT: String(port),
  }
  run(
    process.execPath,
    ['run', 'build'],
    join(worktreeApp, 'apps', 'client'),
    env,
  )
  return `dist/ talks to port ${port}`
}

const port = portFor(process.argv[2], USAGE)
const { worktreeApp, mainRoot, mainApp } = findCheckouts()
step('dependencies', () => installDependencies(worktreeApp))
step('cargo target shared', () => shareCargoTarget(worktreeApp, mainRoot))
step('sidecar', () => copySidecar(worktreeApp, mainApp))
step('playwright browser', () => checkBrowser(worktreeApp))
step('client build', () => buildClient(worktreeApp, port))
console.log(
  `\nRun e2e: cd app/apps/client && CI=1 E2E_WORKERS=${WORKTREE_E2E_WORKERS} TEST_PORT=${port} bunx playwright test <spec> --retries=2`,
)
