/**
 * What a task's review build (review-build.ts) leaves on this computer, and
 * how worktree-cleanup.ts removes it: the app's window, its build folder in
 * the main checkout, bundles an older review-build.ts left in the shared
 * Cargo target, and the folders the OS made for the app's own identifier.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'

import { reviewIdentifier } from './worktree-common'

/** Folders the OS creates for an app of this identifier, per platform. */
function appDataDirs(identifier: string): string[] {
  const home = homedir()
  if (process.platform === 'darwin') {
    const library = join(home, 'Library')
    return [
      join(library, 'Application Support', identifier),
      join(library, 'Caches', identifier),
      join(library, 'WebKit', identifier),
      join(library, 'Logs', identifier),
      join(library, 'Preferences', `${identifier}.plist`),
      join(library, 'Saved Application State', `${identifier}.savedState`),
    ]
  }
  if (process.platform === 'win32') {
    return [process.env.APPDATA, process.env.LOCALAPPDATA]
      .filter((dir): dir is string => Boolean(dir))
      .map((dir) => join(dir, identifier))
  }
  return [
    join(home, '.local', 'share', identifier),
    join(home, '.cache', identifier),
    join(home, '.config', identifier),
  ]
}

/** `church-hub-T-023.app`, `church-hub-T-023_1.0_amd64.AppImage`; never `church-hub-T-0230.app`. */
function isBundleOf(name: string, taskId: string) {
  const prefix = `church-hub-${taskId}`
  return name.startsWith(prefix) && /^[._]/.test(name.slice(prefix.length))
}

/** Bundles an older review-build.ts left in the shared Cargo target (it now moves them out). */
function leftoverBundles(mainRoot: string, taskId: string): string[] {
  const target = join(mainRoot, 'app', 'tauri', 'target')
  const bundleRoot = join(target, 'release', 'bundle')
  const bundles = existsSync(bundleRoot)
    ? readdirSync(bundleRoot).flatMap((folder) =>
        readdirSync(join(bundleRoot, folder))
          .filter((name) => isBundleOf(name, taskId))
          .map((name) => join(bundleRoot, folder, name)),
      )
    : []
  return [...bundles, join(target, 'review-builds', taskId)]
}

/**
 * Closes the review app of a task if it is running: every process started from
 * its `.review-build/<task id>/` folder (the window and its sidecar).
 * Windows has no cheap command-line listing, so only the port is freed there.
 */
export function stopReviewApp(taskId: string) {
  if (process.platform === 'win32') return 'skipped on Windows'
  const listing = spawnSync('ps', ['-axo', 'pid=,command='], {
    encoding: 'utf8',
  }).stdout
  const folder = `${sep}.review-build${sep}${taskId}${sep}`
  const pids = listing
    .split('\n')
    .filter((line) => line.includes(folder))
    .map((line) => Number(line.trim().split(/\s+/)[0]))
    .filter((pid) => pid && pid !== process.pid)
  for (const pid of pids) process.kill(pid, 'SIGTERM')
  return pids.length > 0 ? `closed ${pids.length} process(es)` : 'not running'
}

/** Deletes a task's review build from the main checkout, the Cargo target and the OS app folders. */
export function removeReviewBuild(mainRoot: string, taskId: string) {
  const found = [
    join(mainRoot, '.review-build', taskId),
    ...leftoverBundles(mainRoot, taskId),
    ...appDataDirs(reviewIdentifier(taskId)),
  ].filter(existsSync)
  for (const path of found)
    rmSync(path, { recursive: true, force: true, maxRetries: 3 })
  return found.length > 0 ? `removed ${found.length} folder(s)` : 'nothing left'
}
