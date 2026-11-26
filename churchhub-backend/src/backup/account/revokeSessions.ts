import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'

/** Signs this PC out: its session family ends; other PCs stay signed in. */
export async function revokeSessions({ bucket, caller }: BackupContext) {
  await updateAccount(bucket, caller.accountId, (record) => {
    delete record.sessions[caller.fid]
  })
}
