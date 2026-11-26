import { hashToken } from '../../sync/hashToken'

/**
 * The bucket's layout. Three top-level prefixes, so a lifecycle rule can
 * target backups alone:
 * - accounts/<accountId>/account.json   the record (compare-and-swap)
 * - backups/<accountId>/<backupId>/     manifest.chb and user.chb, encrypted;
 *                                       they expire (lifecycle safety net)
 * - blobs/<accountId>/<blobPrefix>/<sha256>  shared resources, plaintext,
 *                                       immutable, kept while referenced
 */
export const accountRecordKey = (accountId: string) =>
  `accounts/${accountId}/account.json`

export const accountBackupsPrefix = (accountId: string) =>
  `backups/${accountId}/`

export const backupPrefix = (accountId: string, backupId: string) =>
  `${accountBackupsPrefix(accountId)}${backupId}/`

export const userPartKey = (accountId: string, backupId: string) =>
  `${backupPrefix(accountId, backupId)}user.chb`

export const manifestKey = (accountId: string, backupId: string) =>
  `${backupPrefix(accountId, backupId)}manifest.chb`

export const accountBlobsPrefix = (accountId: string) => `blobs/${accountId}/`

export const blobKey = (accountId: string, blobPrefix: string, hash: string) =>
  `${accountBlobsPrefix(accountId)}${blobPrefix}/${hash}`

/**
 * The account's id in the bucket: HMAC-SHA-256 of its Google `sub` under
 * BACKUP_KEY_SECRET. Stable for the account, never its email, and the
 * bucket alone doesn't reveal which Google account a folder belongs to.
 */
export function accountIdFor(googleSub: string, keySecret: string) {
  return hashToken(`backup-account:${googleSub}`, keySecret)
}
