import { readCloudBackupCredential } from './cloudBackupCredential'
import { getCloudBackupSchedule } from './cloudBackupSchedule'

/**
 * Whether this PC is signed in to Church Hub Cloud backup, as which
 * account, and its automatic schedule. Never a token.
 */
export function getCloudBackupStatus() {
  const credential = readCloudBackupCredential()
  return {
    signedIn: credential !== null,
    email: credential?.email ?? null,
    ...getCloudBackupSchedule(),
  }
}
