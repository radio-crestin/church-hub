const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface SystemInfo {
  osVersion: string
  appVersion: string
}

/** OS and app version for the request's context; the web app reports `Web`. */
export async function getSystemInfo(): Promise<SystemInfo> {
  if (!isTauri) {
    return { osVersion: navigator.userAgent, appVersion: 'Web' }
  }

  let appVersion = 'Unknown'
  let osVersion = navigator.userAgent
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    appVersion = await getVersion()
  } catch {
    // Keep 'Unknown': the version is context, not a reason to block the request.
  }
  try {
    const { type, version, arch } = await import('@tauri-apps/plugin-os')
    osVersion = `${type()} ${version()} (${arch()})`
  } catch {
    // Keep the user agent as the OS description.
  }
  return { osVersion, appVersion }
}
