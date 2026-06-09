import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'
import { getLocalUsers, LOGGED_OUT_FLAG, login } from '~/features/users/service'
import type { LocalUser } from '~/features/users/types'
import { usePermissions } from '~/provider/permissions-provider'
import { LoginScreen } from './LoginScreen'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
  )
}

function ConnectionLost({ onRetry }: { onRetry?: () => void }) {
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
        onClick={() => (onRetry ? onRetry() : refresh())}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
      >
        {t('buttons.retry')}
      </button>
    </div>
  )
}

/**
 * Gates the app behind a local login. The persisted `user_auth` cookie acts as
 * an auto-login token — as long as it's valid, the operator is signed back in
 * as the LAST USER on the next launch and the app opens directly. The picker
 * only shows when there is no valid session.
 *
 * Behaviour:
 *  - Persisted session → render the app (last user auto-signed-in).
 *  - No session + a single passwordless account (fresh install) → silent login.
 *  - No session + anything else → account picker.
 *
 * On mobile the existing token/connection flow (MobileConnectionGuard) handles
 * auth, so this gate steps aside.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isConnectionError, refresh } =
    usePermissions()
  const [users, setUsers] = useState<LocalUser[] | null>(null)
  const [listError, setListError] = useState(false)
  const [autoLoginTried, setAutoLoginTried] = useState(false)
  const [autoLoggingIn, setAutoLoggingIn] = useState(false)
  // Set when a deliberate logout is detected (LOGGED_OUT_FLAG), so we show the
  // picker instead of instantly auto-signing a sole passwordless account back
  // in. Checked at runtime in the auto-login effect (logout refreshes the
  // context rather than reloading, so a mount-time read would miss it).
  const [skipSoleAutoLogin, setSkipSoleAutoLogin] = useState(false)

  // Only fetch the user list when we actually need it (picker or sole
  // auto-login). When a session is already valid we skip straight to the app.
  const needsList =
    !isMobile() && !isLoading && !isConnectionError && !isAuthenticated

  useEffect(() => {
    if (!needsList || users !== null) return
    let cancelled = false
    getLocalUsers()
      .then((list) => {
        if (!cancelled) setUsers(list)
      })
      .catch(() => {
        // Surface the failure instead of rendering an empty account picker.
        if (!cancelled) setListError(true)
      })
    return () => {
      cancelled = true
    }
  }, [needsList, users])

  // A single passwordless account requires no choice — unless the user just
  // logged out on purpose, in which case we show the picker so they stay out.
  const soleAutoLogin =
    !!users && users.length === 1 && !users[0].hasPassword && !skipSoleAutoLogin

  // Auto-login that single passwordless account (fresh install).
  useEffect(() => {
    if (!needsList || !users || autoLoginTried) return
    if (soleAutoLogin) {
      // A deliberate logout suppresses this one auto-login so the user stays out.
      try {
        if (sessionStorage.getItem(LOGGED_OUT_FLAG) === '1') {
          sessionStorage.removeItem(LOGGED_OUT_FLAG)
          setSkipSoleAutoLogin(true)
          return
        }
      } catch {
        // sessionStorage unavailable — fall through to normal auto-login.
      }
      setAutoLoginTried(true)
      setAutoLoggingIn(true)
      login(users[0].id)
        .then(() => refresh())
        .finally(() => setAutoLoggingIn(false))
    }
  }, [needsList, users, autoLoginTried, soleAutoLogin, refresh])

  // LoginScreen already called `login()`, which set the session cookie via its
  // fetch response (it round-trips cross-site in the desktop webview). A pure
  // context `refresh()` re-reads /api/auth/me and renders the app as the chosen
  // user — no page navigation/reload, which is unreliable in the packaged
  // desktop webview (app on `tauri.localhost`, sidecar on `localhost`).
  const handleSelected = useCallback(() => {
    void refresh()
  }, [refresh])

  if (isMobile()) return <>{children}</>
  if (isLoading) return <FullScreenSpinner />
  if (isConnectionError) return <ConnectionLost />
  if (listError)
    return (
      <ConnectionLost
        onRetry={() => {
          setListError(false)
          setUsers(null) // re-triggers the user-list fetch
          refresh()
        }}
      />
    )
  // Persisted session = auto-login as the last user. No picker.
  if (isAuthenticated) return <>{children}</>
  if (users === null || autoLoggingIn) return <FullScreenSpinner />
  if (soleAutoLogin) return <FullScreenSpinner />

  return <LoginScreen users={users} onLoggedIn={handleSelected} />
}
