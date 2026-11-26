/**
 * Shared by the worktree scripts (setup, review build, cleanup): a task's
 * ports and review-app identity, running a command, and timing each step.
 */

import { spawnSync } from 'node:child_process'
import { accessSync, constants, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { PORTS_PER_SERVER } from '../apps/client/e2e/helpers/server-ports'

/**
 * Each task owns a block of ports for its e2e run, one server per worker:
 * TASK_PORT_BASE + n × TASK_PORT_BLOCK onwards. Blocks never overlap, stay
 * clear of 3000/3001 and the review ports (4100 + n), and stay below the
 * OS's ephemeral range (Linux starts at 32768) up to task ~1000.
 */
export const WORKTREE_E2E_WORKERS = 2
const TASK_PORT_BLOCK = WORKTREE_E2E_WORKERS * PORTS_PER_SERVER
const TASK_PORT_BASE = 20000
const REVIEW_PORT_BASE = 4100

function taskNumberOf(taskId: string | undefined, usage: string): number {
  const taskNumber = Number(taskId?.match(/\d+/)?.[0])
  if (!taskNumber) throw new Error(usage)
  return taskNumber
}

/** A task's own port, the first of its block (T-052 → 20624). */
export function portFor(taskId: string | undefined, usage: string): number {
  return TASK_PORT_BASE + taskNumberOf(taskId, usage) * TASK_PORT_BLOCK
}

/** Every port of a task's block: its server and its e2e workers' ports. */
export function taskPorts(taskId: string | undefined, usage: string): number[] {
  const first = portFor(taskId, usage)
  return Array.from({ length: TASK_PORT_BLOCK }, (_, i) => first + i)
}

/** A task's review-app port: 4100 + its number (T-052 → 4152). */
export function reviewPortFor(
  taskId: string | undefined,
  usage: string,
): number {
  return REVIEW_PORT_BASE + taskNumberOf(taskId, usage)
}

/** The bundle identifier of a task's review app (T-052 → com.church-hub.review.t052). */
export function reviewIdentifier(taskId: string): string {
  return `com.church-hub.review.${taskId.toLowerCase().replace(/[^a-z0-9]/g, '')}`
}

export function run(
  command: string,
  args: string[],
  cwd: string,
  env = process.env,
) {
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

export function step(name: string, action: () => string | undefined) {
  const started = performance.now()
  const detail = action()
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`✓ ${name} (${seconds}s)${detail ? ` — ${detail}` : ''}`)
}

/** The main checkout's root, from inside it or any of its worktrees. */
export function mainCheckoutRoot(cwd: string): string {
  const commonDir = run(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    cwd,
  )
  return realpathSync(dirname(commonDir))
}

/**
 * Where a checkout keeps its review builds (review-build.ts): its own
 * `.review-build/`, gitignored and removed with the worktree. Never the main
 * checkout's: a task session sees the main checkout read-only.
 */
export function reviewBuildsRoot(checkoutRoot: string): string {
  return join(checkoutRoot, '.review-build')
}

/**
 * This user's cache folder for Church Hub's build caches, shared by every
 * checkout and writable from task sessions: ~/Library/Caches on macOS,
 * %LOCALAPPDATA% on Windows, $XDG_CACHE_HOME or ~/.cache on Linux.
 */
export function userCacheDir(): string {
  const home = homedir()
  if (process.platform === 'darwin')
    return join(home, 'Library', 'Caches', 'church-hub')
  if (process.platform === 'win32')
    return join(
      process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'),
      'church-hub',
    )
  return join(process.env.XDG_CACHE_HOME || join(home, '.cache'), 'church-hub')
}

function isWritable(dir: string) {
  try {
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * The Cargo target dir the worktrees share: the main checkout's, or the user
 * cache's when the main checkout is read-only (a task session).
 */
export function sharedCargoTarget(mainRoot: string): string {
  const tauri = join(mainRoot, 'app', 'tauri')
  return isWritable(tauri)
    ? join(tauri, 'target')
    : join(userCacheDir(), 'cargo-target')
}
