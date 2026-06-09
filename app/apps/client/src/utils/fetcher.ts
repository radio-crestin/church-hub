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
 * - In browser: use the page's own origin (the API server is what serves
 *   the page — it proxies Vite in dev and serves the built client in prod)
 */
function getApiBaseUrl(): string {
  // On mobile, use stored API URL
  if (isMobile()) {
    const storedUrl = getStoredApiUrl()
    if (storedUrl) return storedUrl
  }

  // Plain browser: the page origin IS the API origin, whatever the port —
  // main app on 3000, worktrees on 3002 — no compile-time env needed.
  if (!isTauri) {
    return window.location.origin
  }

  // Tauri desktop loads the frontend at `http://tauri.localhost` but the
  // sidecar binds to localhost — using `tauri.localhost` here makes every
  // fetch fail the document CSP (`connect-src http://localhost:*`). Force
  // `localhost` so the URL matches CSP; CORS handles cross-origin allow.
  const port =
    window.__serverConfig?.serverPort ??
    import.meta.env.VITE_SERVER_PORT ??
    3000

  return `http://localhost:${port}`
}

export async function fetcher<T>(
  url: string,
  options?: RequestInit & ClientOptions & { timeout?: number },
): Promise<T> {
  // Auth token for Tauri (mobile + desktop). In a browser the same-origin
  // cookie is used, so no explicit header is needed.
  const userToken = isTauri ? getStoredUserToken() : null

  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) ?? {}),
  }

  // Mobile uses the Tauri HTTP plugin, which can set the `Cookie` header.
  // Desktop uses `window.fetch`, which forbids the `Cookie` header — and macOS
  // WKWebView won't store the cross-site `Secure` cookie anyway — so send the
  // token in `X-User-Auth` (read as a fallback by the server auth middleware).
  if (userToken) {
    if (isMobile()) {
      headers['Cookie'] = `user_auth=${userToken}`
    } else {
      headers['X-User-Auth'] = userToken
    }
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
