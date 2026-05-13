import { existsSync, statSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { join } from 'node:path'

import { getLogsDir } from '../../utils/paths'

/**
 * Reads the tail of the last `daysBack` days of log files. Used by the
 * feedback flow so we can ship recent server + Tauri logs to PostHog
 * under a report ID without bloating GitHub issues.
 *
 * Per-file cap of `maxBytes` (default 32 KiB) × 7 days × 2 streams =
 * ~448 KiB worst case, comfortably under PostHog's 1 MiB
 * event-property limit.
 */
const DEFAULT_MAX_BYTES = 32 * 1024
const DEFAULT_DAYS_BACK = 7

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

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0] as string
}

async function readMultiDayTail(
  dir: string,
  filePrefix: 'server' | 'tauri',
  daysBack: number,
  maxBytes: number,
): Promise<string> {
  const today = new Date()
  const parts: string[] = []
  // Walk oldest → newest so the freshest log lines land at the end of
  // the concatenated tail — the maintainer scans bottom-up.
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const date = isoDate(d)
    const tail = await tailFile(join(dir, `${filePrefix}-${date}.log`), maxBytes)
    if (tail) {
      parts.push(`=== ${filePrefix} ${date} ===\n${tail}`)
    }
  }
  return parts.join('\n\n')
}

export interface RecentLogs {
  serverTail: string
  tauriTail: string
  logsDir: string
}

export async function readRecentLogs(
  maxBytes = DEFAULT_MAX_BYTES,
  daysBack = DEFAULT_DAYS_BACK,
): Promise<RecentLogs> {
  const dir = getLogsDir()
  const [serverTail, tauriTail] = await Promise.all([
    readMultiDayTail(dir, 'server', daysBack, maxBytes),
    readMultiDayTail(dir, 'tauri', daysBack, maxBytes),
  ])
  return { serverTail, tauriTail, logsDir: dir }
}
