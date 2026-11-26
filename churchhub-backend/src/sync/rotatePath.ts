import { finishPathMove } from './finishPathMove'
import { movePathSecret } from './movePathSecret'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'

/**
 * Moves the church to a fresh path secret, so a revoked device that still
 * knows the old path reads nothing new (movePathSecret, finishPathMove).
 * Remaining devices learn the new path from their next write or `GET path`.
 */
export async function rotatePath(
  store: SyncStore,
  churchId: string
): Promise<ChurchState> {
  let oldPrefix = ''
  const { state, etag } = await updateChurch(
    store,
    churchId,
    async (church) => {
      const move = await movePathSecret(store.bucket, church)
      oldPrefix = move.oldPrefix
      return { next: church, result: church.pathSecret, undo: move.undo }
    }
  )
  await finishPathMove(store, state, etag, oldPrefix)
  return state
}
