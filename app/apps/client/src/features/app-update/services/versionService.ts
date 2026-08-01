import { getVersion } from '@tauri-apps/api/app'
import { arch, type } from '@tauri-apps/plugin-os'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const GITHUB_REPO = 'radio-crestin/church-hub'
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`

export interface GithubAsset {
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

export interface GithubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  published_at: string
  draft: boolean
  prerelease: boolean
  assets: GithubAsset[]
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNotes: string
  downloadUrl: string | null
  publishedAt: string
}

/**
 * Fetches the current app version
 */
export async function getCurrentVersion(): Promise<string> {
  if (isTauri) {
    try {
      return await getVersion()
    } catch {
      return 'Unknown'
    }
  }
  return __appVersion
}

/**
 * Matches the release asset for this machine.
 *
 * A release carries the same build under two names: Tauri's raw bundle
 * (`church-hub_0.1.85_aarch64.dmg`) and the workflow's renamed copy
 * (`church-hub-macos-arm64-v-0.1.85.dmg`). These patterns target the renamed
 * ones — they are what the release notes link to, they carry the version, and
 * they are stable against Tauri changing its bundle naming.
 */
function getAssetPattern(): RegExp | null {
  if (!isTauri) return null

  let osType: string
  let osArch: string
  try {
    osType = type()
    osArch = arch()
  } catch {
    return null
  }

  if (osType === 'macos') {
    return osArch === 'aarch64'
      ? /church-hub-macos-arm64-.*\.dmg$/i
      : /church-hub-macos-x64-.*\.dmg$/i
  }

  if (osType === 'windows') {
    return osArch === 'aarch64'
      ? /church-hub-windows-arm64-.*\.exe$/i
      : /church-hub-windows-x64-.*\.exe$/i
  }

  // Linux is not built by the release workflow yet; nothing to offer.
  return null
}

/**
 * Finds the appropriate download URL for the current platform
 */
function findDownloadUrl(assets: GithubAsset[]): string | null {
  const pattern = getAssetPattern()
  if (!pattern) return null

  const asset = assets.find((a) => pattern.test(a.name))
  return asset?.browser_download_url ?? null
}

/**
 * Compares two version strings (semver format)
 * Returns true if version2 is newer than version1
 */
function isNewerVersion(current: string, latest: string): boolean {
  // Remove 'v' prefix if present
  const v1 = current.replace(/^v/, '')
  const v2 = latest.replace(/^v/, '')

  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0

    if (p2 > p1) return true
    if (p2 < p1) return false
  }

  return false
}

/**
 * Fetches the latest release from GitHub and checks for updates
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = await getCurrentVersion()
  const releasesPageUrl = `https://github.com/${GITHUB_REPO}/releases`

  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.statusText}`)
    }

    const releases: GithubRelease[] = await response.json()

    // Find the latest non-draft, non-prerelease release
    const latestRelease = releases.find((r) => !r.draft && !r.prerelease)

    if (!latestRelease) {
      // No releases available yet
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseUrl: releasesPageUrl,
        releaseNotes: '',
        downloadUrl: null,
        publishedAt: '',
      }
    }

    const latestVersion = latestRelease.tag_name.replace(/^v/, '')
    const hasUpdate = isNewerVersion(currentVersion, latestVersion)
    const downloadUrl = findDownloadUrl(latestRelease.assets)

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl: latestRelease.html_url,
      releaseNotes: latestRelease.body,
      downloadUrl,
      publishedAt: latestRelease.published_at,
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging for debugging update check failures
    console.error('Failed to check for updates:', error)
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseUrl: releasesPageUrl,
      releaseNotes: '',
      downloadUrl: null,
      publishedAt: '',
    }
  }
}

/**
 * Opens the download URL or release page
 */
export async function openDownloadUrl(url: string): Promise<void> {
  if (isTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}
