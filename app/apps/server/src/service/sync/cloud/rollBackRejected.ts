import type { CloudIdentity } from './cloudIdentityStore'
import { fetchRemoteChanges } from './fetchRemoteChanges'
import type { RejectedChange } from './types'
import { createLogger } from '../../../utils/logger'
import { applyRemoteChanges } from '../applyRemoteChanges'
import { COLLECTION_BY_TYPE, collectionOf } from '../libraryCollections'
import { dirtyKey } from '../mergeLibraries'
import type { ApplyOp, LibraryFile } from '../types'

const logger = createLogger('sync')

/**
 * Puts the changes the sync service refused (their author may not make
 * them) back as the church has them: the church's row, or no row when it
 * never had it. Each is taken off the queue and shown in the updates feed
 * with the permission it needed. Returns how many were reported.
 */
export async function rollBackRejected(
  identity: CloudIdentity,
  rejected: RejectedChange[],
  local: LibraryFile,
): Promise<number> {
  const church = (await fetchRemoteChanges(identity, { whole: true }))?.library
  const ops: ApplyOp[] = rejected.map(({ type, uuid, permission }) => {
    const { key, titleOf } = COLLECTION_BY_TYPE[type]
    const theirs = church
      ? collectionOf(church, key).find((item) => item.uuid === uuid)
      : undefined
    const ours = collectionOf(local, key).find((item) => item.uuid === uuid)
    logger.warning(
      `Cloud sync refused ${dirtyKey(type, uuid)}: needs ${permission}, rolled back`,
    )
    return {
      entityType: type,
      op: theirs ? 'upsert' : 'delete',
      uuid,
      data: theirs,
      changeKind: 'rejected',
      title: titleOf(theirs ?? ours ?? ({ uuid } as never)),
      detail: permission,
    }
  })
  return applyRemoteChanges(ops).reportedCount
}
