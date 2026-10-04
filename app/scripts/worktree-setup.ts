#!/usr/bin/env bun
/**
 * Makes a fresh git worktree ready for e2e tests in seconds by reusing the
 * main checkout's caches instead of rebuilding them:
 *
 *   1. node_modules from bun's global cache (`bun install` clones or hardlinks),
 *   2. Cargo's target dir: the worktree's app/tauri/.cargo/config.toml points
 *      at the main checkout's, so `cargo check`/`clippy`/`test` reuse its crates,
 *   3. the built sidecar binary, which tauri-build requires before compiling,
 *   4. the Playwright browser in the shared per-user cache (checked, never downloaded),
 *   5. then builds the client for the worktree's own port (3100 + task number).
 *
 * Usage, from anywhere inside the worktree:
 *   bun app/scripts/worktree-setup.ts T-052
 *
 * Cross-platform: pure Node/Bun APIs, no shell path interpolation.
 */

import { spawnSync } from 'node:child_process'
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

const PORT_BASE = 3100
const SIDECAR_PREFIX = 'church-hub-sidecar'

function run(command: string, args: string[], cwd: string, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${result.status})`,
    )
  }
  return result.stdout.trim()
}

function step(name: string, action: () => string | undefined) {
  const started = performance.now()
  const detail = action()
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`✓ ${name} (${seconds}s)${detail ? ` — ${detail}` : ''}`)
}

function portFor(taskId: string | undefined): number {
  const taskNumber = Number(taskId?.match(/\d+/)?.[0])
  if (!taskNumber)
    throw new Error(
      'usage: bun app/scripts/worktree-setup.ts <task id, e.g. T-052>',
    )
  return PORT_BASE + taskNumber
}

function findCheckouts() {
  const worktreeRoot = realpathSync(
    run('git', ['rev-parse', '--show-toplevel'], process.cwd()),
  )
  const commonDir = run(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    process.cwd(),
  )
  const mainRoot = realpathSync(dirname(commonDir))
  if (worktreeRoot === mainRoot) {
    throw new Error('this is the main checkout: run it inside a worktree')
  }
  return {
    worktreeApp: join(worktreeRoot, 'app'),
    mainApp: join(mainRoot, 'app'),
  }
}

function installDependencies(worktreeApp: string) {
  run(process.execPath, ['install'], worktreeApp)
  return undefined
}

function shareCargoTarget(worktreeApp: string, mainApp: string) {
  const mainTarget = join(mainApp, 'tauri', 'target')
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
  return `MISSING ${location}: run \`bunx playwright install chromium-headless-shell\` once (see .claude/tasks/teammate.md if it hangs)`
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

const port = portFor(process.argv[2])
const { worktreeApp, mainApp } = findCheckouts()
step('dependencies', () => installDependencies(worktreeApp))
step('cargo target shared', () => shareCargoTarget(worktreeApp, mainApp))
step('sidecar', () => copySidecar(worktreeApp, mainApp))
step('playwright browser', () => checkBrowser(worktreeApp))
step('client build', () => buildClient(worktreeApp, port))
console.log(
  `\nRun e2e: cd app/apps/client && CI=1 TEST_PORT=${port} bunx playwright test <spec> --workers=1 --retries=2`,
)
