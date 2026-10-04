#!/usr/bin/env bun
/**
 * Removes a finished task's worktree in about a second:
 *
 *   1. stops whatever listens on the task's port (3100 + task number, never 3000),
 *   2. unlocks the worktree, renames it aside and prunes git's record of it,
 *   3. deletes the renamed folder (node_modules, test DB, dist, test-results)
 *      with one detached rm, so nobody waits for it,
 *   4. deletes the branch only when it is merged into main or fully pushed.
 *
 * Shared caches stay: bun's global cache, the Playwright browsers and the main
 * checkout's Cargo target dir (worktree-setup.ts points worktrees at it).
 *
 * Usage, from the main checkout:
 *   bun app/scripts/worktree-cleanup.ts <task-id> <branch | worktree path>
 *
 * Cross-platform: pure Node/Bun APIs, no shell path interpolation.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, realpathSync, renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { mainCheckoutRoot, portFor, run, step } from './worktree-common'

const USER_DEV_PORT = 3000
const USAGE =
  'usage: bun app/scripts/worktree-cleanup.ts <task id, e.g. T-052> <branch | worktree path>'

interface Worktree {
  path: string
  branch?: string
  locked: boolean
}

function listWorktrees(mainRoot: string): Worktree[] {
  const porcelain = run('git', ['worktree', 'list', '--porcelain'], mainRoot)
  return porcelain.split(/\n\n+/).map((entry) => ({
    path: entry.match(/^worktree (.+)$/m)?.[1] ?? '',
    branch: entry.match(/^branch refs\/heads\/(.+)$/m)?.[1],
    locked: /^locked/m.test(entry),
  }))
}

function realPath(path: string) {
  return existsSync(path) ? realpathSync(path) : undefined
}

function findWorktree(mainRoot: string, target: string): Worktree {
  const targetPath = realPath(target)
  const [main, ...worktrees] = listWorktrees(mainRoot)
  if (targetPath && targetPath === realPath(main!.path))
    throw new Error('refusing to remove the main checkout')
  const found = worktrees.find(
    (worktree) =>
      worktree.branch === target ||
      (targetPath && realPath(worktree.path) === targetPath),
  )
  if (!found) throw new Error(`no worktree for "${target}"`)
  return found
}

function stopPort(mainRoot: string, port: number) {
  if (port === USER_DEV_PORT)
    throw new Error('port 3000 is the user dev server')
  const freePort = join(mainRoot, 'app', 'scripts', 'free-port.js')
  spawnSync(process.execPath, [freePort, String(port)], { stdio: 'ignore' })
  return `port ${port}`
}

function deleteInBackground(dir: string) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'rmdir', '/s', '/q', dir]]
      : ['rm', ['-rf', dir]]
  spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref()
}

function removeWorktree(mainRoot: string, worktree: Worktree) {
  if (worktree.locked)
    run('git', ['worktree', 'unlock', worktree.path], mainRoot)
  const trash = join(
    dirname(worktree.path),
    `.trash-${basename(worktree.path)}-${Date.now()}`,
  )
  try {
    renameSync(worktree.path, trash)
  } catch {
    // A file still held open (Windows) blocks the rename; let git delete it in place.
    run(
      'git',
      ['worktree', 'remove', '--force', '--force', worktree.path],
      mainRoot,
    )
    return `${worktree.path} (removed in place)`
  }
  run('git', ['worktree', 'prune'], mainRoot)
  deleteInBackground(trash)
  return `${worktree.path} (deleting in background)`
}

function isAncestor(mainRoot: string, commit: string, of: string) {
  return (
    spawnSync('git', ['merge-base', '--is-ancestor', commit, of], {
      cwd: mainRoot,
    }).status === 0
  )
}

function deleteBranchIfSafe(mainRoot: string, branch: string | undefined) {
  if (!branch) return 'detached HEAD, no branch'
  const remote = `refs/remotes/origin/${branch}`
  const pushed =
    spawnSync('git', ['show-ref', '--verify', '--quiet', remote], {
      cwd: mainRoot,
    }).status === 0 && isAncestor(mainRoot, branch, remote)
  if (!pushed && !isAncestor(mainRoot, branch, 'main')) {
    return `kept ${branch}: not merged into main and not pushed`
  }
  run('git', ['branch', '-D', branch], mainRoot)
  return `deleted ${branch} (${pushed ? 'pushed' : 'merged'})`
}

const port = portFor(process.argv[2], USAGE)
const target = process.argv[3]
if (!target) throw new Error(USAGE)
const mainRoot = mainCheckoutRoot(process.cwd())
const worktree = findWorktree(mainRoot, target)
step('port stopped', () => stopPort(mainRoot, port))
step('worktree removed', () => removeWorktree(mainRoot, worktree))
step('branch', () => deleteBranchIfSafe(mainRoot, worktree.branch))
