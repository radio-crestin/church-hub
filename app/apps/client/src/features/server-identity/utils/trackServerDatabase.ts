import { clearLastVisitedState } from '~/features/navigation'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:server-identity')

/** Set by the server on every API response (apps/server/src/utils/databaseId.ts). */
export const DATABASE_ID_HEADER = 'X-Church-Hub-Database'
const SERVER_CHANGED_KEY = 'church-hub:server-changed'

let knownDatabaseId: string | null = null

/**
 * Remembers which database answers this window and reports a change.
 *
 * A Church Hub kills whatever holds its port on start. When two apps share a
 * port (two installed builds; before T-096 also the dev server on 3000), the
 * older window stays open on its lists, but its requests now reach another
 * app's database, where a listed song is missing or is a different song
 * (T-096). On a change the window reloads on
 * the section's list, so everything it shows comes from the database it
 * talks to, and says why.
 *
 * Returns true when the window is reloading: the caller must not use the
 * response.
 */
export function trackServerDatabase(response: Response): boolean {
  const databaseId = response.headers.get(DATABASE_ID_HEADER)
  if (!databaseId) return false
  knownDatabaseId ??= databaseId
  if (databaseId === knownDatabaseId) return false

  logger.warn(
    `Server database changed (${knownDatabaseId} → ${databaseId}): another Church Hub took over this window's server; reloading`,
  )
  markServerChanged()
  // Ids in the address and in the remembered pages belong to the old
  // database: start again from the section's list.
  clearLastVisitedState()
  window.location.assign(sectionListPath(window.location.pathname))
  return true
}

/** Display windows (`/screen/2`) have no list: they reload where they are. */
const SECTIONS_WITHOUT_LIST = new Set(['screen', 'monitor-badge'])

/** `/songs/123/edit` → `/songs`: the list of the section the window is in. */
export function sectionListPath(pathname: string): string {
  const section = pathname.split('/').filter(Boolean)[0]
  if (!section) return '/'
  return SECTIONS_WITHOUT_LIST.has(section) ? pathname : `/${section}`
}

function markServerChanged() {
  try {
    sessionStorage.setItem(SERVER_CHANGED_KEY, '1')
  } catch {
    // Storage blocked: the reload still happens, only the notice is lost.
  }
}

/** True once after a reload caused by a server change (then forgotten). */
export function takeServerChangedFlag(): boolean {
  try {
    const changed = sessionStorage.getItem(SERVER_CHANGED_KEY) === '1'
    sessionStorage.removeItem(SERVER_CHANGED_KEY)
    return changed
  } catch {
    return false
  }
}
