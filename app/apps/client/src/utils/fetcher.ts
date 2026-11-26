import type { ClientOptions } from '@tauri-apps/plugin-http'

import { getApiUrl } from '~/config'
import { trackServerDatabase } from '~/features/server-identity/utils/trackServerDatabase'
import { apiFetch } from '~/utils/apiFetch'
import { getAuthHeaders } from '~/utils/getAuthHeaders'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:fetcher')

// Default timeout for all fetch requests (15 seconds)
const DEFAULT_FETCH_TIMEOUT_MS = 15_000

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

  const fullUrl = `${getApiUrl() ?? window.location.origin}${url}`
  const startTime = performance.now()

  const timeoutMs = options?.timeout ?? DEFAULT_FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Merge caller's signal with our timeout signal
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const res = await apiFetch(fullUrl, {
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
