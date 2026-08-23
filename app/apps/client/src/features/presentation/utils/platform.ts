export type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

/** The desktop OS the app is running on, read off the browser. */
export function getCurrentPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows'
  }
  if (
    platform.includes('mac') ||
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os')
  ) {
    return 'macos'
  }
  if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux'
  }
  return 'unknown'
}
