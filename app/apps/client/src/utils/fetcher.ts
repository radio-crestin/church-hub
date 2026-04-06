import { ClientOptions, fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { isMobile } from '~/config'
import { getStoredApiUrl, getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:fetcher')

// Default timeout for all fetch requests (15 seconds)
const DEFAULT_FETCH_TIMEOUT_MS = 15_000

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch ONLY on mobile (iOS WKWebView blocks HTTP fetch to non-HTTPS origins)
// On desktop Tauri, use window.fetch which shares the webview's cookie jar and HTTP context
const fetchFn = isTauri && isMobile() ? tauriFetch : window.fetch.bind(window)

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

  // Use the same hostname the client loaded from to stay same-origin
  // This avoids CORS issues with credentials: 'include'
  const hostname = window.location.hostname || 'localhost'

  return `http://${hostname}:${port}`
}

export async function fetcher<T>(
  url: string,
  options?: RequestInit & ClientOptions & { timeout?: number },
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

  const fullUrl = `${getApiBaseUrl()}${url}`
  const startTime = performance.now()

  const timeoutMs = options?.timeout ?? DEFAULT_FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Merge caller's signal with our timeout signal
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const res = await fetchFn(fullUrl, {
      ...(options ?? {}),
      credentials: 'include',
      headers,
      signal: controller.signal,
    })

    const duration = performance.now() - startTime

    if (!res.ok) {
      logger.warn(
        `API ${options?.method ?? 'GET'} ${url} returned ${res.status} (${duration.toFixed(0)}ms)`,
      )
    } else {
      logger.debug(
        `API ${options?.method ?? 'GET'} ${url} OK (${duration.toFixed(0)}ms)`,
      )
    }

    return await res.json()
  } catch (error) {
    const duration = performance.now() - startTime

    if (controller.signal.aborted && !options?.signal?.aborted) {
      const timeoutError = new Error(
        `API ${options?.method ?? 'GET'} ${url} timed out after ${timeoutMs}ms`,
      )
      timeoutError.name = 'TimeoutError'
      logger.error(timeoutError.message)
      throw timeoutError
    }

    logger.error(
      `API ${options?.method ?? 'GET'} ${url} failed (${duration.toFixed(0)}ms)`,
      error,
    )
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
