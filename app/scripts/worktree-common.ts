/**
 * Shared by the worktree scripts (setup, review build, cleanup): a task's
 * ports and review-app identity, running a command, and timing each step.
 */

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'

const PORT_BASE = 3100
const REVIEW_PORT_BASE = 4100

function taskNumberOf(taskId: string | undefined, usage: string): number {
  const taskNumber = Number(taskId?.match(/\d+/)?.[0])
  if (!taskNumber) throw new Error(usage)
  return taskNumber
}

/** A task's own port: 3100 + its number (T-052 → 3152). */
export function portFor(taskId: string | undefined, usage: string): number {
  return PORT_BASE + taskNumberOf(taskId, usage)
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
