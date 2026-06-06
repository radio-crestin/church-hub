import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { getLogsDir } from '../../utils/paths'

export interface ClearLogsResult {
  /** How many `.log` files were emptied. */
  cleared: number
  logsDir: string
}

/**
 * Empties every `.log` file in the logs directory (server + tauri daily logs).
 *
 * Files are TRUNCATED rather than deleted: the file logger appends with
 * `appendFileSync` (no held handle) so truncation is race-safe, keeps today's
 * file path valid for continued logging, and avoids the cross-platform
 * unlink-while-open hazards (e.g. the Tauri side keeps its daily log open on
 * Windows). A file that is momentarily locked is skipped rather than failing
 * the whole operation.
 */
export function clearLogs(): ClearLogsResult {
  const dir = getLogsDir()
  if (!existsSync(dir)) {
    return { cleared: 0, logsDir: dir }
  }

  const files = readdirSync(dir).filter((name) => name.endsWith('.log'))
  let cleared = 0
  for (const name of files) {
    try {
      writeFileSync(join(dir, name), '')
      cleared++
    } catch {
      // Skip files that can't be truncated right now (e.g. a transient lock).
    }
  }

  return { cleared, logsDir: dir }
}
