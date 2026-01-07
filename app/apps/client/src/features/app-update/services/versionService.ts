import { getVersion } from '@tauri-apps/api/app'
import { arch, type } from '@tauri-apps/plugin-os'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const GITHUB_REPO = 'radio-crestin/church-hub'
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

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
  return 'Web'
}

/**
 * Gets the platform-specific download asset name pattern
 */
function getAssetPattern(): RegExp | null {
  if (!isTauri) return null

  const osType = type()
  const osArch = arch()

  // Map OS and arch to GitHub release asset patterns
  if (osType === 'macos') {
    if (osArch === 'aarch64') {
      return /church-hub.*aarch64\.dmg$/i
    }
    return /church-hub.*x64\.dmg$/i
  }

  if (osType === 'windows') {
    if (osArch === 'aarch64') {
      return /church-hub.*arm64.*setup\.exe$/i
    }
    return /church-hub.*x64.*setup\.exe$/i
  }

  if (osType === 'linux') {
    if (osArch === 'aarch64') {
      return /church-hub.*aarch64\.(AppImage|deb)$/i
    }
    return /church-hub.*amd64\.(AppImage|deb)$/i
  }

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

  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch release: ${response.statusText}`)
    }

    const release: GithubRelease = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, '')
    const hasUpdate = isNewerVersion(currentVersion, latestVersion)
    const downloadUrl = findDownloadUrl(release.assets)

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl: release.html_url,
      releaseNotes: release.body,
      downloadUrl,
      publishedAt: release.published_at,
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging for debugging update check failures
    console.error('Failed to check for updates:', error)
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
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
