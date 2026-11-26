import { managedArchiveOf, managedFileUrl } from './readManagedManifest'
import type { ManagedManifest } from './types'
import { fetchLink } from '../links/fetchLink'

const sha256Of = (bytes: Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

/**
 * The `.chsongs` archive a managed source's manifest points to (in the
 * source's `folder` of our bucket), refused when its bytes don't match the
 * manifest's checksum: a broken upload, a stale or tampered copy.
 */
export async function readManagedArchive(
  folder: string,
  manifest: ManagedManifest,
): Promise<Uint8Array> {
  const file = managedArchiveOf(manifest)
  const bytes = await fetchLink(managedFileUrl(folder, file.path))
  if (sha256Of(bytes) !== file.sha256) {
    throw new Error(
      `${manifest.name} ${manifest.version}: the downloaded song file does not match its checksum, so it was refused`,
    )
  }
  return bytes
}
