import { CloudBackupAccount } from './CloudBackupAccount'
import { CloudBackupList } from './CloudBackupList'
import { CloudBackupNow } from './CloudBackupNow'
import { CloudBackupSchedule } from './CloudBackupSchedule'
import { CloudBackupSignedOut } from './CloudBackupSignedOut'
import { useCloudBackupStatus, useCloudBackups } from '../hooks'

/**
 * Church Hub Cloud (free), next to Drive and local backups: sign in with
 * Google, back up now or on a schedule, restore or delete a backup, and
 * sign out (optionally deleting every cloud backup).
 */
export function CloudBackupPanel() {
  const { data: status, isLoading } = useCloudBackupStatus()
  const signedIn = status?.signedIn ?? false
  const backups = useCloudBackups(signedIn)

  return (
    <div className="space-y-4" data-testid="cloud-backup-panel">
      {isLoading || !status ? (
        <div className="h-[74px] rounded-xl bg-field" />
      ) : !signedIn ? (
        <CloudBackupSignedOut />
      ) : (
        <>
          <CloudBackupAccount
            email={status.email}
            usage={backups.data?.usage}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CloudBackupNow lastBackupAt={status.lastBackupAt} />
            <CloudBackupSchedule status={status} />
          </div>
          <CloudBackupList
            backups={backups.data?.backups}
            isLoading={backups.isLoading}
            error={backups.error}
          />
        </>
      )}
    </div>
  )
}
