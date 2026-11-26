import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'

/** Signs the account out everywhere: every token issued so far is refused. */
export async function revokeSessions({ bucket, caller }: BackupContext) {
  await updateAccount(bucket, caller.accountId, (record) => {
    record.tokensValidAfter = Date.now()
  })
}
