import { hashToken } from '../../sync/hashToken'

/** The account's folder in the bucket: everything it owns is under it. */
export const accountPrefix = (accountId: string) => `accounts/${accountId}/`

export const accountRecordKey = (accountId: string) =>
  `${accountPrefix(accountId)}account.json`

export const backupObjectKey = (accountId: string, backupId: string) =>
  `${accountPrefix(accountId)}backups/${backupId}.chb`

/**
 * The account's id in the bucket: HMAC-SHA-256 of its Google `sub` under
 * BACKUP_KEY_SECRET. Stable for the account, never its email, and the
 * bucket alone doesn't reveal which Google account a folder belongs to.
 */
export function accountIdFor(googleSub: string, keySecret: string) {
  return hashToken(`backup-account:${googleSub}`, keySecret)
}
