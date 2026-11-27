import { publishShare } from './publishShare'
import { requireCloudIdentity } from './requireCloudIdentity'
import { getShare, upsertShare } from './shareStore'
import type { LibraryShare, LibraryShareInput } from './types'
import { getInstallation } from '../../sync/cloud/getInstallation'

/** A random base64url id for the library's folder (10 bytes: 80 bits). */
function randomPart(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(10))).toString(
    'base64url',
  )
}

/**
 * Creates a share (no `id`) or changes what one shares, then publishes it.
 * A new share's folder is `<churchId>-<random>`: the service lets only this
 * church write it. Null when there is no share with this `id`.
 */
export async function saveShare(
  input: LibraryShareInput,
  id?: number,
): Promise<LibraryShare | null> {
  const identity = await requireCloudIdentity()
  if (id !== undefined && !getShare(id)) return null
  const churchName = getInstallation()?.name ?? 'Church Hub'
  const savedId = upsertShare(
    {
      ...input,
      name: input.name.trim().slice(0, 200) || churchName,
      publisher: input.publisher?.trim().slice(0, 200) || churchName,
    },
    id !== undefined
      ? { id }
      : { sourceId: `${identity.churchId}-${randomPart()}` },
  )
  await publishShare(savedId, { force: true }).catch(() => {
    // Recorded on the share (lastError) and retried by the periodic sync.
  })
  return getShare(savedId)
}
