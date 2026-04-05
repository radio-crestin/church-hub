import * as Sentry from '@sentry/react'

export function initSentry() {
  Sentry.init({
    dsn: 'https://b03cb4a2222d30afae18571fb703c6f4@o4510714091536384.ingest.de.sentry.io/4510714105233488',
    release: `church-hub@${window.__appVersion || '0.0.0'}`,
    environment: window.__envMode || 'development',

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,
        fetch: true,
        history: true,
        xhr: true,
      }),
      Sentry.httpClientIntegration(),
      Sentry.dedupeIntegration(),
    ],

    // Disable performance monitoring (only capture errors)
    tracesSampleRate: 0,

    // Capture 100% of errors
    sampleRate: 1.0,

    // Attach stack traces to pure-message events
    attachStacktrace: true,

    // Max breadcrumbs for debugging context
    maxBreadcrumbs: 50,

    beforeSend(event, hint) {
      const error = hint?.originalException

      // Filter out known non-actionable errors
      if (error instanceof Error) {
        // Ignore ResizeObserver errors (browser quirk, not a real error)
        if (error.message?.includes('ResizeObserver loop')) {
          return null
        }
        // Ignore network errors when server is restarting
        if (
          error.message?.includes('Failed to fetch') &&
          window.__TAURI_INTERNALS__
        ) {
          return null
        }
      }

      event.tags = {
        ...event.tags,
        component: 'client',
        runtime: window.__TAURI_INTERNALS__ ? 'tauri' : 'browser',
      }

      // Add current route as context
      try {
        event.tags.route = window.location.pathname
      } catch {
        // ignore
      }

      return event
    },

    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null
      }
      return breadcrumb
    },
  })
}

export { Sentry }
