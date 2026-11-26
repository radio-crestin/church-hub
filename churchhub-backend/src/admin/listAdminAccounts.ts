import { readAccountIndex } from '../backup/account/accountIndex'
import { readAccount } from '../backup/account/accountStore'
import type { BackupSettings } from '../backup/backupSettings'
import type { BackupBucket } from '../backup/storage/createBackupBucket'
import { describeAccount } from './describeAccount'

export const ADMIN_PAGE_SIZE = 25

/**
 * The accounts that signed in, most recent sign-in first, filtered by an
 * email substring; one page, with each account's live usage read from its
 * record.
 */
export async function listAdminAccounts(
  bucket: BackupBucket,
  settings: BackupSettings,
  query: string,
  page: number
) {
  const { index } = await readAccountIndex(bucket)
  const needle = query.trim().toLowerCase()
  const matching = Object.entries(index)
    .filter(([, entry]) => entry.email.toLowerCase().includes(needle))
    .sort(([, a], [, b]) => b.lastSignInAt - a.lastSignInAt)
  const slice = matching.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)
  const accounts = await Promise.all(
    slice.map(async ([accountId]) => {
      const { record } = await readAccount(bucket, accountId)
      return describeAccount(accountId, record, settings.limits)
    })
  )
  return { accounts, total: matching.length, page, pageSize: ADMIN_PAGE_SIZE }
}
