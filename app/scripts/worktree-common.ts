/**
 * Shared by worktree-setup.ts and worktree-cleanup.ts: a task's port, running
 * a command, and timing each step.
 */

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'

const PORT_BASE = 3100

/** A task's own port: 3100 + its number (T-052 → 3152). */
export function portFor(taskId: string | undefined, usage: string): number {
  const taskNumber = Number(taskId?.match(/\d+/)?.[0])
  if (!taskNumber) throw new Error(usage)
  return PORT_BASE + taskNumber
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
