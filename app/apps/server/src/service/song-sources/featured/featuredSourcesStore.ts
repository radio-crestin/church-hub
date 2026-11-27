import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { getBundledLibrariesDir } from './getBundledLibrariesDir'
import { parseFeaturedSources } from './parseFeaturedSources'
import type { FeaturedList } from './types'
import { createLogger } from '../../../utils/logger'
import { getDatabasePath } from '../../../utils/paths'

const logger = createLogger('song-sources:featured')

/** The last list read, kept next to the database for the next start offline. */
const CACHE_FILE = 'featured-sources.json'

function cachePath(): string {
  return join(dirname(getDatabasePath()), CACHE_FILE)
}

/** A saved list: `{ url, featured }`; null when missing or unreadable. */
function readSaved(path: string): FeaturedList | null {
  if (!existsSync(path)) return null
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8')) as {
      url?: unknown
      featured?: unknown
    }
    if (typeof saved.url !== 'string') return null
    return {
      url: saved.url,
      featured: parseFeaturedSources(JSON.stringify(saved.featured)),
    }
  } catch (error) {
    logger.warning(`Ignoring the saved featured sources in ${path}: ${error}`)
    return null
  }
}

/**
 * The sources Church Hub offers: the last list read from the cloud, else
 * the one shipped with the installer, else none (the app's built-in list).
 * Read from the file each time: the song updates' worker thread shares it.
 */
export function getFeaturedList(): FeaturedList | null {
  const bundled = getBundledLibrariesDir()
  return (
    readSaved(cachePath()) ??
    (bundled ? readSaved(join(bundled, 'featured.json')) : null)
  )
}

/** Keeps a list just read, for the app and its next start. */
export function saveFeaturedList(list: FeaturedList): void {
  writeFileSync(cachePath(), JSON.stringify(list))
}
