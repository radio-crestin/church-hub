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
 * Shares the church's songs, or changes what it shares, then publishes
 * them. The library's folder is `<churchId>-<random>`: the service lets only
 * this church write it.
 */
export async function saveShare(
  input: LibraryShareInput,
): Promise<LibraryShare> {
  const identity = await requireCloudIdentity()
  const share = upsertShare(
    {
      ...input,
      name: input.name.trim().slice(0, 200) || getInstallation().name,
      publisher:
        input.publisher?.trim().slice(0, 200) || getInstallation().name,
    },
    () => `${identity.churchId}-${randomPart()}`,
  )
  await publishShare({ force: true }).catch(() => {
    // Recorded on the share (lastError) and retried by the periodic sync.
  })
  return getShare() ?? share
}
