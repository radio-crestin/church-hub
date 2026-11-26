import {
  hasDatabaseFile,
  openStorage,
  saveToFile,
  useDatabaseFile,
} from './database'
import { joinChurchDatabase } from './joinChurchDatabase'
import type { BootStep, StartMessage } from './protocol'
import { sessionToken } from './sessionToken'
import { loadFixtures, unloadFixtures } from './shims/readFixtureFile'
import { initializeDatabase } from '../../../../../server/src/db'
import { rebuildStaleSearchIndexes } from '../../../../../server/src/db/rebuildStaleSearchIndexes'
import { stopPresentation } from '../../../../../server/src/service/presentation'
import { updateCloudIdentity } from '../../../../../server/src/service/sync/cloud/cloudIdentityStore'
import { startSyncScheduler } from '../../../../../server/src/service/sync/scheduler'
import { setBootReady } from '../../../../../server/src/utils/bootState'

/** The Bibles every database starts with: not synced, the PC's own seed. */
const BIBLE_FIXTURES = ['default-bibles.json', 'default-bible-topics.json']
/** A guest gets the Church Hub dataset a new PC starts with: songs too. */
const GUEST_FIXTURES = [...BIBLE_FIXTURES, 'default-songs.json']

export const churchDatabaseFile = (churchId: string) => `/church-${churchId}.db`

function databaseFile(start: StartMessage): string {
  return start.mode === 'guest'
    ? '/guest.db'
    : churchDatabaseFile(start.church.churchId)
}

/**
 * Starts the server's database in this browser: opens it from OPFS, or on
 * a first start builds it in memory (the seeds, and a joined church's first
 * sync) and saves it to OPFS in one go. A church then syncs on the server's
 * own schedule. Returns whom the page signs in as.
 */
export async function bootBrowserServer(
  start: StartMessage,
  report: (step: BootStep) => void,
): Promise<{ userToken: string; persistent: boolean }> {
  const storage = await openStorage()
  const file = databaseFile(start)

  if (hasDatabaseFile(storage, file)) {
    useDatabaseFile(storage, file)
    await initializeDatabase()
    if (start.mode === 'church') {
      // Joined again with a new link: its token from now on.
      await updateCloudIdentity({
        serverToken: start.church.token,
        deviceId: start.church.deviceId,
      })
    }
  } else {
    useDatabaseFile(storage, null)
    report('download')
    await loadFixtures(start.mode === 'guest' ? GUEST_FIXTURES : BIBLE_FIXTURES)
    report('seed')
    await initializeDatabase()
    unloadFixtures()
    if (start.mode === 'church') {
      report('sync')
      await joinChurchDatabase(start.church)
    }
    report('search')
    rebuildStaleSearchIndexes()
    report('save')
    await saveToFile(storage, file)
  }

  rebuildStaleSearchIndexes()
  stopPresentation()
  if (start.mode === 'church') startSyncScheduler()
  setBootReady()
  return {
    userToken: sessionToken(
      start.mode === 'church' ? start.church.userId : null,
    ),
    persistent: storage.pool !== null,
  }
}
