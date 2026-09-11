import { getVersion } from '@tauri-apps/api/app'
import { check, type Update } from '@tauri-apps/plugin-updater'

import { compareVersions } from '~/features/release-notes'
import { isTauri } from '~/utils/isTauri'

const GITHUB_REPO = 'radio-crestin/church-hub'
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`

export interface GithubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  published_at: string
  draft: boolean
  prerelease: boolean
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
  /**
   * True when the updater holds a signed build for this machine. Only ever
   * in the desktop app: a browser tab can read about a release, not apply it.
   */
  installable: boolean
}

export interface UpdateCheck {
  info: UpdateInfo
  /** The updater's handle for downloading and installing, when installable. */
  update: Update | null
}

/**
 * Fetches the current app version
 */
export async function getCurrentVersion(): Promise<string> {
  if (isTauri()) {
    try {
      return await getVersion()
    } catch {
      return 'Unknown'
    }
  }
  return __appVersion
}

function releaseUrlFor(version: string): string {
  return `https://github.com/${GITHUB_REPO}/releases/tag/v${version}`
}

function upToDate(currentVersion: string): UpdateInfo {
  return {
    currentVersion,
    latestVersion: currentVersion,
    hasUpdate: false,
    releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
    releaseNotes: '',
    publishedAt: '',
    installable: false,
  }
}

/**
 * Desktop: the updater plugin reads the signed manifest of the latest
 * published release (`latest.json`), compares versions as semver in Rust
 * and hands back a handle for the download when a newer build exists for
 * this machine. Nothing here touches the GitHub API, so there is no rate
 * limit to run into.
 */
async function checkWithUpdater(): Promise<UpdateCheck> {
  const update = await check()
  if (!update) {
    return { info: upToDate(await getCurrentVersion()), update: null }
  }

  // The manifest's own timestamp is what the workflow wrote; the plugin's
  // formatted copy is the fallback.
  const publishedAt =
    typeof update.rawJson.pub_date === 'string'
      ? update.rawJson.pub_date
      : (update.date ?? '')

  return {
    info: {
      currentVersion: update.currentVersion,
      latestVersion: update.version,
      hasUpdate: true,
      releaseUrl: releaseUrlFor(update.version),
      releaseNotes: update.body ?? '',
      publishedAt,
      installable: true,
    },
    update,
  }
}

/**
 * Browser: a tab controlling the app from another machine cannot install
 * anything, but it can still say a newer release exists. The GitHub API is
 * used because it answers cross-origin requests; the release download URLs
 * do not.
 */
async function checkWithGithub(currentVersion: string): Promise<UpdateInfo> {
  const response = await fetch(GITHUB_RELEASES_URL, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch releases: ${response.statusText}`)
  }

  const releases: GithubRelease[] = await response.json()
  const latestRelease = releases.find((r) => !r.draft && !r.prerelease)
  if (!latestRelease) return upToDate(currentVersion)

  const latestVersion = latestRelease.tag_name.replace(/^v/, '')
  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    releaseUrl: latestRelease.html_url,
    releaseNotes: latestRelease.body,
    publishedAt: latestRelease.published_at,
    installable: false,
  }
}

/**
 * Checks for a newer release. A failed check reads as "up to date" rather
 * than an error: the check runs on its own every hour, and a machine that
 * is offline for a while should not keep announcing a problem.
 */
export async function checkForUpdates(): Promise<UpdateCheck> {
  if (isTauri()) {
    try {
      return await checkWithUpdater()
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Error logging for debugging update check failures
      console.error('Failed to check for updates:', error)
      return { info: upToDate(await getCurrentVersion()), update: null }
    }
  }

  const currentVersion = await getCurrentVersion()
  try {
    return { info: await checkWithGithub(currentVersion), update: null }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging for debugging update check failures
    console.error('Failed to check for updates:', error)
    return { info: upToDate(currentVersion), update: null }
  }
}
