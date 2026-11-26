import type { SecretFeature } from './secretColumns'
import { type SecretEntry, secretEntries } from './secretEntries'
import type { Database } from 'bun:sqlite'
import { createLogger } from '../../../utils/logger'
import { findDataKey } from '../data-key/findDataKey'
import { inspectSecret } from '../inspectSecret'
import { activeKey, knownKey } from '../keyRing'
import { parseSealed } from '../sealedFormat'
import { sealSecret } from '../sealSecret'
import { describePlace } from '../secretPlace'

const logger = createLogger('secret-store')

export interface SealReport {
  /** Values stored in plain text, now sealed. */
  sealed: number
  /** Values sealed with another data key of this computer, now with this one's. */
  rewrapped: number
  /** Features whose secrets came from another computer and were forgotten. */
  forgotten: Set<SecretFeature>
  /** Values kept as they are: their key's store could not be asked. */
  unresolved: string[]
}

/** The ids of the keys `db`'s values are sealed with that this server lacks. */
function unknownKeyIds(db: Database): Set<string> {
  const ids = new Set<string>()
  for (const { stored } of secretEntries(db)) {
    const keyId = parseSealed(stored)?.keyId
    if (keyId && !knownKey(keyId)) ids.add(keyId)
  }
  return ids
}

/** Looks the unknown keys up; returns those that exist nowhere here. */
async function missingKeyIds(db: Database): Promise<Set<string>> {
  const missing = new Set<string>()
  for (const keyId of unknownKeyIds(db)) {
    if ((await findDataKey(keyId)) === 'missing') missing.add(keyId)
  }
  return missing
}

function settle(
  entry: SecretEntry,
  missing: Set<string>,
  forgetUnreadable: boolean,
  report: SealReport,
): void {
  const seen = inspectSecret(entry.stored, entry.place)
  if (seen.state === 'plain') {
    entry.replace(sealSecret(seen.value, entry.place))
    report.sealed++
  } else if (seen.state === 'open' && seen.keyId !== activeKey().id) {
    entry.replace(sealSecret(seen.value, entry.place))
    report.rewrapped++
  } else if (
    seen.state === 'broken' ||
    (seen.state === 'no-key' && missing.has(seen.keyId))
  ) {
    if (forgetUnreadable) entry.forget()
    if (entry.feature) report.forgotten.add(entry.feature)
  } else if (seen.state === 'no-key') {
    report.unresolved.push(describePlace(entry.place))
  }
}

/** Plain text left behind would be a bug: logged by place, never by value. */
function verifyNothingPlain(db: Database): void {
  const plain = [...secretEntries(db)]
    .filter(
      (entry) => inspectSecret(entry.stored, entry.place).state === 'plain',
    )
    .map((entry) => describePlace(entry.place))
  if (plain.length > 0) {
    logger.error(`Secrets still unsealed after sealing: ${plain.join(', ')}`)
  }
}

/**
 * Brings every secret in `db` under the active data key, in one
 * transaction (an interrupted run leaves the database as it was, and the
 * next start does it again): plain text from older versions is sealed, a
 * value sealed with another data folder's key on this computer is sealed
 * again with this one's, and with `forgetUnreadable` a value from another
 * computer is forgotten so its feature asks to be set up again. Values whose
 * key store could not be asked are kept for a later start.
 */
export async function sealStoredSecrets(
  db: Database,
  { forgetUnreadable }: { forgetUnreadable: boolean },
): Promise<SealReport> {
  const missing = await missingKeyIds(db)
  const report: SealReport = {
    sealed: 0,
    rewrapped: 0,
    forgotten: new Set(),
    unresolved: [],
  }
  db.transaction(() => {
    for (const entry of secretEntries(db)) {
      settle(entry, missing, forgetUnreadable, report)
    }
  })()
  verifyNothingPlain(db)
  if (report.unresolved.length > 0) {
    logger.warning(
      `Kept secrets whose data key could not be looked up: ${report.unresolved.join(', ')}`,
    )
  }
  return report
}
