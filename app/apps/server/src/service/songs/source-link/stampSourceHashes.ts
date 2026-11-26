import { fillContentHashes } from './fillContentHashes'
import { getRawDatabase } from '../../../db'

/**
 * The songs a source just added get their source hash: their lyrics as the
 * source gave them, so a later change from it can tell whether anyone
 * changed them here since.
 */
export function stampSourceHashes(sourceId: string): void {
  fillContentHashes()
  getRawDatabase()
    .query(
      'UPDATE songs SET source_hash = content_hash WHERE source_id = ? AND source_hash IS NULL',
    )
    .run(sourceId)
}
