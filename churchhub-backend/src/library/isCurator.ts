import type { OwnerIdentity } from '../sync/owner/OwnerIdentity'

/**
 * The cloud `library_curator` role: the Google accounts (emails or subs)
 * listed in LIBRARY_CURATORS, the project team at first.
 */
export function isCurator(
  curators: string | undefined,
  account: OwnerIdentity
): boolean {
  const listed = (curators ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return (
    listed.includes(account.email.toLowerCase()) ||
    listed.includes(account.googleSub.toLowerCase())
  )
}
