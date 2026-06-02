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

import { type LoginResult, login } from '~/features/users/service'
import type { LocalUser } from '~/features/users/types'
import { UserAvatar } from './UserAvatar'

interface LoginScreenProps {
  users: LocalUser[]
  /** Called after a successful login so the app can finalize the session. */
  onLoggedIn: (result: LoginResult) => void | Promise<void>
}

/** Decorative branded panel shown on large screens. */
function BrandPanel({ tagline }: { tagline: string }) {
  return (
    <div className="login-gradient relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex">
      {/* Soft decorative blobs that drift slowly */}
      <div className="login-blob pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="login-blob-slow pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-fuchsia-300/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <img
          src="/logo192.png"
          alt="Church Hub"
          className="h-11 w-11 rounded-xl shadow-lg"
        />
        <span className="text-lg font-semibold tracking-tight">Church Hub</span>
      </div>

      <div className="relative">
        <h2 className="text-4xl font-bold leading-tight">Church Hub</h2>
        <p className="mt-3 max-w-sm text-lg text-white/80">{tagline}</p>
      </div>

      <div className="relative text-sm text-white/50">
        © {new Date().getFullYear()} Church Hub
      </div>
    </div>
  )
}

/**
 * Modern split-screen local login. A branded panel sits beside the account
 * chooser; selecting a user signs in immediately (passwordless) or reveals a
 * password field.
 */
export function LoginScreen({ users, onLoggedIn }: LoginScreenProps) {
  const { t } = useTranslation('users')
  const [selected, setSelected] = useState<LocalUser | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  async function doLogin(user: LocalUser, pw?: string) {
    setSubmitting(true)
    setError(false)
    try {
      const result = await login(user.id, pw)
      await onLoggedIn(result)
    } catch {
      setError(true)
      setSubmitting(false)
    }
  }

  function handleSelect(user: LocalUser) {
    setError(false)
    setPassword('')
    setShowPassword(false)
    if (user.hasPassword) {
      setSelected(user)
    } else {
      void doLogin(user)
    }
  }

  function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (selected) void doLogin(selected, password)
  }

  const roleLabel = (user: LocalUser) =>
    user.isSuperAdmin ? t('superAdmin') : t('profile.user')

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <BrandPanel tagline={t('login.tagline')} />

      {/* Account chooser */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Brand (mobile only, since the side panel is hidden) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img
              src="/logo192.png"
              alt="Church Hub"
              className="h-9 w-9 rounded-lg"
            />
            <span className="font-semibold text-gray-900 dark:text-white">
              Church Hub
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('login.title')}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {selected ? t('login.enterPassword') : t('login.selectUser')}
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
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selected.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {roleLabel(selected)}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t('login.passwordLabel')}
                  </label>
                  <div ref={passwordRowRef} className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError(false)
                      }}
                      disabled={submitting}
                      className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-11 text-gray-900 outline-none transition focus:ring-2 disabled:opacity-60 dark:bg-gray-800 dark:text-white ${
                        error
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-gray-600'
                      }`}
                      placeholder={t('login.passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                      aria-label={showPassword ? t('password.hide') : t('password.show')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {error ? (
                    <p
                      role="alert"
                      className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {t('login.wrongPassword')}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    disabled={submitting}
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {t('login.back')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || password.length === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t('login.signIn')}
                  </button>
                </div>
              </form>
            ) : (
              <ul className="space-y-2.5">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(user)}
                      disabled={submitting}
                      className="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500/60"
                    >
                      <UserAvatar
                        name={user.name}
                        isSuperAdmin={user.isSuperAdmin}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-900 dark:text-white">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {roleLabel(user)}
                        </span>
                      </span>
                      {user.hasPassword ? (
                        <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                      ) : null}
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400 dark:text-gray-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
