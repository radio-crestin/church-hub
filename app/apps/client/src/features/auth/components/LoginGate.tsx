import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'
import {
  getLocalUsers,
  getLoginRedirectUrl,
  login,
  type LoginResult,
} from '~/features/users/service'
import type { LocalUser } from '~/features/users/types'
import { usePermissions } from '~/provider/permissions-provider'
import { LoginScreen } from './LoginScreen'

// Per-window-session marker: set once the operator has explicitly chosen an
// account for this launch. sessionStorage is cleared when the app window is
// closed, so a fresh launch shows the picker again; it survives the in-window
// reload caused by the login redirect, so we don't re-prompt mid-session.
const SELECTION_FLAG = 'church-hub-user-selected'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
  )
}

function ConnectionLost() {
  const { t } = useTranslation('common')
  const { refresh } = usePermissions()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center dark:bg-gray-900">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('errors.connectionLostTitle')}
      </h1>
      <p className="max-w-md text-gray-600 dark:text-gray-400">
        {t('errors.connectionLost')}
      </p>
      <button
        onClick={() => refresh()}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
      >
        {t('buttons.retry')}
      </button>
    </div>
  )
}

/**
 * Gates the app behind a local login. Because the server no longer grants
 * automatic access to localhost, the app must establish a session before any
 * authenticated request fires — so this wraps the app tree and blocks it until
 * a user is signed in.
 *
 * Behaviour:
 *  - A single passwordless account (fresh install) auto-signs-in — zero friction.
 *  - When there are multiple accounts (or a single password-protected one), the
 *    account picker is shown ONCE per app launch — even if a previous session
 *    is still valid — so whoever opens the app chooses who they are.
 *
 * On mobile the existing token/connection flow (MobileConnectionGuard) handles
 * auth, so this gate steps aside.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isConnectionError, refresh } =
    usePermissions()
  const [users, setUsers] = useState<LocalUser[] | null>(null)
  const [autoLoginTried, setAutoLoginTried] = useState(false)
  const [autoLoggingIn, setAutoLoggingIn] = useState(false)

  const enabled = !isMobile() && !isLoading && !isConnectionError

  // Fetch the user list — needed even when already authenticated, to decide
  // whether the picker should be shown for this launch.
  useEffect(() => {
    if (!enabled || users !== null) return
    let cancelled = false
    getLocalUsers()
      .then((list) => {
        if (!cancelled) setUsers(list)
      })
      .catch(() => {
        if (!cancelled) setUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [enabled, users])

  // A single passwordless account requires no choice.
  const soleAutoLogin = !!users && users.length === 1 && !users[0].hasPassword

  // Auto-login that single passwordless account (fresh install).
  useEffect(() => {
    if (!enabled || !users || autoLoginTried || isAuthenticated) return
    if (soleAutoLogin) {
      setAutoLoginTried(true)
      setAutoLoggingIn(true)
      login(users[0].id)
        .then(() => refresh())
        .finally(() => setAutoLoggingIn(false))
    }
  }, [enabled, users, autoLoginTried, soleAutoLogin, isAuthenticated, refresh])

  // Finalize the chosen account via a top-level navigation (reliable cookie set
  // in the desktop webview) and remember the choice for this launch.
  const handleSelected = useCallback((result: LoginResult) => {
    sessionStorage.setItem(SELECTION_FLAG, '1')
    window.location.href = getLoginRedirectUrl(result.ticket)
  }, [])

  if (isMobile()) return <>{children}</>
  if (isLoading) return <FullScreenSpinner />
  if (isConnectionError) return <ConnectionLost />
  if (users === null || autoLoggingIn) return <FullScreenSpinner />

  // Single passwordless account — never prompt.
  if (soleAutoLogin) {
    return isAuthenticated ? <>{children}</> : <FullScreenSpinner />
  }

  // Multiple accounts (or a single password-protected one): require an explicit
  // choice once per launch, even if a previous session cookie is still valid.
  const selectionDone = sessionStorage.getItem(SELECTION_FLAG) === '1'
  if (selectionDone && isAuthenticated) return <>{children}</>

  return <LoginScreen users={users} onLoggedIn={handleSelected} />
}
