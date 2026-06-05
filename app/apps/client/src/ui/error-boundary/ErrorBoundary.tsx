import { Component, type ErrorInfo, type ReactNode } from 'react'

import { captureError } from '~/utils/error-handler'

/**
 * Top-level React error boundary — the safety net for render crashes that the
 * router's `defaultErrorComponent` can't catch (provider failures, errors in
 * the layout shell itself). Without it, such a throw unmounts the whole app to
 * a blank screen and nothing is reported.
 *
 * The fallback is deliberately self-contained: it reads the persisted language
 * directly and uses no hooks/providers, so it still renders even when the crash
 * was in a provider above it. componentDidCatch routes the error through
 * captureError → PostHog + console + the on-disk server log.
 */

const lang: 'en' | 'ro' = (() => {
  try {
    return localStorage.getItem('church-hub-language') === 'ro' ? 'ro' : 'en'
  } catch {
    return 'en'
  }
})()

const STRINGS = {
  title: {
    en: 'Something went wrong',
    ro: 'Ceva nu a funcționat',
  },
  description: {
    en: 'The app hit an unexpected error. It has been reported automatically.',
    ro: 'Aplicația a întâmpinat o eroare neașteptată. A fost raportată automat.',
  },
  reload: { en: 'Reload', ro: 'Reîncarcă' },
} as const

const t = (key: keyof typeof STRINGS): string => STRINGS[key][lang]

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    captureError(error, {
      source: 'react-error-boundary',
      component: 'ErrorBoundary',
      componentStack: info.componentStack ?? undefined,
    })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          background: '#000',
          color: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 99999,
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
          {t('title')}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: '380px',
            color: '#9ca3af',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          {t('description')}
        </p>
        {this.state.message ? (
          <p
            style={{
              margin: 0,
              maxWidth: '360px',
              color: '#6b7280',
              fontSize: '12px',
              wordBreak: 'break-word',
            }}
          >
            {this.state.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            background: '#4f46e5',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('reload')}
        </button>
      </div>
    )
  }
}
