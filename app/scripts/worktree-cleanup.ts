#!/usr/bin/env bun
/**
 * Removes everything a finished task made and no longer needs. Run it after
 * the task is accepted and its pull request merged. The local part takes about
 * a second; the GitHub steps add a few more.
 *
 *   1. closes the task's review app and stops whatever listens on its ports
 *      (e2e 3100 + task number, review 4100 + task number; never 3000),
 *   2. unlocks the worktree, renames it aside and prunes git's record of it,
 *   3. deletes the renamed folder (node_modules, test DB, dist, test-results)
 *      with one detached rm, so nobody waits for it,
 *   4. deletes the review build: its folder in the main checkout, bundles left
 *      in the Cargo target and the folders the OS made for the app,
 *   5. deletes the branch, and the worktree's empty `worktree-agent-*` base
 *      branch, only when merged into main, fully pushed or the head of a merged PR,
 *   6. deletes the remote branch and the PR's installers from the shared
 *      `pr-builds` release once the PR is merged (installers also once closed).
 *
 * Kept: shared caches (bun's global cache, the Playwright browsers, the main
 * checkout's Cargo target dir that worktree-setup.ts points worktrees at) and
 * the demo videos the PR embeds (`pr-demos-*` releases, `pr-demo-videos`).
 *
 * Usage, from the main checkout:
 *   bun app/scripts/worktree-cleanup.ts <task-id> <branch | worktree path>
 *
 * Cross-platform: pure Node/Bun APIs, no shell path interpolation.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, realpathSync, renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import type { PullRequest } from './cleanup-github'
import {
  deletePrBuildRelease,
  deleteRemoteBranch,
  findPullRequest,
} from './cleanup-github'
import { removeReviewBuild, stopReviewApp } from './cleanup-review-build'
import {
  mainCheckoutRoot,
  portFor,
  reviewPortFor,
  run,
  step,
} from './worktree-common'

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

function stopPorts(mainRoot: string, ports: number[]) {
  if (ports.includes(USER_DEV_PORT))
    throw new Error('port 3000 is the user dev server')
  const freePort = join(mainRoot, 'app', 'scripts', 'free-port.js')
  spawnSync(process.execPath, [freePort, ...ports.map(String)], {
    stdio: 'ignore',
  })
  return `port ${ports.join(', ')}`
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

function tipOf(mainRoot: string, branch: string) {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
    { cwd: mainRoot, encoding: 'utf8' },
  )
  return result.status === 0 ? result.stdout.trim() : undefined
}

/** Why deleting the branch loses nothing, or undefined when it might. */
function whySafeToDelete(
  mainRoot: string,
  branch: string,
  tip: string,
  pull: PullRequest | undefined,
) {
  const remote = `refs/remotes/origin/${branch}`
  const pushed =
    spawnSync('git', ['show-ref', '--verify', '--quiet', remote], {
      cwd: mainRoot,
    }).status === 0 && isAncestor(mainRoot, branch, remote)
  if (pushed) return 'pushed'
  if (isAncestor(mainRoot, branch, 'main')) return 'merged'
  // A squash or rebase merge leaves the commits out of main; the PR head proves they were in it.
  if (pull?.state === 'MERGED' && pull.headRefOid === tip)
    return `PR #${pull.number} merged`
  return undefined
}

function deleteBranchIfSafe(
  mainRoot: string,
  branch: string | undefined,
  pull?: PullRequest,
) {
  if (!branch) return 'detached HEAD, no branch'
  const tip = tipOf(mainRoot, branch)
  if (!tip) return `${branch} already gone`
  const reason = whySafeToDelete(mainRoot, branch, tip, pull)
  if (!reason)
    return `kept ${branch}: not merged into main, not pushed and no merged PR`
  run('git', ['branch', '-D', branch], mainRoot)
  return `deleted ${branch} (${reason})`
}

/** The empty branch the worktree started on, left behind once its task moved to a feature branch. */
function deleteBaseBranch(mainRoot: string, worktree: Worktree) {
  const base = `worktree-${basename(worktree.path)}`
  if (base === worktree.branch) return 'same as the task branch'
  return deleteBranchIfSafe(mainRoot, base)
}

const port = portFor(process.argv[2], USAGE)
const reviewPort = reviewPortFor(process.argv[2], USAGE)
const taskId = process.argv[2]!.toUpperCase()
const target = process.argv[3]
if (!target) throw new Error(USAGE)
const mainRoot = mainCheckoutRoot(process.cwd())
const worktree = findWorktree(mainRoot, target)
// Asked first: the branch is deleted below, and the PR proves what was merged.
const pull = worktree.branch
  ? findPullRequest(mainRoot, worktree.branch)
  : undefined
step('review app closed', () => stopReviewApp(taskId))
step('ports stopped', () => stopPorts(mainRoot, [port, reviewPort]))
step('worktree removed', () => removeWorktree(mainRoot, worktree))
step('review build removed', () => removeReviewBuild(mainRoot, taskId))
step('branch', () => deleteBranchIfSafe(mainRoot, worktree.branch, pull))
step('base branch', () => deleteBaseBranch(mainRoot, worktree))
step('remote branch', () =>
  worktree.branch
    ? deleteRemoteBranch(mainRoot, worktree.branch, pull)
    : 'no branch',
)
step('PR installers', () => deletePrBuildRelease(mainRoot, pull))
