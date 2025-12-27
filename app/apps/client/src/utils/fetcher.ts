import { ClientOptions, fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getStoredApiUrl, getStoredUserToken } from '~/service/api-url'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Check if on mobile (iOS/Android in Tauri)
function isMobile(): boolean {
  if (!isTauri) return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('iphone') || ua.includes('ipad') || ua.includes('android')
}

// Use Tauri fetch in Tauri mode, browser fetch in web mode
const fetchFn = isTauri ? tauriFetch : window.fetch.bind(window)

/**
 * Gets the API base URL
 * - On mobile: use the stored API URL from localStorage
 * - In Tauri desktop: use localhost with the sidecar port
 * - In browser: use the same hostname the client accessed from
 */
function getApiBaseUrl(): string {
  // On mobile, use stored API URL
  if (isMobile()) {
    const storedUrl = getStoredApiUrl()
    if (storedUrl) return storedUrl
  }

  const port =
    window.__serverConfig?.serverPort ??
    import.meta.env.VITE_SERVER_PORT ??
    3000

  // In Tauri desktop, always use localhost (sidecar runs locally)
  // In browser, use the same hostname the client used to access the app
  const hostname = isTauri
    ? 'localhost'
    : window.location.hostname || 'localhost'

  return `http://${hostname}:${port}`
}

export async function fetcher<T>(
  url: string,
  options?: RequestInit & ClientOptions,
): Promise<T> {
  // Get auth token for mobile
  const userToken = isMobile() ? getStoredUserToken() : null

  // Build headers with auth token if on mobile
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) ?? {}),
  }

  // Add auth cookie header for mobile (Tauri HTTP plugin needs explicit Cookie header)
  if (userToken) {
    headers['Cookie'] = `user_auth=${userToken}`
  }

  const res = await fetchFn(`${getApiBaseUrl()}${url}`, {
    ...(options ?? {}),
    credentials: 'include',
    headers,
  })
  return await res.json()
}
