import { parseReleaseBody } from './parseReleaseBody'
import type { VersionNotes } from '../types'

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/radio-crestin/church-hub/releases'

interface GithubRelease {
  tag_name: string
  body: string
  published_at: string
  draft: boolean
  prerelease: boolean
}

/**
 * Fetches published releases from GitHub and parses their bodies into
 * structured notes. Used to augment the bundled (offline) changelog with any
 * versions released after the current build. Throws on network/HTTP failure so
 * the caller can fall back to the bundled baseline.
 */
export async function fetchGithubReleaseNotes(): Promise<VersionNotes[]> {
  const response = await fetch(GITHUB_RELEASES_URL, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch releases: ${response.statusText}`)
  }

  const releases: GithubRelease[] = await response.json()

  return releases
    .filter((r) => !r.draft && !r.prerelease)
    .map((r) => parseReleaseBody(r.tag_name, r.published_at, r.body || ''))
}
