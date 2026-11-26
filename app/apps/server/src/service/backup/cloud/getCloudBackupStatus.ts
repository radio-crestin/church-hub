import { readCloudBackupCredential } from './cloudBackupCredential'
import { getCloudBackupSchedule } from './cloudBackupSchedule'
import { isCloudBackupAvailable } from './isCloudBackupAvailable'

/**
 * Whether this PC is signed in to Church Hub Cloud backup, as which
 * account, and its automatic schedule. Never a token.
 */
export function getCloudBackupStatus() {
  const credential = readCloudBackupCredential()
  return {
    /** False while this build points at the legacy backend (not available yet). */
    available: isCloudBackupAvailable(),
    signedIn: credential !== null,
    email: credential?.email ?? null,
    ...getCloudBackupSchedule(),
  }
}
