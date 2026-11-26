import type { Bindings } from '../types'

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

/**
 * Whether a Google account (its `sub` and its Google-verified email) may use
 * the admin panel: listed in ADMIN_GOOGLE_SUBS or ADMIN_EMAILS. Nobody is,
 * when neither is set.
 */
export function isAllowedAdmin(
  env: Bindings,
  account: { sub: string; email: string }
): boolean {
  return (
    list(env.ADMIN_GOOGLE_SUBS).includes(account.sub.toLowerCase()) ||
    list(env.ADMIN_EMAILS).includes(account.email.toLowerCase())
  )
}
