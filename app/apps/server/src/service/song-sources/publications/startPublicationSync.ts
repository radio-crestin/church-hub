import { listPublications } from './listPublications'
import { syncPublication } from './syncPublication'
import { createLogger } from '../../../utils/logger'
import { getS3Storage } from '../storage/getS3Storage'

const logger = createLogger('song-sources')

/** How often published categories are checked for changes. */
const SYNC_INTERVAL_MS = 5 * 60 * 1000

let running = false

/**
 * Keeps every published category in sync with its S3 folder. A check that
 * finds nothing changed sends nothing (syncPublication compares hashes);
 * a failure is recorded on the publication and retried next round.
 */
export async function syncAllPublications(): Promise<void> {
  if (running || !getS3Storage()) return
  running = true
  try {
    for (const publication of listPublications()) {
      // A failure is recorded on the publication and retried next round.
      await syncPublication(publication.id).catch((error) =>
        logger.warning(
          `Publishing "${publication.categoryName}" failed: ${error}`,
        ),
      )
    }
  } finally {
    running = false
  }
}

/** Starts the periodic sync; returns a stop function. */
export function startPublicationSync(): () => void {
  const timer = setInterval(() => void syncAllPublications(), SYNC_INTERVAL_MS)
  return () => clearInterval(timer)
}
