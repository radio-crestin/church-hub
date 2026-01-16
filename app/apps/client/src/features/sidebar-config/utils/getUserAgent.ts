import { isTauri } from '~/utils/isTauri'

/**
 * User agents for different operating systems
 * Uses modern Chrome versions for compatibility with sites like YouTube and WhatsApp Web
 */
const USER_AGENTS = {
  macos:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
} as const

// Cache the detected OS to avoid repeated async calls
let cachedOs: 'macos' | 'windows' | 'linux' | null = null

/**
 * Detects the current operating system
 */
async function detectOs(): Promise<'macos' | 'windows' | 'linux'> {
  if (cachedOs) return cachedOs

  if (isTauri()) {
    try {
      const { type } = await import('@tauri-apps/plugin-os')
      const osType = type()

      if (osType === 'macos') {
        cachedOs = 'macos'
      } else if (osType === 'windows') {
        cachedOs = 'windows'
      } else {
        // Default to Linux for other Unix-like systems
        cachedOs = 'linux'
      }
      return cachedOs
    } catch {
      // Fall through to navigator detection
    }
  }

  // Fallback: detect from navigator
  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes('win') || userAgent.includes('windows')) {
    cachedOs = 'windows'
  } else if (
    platform.includes('mac') ||
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os')
  ) {
    cachedOs = 'macos'
  } else {
    cachedOs = 'linux'
  }

  return cachedOs
}

/**
 * Gets the Chrome user agent string appropriate for the current operating system
 */
export async function getChromeUserAgent(): Promise<string> {
  const os = await detectOs()
  return USER_AGENTS[os]
}

/**
 * Gets the Chrome user agent synchronously using cached value or fallback
 * Use this when you cannot use async (e.g., in constructors)
 */
export function getChromeUserAgentSync(): string {
  if (cachedOs) {
    return USER_AGENTS[cachedOs]
  }

  // Synchronous fallback detection
  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes('win') || userAgent.includes('windows')) {
    return USER_AGENTS.windows
  } else if (
    platform.includes('mac') ||
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os')
  ) {
    return USER_AGENTS.macos
  }

  return USER_AGENTS.linux
}
