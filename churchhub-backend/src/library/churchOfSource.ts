/** Length of a church id: 12 random bytes in base64url (registerChurch). */
const CHURCH_ID_LENGTH = 16

/**
 * The church a shared library belongs to: its folder is
 * `<churchId>-<random>`, so ownership needs no state of its own. Null for
 * a folder that is no church's (the curated one, or anything else).
 */
export function churchOfSource(sourceId: string): string | null {
  if (sourceId.length <= CHURCH_ID_LENGTH + 1) return null
  if (sourceId[CHURCH_ID_LENGTH] !== '-') return null
  return sourceId.slice(0, CHURCH_ID_LENGTH)
}
