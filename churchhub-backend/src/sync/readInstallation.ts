import type { Installation } from './checkInstallation'

/**
 * The installation a church PC names in `X-Church-Hub-Installation` (its id)
 * and `X-Church-Hub-Installation-Name` (its hostname, URI-encoded), or null
 * from a client that names none.
 */
export function readInstallation(
  header: (name: string) => string | undefined
): Installation | null {
  const id = header('X-Church-Hub-Installation')
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null
  let name: string | null = null
  try {
    name = decodeURIComponent(header('X-Church-Hub-Installation-Name') ?? '')
  } catch {
    name = null
  }
  return { id, name: name?.slice(0, 200) || null }
}
