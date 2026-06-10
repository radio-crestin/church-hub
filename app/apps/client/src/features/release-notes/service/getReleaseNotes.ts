import { fetchGithubReleaseNotes } from './fetchGithubReleaseNotes'
import { getBundledReleaseNotes } from './getBundledReleaseNotes'
import { mergeReleaseNotes } from './mergeReleaseNotes'
import type { VersionNotes } from '../types'

/**
 * Resolves the full release-notes list: the bundled offline baseline merged
 * with any newer versions from GitHub. Network failures degrade gracefully to
 * the bundled data so the section always renders.
 */
export async function getReleaseNotes(): Promise<VersionNotes[]> {
  const bundled = getBundledReleaseNotes()
  try {
    const remote = await fetchGithubReleaseNotes()
    return mergeReleaseNotes(bundled, remote)
  } catch {
    return bundled
  }
}
