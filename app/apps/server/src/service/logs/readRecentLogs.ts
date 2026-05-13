import { existsSync, statSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { join } from 'node:path'

import { getLogsDir } from '../../utils/paths'

/**
 * Reads the tail of today's log files. Used by the feedback flow so we can
 * ship the most recent server + Tauri log lines to PostHog under a report ID
 * without bloating GitHub issues with the full contents.
 *
 * Reads at most `maxBytes` from the end of each file. The default (48 KiB
 * per file) keeps the combined payload comfortably under PostHog's 1 MiB
 * event-property limit while still capturing a meaningful boot window.
 */
const DEFAULT_MAX_BYTES = 48 * 1024

async function tailFile(path: string, maxBytes: number): Promise<string> {
  if (!existsSync(path)) return ''
  const stat = statSync(path)
  const start = Math.max(0, stat.size - maxBytes)
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(stat.size - start)
    await fh.read(buf, 0, buf.length, start)
    return buf.toString('utf-8')
  } finally {
    await fh.close()
  }
}

export interface RecentLogs {
  serverTail: string
  tauriTail: string
  logsDir: string
}

export async function readRecentLogs(
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<RecentLogs> {
  const dir = getLogsDir()
  const today = new Date().toISOString().split('T')[0]
  const [serverTail, tauriTail] = await Promise.all([
    tailFile(join(dir, `server-${today}.log`), maxBytes),
    tailFile(join(dir, `tauri-${today}.log`), maxBytes),
  ])
  return { serverTail, tauriTail, logsDir: dir }
}
