import { saveFeaturedList } from './featuredSourcesStore'
import { parseFeaturedSources } from './parseFeaturedSources'
import { getSyncServiceUrl } from '../../sync/cloud/getSyncServiceUrl'

const TIMEOUT_MS = 30_000

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${response.status} from ${url}`)
  return (await response.json()) as T
}

/**
 * Reads the sources Church Hub offers from the cloud (the sync service
 * names where the list is) and keeps it. Throws when offline; the last
 * list kept, or the installer's, stays in use.
 */
export async function refreshFeaturedSources(): Promise<void> {
  const base = getSyncServiceUrl().replace(/\/+$/, '')
  const { featuredUrl } = await getJson<{ featuredUrl?: string }>(
    `${base}/sync/libraries`,
  )
  if (!featuredUrl) throw new Error('The sync service names no featured list')
  const response = await fetch(`${featuredUrl}?at=${Date.now()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  // None published yet: the built-in list stays.
  if (response.status === 404 || response.status === 403) return
  if (!response.ok) throw new Error(`${response.status} from ${featuredUrl}`)
  saveFeaturedList({
    url: featuredUrl,
    featured: parseFeaturedSources(await response.text()),
  })
}
