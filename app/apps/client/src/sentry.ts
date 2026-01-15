import * as Sentry from '@sentry/react'

export function initSentry() {
  Sentry.init({
    dsn: 'https://b03cb4a2222d30afae18571fb703c6f4@o4510714091536384.ingest.de.sentry.io/4510714105233488',
    release: `church-hub@${window.__appVersion || '0.0.0'}`,
    environment: window.__envMode || 'development',

    integrations: [Sentry.browserTracingIntegration()],

    // Disable performance monitoring (only capture errors)
    tracesSampleRate: 0,

    beforeSend(event) {
      event.tags = {
        ...event.tags,
        component: 'client',
        runtime: window.__TAURI_INTERNALS__ ? 'tauri' : 'browser',
      }
      return event
    },
  })
}

export { Sentry }
