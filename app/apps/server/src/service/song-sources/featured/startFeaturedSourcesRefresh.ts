import { refreshFeaturedSources } from './refreshFeaturedSources'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('song-sources:featured')

/** The list changes rarely: read at start, then twice a day. */
const REFRESH_MS = 12 * 60 * 60 * 1000

function refresh(): void {
  refreshFeaturedSources().catch((error) =>
    logger.info(`Featured sources not refreshed (offline?): ${error}`),
  )
}

/** Reads the featured list now and every so often; returns a stop function. */
export function startFeaturedSourcesRefresh(): () => void {
  refresh()
  const timer = setInterval(refresh, REFRESH_MS)
  return () => clearInterval(timer)
}
