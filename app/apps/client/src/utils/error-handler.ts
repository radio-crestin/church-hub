/**
 * Global error handler for the client application.
 * Captures unhandled errors, promise rejections, and provides
 * structured error reporting to PostHog and the console logger.
 */
import { posthog } from '~/posthog'
import { createLogger } from './logger'

const logger = createLogger('app:error')

interface ErrorContext {
  source: string
  url?: string
  component?: string
  action?: string
  [key: string]: unknown
}

/**
 * Report an error with structured context to both PostHog and the logger.
 */
export function captureError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error))

  logger.error(`${context?.source ?? 'unknown'}: ${err.message}`, {
    ...context,
    stack: err.stack,
  })

  posthog.captureException(err, {
    source: context?.source ?? 'unknown',
    component: context?.component,
    ...context,
  })
}

/**
 * Report a warning-level issue (non-fatal but noteworthy).
 */
export function captureWarning(message: string, context?: ErrorContext): void {
  logger.warn(`${context?.source ?? 'unknown'}: ${message}`, context)

  posthog.capture('warning', {
    level: 'warning',
    message,
    source: context?.source ?? 'unknown',
    component: context?.component,
    ...context,
  })
}

/**
 * Initialize global error handlers for unhandled errors and rejections.
 * Call this once during app startup.
 */
export function initGlobalErrorHandlers(): void {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, {
      source: 'window.onerror',
      url: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, {
      source: 'unhandledrejection',
    })
  })

  // Capture resource loading errors (images, scripts, stylesheets)
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null
      if (target && target !== window && 'src' in target) {
        captureWarning('Resource failed to load', {
          source: 'resource-error',
          element: target.tagName,
          url:
            (target as HTMLImageElement).src ||
            (target as HTMLScriptElement).src,
        })
      }
    },
    true, // capture phase to catch resource errors
  )

  logger.info('Global error handlers initialized')
}

/**
 * Wrap an async function with error capturing.
 * Useful for event handlers and callbacks.
 */
export function withErrorCapture<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, context: ErrorContext): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      captureError(error, context)
      throw error
    }
  }) as T
}
