import { applyAccessChange } from './applyAccessChange'
import { authorOf, checkChanges } from './checkChanges'
import { churchPrefix } from './churchPrefix'
import { compact } from './compact'
import { finishPathMove } from './finishPathMove'
import { gzipJson } from './gzipJson'
import { movePathSecret, type PathMove } from './movePathSecret'
import { publishHead } from './publishHead'
import { randomId } from './randomId'
import { revokeDevicesOfInactiveUsers } from './revokeDevicesOfInactiveUsers'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { type ChurchVersion, readChurch } from './state/readChurch'
import { updateChurch } from './state/updateChurch'
import { SyncError } from './SyncError'
import type { ChangeInput, PublishedChange, Segment, SyncCaller } from './types'
import { IMMUTABLE_CACHE_CONTROL } from './writeSnapshot'

export interface CommitResult {
  seq: number
  versions: { type: string; uuid: string; version: number }[]
  state: ChurchState
}

/**
 * One accepted write (design §4): authorize every change against its
 * author, check its version, then publish it as one segment and commit the
 * new versions. Role and user changes become the rules later writes are
 * checked against; a user they deactivate or remove has every device
 * revoked, and the path secret moves in the same state write, so those
 * devices neither write nor read again.
 *
 * The segment is written first, under a name of its own
 * (`log/<seq>-<nonce>.json.gz`); the church's state then takes `seq` with a
 * conditional write (If-Match on the ETag it was read at). A write that
 * lost to a concurrent one deletes its segment and starts again, re-checking
 * its versions against the winner's. `church`: the state the caller was
 * authenticated against, used for the first attempt.
 */
export async function commitChanges(
  store: SyncStore,
  caller: SyncCaller,
  changes: ChangeInput[],
  compactAfter: number,
  church: ChurchVersion
): Promise<CommitResult> {
  let committed
  let move: PathMove | null = null
  try {
    committed = await updateChurch(
      store,
      caller.churchId,
      async (state) => {
        move = null
        checkChanges(changes, state, caller)

        const seq = state.seq + 1
        const now = Math.floor(Date.now() / 1000)
        const published: PublishedChange[] = changes.map((change) => ({
          type: change.type,
          uuid: change.uuid,
          op: change.op,
          version: seq,
          author: authorOf(caller, change),
          ...(change.op === 'upsert'
            ? { data: change.data }
            : { deletedAt: change.deletedAt }),
        }))
        const segment: Segment = {
          seq,
          committedAt: now,
          deviceId: caller.deviceId,
          userId: caller.userId,
          changes: published,
        }
        const key = `log/${seq}-${randomId(9)}.json.gz`
        const object = `${churchPrefix(state.id, state.pathSecret)}/${key}`
        await store.bucket.put(object, await gzipJson(segment), {
          contentType: 'application/gzip',
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        })

        state.seq = seq
        state.segments.push({ seq, key })
        for (const change of changes) {
          state.versions[`${change.type}:${change.uuid}`] =
            change.op === 'delete' ? -seq : seq
          applyAccessChange(state, change)
        }
        state.updatedAt = now
        if (revokeDevicesOfInactiveUsers(state, now) > 0) {
          move = await movePathSecret(store.bucket, state)
        }
        const moved = move as PathMove | null
        return {
          next: state,
          result: seq,
          undo: async () => {
            await moved?.undo()
            await store.bucket.delete(object)
          },
        }
      },
      church
    )
  } catch (error) {
    // A client stuck on a stale head (a head write that failed) is told
    // about the conflict and gets the current head on its next poll.
    if (error instanceof SyncError && error.status === 409) {
      const latest = await readChurch(store, caller.churchId)
      if (latest) await publishHead(store, latest.state, latest.etag)
    }
    throw error
  }

  const { state, etag } = committed
  const seq = state.seq
  const moved = move as PathMove | null
  if (moved) await finishPathMove(store, state, etag, moved.oldPrefix)
  else await publishHead(store, state, etag)
  const result = {
    seq,
    versions: changes.map(({ type, uuid }) => ({ type, uuid, version: seq })),
  }
  if (state.segments.length >= compactAfter) {
    return { ...result, state: (await compact(store, state.id)).state }
  }
  return { ...result, state }
}
