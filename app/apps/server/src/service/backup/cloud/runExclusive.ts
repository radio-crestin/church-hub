import { CloudBackupError } from './CloudBackupError'

let running = false

/** One cloud backup or restore at a time; another meanwhile is `busy`. */
export async function runExclusive<T>(work: () => Promise<T>): Promise<T> {
  if (running) throw new CloudBackupError('busy', 409)
  running = true
  try {
    return await work()
  } finally {
    running = false
  }
}
