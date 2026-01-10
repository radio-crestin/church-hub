/**
 * Application configuration
 */

import { getStoredApiUrl } from './service/api-url'

const API_PORT = import.meta.env.VITE_API_PORT || '3000'

// Check if we're running in Tauri mode
const isTauriEnv =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Returns true if running in Tauri context
 */
export function isTauri(): boolean {
  return isTauriEnv
}

/**
 * Checks if we're running on a mobile platform (iOS/Android) in Tauri
 * Note: iPadOS 13+ identifies as Mac in user agent, so we also check for touch support
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  if (!isTauriEnv) return false

  const ua = navigator.userAgent.toLowerCase()

  // Direct mobile detection
  if (
    ua.includes('iphone') ||
    ua.includes('ipad') ||
    ua.includes('ipod') ||
    ua.includes('android')
  ) {
    return true
  }

  // iPadOS 13+ detection: identifies as Mac but has touch support
  // This catches iPad in "desktop mode" which reports as Macintosh
  if (ua.includes('macintosh') && navigator.maxTouchPoints > 1) {
    return true
  }

  return false
}

/**
 * Checks if the API URL needs to be configured on mobile
 * Returns true if on mobile and no API URL is stored
 */
export function needsApiUrlConfiguration(): boolean {
  if (!isMobile()) return false
  return getStoredApiUrl() === null
}

/**
 * Gets the API host - uses the same hostname the client used to access the app
 * This ensures that if user accesses via 192.168.88.12:3000, API calls go to 192.168.88.12:3000
 * In Tauri desktop mode, always use localhost since the sidecar runs locally
 * In Tauri mobile mode, uses the stored API URL from localStorage
 */
function getApiHost(): string {
  // In Tauri desktop, always use localhost (sidecar runs locally)
  if (isTauriEnv && !isMobile()) {
    return 'localhost'
  }

  // Check for explicit env override first
  const envHost = import.meta.env.VITE_API_HOST
  if (envHost) return envHost

  // Use the same hostname the client used to access the app
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname
  }

  // Fallback for SSR or non-browser environments
  return '127.0.0.1'
}

/**
 * Returns the base API URL
 * On mobile, uses the stored API URL from localStorage
 */
export function getApiUrl(): string | null {
  // On mobile, use the stored API URL
  if (isMobile()) {
    const storedUrl = getStoredApiUrl()
    return storedUrl // Returns null if not configured
  }

  return `http://${getApiHost()}:${API_PORT}`
}

/**
 * Returns the WebSocket URL
 * On mobile, derives from the stored API URL
 */
export function getWsUrl(): string | null {
  // On mobile, derive WS URL from stored API URL
  if (isMobile()) {
    const storedUrl = getStoredApiUrl()
    if (!storedUrl) return null

    // Convert http(s):// to ws(s)://
    return storedUrl.replace(/^http/, 'ws')
  }

  return `ws://${getApiHost()}:${API_PORT}`
}

/**
 * Checks if the client is accessing from localhost
 * In Tauri desktop mode, always returns true since sidecar runs locally
 * In Tauri mobile mode, returns false since we connect to remote API
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false

  // On mobile, we're connecting to a remote API
  if (isMobile()) return false

  // In Tauri desktop, always treat as localhost
  if (isTauriEnv) return true

  const hostname = window.location.hostname.toLowerCase()
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('127.') ||
    hostname === 'tauri.localhost'
  )
}
