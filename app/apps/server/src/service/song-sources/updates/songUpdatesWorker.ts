/**
 * The song updates' worker thread: downloading, reading and comparing
 * thousands of songs is CPU and SQLite work that would otherwise hold up the
 * server's main thread, and so every request the app makes meanwhile.
 * A separate entrypoint of the compiled sidecar (scripts/compile.ts).
 */
import { runSongUpdates } from './runSongUpdates'
import type { SongUpdatesRun } from './types'
import { connectDatabase } from '../../../db'

declare const self: Worker

let connected = false

self.onmessage = async (event: MessageEvent<SongUpdatesRun>) => {
  if (!connected) {
    connectDatabase()
    connected = true
  }
  try {
    const imported = await runSongUpdates(event.data)
    self.postMessage({ type: 'done', imported })
  } catch (error) {
    self.postMessage({ type: 'failed', error: String(error) })
  }
}
