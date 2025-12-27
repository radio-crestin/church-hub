/**
 * API URL configuration service for mobile platforms
 * Stores the API URL in localStorage since we need it before connecting to the server
 * Supports auth URLs like: http://server:3000/api/auth/user/usr_TOKEN
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const API_URL_STORAGE_KEY = 'church-hub-api-url'
const USER_AUTH_STORAGE_KEY = 'church-hub-user-auth'

// Check if running in Tauri (v2 uses __TAURI_INTERNALS__)
const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

// Pattern to match auth URL: /api/auth/user/{token}
const AUTH_URL_PATTERN = /\/api\/auth\/user\/(usr_[A-Za-z0-9_]+)$/

/**
 * Parses an auth URL to extract base URL and user token
 * Input: http://192.168.88.12:3000/api/auth/user/usr_P7qMH2S1iFKVoJxX6c6uvUp8_D36OYju
 * Returns: { baseUrl: 'http://192.168.88.12:3000', userToken: 'usr_P7qMH2S1iFKVoJxX6c6uvUp8_D36OYju' }
 */
export function parseAuthUrl(url: string): {
  baseUrl: string
  userToken: string | null
} {
  const match = url.match(AUTH_URL_PATTERN)
  if (match) {
    const userToken = match[1]
    const baseUrl = url.replace(AUTH_URL_PATTERN, '')
    return { baseUrl, userToken }
  }
  // Not an auth URL, treat as base URL
  return { baseUrl: url.replace(/\/+$/, ''), userToken: null }
}

/**
 * Gets the stored API URL from localStorage
 * Returns null if no URL is configured
 */
export function getStoredApiUrl(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return localStorage.getItem(API_URL_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Gets the stored user auth token from localStorage
 */
export function getStoredUserToken(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return localStorage.getItem(USER_AUTH_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Saves the API URL and optional user token to localStorage
 * Also sets the user_auth cookie if a token is provided
 */
export function setApiUrl(url: string): void {
  if (typeof window === 'undefined') return

  try {
    const { baseUrl, userToken } = parseAuthUrl(url)

    // Store base URL
    localStorage.setItem(API_URL_STORAGE_KEY, baseUrl)

    // Store and set user token if present
    if (userToken) {
      localStorage.setItem(USER_AUTH_STORAGE_KEY, userToken)
      // Set cookie for API authentication
      document.cookie = `user_auth=${userToken}; path=/; SameSite=Lax`
    }
  } catch {
    // Silently fail - storage errors are not critical
  }
}

/**
 * Clears the stored API URL and user token
 */
export function clearApiUrl(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(API_URL_STORAGE_KEY)
    localStorage.removeItem(USER_AUTH_STORAGE_KEY)
    // Clear cookie
    document.cookie =
      'user_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  } catch {
    // Silently fail - storage errors are not critical
  }
}

/**
 * Validates a URL string
 * Returns true if the URL is valid HTTP/HTTPS
 */
export function isValidApiUrl(url: string): boolean {
  try {
    const { baseUrl } = parseAuthUrl(url)
    const parsed = new URL(baseUrl)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Tests connection to the API by pinging the health endpoint
 * If the URL contains an auth token, also verifies the token is valid
 * Returns { success: boolean, error?: string }
 */
export async function testApiConnection(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { baseUrl, userToken } = parseAuthUrl(url)

    // Use Tauri HTTP plugin in Tauri environment (bypasses WKWebView restrictions on iOS)
    const fetchFn = isTauri ? tauriFetch : fetch

    // Test basic connectivity
    const pingResponse = await fetchFn(`${baseUrl}/ping`, {
      method: 'GET',
    })

    if (!pingResponse.ok) {
      return { success: false, error: `Server returned ${pingResponse.status}` }
    }

    // If there's a user token, save it
    if (userToken) {
      document.cookie = `user_auth=${userToken}; path=/; SameSite=Lax`
      localStorage.setItem(USER_AUTH_STORAGE_KEY, userToken)
    }

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: `${error.name}: ${error.message}` }
    }
    return { success: false, error: 'Unknown error occurred' }
  }
}
