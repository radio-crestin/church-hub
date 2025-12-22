/**
 * Application configuration
 */

const API_PORT = import.meta.env.VITE_API_PORT || '3000'

// Check if we're running in Tauri mode
const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Gets the API host - uses the same hostname the client used to access the app
 * This ensures that if user accesses via 192.168.88.12:8086, API calls go to 192.168.88.12:3000
 * In Tauri mode, always use localhost since the sidecar runs locally
 */
function getApiHost(): string {
  // In Tauri, always use localhost (sidecar runs locally)
  if (isTauri) {
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
 */
export function getApiUrl(): string {
  return `http://${getApiHost()}:${API_PORT}`
}

/**
 * Returns the WebSocket URL
 */
export function getWsUrl(): string {
  return `ws://${getApiHost()}:${API_PORT}`
}

/**
 * Checks if the client is accessing from localhost
 * In Tauri mode, always returns true since sidecar runs locally
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false

  // In Tauri, always treat as localhost
  if (isTauri) return true

  const hostname = window.location.hostname.toLowerCase()
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('127.') ||
    hostname === 'tauri.localhost'
  )
}
