/**
 * The GitHub side of a finished task, for worktree-cleanup.ts: its merged
 * remote branch and its installers in the shared `pr-builds` prerelease. Every function
 * answers with a sentence for the step log and never throws when `gh` is
 * missing, offline or not logged in: the local cleanup must still finish.
 *
 * Never deleted here: demo videos (`pr-demos-*` releases, `pr-demo-videos`
 * branch), which the pull request embeds for good.
 */

import { spawnSync } from 'node:child_process'

export interface PullRequest {
  number: number
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  headRefOid: string
}

const KEPT_BRANCHES = new Set(['main', 'master', 'pr-assets', 'pr-demo-videos'])

/** Runs `gh` or `git`; undefined when it fails (missing, offline, not logged in, not found). */
function ask(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : undefined
}

/** The branch's open pull request, else its newest one; undefined when none or `gh` is unusable. */
export function findPullRequest(
  mainRoot: string,
  branch: string,
): PullRequest | undefined {
  const json = ask(
    'gh',
    [
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'all',
      '--limit',
      '5',
      '--json',
      'number,state,headRefOid',
    ],
    mainRoot,
  )
  if (!json) return undefined
  const pulls = JSON.parse(json) as PullRequest[]
  return pulls.find((pull) => pull.state === 'OPEN') ?? pulls[0]
}

/** Deletes `origin/<branch>` once its pull request is merged and nothing was pushed after the merged head. */
export function deleteRemoteBranch(
  mainRoot: string,
  branch: string,
  pull: PullRequest | undefined,
) {
  if (KEPT_BRANCHES.has(branch)) return `kept origin/${branch}: protected`
  if (!pull) return `kept origin/${branch}: no pull request found`
  if (pull.state !== 'MERGED')
    return `kept origin/${branch}: PR #${pull.number} is ${pull.state.toLowerCase()}`
  const listed = ask(
    'git',
    ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`],
    mainRoot,
  )
  if (listed === undefined) return `kept origin/${branch}: remote unreachable`
  const remoteTip = listed.split(/\s+/)[0]
  if (!remoteTip) return `origin/${branch} already gone`
  if (remoteTip !== pull.headRefOid)
    return `kept origin/${branch}: pushed after PR #${pull.number} was merged`
  const deleted =
    ask('git', ['push', 'origin', '--delete', branch], mainRoot) !== undefined
  return deleted
    ? `deleted origin/${branch} (PR #${pull.number} merged)`
    : `kept origin/${branch}: git push --delete failed`
}

const PR_BUILDS_TAG = 'pr-builds'

interface ReleaseAsset {
  id: number
  name: string
}

/** Deletes a merged or closed pull request's installers (`church-hub-<platform>-pr-<n>-<sha>.<ext>`) from the shared `pr-builds` prerelease. */
export function deletePrBuildRelease(
  mainRoot: string,
  pull: Pick<PullRequest, 'number' | 'state'> | undefined,
) {
  if (!pull) return 'no pull request, no installers to remove'
  if (pull.state === 'OPEN') return `kept: PR #${pull.number} is still open`
  const listed = ask(
    'gh',
    [
      'api',
      `repos/{owner}/{repo}/releases/tags/${PR_BUILDS_TAG}`,
      '--jq',
      '.assets | map({id, name})',
    ],
    mainRoot,
  )
  if (listed === undefined) return `no ${PR_BUILDS_TAG} release`
  const marker = `-pr-${pull.number}-`
  const mine = (JSON.parse(listed) as ReleaseAsset[]).filter((asset) =>
    asset.name.includes(marker),
  )
  if (mine.length === 0) return `no installers of PR #${pull.number}`
  const failed = mine.filter(
    (asset) =>
      ask(
        'gh',
        ['api', '-X', 'DELETE', `repos/{owner}/{repo}/releases/assets/${asset.id}`],
        mainRoot,
      ) === undefined,
  )
  return failed.length === 0
    ? `deleted ${mine.length} installers of PR #${pull.number}`
    : `kept ${failed.length} installers of PR #${pull.number}: delete failed`
}
