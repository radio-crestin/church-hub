import {
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type LoginResult,
  login,
  PairingRequiredError,
} from '~/features/users/service'
import type { LocalUser } from '~/features/users/types'
import { AppMark } from '~/ui/brand/AppMark'
import { captureActivity } from '~/utils/activity-logger'
import { UserAvatar } from './UserAvatar'

interface LoginScreenProps {
  users: LocalUser[]
  /** Called after a successful login so the app can finalize the session. */
  onLoggedIn: (result: LoginResult) => void | Promise<void>
  /** A pairing already opened for this user: ask for its code at once. */
  initialPairing?: { user: LocalUser; pairingId: string } | null
}

/** The quiet brand half shown on large screens. */
function BrandPanel({ tagline }: { tagline: string }) {
  return (
    <div className="hidden w-1/2 flex-col justify-between border-r border-line bg-panel p-12 lg:flex">
      <div className="flex items-center gap-3">
        <AppMark size={40} />
        <span className="text-[15px] font-semibold text-fg">Church Hub</span>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-fg">Church Hub</h2>
        <p className="mt-2 max-w-sm text-[15px] text-fg-label">{tagline}</p>
      </div>

      <div className="text-xs text-fg-hint">
        © {new Date().getFullYear()} Church Hub
      </div>
    </div>
  )
}

/**
 * Modern split-screen local login. A branded panel sits beside the account
 * chooser; selecting a user signs in immediately (passwordless, on the Church
 * Hub computer), or reveals a password field, or, for a passwordless account
 * from another device, a field for the pairing code the desktop app shows.
 */
export function LoginScreen({
  users,
  onLoggedIn,
  initialPairing,
}: LoginScreenProps) {
  const { t } = useTranslation('users')
  const [selected, setSelected] = useState<LocalUser | null>(
    initialPairing?.user ?? null,
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Set while signing in to a passwordless account from another device.
  const [pairingId, setPairingId] = useState<string | null>(
    initialPairing?.pairingId ?? null,
  )
  const codeMode = pairingId !== null
  const passwordRowRef = useRef<HTMLDivElement>(null)

  // Re-trigger the shake animation on every wrong-password attempt by
  // forcibly restarting the class (a CSS keyframe only plays once).
  useEffect(() => {
    if (!error) return
    const el = passwordRowRef.current
    if (!el) return
    el.classList.remove('animate-shake')
    // Force a reflow so the animation can play again from the start.
    void el.offsetWidth
    el.classList.add('animate-shake')
  }, [error])

  async function doLogin(
    user: LocalUser,
    pw?: string,
    pairing?: { pairingId: string; code: string },
  ) {
    setSubmitting(true)
    setError(false)
    try {
      const result = await login(user.id, pw, pairing)
      captureActivity('login', { source: 'login-screen', userId: user.id })
      await onLoggedIn(result)
    } catch (err) {
      setSubmitting(false)
      if (err instanceof PairingRequiredError) {
        setSelected(user)
        setPairingId(err.pairingId)
        setPassword('')
        return
      }
      setError(true)
    }
  }

  function handleSelect(user: LocalUser) {
    setError(false)
    setPassword('')
    setShowPassword(false)
    setPairingId(null)
    if (user.hasPassword) {
      setSelected(user)
    } else {
      void doLogin(user)
    }
  }

  function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (pairingId)
      void doLogin(selected, undefined, { pairingId, code: password })
    else void doLogin(selected, password)
  }

  const roleLabel = (user: LocalUser) =>
    user.isSuperAdmin ? t('superAdmin') : t('profile.user')

  return (
    <div className="flex min-h-screen bg-app">
      <BrandPanel tagline={t('login.tagline')} />

      {/* Account chooser */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Brand (mobile only, since the side panel is hidden) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <AppMark size={32} />
            <span className="text-[15px] font-semibold text-fg">
              Church Hub
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-fg">{t('login.title')}</h1>
          <p className="mt-1.5 text-[13px] text-fg-hint">
            {!selected
              ? t('login.selectUser')
              : codeMode
                ? t('login.enterCode')
                : t('login.enterPassword')}
          </p>

          <div className="mt-8">
            {selected ? (
              <form onSubmit={handleSubmitPassword} className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <UserAvatar
                    name={selected.name}
                    isSuperAdmin={selected.isSuperAdmin}
                    size="lg"
                  />
                  <div className="text-center">
                    <p className="text-base font-semibold text-fg">
                      {selected.name}
                    </p>
                    <p className="text-xs text-fg-hint">
                      {roleLabel(selected)}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-[13px] font-medium text-fg-label"
                  >
                    {codeMode ? t('login.codeLabel') : t('login.passwordLabel')}
                  </label>
                  {codeMode ? (
                    <p className="mb-2 text-[13px] text-fg-hint">
                      {t('login.codeHint')}
                    </p>
                  ) : null}
                  <div ref={passwordRowRef} className="relative">
                    <Lock
                      strokeWidth={1.5}
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-hint"
                    />
                    <input
                      id="login-password"
                      type={codeMode || showPassword ? 'text' : 'password'}
                      inputMode={codeMode ? 'numeric' : undefined}
                      autoComplete={codeMode ? 'one-time-code' : undefined}
                      maxLength={codeMode ? 6 : undefined}
                      autoFocus
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError(false)
                      }}
                      disabled={submitting}
                      className={`w-full rounded-[10px] bg-field py-2.5 pl-10 pr-11 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-hint disabled:opacity-60 ${
                        error
                          ? 'ring-1 ring-inset ring-red-500'
                          : 'focus:ring-1 focus:ring-inset focus:ring-focus'
                      }`}
                      placeholder={
                        codeMode ? '000000' : t('login.passwordPlaceholder')
                      }
                    />
                    {codeMode ? null : (
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        tabIndex={-1}
                        aria-label={
                          showPassword ? t('password.hide') : t('password.show')
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-label transition-colors hover:bg-hover hover:text-fg"
                      >
                        {showPassword ? (
                          <EyeOff strokeWidth={1.5} className="h-4 w-4" />
                        ) : (
                          <Eye strokeWidth={1.5} className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {error ? (
                    <p
                      role="alert"
                      className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"
                    >
                      <AlertCircle
                        strokeWidth={1.5}
                        className="h-4 w-4 shrink-0"
                      />
                      {codeMode
                        ? t('login.wrongCode')
                        : t('login.wrongPassword')}
                    </p>
                  ) : null}
                  {codeMode ? (
                    <button
                      type="button"
                      onClick={() => void doLogin(selected)}
                      disabled={submitting}
                      className="mt-2 text-[13px] font-medium text-focus hover:underline disabled:opacity-60"
                    >
                      {t('login.newCode')}
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null)
                      setPairingId(null)
                    }}
                    disabled={submitting}
                    className="h-9 flex-1 rounded-lg bg-field px-4 text-[13px] font-medium text-fg transition-colors hover:bg-hover disabled:opacity-60"
                  >
                    {t('login.back')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || password.length === 0}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t('login.signIn')}
                  </button>
                </div>
              </form>
            ) : users.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-5 text-center text-[13px] text-fg-hint">
                {t('login.noAccounts')}
              </p>
            ) : (
              <>
                {error ? (
                  <p
                    role="alert"
                    className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"
                  >
                    <AlertCircle
                      strokeWidth={1.5}
                      className="h-4 w-4 shrink-0"
                    />
                    {t('login.failed')}
                  </p>
                ) : null}
                <ul className="space-y-1.5">
                  {users.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(user)}
                        disabled={submitting}
                        className="group flex w-full items-center gap-3 rounded-lg bg-field px-3 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-60"
                      >
                        <UserAvatar
                          name={user.name}
                          isSuperAdmin={user.isSuperAdmin}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-fg">
                            {user.name}
                          </span>
                          <span className="block truncate text-xs text-fg-hint">
                            {roleLabel(user)}
                          </span>
                        </span>
                        {user.hasPassword ? (
                          <Lock
                            strokeWidth={1.5}
                            className="h-4 w-4 shrink-0 text-fg-hint"
                          />
                        ) : null}
                        <ChevronRight
                          strokeWidth={1.5}
                          className="h-4 w-4 shrink-0 text-fg-hint group-hover:text-fg"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
