import { type CloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { setSyncVersions } from './syncVersionsStore'
import type { ChangeInput, EntityVersion, RejectedChange } from './types'
import { dirtyKey } from '../mergeLibraries'

/** Changes per request: a first sync of thousands of songs goes in chunks. */
export const CHANGES_PER_REQUEST = 500

interface CommitResponse {
  seq: number
  versions: { type: string; uuid: string; version: number }[]
  readUrl: string
}

export type PushOutcome =
  | { outcome: 'pushed' | 'conflict' }
  | { outcome: 'rejected'; rejected: RejectedChange[] }

/**
 * Publishes the changes through the sync service, a chunk per request, and
 * records each accepted row's new version. 'conflict' when the service
 * answered 409 (a row changed elsewhere first: pull, merge, push again);
 * 'rejected' when it answered 403, with the changes whose author may not
 * make them (nothing of that chunk was published). Any other refusal
 * throws with the service's reason.
 */
export async function pushChanges(
  identity: CloudIdentity,
  changes: ChangeInput[],
): Promise<PushOutcome> {
  for (let i = 0; i < changes.length; i += CHANGES_PER_REQUEST) {
    const chunk = changes.slice(i, i + CHANGES_PER_REQUEST)
    const response = await syncServiceRequest<CommitResponse>(
      { serviceUrl: identity.serviceUrl, identity },
      'POST',
      '/changes',
      { changes: chunk },
    )
    if (response.status === 409) return { outcome: 'conflict' }
    if (response.status === 403) {
      const { rejected } = response.body as unknown as {
        rejected?: RejectedChange[]
      }
      if (rejected?.length) return { outcome: 'rejected', rejected }
    }
    if (response.status !== 200) throw serviceError(response)

    const { seq, versions, readUrl } = response.body
    const deleted = new Set(
      chunk
        .filter((change) => change.op === 'delete')
        .map((change) => dirtyKey(change.type, change.uuid)),
    )
    setSyncVersions(
      new Map<string, EntityVersion>(
        versions.map(({ type, uuid, version }) => {
          const key = dirtyKey(type, uuid)
          return [key, { version, deleted: deleted.has(key) }]
        }),
      ),
    )
    // Nobody else wrote in between: this server is already at that seq.
    const patch: Parameters<typeof updateCloudIdentity>[0] = { readUrl }
    if (seq === identity.seq + 1) patch.seq = seq
    await updateCloudIdentity(patch)
    identity.readUrl = readUrl
    if (patch.seq) identity.seq = seq
  }
  return { outcome: 'pushed' }
}
