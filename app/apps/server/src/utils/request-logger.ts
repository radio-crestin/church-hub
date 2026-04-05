/**
 * Request logging utility for HTTP request/response tracking.
 * Logs request method, path, duration, status code, and errors.
 * Controlled by DEBUG environment variable.
 */
import * as Sentry from '@sentry/bun'

import { createLogger } from './logger'

const logger = createLogger('http')


/**
 * Log an incoming HTTP request and return a function to log the response.
 */
export function logRequest(req: Request): () => void {
  const url = new URL(req.url)
  const _startTime = performance.now()
  const method = req.method
  const path = url.pathname

  // Skip noisy endpoints from debug logging
  const isNoisy =
    path === '/ping' ||
    path === '/ws' ||
    path.startsWith('/api/presentation/state') ||
    path.startsWith('/api/music/player/status')

  if (!isNoisy) {
    logger.debug(`→ ${method} ${path}`)
  }

  // Add Sentry breadcrumb for every request
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${method} ${path}`,
    level: 'info',
    data: {
      method,
      url: path,
    },
  })

  return () => {
    // Called after response is sent (not used in current flow, but available)
  }
}

/**
 * Log a completed request with status and duration.
 */
export function logResponse(
  req: Request,
  status: number,
  startTime: number,
): void {
  const url = new URL(req.url)
  const duration = performance.now() - startTime
  const method = req.method
  const path = url.pathname

  // Skip noisy endpoints
  const isNoisy =
    path === '/ping' ||
    path === '/ws' ||
    path.startsWith('/api/presentation/state') ||
    path.startsWith('/api/music/player/status')

  if (status >= 500) {
    logger.error(`← ${method} ${path} ${status} (${duration.toFixed(0)}ms)`)
  } else if (status >= 400) {
    logger.warning(`← ${method} ${path} ${status} (${duration.toFixed(0)}ms)`)
  } else if (!isNoisy) {
    logger.debug(`← ${method} ${path} ${status} (${duration.toFixed(0)}ms)`)
  }

  // Log slow requests as warnings (over 2 seconds)
  if (duration > 2000 && !isNoisy) {
    logger.warning(
      `Slow request: ${method} ${path} took ${duration.toFixed(0)}ms`,
    )
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Slow request: ${method} ${path}`,
      level: 'warning',
      data: { duration, status },
    })
  }
}

/**
 * Capture and log an API error with full context.
 */
export function logApiError(
  req: Request,
  error: unknown,
  startTime: number,
): void {
  const url = new URL(req.url)
  const duration = performance.now() - startTime
  const method = req.method
  const path = url.pathname

  const err = error instanceof Error ? error : new Error(String(error))

  logger.error(
    `API Error: ${method} ${path} (${duration.toFixed(0)}ms) - ${err.message}`,
  )

  Sentry.captureException(err, {
    tags: {
      component: 'server',
      source: 'api-handler',
      method,
      path,
    },
    extra: {
      duration,
      url: path,
      method,
    },
  })
}
