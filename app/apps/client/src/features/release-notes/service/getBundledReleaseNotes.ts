import changelog from '../changelog.generated.json'
import type { VersionNotes } from '../types'

/**
 * Returns the release notes bundled into the app at build time. This is the
 * offline baseline — always available, regenerated on every version bump so the
 * shipping build contains its own version's notes.
 */
export function getBundledReleaseNotes(): VersionNotes[] {
  return changelog as VersionNotes[]
}
