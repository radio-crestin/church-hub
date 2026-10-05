import { ClientOptions, fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { isMobile } from '~/config'
import { trackServerDatabase } from '~/features/server-identity/utils/trackServerDatabase'
import { getStoredApiUrl } from '~/service/api-url'
import { getAuthHeaders } from '~/utils/getAuthHeaders'
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

type FetcherOptions = RequestInit & ClientOptions & { timeout?: number }

/** The parsed JSON body, whatever the HTTP status (see `fetchJsonWithStatus`). */
export async function fetcher<T>(
  url: string,
  options?: FetcherOptions,
): Promise<T> {
  return (await fetchJsonWithStatus<T>(url, options)).body
}

/**
 * Like `fetcher`, plus the HTTP status, for callers that must tell "the server
 * has no such thing" (404) apart from any other failure.
 */
export async function fetchJsonWithStatus<T>(
  url: string,
  options?: FetcherOptions,
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) ?? {}),
    ...getAuthHeaders(),
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

    // Another Church Hub answered: the window reloads; never use its answer.
    if (trackServerDatabase(res)) return new Promise(() => {})

    if (!res.ok) {
      logger.warn(
        `API ${options?.method ?? 'GET'} ${url} returned ${res.status} (${duration.toFixed(0)}ms)`,
      )
    } else {
      logger.debug(
        `API ${options?.method ?? 'GET'} ${url} OK (${duration.toFixed(0)}ms)`,
      )
    }

    return { status: res.status, body: await res.json() }
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
