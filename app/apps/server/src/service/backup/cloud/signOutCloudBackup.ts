import { CloudBackupError } from './CloudBackupError'
import { cloudBackupRequest } from './cloudBackupRequest'
import { updateCloudBackupSchedule } from './cloudBackupSchedule'
import { forgetServiceSession } from './cloudBackupSession'

/**
 * Signs this PC out of Church Hub Cloud backup. `deleteBackups` first
 * deletes the account's backups and data on the service; otherwise the
 * service refuses every token issued so far (signed out everywhere).
 * Either way this PC forgets its sign-in and stops automatic backups.
 */
export async function signOutCloudBackup(deleteBackups: boolean) {
  let deletedBackups = 0
  try {
    if (deleteBackups) {
      const result = await cloudBackupRequest<{ deletedBackups: number }>(
        'DELETE',
        '/backup/account',
      )
      deletedBackups = result.deletedBackups
    } else {
      await cloudBackupRequest('DELETE', '/backup/session')
    }
  } catch (error) {
    // Already signed out on the service: only this PC's copy is left.
    const signedOut = error instanceof CloudBackupError && error.status === 401
    if (deleteBackups || !signedOut) throw error
  }
  forgetServiceSession()
  updateCloudBackupSchedule({ autoBackupEnabled: false })
  return { signedOut: true, deletedBackups }
}
